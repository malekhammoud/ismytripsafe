require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const http=require('../lib/nightlife/http.ts')
const request=http.fetchJson
http.fetchJson=(url,options,policy)=>request(url,options,{...policy,sleep:async()=>{}})
const {lookupCity}=require('../lib/nightlife/wikidata.ts')
const {SourceHttpError,sourceFailure}=require('../lib/nightlife/source-errors.ts')
const {sourceStatus}=require('../lib/nightlife/source-status.ts')
const claim=value=>({mainsnak:{datavalue:{value}}})
const seed={key:'ge_tbilisi',city:'Tbilisi',country:'Georgia',countryCode:'GE',lat:41.72,lon:44.79}
const city={id:'Q994',labels:{en:{value:'Tbilisi'}},claims:{P31:[claim({id:'Q515'})],P17:[claim({id:'Q230'})],P625:[claim({latitude:41.69,longitude:44.8})],P402:[claim('1996871')]}}
const country={id:'Q230',claims:{P297:[claim('GE')]}}
async function mockFetch(fetcher,run) {const before=global.fetch;global.fetch=fetcher;try{return await run()}finally{global.fetch=before}}
function responseFor(url,entity=city) {
  if(url.hostname==='en.wikipedia.org') return Response.json({type:'standard',wikibase_item:entity.id,coordinates:{lat:41.69,lon:44.8}})
  if(url.pathname.endsWith('/Q230.json')||url.searchParams.get('ids')==='Q230')return Response.json({entities:{Q230:country}})
  if(url.pathname.includes('EntityData'))return Response.json({entities:{[entity.id]:entity}})
  if(url.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:entity.id}]})
  return Response.json({entities:{[entity.id]:entity}})
}

