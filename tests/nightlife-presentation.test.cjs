require('../scripts/typescript-worker.cjs')
require.extensions['.css']=()=>{}
const {test}=require('node:test'),assert=require('node:assert/strict')
const {venueShortlist,priceBand}=require('../lib/nightlife/presentation.ts')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {NightlifeReportPage}=require('../components/nightlife/Report.tsx')
const {Stars}=require('../components/nightlife/Stars.tsx')
const v=(id,name,rating)=>({id,name,type:'Pub',lat:41,lon:-8,sources:[{id:'osm',url:'https://www.openstreetmap.org/node/1'}],...(rating?{rating,votes:20}:{})})
const m=(id,group,names,sentiment='positive')=>({id,group,recommendedVenues:names,sentiment,relevant:true,publishedAt:new Date().toISOString(),themes:['Great live music'],source:'blogs',url:'https://example.org/'+group})
const base={city:{key:'pt_porto',city:'Porto',country:'Portugal',safetyPath:'/portugal/porto',countrySlug:'portugal',citySlug:'porto',lat:41,lon:-8},updatedAt:'2026-10-21',overall:4.2,scores:['density','quality','variety','vibe','safety'].map(key=>({key,label:key,value:key==='quality'?null:4,bullets:['Should never be shown'],inputs:{}})),venues:[v('a','Bonaparte'),v('b','Live Club',9)],mentions:[],beer:null,events:[],sources:[],lateness:{known:0},safety:null,refresh:{}}
test('independent recommendations rank above ratings; repeat threads and negative mentions cannot inflate recommendations',()=>{
 const r={...base,mentions:[m('1','article1',['Bonaparte']),m('2','article1',['Bonaparte']),m('3','article2',['Bonaparte']),m('4','article3',['Live Club'],'negative')]}
 const list=venueShortlist(r);assert.equal(list[0].venue.name,'Bonaparte');assert.equal(list[0].groups,2);assert.equal(list[1].groups,0)
 assert.equal(venueShortlist({...base,venues:[{...v('a','Bonaparte'),closed:true}],mentions:r.mentions}).length,0)
})
test('expired recommendations and generic themes do not create a shortlist',()=>{
 assert.deepEqual(venueShortlist({...base,venues:[v('a','Bonaparte')],mentions:[{...m('old','old',['Bonaparte']),publishedAt:'2019-01-01'}, {...m('topic','topic',[]),themes:['Bonaparte']}]}),[])
})
test('large stars retain a fractional overall and price bands require valid USD observations',()=>{
 const html=renderToStaticMarkup(React.createElement(Stars,{value:4.2,large:true}));assert.match(html,/width:20/)
 assert.equal(priceBand(null),null);assert.equal(priceBand(NaN),null);assert.equal(priceBand(-1),null);assert.equal(priceBand(3),1);assert.equal(priceBand(4),2);assert.equal(priceBand(8),3)
})
test('empty blocks are hidden and Porto has a sourced night hero without research copy',()=>{
 const html=renderToStaticMarkup(React.createElement(NightlifeReportPage,{report:{...base,venues:[v('a','Bonaparte')]},nearby:[]}))
 for(const id of ['top-venues','late','prices','night-safety','travelers','sources','events'])assert.ok(!html.includes(`id="${id}"`),id)
 assert.ok(html.includes('Porto Nightlife Report 2026'));assert.ok(html.includes('Effeietsanders'));assert.ok(html.includes('Not enough data'));assert.ok(html.includes('/methodology/nightlife?'))
 for(const copy of ['—','THE AFTER-DARK','Should never be shown','nl-section-number','Based on','Limited data'])assert.ok(!html.includes(copy),copy)
})
test('available blocks appear in the requested order with linked evidence and no invented taxi prices',()=>{
 const report={...base,mentions:[m('a','guide',['Bonaparte'])],beer:{currency:'EUR',domestic:2.5,imported:null,domesticUsd:2.7,updatedAt:'2026-10-01'},lateness:{known:10,afterMidnight:8,after2:5,after4:1},safety:{index:89,summary:'Yes — Porto is safe.',zones:[],signals:[]}}
 const html=renderToStaticMarkup(React.createElement(NightlifeReportPage,{report,nearby:[]}))
 const ids=['the-stars','venues','top-venues','late','prices','night-safety','travelers'].map(id=>html.indexOf(`id="${id}"`));assert.ok(ids.every((n,i)=>n>=0&&(!i||n>ids[i-1])))
 assert.ok(html.includes('€2.50'));assert.ok(html.includes('https://example.org/guide'));assert.ok(!html.includes('Taxi'));assert.ok(!html.includes('—'))
})
test('model recommendations must name a venue actually present in source text',async()=>{
 const {classifyMentions}=require('../lib/nightlife/sentiment.ts')
 const previousFetch=global.fetch,previousEnv={...process.env}
 process.env.OPENROUTER_API_KEY='fixture';process.env.NIGHTLIFE_SENTIMENT_MODEL='fixture'
 global.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({labels:[{id:'source',relevant:true,sentiment:'positive',themes:['Good music'],recommendedVenues:['Bonaparte','Invented club']}]})}}]})
 try{
  const result=await classifyMentions(base.city,[{id:'source',source:'blogs',group:'guide',url:'https://example.org/guide',publishedAt:new Date().toISOString(),text:'We recommend Bonaparte for an evening out.'}])
  assert.deepEqual(result[0].recommendedVenues,['Bonaparte'])
 }finally{global.fetch=previousFetch;process.env=previousEnv}
})
test('derived budgets use sourced components and incomplete taxi data stays hidden',()=>{
 const prices={currency:'EUR',domestic:3,imported:null,domesticUsd:3.2,meal:12,taxiStart:4,taxiPerKm:1.5,updatedAt:'2026-10-01'}
 const html=renderToStaticMarkup(React.createElement(NightlifeReportPage,{report:{...base,beer:prices},nearby:[]}));assert.ok(html.includes('€18.00'));assert.ok(html.includes('€11.50'))
 const noTaxi=renderToStaticMarkup(React.createElement(NightlifeReportPage,{report:{...base,beer:{...prices,taxiPerKm:null}},nearby:[]}));assert.ok(!noTaxi.includes('5 km'))
})
