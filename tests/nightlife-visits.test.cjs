require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {promises:fs}=require('node:fs')
const path=require('node:path')
const os=require('node:os')
const {createVisitJobs,needsNightlifeRefresh}=require('../lib/nightlife/visits.ts')
const {FORMULA_VERSION}=require('../lib/nightlife/scoring.ts')
const DAY=86400000
const hit=(key='xx_test')=>({meta:{key,city:'Test City',country:'Example',countryCode:'XX',countrySlug:'example',citySlug:key,safetyPath:'/example/'+key,path:'/example/'+key,lat:42,lon:10},report:{key}})
const report=(now,overrides={})=>({version:1,formulaVersion:FORMULA_VERSION,city:{key:'xx_test'},updatedAt:new Date(now).toISOString(),outcome:'limited',sources:[],venues:Array(12).fill({}),refresh:{venues:new Date(now).toISOString(),population:new Date(now).toISOString(),events:'',beer:''},...overrides})
async function setup(overrides={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nightlife-visits-'))
 let now=Date.now(),calls=0,stored=null
 const deps={directory,now:()=>now,read:async()=>stored,limit:10,build:async(_seed,_safety,{onProgress})=>{calls++;await onProgress?.('venues');stored=report(now);return stored},...overrides}
 const jobs=createVisitJobs(deps)
 return{directory,deps,jobs,calls:()=>calls,stored:()=>stored,setStored:r=>stored=r,advance:ms=>now+=ms,now:()=>now}
}
test('cold visit claims work without blocking on the actual build',async()=>{
 const x=await setup(),job=await x.jobs.prepare(hit());assert.equal(job.status.state,'running');assert.equal(x.calls(),0);assert.equal((await x.jobs.inspect('xx_test')).phase,'resolve');await job.run();assert.equal(x.calls(),1);assert.equal((await x.jobs.inspect('xx_test')).state,'ready')
})
test('concurrent visitors and separate process instances share a single job',async()=>{
 const x=await setup(),other=createVisitJobs(x.deps)
 const results=await Promise.all(Array.from({length:12},(_,i)=>(i%2?x.jobs:other).prepare(hit())))
 assert.equal(results.filter(r=>r.run).length,1);await results.find(r=>r.run).run();assert.equal(x.calls(),1)
})
test('the same after-response callback cannot execute twice',async()=>{const x=await setup(),job=await x.jobs.prepare(hit());await Promise.all([job.run(),job.run()]);assert.equal(x.calls(),1)})
test('fresh reports cost no new API job',async()=>{const x=await setup();x.setStored(report(x.now()));const job=await x.jobs.prepare(hit());assert.equal(job.status.state,'ready');assert.equal(job.run,undefined);assert.equal(x.calls(),0)})
test('a stale report stays available throughout its refresh',async()=>{const x=await setup();x.setStored(report(x.now()-31*DAY));const job=await x.jobs.prepare(hit());assert.equal(job.status.state,'running');assert.equal(job.status.available,true);await job.run();assert.equal((await x.jobs.inspect('xx_test')).state,'ready')})
test('failures have a persistent retry cooldown and retain cached reports',async()=>{
 const x=await setup({build:async()=>{throw new Error('Simulated source outage')}});x.setStored(report(x.now()-31*DAY));const job=await x.jobs.prepare(hit());await job.run();const state=await x.jobs.inspect('xx_test');assert.equal(state.state,'failed');assert.equal(state.available,true);assert.ok(state.retryAfter>0);assert.equal((await x.jobs.prepare(hit())).run,undefined);x.advance(11*60000);assert.ok((await x.jobs.prepare(hit())).run)
})
test('thin evidence is unavailable rather than assigned invented stars',async()=>{
 const x=await setup({build:async()=>report(Date.now(),{outcome:'withheld'})});const job=await x.jobs.prepare(hit());await job.run();const state=await x.jobs.inspect('xx_test');assert.equal(state.state,'unavailable');assert.equal(state.available,false);assert.ok(state.retryAfter>86000);assert.equal((await x.jobs.prepare(hit())).run,undefined)
})
test('source errors use the short outage cooldown instead of a full thin-data day',async()=>{
 const x=await setup({build:async()=>report(Date.now(),{outcome:'withheld',sources:[{id:'osm',status:'error'}]})});const job=await x.jobs.prepare(hit());await job.run();const state=await x.jobs.inspect('xx_test');assert.equal(state.state,'failed');assert.ok(state.retryAfter<=600)
})
test('a global slot prevents simultaneous builds for different cities',async()=>{const x=await setup();const first=await x.jobs.prepare(hit());const second=await x.jobs.prepare(hit('xx_other'));assert.equal(second.status.state,'busy');assert.equal(second.run,undefined);await first.run()})
test('daily budgets survive new coordinator instances and never block cached pages',async()=>{
 const x=await setup({limit:1});const first=await x.jobs.prepare(hit());await first.run();x.setStored(null);const other=createVisitJobs(x.deps);const blocked=await other.prepare(hit('xx_other'));assert.equal(blocked.status.state,'deferred');assert.equal(blocked.run,undefined);x.setStored(report(x.now()));assert.equal((await other.prepare(hit('xx_fresh'))).status.state,'ready')
})
test('abandoned jobs can recover after their lease expires',async()=>{
 const x=await setup(),first=await x.jobs.prepare(hit());const stale=new Date(x.now()-16*60000);await fs.utimes(path.join(x.directory,'jobs','research.lock'),stale,stale);const file=path.join(x.directory,'jobs','xx_test.json');await fs.writeFile(file,JSON.stringify({state:'running',updatedAt:stale.toISOString()}));const retry=await x.jobs.prepare(hit());assert.ok(retry.run);await retry.run();assert.equal(x.calls(),1);assert.ok(first.run)
})
test('events are refreshed weekly only when that optional source is connected',()=>{
 const old=process.env.TICKETMASTER_API_KEY;delete process.env.TICKETMASTER_API_KEY
 const now=Date.now(),r=report(now,{refresh:{venues:new Date(now).toISOString(),population:new Date(now).toISOString(),events:new Date(now-8*DAY).toISOString(),beer:''}})
 try{assert.equal(needsNightlifeRefresh(r,now),false);process.env.TICKETMASTER_API_KEY='fixture';assert.equal(needsNightlifeRefresh(r,now),true)}finally{if(old===undefined)delete process.env.TICKETMASTER_API_KEY;else process.env.TICKETMASTER_API_KEY=old}
})
test('failed sources and formula changes request another check even with recent venues',()=>{const now=Date.now();assert.equal(needsNightlifeRefresh(report(now,{sources:[{status:'error'}]}),now),true);assert.equal(needsNightlifeRefresh(report(now,{formulaVersion:'old'}),now),true)})
test('job paths reject traversal',async()=>{const x=await setup();await assert.rejects(()=>x.jobs.inspect('../secret'),/Invalid city key/)})
