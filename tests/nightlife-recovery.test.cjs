require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {promises:fs}=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const {selectCity,latestPopulation,RESOLUTION_VERSION}=require('../lib/nightlife/city-resolution.ts')
const {fetchJson}=require('../lib/nightlife/http.ts')
const {watchNightlife}=require('../lib/nightlife/watch.ts')
const {SourceHttpError}=require('../lib/nightlife/source-errors.ts')
const claim=(value,rank='normal')=>({rank,mainsnak:{datavalue:{value}}})
const population=(amount,time,precision)=>({...claim({amount:'+'+amount}),qualifiers:{P585:[{datavalue:{value:{time,precision}}}]}})
const seed={key:'ge_tbilisi',city:'Tbilisi',countryCode:'GE',lat:41.72,lon:44.79}
const countries={Q230:{id:'Q230',claims:{P297:[claim('GE')]}}}
const entity=(id,label,kind,lat=41.69)=>({id,labels:{en:{value:label}},claims:{P31:[claim({id:kind})],P17:[claim({id:'Q230'})],P625:[claim({latitude:lat,longitude:44.8})]}})

test('Tbilisi resolves to the city, never the closer station with a Tbilisi alias',()=>{
  // Regression for the actual live failure: Q1341835 is Tbilisi Central
  // Station, Q994 is the city (https://www.wikidata.org/wiki/Q994).
  const station=entity('Q1341835','Tbilisi Central Station','Q55488',41.7233)
  station.aliases={en:[{value:'Tbilisi'}]}
  const city=entity('Q994','Tbilisi','Q515')
  city.claims.P402=[claim('1996871')]
  city.claims.P1082=[population(1000000,'+2025-00-00T00:00:00Z',9)] // fixture population
  const match=selectCity(seed,[station,city],countries,{})
  assert.equal(match.wikidataId,'Q994');assert.equal(match.relationId,1996871)
  assert.equal(match.populationDate,'2025');assert.equal(match.resolutionVersion,RESOLUTION_VERSION)
})
test('same-name landmarks and cities in a different country are rejected',()=>{
  assert.equal(selectCity(seed,[entity('Q1','Tbilisi','Q55488')],countries,{}),null)
  assert.equal(selectCity({...seed,countryCode:'US'},[entity('Q994','Tbilisi','Q515')],countries,{}),null)
  assert.equal(selectCity({...seed,lat:NaN},[entity('Q994','Tbilisi','Q515')],countries,{}),null)
})
test('country-specific settlement subclasses work; cyclic classifications terminate',()=>{
  const city=entity('Q994','Tbilisi','Q100')
  const classes={Q100:{id:'Q100',claims:{P279:[claim({id:'Q515'})]}}}
  assert.equal(selectCity(seed,[city],countries,classes).wikidataId,'Q994')
  classes.Q100.claims.P279=[claim({id:'Q100'})]
  assert.equal(selectCity(seed,[city],countries,classes),null)
})
test('population accepts year and month precision without inventing a day',()=>{
  assert.deepEqual(latestPopulation([population(1200,'+2024-00-00T00:00:00Z',9)]),{population:1200,date:'2024'})
  assert.deepEqual(latestPopulation([population(1300,'+2025-03-00T00:00:00Z',10)]),{population:1300,date:'2025-03'})
  assert.equal(latestPopulation([population(1300,'+2025-02-31T00:00:00Z',11)]),null)
  const partial=population(400,'+2026-01-01T00:00:00Z',11);partial.qualifiers.P518=[{datavalue:{value:{id:'Q1'}}}]
  assert.equal(latestPopulation([partial]),null)
})
test('transient upstream errors retry once and preserve caller headers',async()=>{
  let calls=0;const waits=[]
  const result=await fetchJson('https://example.com', {headers:{Authorization:'fixture'}}, {fetch:async(_url,options)=>{
    calls++;assert.equal(options.headers.get('Authorization'),'fixture')
    return calls===1?new Response('',{status:503,headers:{'Retry-After':'4'}}):Response.json({ok:true})
  },sleep:async ms=>waits.push(ms)})
  assert.deepEqual(result,{ok:true});assert.equal(calls,2);assert.deepEqual(waits,[4000])
})
test('authentication failures and long rate limits are never hammered',async()=>{
  for(const status of [401,403,429]) {
    let calls=0
    await assert.rejects(()=>fetchJson('https://example.com',{}, {fetch:async()=>{calls++;return new Response('',{status,headers:{'Retry-After':'120'}})},sleep:async()=>assert.fail('Must respect cooldown')}),SourceHttpError)
    assert.equal(calls,1)
  }
})
test('MediaWiki maxlag in an HTTP 200 document is retried rather than cached',async()=>{
  let calls=0
  const result=await fetchJson('https://example.com',{}, {fetch:async()=>Response.json(++calls===1?{error:{code:'maxlag'}}:{search:[]}),sleep:async()=>{}})
  assert.deepEqual(result,{search:[]});assert.equal(calls,2)
})
test('old station cache is invalidated before resolving or serving fallback data',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'nightlife-resolution-'))
  process.env.NIGHTLIFE_CACHE_DIR=root
  const {resolveCity}=require('../lib/nightlife/sources.ts')
  await fs.mkdir(path.join(root,'raw',seed.key),{recursive:true})
  await fs.writeFile(path.join(root,'raw',seed.key,'wikidata.json'),JSON.stringify({fetchedAt:new Date().toISOString(),data:{...seed,wikidataId:'Q1341835'}}))
  const before=global.fetch
  global.fetch=async input=>{
    const url=new URL(String(input))
    if(url.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q994'}]})
    if(url.searchParams.get('ids')==='Q230')return Response.json({entities:countries})
    return Response.json({entities:{Q994:entity('Q994','Tbilisi','Q515')}})
  }
  try {const result=await resolveCity(seed);assert.equal(result.data.wikidataId,'Q994');assert.ok(JSON.parse(await fs.readFile(path.join(root,'raw',seed.key,'wikidata.json'))).identity)}
  finally {global.fetch=before}
})
const progress=(state,more={})=>Response.json({state,available:state==='ready',...more})
async function watch(responses,mode='page') {
  const methods=[],statuses=[],sleeps=[];let refreshed=0,slow=0,now=0
  await watchNightlife({endpoint:'/api/nightlife/test/city',mode,signal:new AbortController().signal,
    fetcher:async(_url,options)=>{methods.push(options.method);const response=responses.shift();if(response instanceof Error)throw response;if(!response)throw new Error('No response');return response},
    sleep:async ms=>{sleeps.push(ms);now+=ms},now:()=>now,onStatus:s=>statuses.push(s),onReport:()=>refreshed++,onSlow:()=>slow++})
  return {methods,statuses,sleeps,refreshed,slow}
}
test('lost POST response reconnects to the existing job before refreshing once',async()=>{
  const r=await watch([new Error('Offline'),progress('running'),progress('ready')])
  assert.deepEqual(r.methods,['POST','GET','GET']);assert.equal(r.refreshed,1);assert.equal(r.statuses.some(s=>s.state==='failed'),false)
})
test('fresh saved pages never cause a refresh loop',async()=>{assert.equal((await watch([progress('ready')],'refresh')).refreshed,0)})
test('outage retries wait for the actual server cooldown before starting work',async()=>{
  const r=await watch([progress('failed',{retryAfter:60,issue:'sources'}),progress('running'),progress('ready')])
  assert.equal(r.sleeps[0],60000);assert.deepEqual(r.methods,['POST','POST','GET']);assert.equal(r.refreshed,1)
})
test('network exhaustion reports connection trouble rather than a source failure',async()=>{
  const r=await watch(Array.from({length:4},()=>new Error('Offline')))
  assert.equal(r.statuses.at(-1).issue,'connection');assert.equal(r.refreshed,0)
})
test('navigation cancellation cannot update the departed page',async()=>{
  const controller=new AbortController()
  await watchNightlife({endpoint:'/api/nightlife/test/city',mode:'page',signal:controller.signal,fetcher:async()=>{controller.abort();return progress('ready')},onStatus:()=>assert.fail('Stale update'),onReport:()=>assert.fail('Stale refresh'),onSlow:()=>{}})
})
