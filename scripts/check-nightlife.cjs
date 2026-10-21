#!/usr/bin/env node
// Read-only by default. --generate explicitly tests the beta visitor pipeline.
const {setTimeout:delay}=require('node:timers/promises')
const origin=process.env.NIGHTLIFE_SMOKE_ORIGIN||'https://beta.ismytripsafe.com'
const args=process.argv.slice(2),city=args.find(a=>!a.startsWith('--'))
async function generate() {
 const base=new URL(origin)
 if(base.hostname!=='beta.ismytripsafe.com'&&!(['localhost','127.0.0.1'].includes(base.hostname)&&['3002','3005'].includes(base.port)))throw new Error('Generation check is restricted to beta or its local preview')
 require('./typescript-worker.cjs')
 const {PIPELINE_VERSION}=require('../lib/nightlife/version.ts')
 const endpoint=new URL('/api/nightlife/'+city,base)
 const deployDeadline=Date.now()+(args.includes('--wait-for-deploy')?300000:0)
 for(;;){
  try {
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(15000)})
   void response.body?.cancel().catch(()=>{})
   if(response.ok&&response.headers.get('x-nightlife-pipeline')===PIPELINE_VERSION)break
   if(Date.now()>=deployDeadline)throw new Error('The expected nightlife pipeline is not deployed: '+PIPELINE_VERSION)
  }catch(error){if(Date.now()>=deployDeadline)throw error}
  console.log('Waiting for beta deployment '+PIPELINE_VERSION)
  await delay(5000)
 }
 const stop=Date.now()+300000
 let method='POST',last=''
 while(Date.now()<stop){
  const response=await fetch(endpoint,{method,headers:{Origin:base.origin},signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('Research status HTTP '+response.status)
  const status=await response.json(),summary=JSON.stringify(status)
  if(summary!==last){console.log('Research '+summary);last=summary}
  if(status.state==='ready'&&status.available){if(status.issue)throw new Error('A saved report exists, but fresh research failed: '+summary);return}
  if(['failed','unavailable','deferred'].includes(status.state))throw new Error('Live report did not qualify: '+summary)
  method=['idle','busy'].includes(status.state)?'POST':'GET'
  await delay(Math.max(1000,Math.min(10000,(status.retryAfter||3)*1000)))
 }
 throw new Error('No completed live report within five minutes')
}
async function get(path,status=200) {
 const r=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(20000)})
 if(r.status!==status)throw new Error(`${path}: HTTP ${r.status}, expected ${status}`)
 return r.text()
}
async function main(){
 if(city&&!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(city))throw new Error('Expected country/city slugs')
 if(args.includes('--generate')){if(!city)throw new Error('--generate requires country/city');await generate()}
 const directory=await get('/nightlife');if(!directory.includes('nightlife-city-search'))throw new Error('Missing nightlife directory content')
 if(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(directory))throw new Error('Beta nightlife directory is indexable')
 await get('/not-a-real-country/not-a-real-city/nightlife',404)
 if(city){
  const route='/'+city+'/nightlife',html=await get(route)
  for(const id of ['the-stars','venues','hotspots','late','travelers','night-safety','sources'])if(!html.includes(`id="${id}"`))throw new Error('Missing section '+id)
  if(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html))throw new Error('Beta city page is indexable')
  const data=JSON.parse(await get(route+'/data.json'))
  if(data.licence!=='ODbL 1.0')throw new Error('Missing venue export licence')
  if(data.venues.some(v=>'rating'in v||'popularity'in v||'votes'in v))throw new Error('Proprietary data leaked in export')
  if(!(await get('/'+city)).includes(route))throw new Error('Missing safety-to-nightlife crosslink')
  for(const asset of [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(m=>m[1]))].slice(0,8))await get(asset)
 }
 console.log('PASS: beta directory, noindex, withheld 404'+(city?', report evidence sections, safety crosslink, ODbL export and static assets':''))
}
main().catch(e=>{const code=typeof e.cause?.code==='string'&&/^[A-Z0-9_]+$/.test(e.cause.code)?` (${e.cause.code})`:'';console.error('Nightlife smoke check failed: '+e.message+code);process.exitCode=1})
