require('../scripts/typescript-worker.cjs')
const assert = require('node:assert/strict')
const { promises: fs } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
async function run() {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'nightlife-integration-'))
 process.env.NIGHTLIFE_CACHE_DIR=root;process.env.NIGHTLIFE_MENTIONS_DIR=path.join(root,'imports');process.env.NIGHTLIFE_BLOG_ANALYSIS_LICENSED='1'
 process.env.FOURSQUARE_API_KEY='secret-foursquare';process.env.FOURSQUARE_DURABLE_STORAGE_LICENSED='1';process.env.FOURSQUARE_CATEGORY_IDS='test-category'
 process.env.TICKETMASTER_API_KEY='secret-ticketmaster';process.env.NUMBEO_API_KEY='secret-numbeo';process.env.NUMBEO_STORAGE_LICENSED='1'
 delete process.env.NIGHTLIFE_SENTIMENT_MODEL
 const http=require('../lib/nightlife/http.ts'),request=http.fetchJson
 http.fetchJson=(url,options,policy)=>request(url,options,{...policy,sleep:async()=>{}})
 const {buildNightlife}=require('../lib/nightlife/build.ts'),{listNightlife,readNightlife}=require('../lib/nightlife/store.ts')
 const {nightlifeSafety}=require('../lib/nightlife/build.ts')
 const {GET}=require('../app/[country]/[city]/nightlife/data.json/route.ts')
 let count=24, fsq=true, searchDown=false
 const calls=[]
 global.fetch=async(input,init={})=>{
  const url=new URL(String(input));calls.push({url,init});let data
  if(url.hostname==='www.wikidata.org') {
   const ids=url.searchParams.get('ids') || url.pathname.match(/\/(Q\d+)\.json$/)?.[1]
   if(searchDown && url.pathname==='/w/api.php') return new Response('',{status:503})
   if(url.searchParams.get('action')==='wbsearchentities')data={search:[{id:'Q123'}]}
   else if(ids==='Q999')data={entities:{Q999:{id:'Q999',claims:{P297:[{mainsnak:{datavalue:{value:'XX'}}}]}}}}
   else data={entities:{Q123:{id:'Q123',labels:{en:{value:'Preview City'}},claims:{P31:[{mainsnak:{datavalue:{value:{id:'Q515'}}}}],P625:[{rank:'normal',mainsnak:{datavalue:{value:{latitude:42,longitude:10}}}}],P17:[{mainsnak:{datavalue:{value:{id:'Q999'}}}}],P1082:[{rank:'normal',mainsnak:{datavalue:{value:{amount:'+100000'}}},qualifiers:{P585:[{datavalue:{value:{time:'+2024-01-01T00:00:00Z'}}}]}}],P402:[{rank:'normal',mainsnak:{datavalue:{value:'123'}}}]}}}}
  } else if(url.hostname==='en.wikipedia.org')data={type:'standard',wikibase_item:'Q123',coordinates:{lat:42,lon:10}}
  else if(url.hostname==='overpass.private.coffee')data={elements:[{type:'relation',id:123,tags:{wikidata:'Q123',boundary:'administrative'},members:[{type:'way',role:'outer',geometry:[{lat:41,lon:9},{lat:41,lon:11},{lat:43,lon:11},{lat:43,lon:9},{lat:41,lon:9}]}]},...Array.from({length:count},(_,i)=>({type:'node',id:1000+i,lat:42+i*.001,lon:10+(i%4)*.001,tags:{name:`Venue ${i}`,amenity:['pub','bar','nightclub','music_venue'][i%4],opening_hours:'Mo-Su 18:00-03:00','addr:suburb':'Old Town'}}))]}
  else if(url.hostname==='places-api.foursquare.com')data={results:fsq?Array.from({length:12},(_,i)=>({fsq_place_id:`f${i}`,name:`Venue ${i}`,latitude:42+i*.001,longitude:10+(i%4)*.001,categories:[{name:['Pub','Cocktail Bar','Nightclub','Jazz Club'][i%4]}],rating:7.5+i*.1,popularity:.9-i*.01,stats:{total_ratings:40+i},location:{neighborhood:['Old Town']}})).concat([{fsq_place_id:'inside-extra',name:'Extra live music',latitude:42.02,longitude:10.02,categories:[{name:'Jazz Club'}],rating:8,popularity:.8,stats:{total_ratings:30}},{fsq_place_id:'outside-extra',name:'Wrong city club',latitude:50,longitude:20,categories:[{name:'Nightclub'}],rating:9,popularity:.9,stats:{total_ratings:100}}]):[]}
  else if(url.hostname==='app.ticketmaster.com')data={_embedded:{events:[{id:'event-1',name:'Preview jazz night',url:'https://www.ticketmaster.com/event/example',dates:{start:{dateTime:new Date(Date.now()+86400000*3).toISOString(),localDate:'2026-10-22'},status:{code:'onsale'}},_embedded:{venues:[{name:'Preview music hall'}]}}]}}
  else if(url.hostname==='www.numbeo.com')data={currency:url.searchParams.get('currency')||'EUR',yearLastUpdate:2026,monthLastUpdate:10,prices:[{item_id:4,average_price:4},{item_id:5,average_price:5}]}
  else throw new Error('Unexpected network '+url)
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}})
 }
 const base={key:'xx_preview',city:'Preview City',country:'Example',countryCode:'XX',countrySlug:'example',citySlug:'preview',safetyPath:'/example/preview',lat:42,lon:10,wikidataId:null,population:null,populationDate:null,relationId:null,boundaryVerified:false}
 const safety={version:1,key:'xx_preview',cachedAt:'2026-10-01',place:'Preview City, Example',geo:{...base,timezone:'UTC'},images:{hero:null,blurb:null,gallery:[]},bundle:{geo:base,country:null,images:{hero:null,blurb:null,gallery:[]},safety:{signals:[{key:'homicide',label:'Homicide',source:'World Bank',group:'Violent crime',value:1,display:'1 /100k',year:'2024',score:94,lowerIsBetter:true,note:''},{key:'numbeo_safety_night',label:'Walking after dark',source:'Numbeo',group:'Violent crime',value:75,display:'75/100',year:'2026',score:75,lowerIsBetter:false,note:''}],advisories:[],sources:[],health:[],comparisons:[],index:75,level:'SAFE'}},enrichment:{verdict:'Test safety report, not real destination advice.',summary:'Test data',mapZones:[]},prose:''}
 await fs.mkdir(process.env.NIGHTLIFE_MENTIONS_DIR,{recursive:true})
 const imports=Array.from({length:12},(_,i)=>({id:`m${i}`,group:`article-${i%4}`,source:'blogs',url:`https://example.com/article-${i%4}`,publishedAt:'2026-09-01',sentiment:'positive',themes:['Lively weekends'],relevant:true}))
 await fs.writeFile(path.join(process.env.NIGHTLIFE_MENTIONS_DIR,'xx_preview.json'),JSON.stringify(imports))
 const full=await buildNightlife(base,safety,{force:true});assert.equal(full.outcome,'full');assert.equal(full.venues.length,25);assert.ok(full.venues.some(v=>v.name==='Extra live music'));assert.ok(!full.venues.some(v=>v.name==='Wrong city club'));assert.equal(full.events.length,1);assert.equal(full.beer.domestic,4);assert.equal(full.city.population,100000);assert.equal(full.city.boundaryVerified,true)
 searchDown=true
 const recovered=await buildNightlife({...base,key:'xx_recovered',citySlug:'recovered'},safety,{force:true,interactive:true})
 assert.equal(recovered.outcome,'limited');assert.equal(recovered.city.resolutionMethod,'linked-data');assert.equal(recovered.venues.length,25);assert.equal(recovered.sources.find(s=>s.id==='wikidata').status,'ok')
 assert.match(recovered.sources.find(s=>s.id==='wikidata').note,/linked item/)
 searchDown=false
 const raw=await fs.readFile(path.join(root,'raw','xx_preview','foursquare.json'),'utf8');assert.ok(!raw.includes('secret-'));assert.ok(JSON.parse(raw).data.results.length)
 const exported=await GET(new Request('http://localhost/example/preview/nightlife/data.json'),{params:Promise.resolve({country:'example',city:'preview'})});const payload=await exported.json();assert.equal(payload.venues.length,24);assert.equal(payload.venues[0].rating,undefined);assert.equal(payload.venues[0].popularity,undefined);assert.equal(payload.licence,'ODbL 1.0')
 const missing=await GET(new Request('http://localhost/missing'),{params:Promise.resolve({country:'missing',city:'missing'})});assert.equal(missing.status,404)
 fsq=false;await fs.unlink(path.join(process.env.NIGHTLIFE_MENTIONS_DIR,'xx_preview.json'))
 const limited=await buildNightlife({...base,key:'xx_limited',citySlug:'limited'},safety,{force:true});assert.equal(limited.outcome,'limited');assert.equal(limited.scores.filter(s=>s.value==null).length,2)
 count=9
 const withheld=await buildNightlife({...base,key:'xx_withheld',citySlug:'withheld'},safety,{force:true});assert.equal(withheld.outcome,'withheld');assert.equal((await listNightlife()).length,3);assert.equal((await listNightlife(true)).length,4)
 assert.ok(calls.some(c=>c.url.hostname==='places-api.foursquare.com'&&c.init.headers.get('X-Places-Api-Version')==='2025-06-17'))
 const previous=await readNightlife('xx_preview');global.fetch=async()=>{throw new Error('Simulated outage')};await assert.rejects(()=>buildNightlife(base,safety,{force:true}),/kept the previous published report/);assert.equal((await readNightlife('xx_preview')).updatedAt,previous.updatedAt);const priorLimited=await readNightlife('xx_limited');const refreshed=await buildNightlife({...base,key:'xx_limited',citySlug:'limited'},safety,{force:true});assert.equal(refreshed.venues.length,priorLimited.venues.length);assert.equal(refreshed.sources.find(s=>s.id==='osm').status,'error');assert.equal(refreshed.sources.find(s=>s.id==='osm').fetchedAt,priorLimited.sources.find(s=>s.id==='osm').fetchedAt)
 // Safety index is deterministic, and uses after-dark score rather than raw safety index.
 const night=nightlifeSafety(safety);assert.equal(night.nightIndex,75);assert.ok(Number.isFinite(night.index))
 const {collectMentions}=require('../lib/nightlife/sentiment.ts')
 process.env.OPENROUTER_API_KEY='fixture-model-key';process.env.NIGHTLIFE_SENTIMENT_MODEL='fixture-model';process.env.REDDIT_COMMERCIAL_ANALYSIS_LICENSED='1';process.env.REDDIT_ACCESS_TOKEN='fixture-token'
 let retryCalls=0;global.fetch=async()=>{retryCalls++;throw new Error('Simulated Reddit outage')}
 const failedMentions=await collectMentions(base,[]),retriedMentions=await collectMentions(base,[])
 assert.ok(failedMentions.errors.length);assert.ok(retriedMentions.errors.length);assert.equal(retryCalls,4,'A failed sentiment fetch must not be cached as a successful monthly fetch')
 console.log('PASS: full/limited/withheld pipeline, eight source statuses, current FSQ contract, raw caches, stale-source dates, safety weighting, and licence-safe public export')
 console.log('Preview fixture store: '+root)
}
run().catch(e=>{console.error(e);process.exitCode=1})
