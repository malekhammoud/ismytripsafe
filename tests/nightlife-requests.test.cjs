// The city-request queue: dedupe, ordering, completion and the per-IP rate
// limit. Kept in its own process with a temporary cache dir so it never
// touches the live nightlife store.
const { mkdtempSync } = require("node:fs")
const path = require("node:path")
const os = require("node:os")

process.env.NIGHTLIFE_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "nightlife-requests-"))
require("../scripts/typescript-worker.cjs")

const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  queueNightlifeRequest,
  readNightlifeRequest,
  listNightlifeRequests,
  completeNightlifeRequest,
  noteRequestAttempt,
  countRequestsSince,
  hashIp,
  requestAnswered,
} = require("../lib/nightlife/requests.ts")

const munich = { key: "de_munich", path: "/germany/munich", city: "Munich", country: "Germany" }
const porto = { key: "pt_porto", path: "/portugal/porto", city: "Porto", country: "Portugal" }

test("a first request is stored as pending with its city and path", async () => {
  const { request, already } = await queueNightlifeRequest(munich, "going in March")
  assert.equal(already, false)
  assert.equal(request.key, "de_munich")
  assert.equal(request.path, "/germany/munich")
  assert.equal(request.city, "Munich")
  assert.equal(request.country, "Germany")
  assert.equal(request.status, "pending")
  assert.equal(request.note, "going in March")
  assert.equal(request.count, 1)
  const read = await readNightlifeRequest("de_munich")
  assert.deepEqual(read, request)
})

test("a repeat request updates one record instead of growing a log", async () => {
  const { request, already } = await queueNightlifeRequest(munich)
  assert.equal(already, true)
  assert.equal(request.count, 2)
  assert.equal(request.status, "pending")
  assert.equal(request.note, "going in March", "the first note survives")
  const pending = await listNightlifeRequests("pending")
  assert.equal(pending.filter((r) => r.key === "de_munich").length, 1)
})

test("pending requests are a fair, oldest-first queue", async () => {
  await queueNightlifeRequest(porto)
  const pending = await listNightlifeRequests("pending")
  assert.deepEqual(
    pending.map((r) => r.key),
    ["de_munich", "pt_porto"],
  )
})

test("completing a request records the outcome and removes it from pending", async () => {
  await completeNightlifeRequest("de_munich", "withheld")
  const done = await readNightlifeRequest("de_munich")
  assert.equal(done.status, "done")
  assert.equal(done.outcome, "withheld")
  assert.ok(done.completedAt)
  assert.deepEqual(
    (await listNightlifeRequests("pending")).map((r) => r.key),
    ["pt_porto"],
  )
  assert.deepEqual(
    (await listNightlifeRequests("done")).map((r) => r.key),
    ["de_munich"],
  )
  assert.equal((await listNightlifeRequests("all")).length, 2)
})

test("a done city can be asked for again if the report is gone", async () => {
  const { request, already } = await queueNightlifeRequest(munich)
  assert.equal(already, false, "a done record is not an open ask")
  assert.equal(request.status, "pending")
  assert.equal(request.count, 3)
  assert.equal(request.outcome, undefined)
})

test("the per-IP limiter allows a person and stops a script", async () => {
  const ip = hashIp("203.0.113.7")
  for (let i = 0; i < 8; i++) assert.equal((await noteRequestAttempt(ip, 8)).allowed, true)
  const blocked = await noteRequestAttempt(ip, 8)
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 600)
  assert.equal((await noteRequestAttempt(hashIp("198.51.100.9"), 8)).allowed, true)
})

test("the daily count uses the last time a city was asked for", async () => {
  assert.equal(await countRequestsSince(Date.now() - 60_000), 2)
  assert.equal(await countRequestsSince(Date.now() - 86_400_000), 2)
})

test("a source outage is not a withheld verdict", () => {
  assert.equal(requestAnswered("full", false), true)
  assert.equal(requestAnswered("limited", true), true, "a published small-scene guide answers the ask")
  assert.equal(requestAnswered("withheld", false), true, "a clean evidence gap is a final answer")
  assert.equal(requestAnswered("withheld", true), false, "an outage must stay in the queue")
})
