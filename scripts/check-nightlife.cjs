#!/usr/bin/env node
// Read-only HTTP checks after a beta deploy. Never writes reports or triggers research.
const origin=process.env.NIGHTLIFE_SMOKE_ORIGIN||'https://beta.ismytripsafe.com'
const city=process.argv[2]
async function get(path,status=200) {
 const r=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(20000)})
 if(r.status!==status)throw new Error(`${path}: HTTP ${r.status}, expected ${status}`)
 return r.text()
}
async function main(){
 const directory=await get('/nightlife');if(!directory.includes('after-dark')&&!directory.includes('After-Dark'))throw new Error('Missing nightlife directory content')
 if(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(directory))throw new Error('Beta nightlife directory is indexable')
 await get('/not-a-real-country/not-a-real-city/nightlife',404)
 if(city){
  if(!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(city))throw new Error('Expected country/city slugs')
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
main().catch(e=>{console.error('Nightlife smoke check failed: '+e.message);process.exitCode=1})
