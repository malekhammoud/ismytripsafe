require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { isBenignClientError, reportClientError } = require('../lib/ops/client.ts')

test('ResizeObserver loop notices are treated as benign browser warnings', () => {
  assert.equal(isBenignClientError('ResizeObserver loop completed with undelivered notifications.'), true)
  assert.equal(isBenignClientError('ResizeObserver loop limit exceeded'), true)
  assert.equal(isBenignClientError('Uncaught Error: ResizeObserver loop completed with undelivered notifications.'), true)
  assert.equal(isBenignClientError('Error: ResizeObserver loop limit exceeded.'), true)
})

test('real client errors are still reportable', () => {
  assert.equal(isBenignClientError('TypeError: Cannot read properties of undefined'), false)
  assert.equal(isBenignClientError('ResizeObserver loop completed with undelivered notifications. TypeError'), false)
  assert.equal(isBenignClientError('ResizeObserver loop completed'), false)
})

test('reportClientError drops ResizeObserver loop notices but sends real failures', () => {
  const originalWindow = global.window
  const originalFetch = global.fetch
  const calls = []
  global.window = { location: { pathname: '/map' } }
  global.fetch = (...args) => {
    calls.push(args)
    return Promise.resolve(new Response(null, { status: 204 }))
  }
  try {
    reportClientError(new Error('ResizeObserver loop completed with undelivered notifications.'), 'window.error')
    reportClientError('ResizeObserver loop limit exceeded', 'window.error')
    assert.equal(calls.length, 0, 'benign resize notices never reach /api/ops/report')

    reportClientError(new Error('TypeError: real failure'), 'window.error')
    assert.equal(calls.length, 1, 'a real client failure is still reported')
    assert.equal(calls[0][0], '/api/ops/report')
  } finally {
    if (originalWindow === undefined) delete global.window
    else global.window = originalWindow
    if (originalFetch === undefined) delete global.fetch
    else global.fetch = originalFetch
  }
})
