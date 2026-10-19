require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const Module=require('node:module')
const reports=require('../lib/reports.ts')
const visits=require('../lib/nightlife/visits.ts')
const scheduled=[]
let lookupCalls=0,buildCalls=0,prepareCalls=0
reports.getCityReport=async(country,city)=>{lookupCalls++;return country==='example'&&city==='city'?{meta:{key:'xx_city'},report:{}}:null}
visits.visitJobs.inspect=async()=>({state:'idle',available:false})
visits.visitJobs.prepare=async()=>{prepareCalls++;return{status:{state:'running',phase:'resolve',available:false,retryAfter:3},run:async()=>{buildCalls++}}}
const load=Module._load
Module._load=function(name,...rest){return name==='next/server'?{after:callback=>scheduled.push(callback)}:load.call(this,name,...rest)}
const {GET,POST}=require('../app/api/nightlife/[country]/[city]/route.ts')
Module._load=load
const context=(country='example',city='city')=>({params:Promise.resolve({country,city})})
const request=(headers={},method='POST')=>new Request('https://beta.ismytripsafe.com/api/nightlife/example/city',{method,headers})
test('GET is status-only and never generates work',async()=>{const before=prepareCalls;const result=await GET(request({},'GET'),context());assert.equal(result.status,200);assert.equal((await result.json()).state,'idle');assert.equal(prepareCalls,before);assert.equal(result.headers.get('cache-control'),'no-store')})
test('POST responds with progress and defers the build through Next after',async()=>{const before=buildCalls;const result=await POST(request({origin:'https://beta.ismytripsafe.com',host:'beta.ismytripsafe.com'}),context());assert.equal(result.status,202);assert.equal(result.headers.get('retry-after'),'3');assert.equal(result.headers.get('x-robots-tag'),'noindex');assert.equal(buildCalls,before);const callback=scheduled.pop();assert.ok(callback);await callback();assert.equal(buildCalls,before+1)})
test('unknown cities cannot create research jobs',async()=>{const before=prepareCalls;assert.equal((await POST(request(),context('example','missing'))).status,404);assert.equal(prepareCalls,before)})
test('invalid slugs are rejected before looking up city data',async()=>{const before=lookupCalls;assert.equal((await GET(request({},'GET'),context('../private','x'))).status,404);assert.equal(lookupCalls,before)})
test('cross-site posts cannot spend research capacity',async()=>{const before=prepareCalls;assert.equal((await POST(request({'sec-fetch-site':'cross-site'}),context())).status,403);assert.equal((await POST(request({origin:'https://unrelated.example'}),context())).status,403);assert.equal(prepareCalls,before)})
test('malformed Origin headers return a controlled 403',async()=>{assert.equal((await POST(request({origin:'not a URL'}),context())).status,403)})
