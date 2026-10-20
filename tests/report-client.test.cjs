require('../scripts/typescript-worker.cjs')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {useReport}=require('../lib/store.ts')
const sse=(events)=>new Response(events.map(e=>'data: '+JSON.stringify(e)).join('\n\n'),{headers:{'content-type':'text/event-stream'}})
test('an HTTP rate limit is an error, never an empty successful report',async()=>{
  global.fetch=async()=>new Response('Rate limited',{status:429})
  await useReport.getState().run({place:'First city'})
  assert.equal(useReport.getState().status,'error');assert.match(useReport.getState().error,/wait a minute/)
})
test('an interrupted stream preserves partial data and asks for a retry',async()=>{
  global.fetch=async()=>sse([{type:'text',content:'Partial report'}])
  await useReport.getState().run({place:'First city'})
  assert.equal(useReport.getState().status,'error');assert.equal(useReport.getState().prose,'Partial report')
})
test('a trailing done event without a newline completes successfully',async()=>{
  global.fetch=async()=>sse([{type:'text',content:'Finished'},{type:'done',path:'/test/city'}])
  await useReport.getState().run({place:'First city'})
  assert.equal(useReport.getState().status,'done');assert.equal(useReport.getState().reportPath,'/test/city')
})
test('an older request cannot overwrite a newer city',async()=>{
  let release,firstSignal
  global.fetch=async(_url,options)=>{
    if(JSON.parse(options.body).place==='Older city'){firstSignal=options.signal;return new Promise(resolve=>{release=resolve})}
    return sse([{type:'text',content:'New city'},{type:'done'}])
  }
  const old=useReport.getState().run({place:'Older city'})
  await useReport.getState().run({place:'Newer city'})
  release(sse([{type:'text',content:'Old city'},{type:'done'}]));await old
  assert.equal(firstSignal.aborted,true);assert.equal(useReport.getState().prose,'New city');assert.equal(useReport.getState().query.place,'Newer city')
})
test('reset cancels the in-flight request and clears its date',async()=>{
  let release
  global.fetch=async()=>new Promise(resolve=>{release=resolve})
  const job=useReport.getState().run({place:'Pending city'});useReport.getState().reset()
  release(sse([{type:'text',content:'Late response'},{type:'done'}]));await job
  assert.equal(useReport.getState().status,'idle');assert.equal(useReport.getState().prose,'');assert.equal(useReport.getState().generatedAt,'')
})
