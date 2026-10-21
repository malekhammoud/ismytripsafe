require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createOverpassClient,boundaryQuery,venueQuery,verifiedArea,verifiedVenues,usesPublicOverpass}=require('../lib/nightlife/overpass.ts')
const {SourceHttpError,SourceOperationError,SourceUnavailable,sourceFailure}=require('../lib/nightlife/source-errors.ts')
const {fetchJson}=require('../lib/nightlife/http.ts')
const city={wikidataId:'Q994',relationId:1996871}
const boundary={type:'relation',id:1996871,tags:{wikidata:'Q994',boundary:'administrative'}}
const area={type:'area',id:3601996871,tags:{wikidata:'Q994'}}
const elements=[{type:'node',id:1,lat:41.7,lon:44.8,tags:{name:'Fixture pub',amenity:'pub'}},{type:'way',id:2,center:{lat:41.7,lon:44.81},tags:{name:'Fixture club',amenity:'nightclub'}},{type:'relation',id:3,center:{lat:41.71,lon:44.8},tags:{name:'Fixture music hall',amenity:'music_venue'}}]
const count={type:'count',id:0,tags:{nodes:'1',ways:'1',relations:'1',total:'3'}}
const response=()=>({elements:[area,...structuredClone(elements),structuredClone(count)]})
test('OSM boundary is verified before querying its searchable area',()=>{
 assert.deepEqual(verifiedArea(city,{elements:[boundary,area]}),{boundary,areaId:area.id})
 assert.throws(()=>verifiedArea(city,{elements:[boundary]}),SourceUnavailable)
 assert.throws(()=>verifiedArea({...city,wikidataId:'Q1'},{elements:[boundary,area]}),SourceUnavailable)
 assert.throws(()=>verifiedArea({...city,relationId:null},{elements:[boundary,area,{...boundary,id:99}]}),SourceUnavailable)
 assert.throws(()=>boundaryQuery({...city,relationId:NaN}),SourceUnavailable)
})
test('complete venue queries retain nodes, ways and relations',()=>{
 assert.equal(verifiedVenues(response(),area.id).length,3)
 assert.match(boundaryQuery(city),/out tags;map_to_area;out tags;/)
 assert.doesNotMatch(boundaryQuery(city),/out geom/)
 assert.match(venueQuery(area.id),/out body center qt;out count;/)
 assert.ok(venueQuery(area.id).includes('[amenity=restaurant][bar=yes]'))
})
test('zero venues is accepted only with a matching area and explicit zero count',()=>{
 const zero={elements:[area,{type:'count',id:0,tags:{nodes:'0',ways:'0',relations:'0',total:'0'}}]}
 assert.deepEqual(verifiedVenues(zero,area.id),[])
 assert.throws(()=>verifiedVenues({elements:[]},area.id),SourceUnavailable)
})
test('truncated, partial, duplicated and wrong-area responses cannot become low ratings',()=>{
 const missing=response();missing.elements.pop()
 const truncated=response();truncated.elements.splice(1,1)
 const duplicate=response();duplicate.elements[2]=duplicate.elements[1]
 const wrongArea=response();wrongArea.elements[0]={...area,id:1}
 for(const raw of [missing,truncated,duplicate,wrongArea,{...response(),remark:'runtime error: Query timed out'}])assert.throws(()=>verifiedVenues(raw,area.id))
})
test('transport timeout uses one fallback and stays there for subsequent city requests',async()=>{
 const hosts=[]
 const client=createOverpassClient({primary:'https://primary.example/api',fallback:'https://fallback.example/api',request:async(url,options,policy)=>{
  const host=new URL(url).hostname;hosts.push(host);assert.equal(policy.retries,0)
  if(host==='primary.example')throw new DOMException('Fixture timeout','TimeoutError')
  return response()
 }})
 await client.query('query','boundary',35000);await client.query('query','venues',45000)
 assert.deepEqual(hosts,['primary.example','fallback.example','fallback.example'])
 assert.equal(client.requests.length,2);assert.equal(client.requests[0].provider,'fallback.example')
})
test('generic service failure can recover but query refusals never rotate providers',async()=>{
 for(const [status,retryAfter,expectedCalls] of [[503,null,2],[429,null,1],[403,null,1],[400,null,1],[504,null,1],[503,60,1]]) {
  let calls=0
  const client=createOverpassClient({primary:'https://primary.example/api',fallback:'https://fallback.example/api',request:async()=>{if(++calls===1)throw new SourceHttpError(status,retryAfter);return response()}})
  if(expectedCalls===2)assert.ok(await client.query('query','venues',45000))
  else await assert.rejects(()=>client.query('query','venues',45000),e=>e instanceof SourceOperationError&&e.failure.status===status)
  assert.equal(calls,expectedCalls)
 }
})
test('an explicit provider has no implicit public fallback',async()=>{
 let calls=0
 const client=createOverpassClient({primary:'https://private.example/api',request:async()=>{calls++;throw new TypeError('Fixture network failure')}})
 await assert.rejects(()=>client.query('query','venues',45000));assert.equal(calls,1)
})
test('partial query results do not trigger failover or successful request traces',async()=>{
 let calls=0
 const client=createOverpassClient({primary:'https://primary.example/api',fallback:'https://fallback.example/api',request:async()=>{calls++;return {...response(),remark:'runtime error: Query timed out'}}})
 await assert.rejects(()=>client.query('query','venues',45000));assert.equal(calls,1);assert.equal(client.requests.length,0)
})
test('timeout diagnostics retain stage, duration and safe hostname without credentials',async()=>{
 const client=createOverpassClient({primary:'https://primary.example/api?key=secret',fallback:'',request:async()=>{throw new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}})}})
 const error=await client.query('query','OpenStreetMap boundary lookup',35000).catch(e=>e)
 const failure=sourceFailure(error)
 assert.equal(failure.kind,'timeout');assert.equal(failure.code,'UND_ERR_CONNECT_TIMEOUT');assert.equal(failure.operation,'OpenStreetMap boundary lookup');assert.equal(failure.provider,'primary.example');assert.ok(failure.elapsedMs>=0)
 assert.ok(!JSON.stringify(failure).includes('secret'));assert.ok(!error.message.includes('secret'))
})
test('Overpass controls its attempt budget instead of inheriting nested HTTP retries',async()=>{
 let calls=0
 await assert.rejects(()=>fetchJson('https://example.com',{}, {retries:0,fetch:async()=>{calls++;throw new TypeError('Fixture failure')},sleep:async()=>assert.fail('Unexpected retry')}))
 assert.equal(calls,1)
})
test('public primary or fallback endpoints retain the public pilot budget',()=>{
 const before=[process.env.OVERPASS_URL,process.env.OVERPASS_FALLBACK_URL]
 try {
  process.env.OVERPASS_URL='https://private.example/api';delete process.env.OVERPASS_FALLBACK_URL;assert.equal(usesPublicOverpass(),false)
  process.env.OVERPASS_FALLBACK_URL='https://overpass-api.de/api/interpreter';assert.equal(usesPublicOverpass(),true)
  process.env.OVERPASS_URL='https://overpass.private.coffee/api/interpreter';process.env.OVERPASS_FALLBACK_URL='';assert.equal(usesPublicOverpass(),true)
 }finally{for(const [i,name]of ['OVERPASS_URL','OVERPASS_FALLBACK_URL'].entries()){if(before[i]===undefined)delete process.env[name];else process.env[name]=before[i]}}
})
