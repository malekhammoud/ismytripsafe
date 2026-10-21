const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const script=fs.readFileSync(require.resolve('../scripts/check-nightlife.cjs'),'utf8')
async function check({origin='https://beta.ismytripsafe.com',pipeline='fixture-version',status,generate=true}={}) {
 const calls=[],messages=[],process={argv:['node','check',...(generate?['--generate']:[]),'germany/berlin'],env:{NIGHTLIFE_SMOKE_ORIGIN:origin},exitCode:0}
 const meta='<meta name="robots" content="noindex, nofollow">'
 const sections=['the-stars','venues','hotspots','late','travelers','night-safety','sources'].map(id=>`<div id="${id}"></div>`).join('')
 let posts=0,polls=0
 const context={process,URL,AbortSignal,Date,console:{log:message=>messages.push(message),error:message=>messages.push(message)},require:name=>{
  if(name==='node:timers/promises')return {setTimeout:async()=>{}}
  if(name==='./typescript-worker.cjs')return {}
  if(name==='../lib/nightlife/version.ts')return {PIPELINE_VERSION:'fixture-version'}
  throw new Error('Unexpected require '+name)
 },fetch:async(input,options={})=>{
  const url=new URL(input),method=options.method||'GET';calls.push({path:url.pathname,method})
  if(url.pathname.startsWith('/api/nightlife/')){
   if(method==='POST'){posts++;return Response.json(status||{state:'running',available:false})}
   polls++;return Response.json({state:posts?'ready':'idle',available:!!posts},{headers:{'X-Nightlife-Pipeline':pipeline}})
  }
  if(url.pathname==='/nightlife')return new Response(meta+'nightlife-city-search')
  if(url.pathname==='/not-a-real-country/not-a-real-city/nightlife')return new Response('',{status:404})
  if(url.pathname==='/germany/berlin/nightlife')return new Response(meta+sections)
  if(url.pathname==='/germany/berlin/nightlife/data.json')return Response.json({licence:'ODbL 1.0',venues:[{id:'osm-node-1'}]})
  if(url.pathname==='/germany/berlin')return new Response('/germany/berlin/nightlife')
  throw new Error('Unexpected URL '+url.pathname)
 }}
 await vm.runInNewContext(script,context)
 return {calls,messages,process,posts,polls}
}
test('live verification generates through the API and verifies the published report',async()=>{
 const r=await check();assert.equal(r.process.exitCode,0);assert.equal(r.posts,1);assert.equal(r.polls,2);assert.ok(r.calls.some(c=>c.path.endsWith('/data.json')));assert.match(r.messages.at(-1),/^PASS/)
})
test('a failed refresh serving an old saved report cannot pass the live check',async()=>{
 const r=await check({status:{state:'ready',available:true,issue:'sources'}})
 assert.equal(r.process.exitCode,1);assert.match(r.messages.at(-1),/fresh research failed/)
})
test('the live check rejects old deployments and refuses generation on production',async()=>{
 const old=await check({pipeline:'old'});assert.equal(old.process.exitCode,1);assert.equal(old.posts,0)
 const prod=await check({origin:'https://ismytripsafe.com'});assert.equal(prod.process.exitCode,1);assert.equal(prod.calls.length,0)
})
test('ordinary smoke checks remain read-only',async()=>{
 const r=await check({generate:false});assert.equal(r.process.exitCode,0);assert.equal(r.posts,0);assert.equal(r.polls,0)
})