test('visitor requests omit maxlag; batch requests retain it on every Action API read',async()=>{
  for(const interactive of [true,false]) {
    const calls=[]
    await mockFetch(async input=>{const url=new URL(input);calls.push(url);return responseFor(url)},async()=>assert.equal((await lookupCity(seed,interactive)).wikidataId,'Q994'))
    assert.equal(calls.length,3)
    for(const url of calls)assert.equal(url.searchParams.get('maxlag'),interactive?null:'5')
  }
})
test('a search or entity service outage recovers through Wikipedia and verified linked data',async()=>{
  for(const failedAction of ['wbsearchentities','wbgetentities']) {
    const calls=[]
    await mockFetch(async input=>{const url=new URL(input);calls.push(url);return url.searchParams.get('action')===failedAction?new Response('',{status:503}):responseFor(url)},async()=>{
      const found=await lookupCity(seed,true)
      assert.equal(found.wikidataId,'Q994');assert.equal(found.relationId,1996871);assert.equal(found.resolutionMethod,'linked-data')
      assert.equal(found.population,null,'A Wikipedia summary must never invent population')
    })
    assert.equal(calls.filter(u=>u.hostname==='en.wikipedia.org').length,1)
    assert.equal(calls.filter(u=>u.pathname.includes('EntityData')).length,2)
  }
})
test('a city without its own boundary reuses a verified municipality relation',async()=>{
 const joburg={key:'za_johannesburg',city:'Johannesburg',country:'South Africa',countryCode:'ZA',countrySlug:'south-africa',citySlug:'johannesburg',lat:-26.204,lon:28.042}
 const cityNoBoundary={id:'Q34647',labels:{en:{value:'Johannesburg'}},claims:{P31:[claim({id:'Q515'})],P17:[claim({id:'Q258'})],P625:[claim({latitude:-26.204,longitude:28.042})],P131:[claim({id:'Q2346838'})]}}
 const parent={id:'Q2346838',labels:{en:{value:'City of Johannesburg Metropolitan Municipality'}},claims:{P31:[claim({id:'Q1530824'})],P402:[claim('594508')]}}
 const countryZA={id:'Q258',claims:{P297:[claim('ZA')]}}
 await mockFetch(async input=>{
  const url=new URL(input)
  if(url.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q34647'}]})
  if(url.searchParams.get('ids')==='Q2346838')return Response.json({entities:{Q2346838:parent}})
  if(url.searchParams.get('ids')==='Q258')return Response.json({entities:{Q258:countryZA}})
  return Response.json({entities:{Q34647:cityNoBoundary}})
 },async()=>{const found=await lookupCity(joburg,true);assert.equal(found.wikidataId,'Q34647');assert.equal(found.relationId,594508)})
})
test('a country-specific municipality parent supplies Stockholm its boundary',async()=>{
 const stockholm={key:'se_stockholm',city:'Stockholm',country:'Sweden',countryCode:'SE',countrySlug:'sweden',citySlug:'stockholm',lat:59.3293,lon:18.0686}
 const cityNoBoundary={id:'Q1754',labels:{en:{value:'Stockholm'}},claims:{P31:[claim({id:'Q515'})],P17:[claim({id:'Q34'})],P625:[claim({latitude:59.3293,longitude:18.0686})],P131:[claim({id:'Q506250'})]}}
 const parent={id:'Q506250',labels:{en:{value:'Stockholm Municipality'}},claims:{P31:[claim({id:'Q127448'})],P402:[claim('398021')]}}
 const sweden={id:'Q34',claims:{P297:[claim('SE')]}}
 await mockFetch(async input=>{
  const url=new URL(input)
  if(url.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q1754'}]})
  if(url.searchParams.get('ids')==='Q506250')return Response.json({entities:{Q506250:parent}})
  if(url.searchParams.get('ids')==='Q34')return Response.json({entities:{Q34:sweden}})
  return Response.json({entities:{Q1754:cityNoBoundary}})
 },async()=>{const found=await lookupCity(stockholm,true);assert.equal(found.wikidataId,'Q1754');assert.equal(found.relationId,398021)})
})
test('a same-name municipality parent supplies Seville a boundary',async()=>{
 const seville={key:'es_seville',city:'Seville',country:'Spain',countryCode:'ES',countrySlug:'spain',citySlug:'seville',lat:37.3828,lon:-5.9731}
 const cityNoBoundary={id:'Q55893348',labels:{en:{value:'Seville city'}},aliases:{en:[{value:'Seville'}]},claims:{P31:[claim({id:'Q515'})],P17:[claim({id:'Q29'})],P625:[claim({latitude:37.3828,longitude:-5.9731})],P131:[claim({id:'Q8717'})]}}
 const parent={id:'Q8717',labels:{en:{value:'Seville'}},claims:{P31:[claim({id:'Q2074737'})],P402:[claim('342563')],P1082:[{mainsnak:{datavalue:{value:{amount:'+700169'}}},qualifiers:{P585:[{datavalue:{value:{time:'+2013-01-01T00:00:00Z',precision:11}}}]}}]}}
 const spain={id:'Q29',claims:{P297:[claim('ES')]}}
 await mockFetch(async input=>{
  const url=new URL(input)
  if(url.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q55893348'}]})
  if(url.searchParams.get('ids')==='Q8717')return Response.json({entities:{Q8717:parent}})
  if(url.searchParams.get('ids')==='Q29')return Response.json({entities:{Q29:spain}})
  return Response.json({entities:{Q55893348:cityNoBoundary}})
 },async()=>{const found=await lookupCity(seville,true);assert.equal(found.wikidataId,'Q55893348');assert.equal(found.relationId,342563);assert.equal(found.population,700169)})
})
test('the fallback rejects a wrong country even when Wikipedia coordinates are nearby',async()=>{
  const wrong={...city,claims:{...city.claims,P17:[claim({id:'Q99'})]}}
  await mockFetch(async input=>{
    const url=new URL(input)
    if(url.pathname==='/w/api.php')return new Response('',{status:503})
    if(url.pathname.endsWith('/Q99.json'))return Response.json({entities:{Q99:{id:'Q99',claims:{P297:[claim('US')]}}}})
    return responseFor(url,wrong)
  },async()=>assert.rejects(()=>lookupCity(seed,true),error=>error instanceof SourceHttpError&&error.status===503))
})
test('the fallback cannot accept a station with the city name',async()=>{
  const station={...city,claims:{...city.claims,P31:[claim({id:'Q55488'})]}}
  await mockFetch(async input=>{
    const url=new URL(input)
    if(url.pathname==='/w/api.php')return new Response('',{status:503})
    if(url.pathname.endsWith('/Q55488.json'))return Response.json({entities:{Q55488:{id:'Q55488',claims:{}}}})
    return responseFor(url,station)
  },async()=>assert.rejects(()=>lookupCity(seed,true),SourceHttpError))
})
test('rate limits, access denials and maxlag never trigger an alternate interface',async()=>{
  for(const [status,code,retry] of [[403,null,null],[429,null,'120'],[503,'maxlag','120'],[200,'maxlag','120'],[503,null,'120']]) {
    let calls=0
    await mockFetch(async input=>{
      const url=new URL(input);assert.equal(url.pathname,'/w/api.php');calls++
      return Response.json(code?{error:{code}}:{},{status,headers:retry?{'Retry-After':retry}:{}})
    },async()=>assert.rejects(()=>lookupCity(seed,true),error=>error instanceof SourceHttpError&&error.status===status))
    assert.equal(calls,1)
  }
})
test('HTTP 503 retains its API code, operation and requested cooldown without storing body text',async()=>{
  const error=await request('https://example.com',{}, {operation:'Wikidata search',fetch:async()=>Response.json({error:{code:'maxlag',info:'sensitive internal details'}},{status:503,headers:{'Retry-After':'1800'}}),sleep:async()=>assert.fail('Must wait for a later job')}).catch(e=>e)
  assert.ok(error instanceof SourceHttpError);assert.equal(error.status,503);assert.equal(error.code,'maxlag')
  const failure=sourceFailure(error)
  assert.equal(failure.kind,'busy');assert.equal(failure.operation,'Wikidata search');assert.ok(Date.parse(failure.retryAt)>Date.now()+1799000)
  assert.ok(!JSON.stringify(failure).includes('sensitive'));assert.ok(!error.message.includes('sensitive'))
  assert.match(sourceStatus({sourceFailures:[{name:'Wikidata',...failure}]}),/asked us to wait/)
})
test('HTTP 200 maxlag preserves its real status and Retry-After instead of becoming a fictional 503',async()=>{
  let calls=0
  const error=await request('https://example.com',{}, {fetch:async()=>{calls++;return Response.json({error:{code:'maxlag'}},{headers:{'Retry-After':'90'}})},sleep:async()=>assert.fail('Long cooldown')}).catch(e=>e)
  assert.equal(error.status,200);assert.equal(error.code,'maxlag');assert.equal(error.retryAfter,90);assert.equal(calls,1)
})
test('HTML and oversized error bodies are discarded; a real 503 is described accurately',async()=>{
  for(const response of [new Response('private upstream HTML',{status:503}),new Response(JSON.stringify({error:{code:'maxlag',info:'x'.repeat(10000)}}),{status:503,headers:{'Content-Type':'application/json'}})]) {
    const error=await request('https://example.com',{}, {fetch:async()=>response.clone(),sleep:async()=>{}}).catch(e=>e)
    assert.equal(error.code,undefined);assert.equal(error.status,503)
    assert.equal(sourceStatus({sourceFailures:[{name:'Wikidata',...sourceFailure(error)}]}),'Wikidata is temporarily unavailable (HTTP 503).')
  }
})
