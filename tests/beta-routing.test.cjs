require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {NextRequest}=require('next/server')
const {proxy}=require('../proxy.ts')
test('mixed-case beta links keep their public hostname behind nginx',()=>{
 const r=proxy(new NextRequest('http://127.0.0.1:3002/Georgia/Tbilisi/Nightlife',{headers:{host:'beta.ismytripsafe.com'}}))
 assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://beta.ismytripsafe.com/georgia/tbilisi/nightlife');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow')
})
test('beta remains noindex even if an old deployment environment disables the ribbon',()=>{
 const r=proxy(new NextRequest('http://127.0.0.1:3002/nightlife',{headers:{host:'beta.ismytripsafe.com'}}));assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow')
})
test('production canonical redirects and local preview still behave correctly',()=>{
 const prod=proxy(new NextRequest('http://127.0.0.1:3000/Portugal/Lisbon',{headers:{host:'www.ismytripsafe.com'}}));assert.equal(prod.headers.get('location'),'https://ismytripsafe.com/portugal/lisbon')
 const preview=proxy(new NextRequest('http://localhost:3005/nightlife'));assert.equal(preview.headers.get('location'),null)
})
