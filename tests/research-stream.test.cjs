require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const Module=require('node:module')
const geo={city:'City',country:'Example',countryCode:'XX',lat:10,lon:20}
const cached={geo,images:{hero:null,gallery:[]},bundle:{safety:{signals:[{key:'numbeo_safety_night'}]}},enrichment:{verdict:'Fixture'},prose:'Fixture report',cachedAt:'2026-10-01'}
let read=async()=>cached,write=async()=>{},modelError=false,writes=0
const scheduled=[]
const stubs={
 'next/server':{after:fn=>scheduled.push(fn)},
 '@/lib/agent':{collectResearch:async()=>({headlines:[],extracts:[]}),runSafetyAgent:async function*(){yield{type:'enrichment',data:{verdict:'Fixture'}};yield modelError?{type:'error',message:'Model interrupted'}:{type:'done'}},generateMapZones:async()=>null},
 '@/lib/timing':{timeLog:()=>{}},
 '@/lib/data':{gatherSafety:async()=>structuredClone({...cached.bundle,images:cached.images})},
 '@/lib/data/wikivoyage':{getWikivoyageSafety:async()=>null},
 '@/lib/cache':{cacheKey:()=> 'xx_city',readCache:()=>read(),readStale:async()=>null,writeCache:async()=>{writes++;await write()}},
 '@/lib/reports':{pathForGeo:()=>'/example/city'},
 '@/lib/seo/indexnow':{pingIndexNow:()=>{}},
 '@/lib/scoring':{attachResearchSignals:s=>s,computeSafetyIndex:()=>({index:70,level:'SAFE'})},
}
const load=Module._load
Module._load=function(name,...rest){return stubs[name]??load.call(this,name,...rest)}
const {POST}=require('../app/api/research/route.ts')
Module._load=load
const request=()=>new Request('http://localhost/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({place:'City, Example',placeGeo:geo})})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
test('a cancelled browser stream tolerates the pending cache read completing',async()=>{
 let release;read=()=>new Promise(resolve=>{release=resolve})
 const response=await POST(request());await response.body.cancel();release(cached);await tick()
 assert.equal(writes,0)
})
test('completion and the permanent link wait until the report is persisted',async()=>{
 read=async()=>null;let release;write=()=>new Promise(resolve=>{release=resolve})
 const response=await POST(request());let text=''
 const drain=(async()=>{for await(const chunk of response.body)text+=new TextDecoder().decode(chunk)})()
 await tick();assert.equal(typeof release,'function');assert.doesNotMatch(text,/"type":"done"/)
 release();await drain;assert.match(text,/"type":"done"/);assert.match(text,/\/example\/city/)
})
test('failed persistence never announces a completed report or working link',async()=>{
 write=async()=>{throw new Error('Fixture write failure')}
 const text=await (await POST(request())).text()
 assert.match(text,/Fixture write failure/);assert.match(text,/"type":"error"/);assert.doesNotMatch(text,/"type":"done"/)
})
test('an interrupted model cannot save a partial enrichment as a finished report',async()=>{
 modelError=true;const before=writes
 const text=await (await POST(request())).text()
 assert.equal(writes,before);assert.match(text,/Model interrupted/);assert.doesNotMatch(text,/"type":"done"/)
})
test('an interrupted background refresh preserves the existing cached report',async()=>{
 read=async()=>({...cached,bundle:{safety:{signals:[]}}});modelError=true;const before=writes
 const response=await POST(request());assert.match(await response.text(),/"cached":true/)
 await scheduled.at(-1)();assert.equal(writes,before)
})
