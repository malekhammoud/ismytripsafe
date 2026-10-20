require('../scripts/typescript-worker.cjs')
require.extensions['.css'] = () => {}
const fs = require('node:fs')
const assert = require('node:assert/strict')
const root=process.argv[2]
if(!root)throw new Error('Supply the isolated fixture store printed by nightlife-integration.cjs')
process.env.NIGHTLIFE_CACHE_DIR=root
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const {AppRouterContext}=require('next/dist/shared/lib/app-router-context.shared-runtime')
const render=element=>renderToStaticMarkup(React.createElement(AppRouterContext.Provider,{value:{refresh(){}}},element))
const reports=require('../lib/reports.ts')
reports.getCityReport=async(country,city)=>country==='example'&&city==='cold'?{meta:{city:'Cold City'},report:{}}:null
const { NightlifeReportPage } = require('../components/nightlife/Report.tsx')
const {default: Index}=require('../app/nightlife/page.tsx')
const {default: Page,generateMetadata}=require('../app/[country]/[city]/nightlife/page.tsx')
async function main(){
 for(const key of ['xx_preview','xx_limited']) {
  const report=JSON.parse(fs.readFileSync(`${root}/reports/${key}.json`,'utf8'))
  const html=render(React.createElement(NightlifeReportPage,{report,nearby:[]}))
  for(const id of ['the-stars','venues','hotspots','late','events','beer','travelers','night-safety','sources'])assert.ok(html.includes(`id="${id}"`),id)
  assert.ok(html.includes('Preview City'));assert.ok(html.includes('ODbL'))
  assert.ok(html.includes('Ticketmaster'));assert.ok(html.includes('Numbeo'));assert.ok(html.includes('Download report data'))
  if(key==='xx_limited'){assert.ok(html.includes('Limited data'));assert.ok(html.includes('Not enough data'))}
  fs.writeFileSync(`/tmp/nightlife-${key}.html`,html)
  console.log(`PASS: ${key} server renders all report sections and evidence states (${html.length.toLocaleString()} bytes)`)
 }
 const props={params:Promise.resolve({country:'example',city:'preview'})}
 const meta=await generateMetadata(props)
 assert.equal(meta.robots.index,false);assert.ok(meta.title.includes('Nightlife'));assert.equal(meta.alternates.canonical,'https://beta.ismytripsafe.com/example/preview/nightlife')
 const page=render(await Page(props)),schema=JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
 assert.equal(schema['@type'],'Article');assert.equal(schema.aggregateRating,undefined);assert.ok(schema.citation.length)
 await assert.rejects(()=>Page({params:Promise.resolve({country:'example',city:'withheld'})}),/404/)
 const cold={params:Promise.resolve({country:'example',city:'cold'})}
 const pending=render(await Page(cold));assert.ok(pending.includes('Cold City nightlife'));assert.ok(pending.includes('Find the right city'));assert.ok(!pending.includes('application/ld+json'));assert.equal((await generateMetadata(cold)).robots.index,false)
 console.log('PASS: known cold city renders research screen without fake ratings')
 reports.listReports=async()=>[{key:'xx_preview',city:'Preview City',country:'Example',region:'Europe',path:'/example/preview'},{key:'xx_cold',city:'Cold City',country:'Example',region:'Europe',path:'/example/cold'},{key:'xx_country',city:'Example',country:'Example',region:'Europe',path:'/example'}]
 const directory=render(await Index());assert.ok(directory.includes('Nightlife, city by city.'));assert.ok(directory.includes('nightlife-city-search'));assert.ok(directory.includes('nightlife-region'));assert.ok(directory.includes('/example/cold/nightlife'));assert.ok(directory.includes('Ready to read'));assert.ok(!directory.includes('Go somewhere.'));assert.ok(!directory.includes('/example/nightlife'))
 fs.writeFileSync('/tmp/nightlife-directory.html',directory)
 console.log('PASS: clean directory includes search, region filter, published ratings and unresearched city links; country-only entries excluded')
 console.log('PASS: real page lookup, beta noindex/canonical, valid Article schema, and withheld route 404')
}
main().catch(e=>{console.error(e);process.exitCode=1})
