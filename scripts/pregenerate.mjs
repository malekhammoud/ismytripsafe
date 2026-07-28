#!/usr/bin/env node
// Batch-generate safety reports.
//
// Every report written here does double duty: it becomes a permanent crawlable
// page at /{country}/{city} (picked up by the sitemap automatically) AND the
// cache entry that makes a customer's search resolve instantly. They are the
// same file — see lib/cache.ts and lib/reports.ts.
//
// Usage:
//   node scripts/pregenerate.mjs                        # the built-in ~1,000-destination list
//   node scripts/pregenerate.mjs places.txt             # or one "City, Country" per line
//   node scripts/pregenerate.mjs --tier 1               # only the top destinations
//   node scripts/pregenerate.mjs --repair               # only reports missing district zones
//   node scripts/pregenerate.mjs --dry-run              # print the work-list and stop
//
// Flags: --host URL  --concurrency N  --limit N  --daily-budget N  --state FILE
//
// Safe to re-run and safe to interrupt. Places already cached and fresh come
// back from the server in a fraction of a second and cost no model calls, so
// resuming is just "run it again". Progress is also journaled to a state file
// so a restart doesn't re-walk work it already finished this run.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs"
import { dirname } from "path"
import { buildDestinations } from "./destinations.mjs"

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback
}
const has = (name) => argv.includes(`--${name}`)

const host = flag("host", process.env.NEXT_PUBLIC_SITE_URL || "https://ismytripsafe.com")
// Concurrency 1 by default. Two parallel reports measured ~22 model calls/min
// against the free tier's ~20/min ceiling, so ~5% of destinations came back
// 429. Slowing down costs nothing real: the *daily* 800-call budget is the
// binding constraint, and one worker still spends it in ~75 minutes. It also
// leaves headroom for actual visitors, who share the same account limit.
const concurrency = Number(flag("concurrency", 1))
const limit = Number(flag("limit", 0)) || Infinity
const maxTier = Number(flag("tier", 3))
// Free-tier budget is ~1,000 model calls/day account-wide and each report costs
// two (the report itself, then the district pass). Stay under it and leave room
// for real visitors, who are generating reports at the same time.
const dailyBudget = Number(flag("daily-budget", 800))
const stateFile = flag("state", "/var/lib/ismytripsafe/pregenerate-state.json")
const cacheDir = process.env.REPORT_CACHE_DIR || "/var/lib/ismytripsafe/reports"
// A floor, not a fact: a report costs one call if the primary model answers,
// but the agent falls through a chain of three on failure and the district pass
// does the same, so a bad run can cost six. The budget is deliberately
// conservative because of that, and RATE_LIMIT_GIVE_UP is the real backstop.
const CALLS_PER_REPORT = 2

const fileArg = argv.find((a) => !a.startsWith("--") && /\.(txt|list)$/.test(a))

// ── work-list ───────────────────────────────────────────────────────
function repairList() {
  // Reports whose district pass never landed: the map column and the SEO
  // page's district section are both empty until it does.
  const out = []
  for (const name of readdirSync(cacheDir)) {
    if (!name.endsWith(".json") || name.includes(".tmp")) continue
    try {
      const d = JSON.parse(readFileSync(`${cacheDir}/${name}`, "utf8"))
      const zones = d?.enrichment?.mapZones ?? []
      if (!zones.length) out.push({ place: `${d.geo.city}, ${d.geo.country}`, tier: 0, refresh: true })
    } catch {}
  }
  return out
}

let work
if (has("repair")) {
  work = repairList()
} else if (fileArg) {
  work = readFileSync(fileArg, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((place) => ({ place, tier: 0 }))
} else {
  work = buildDestinations({ maxTier })
}

// ── state ───────────────────────────────────────────────────────────
function loadState() {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"))
  } catch {
    return { done: [], spentByDay: {} }
  }
}
function saveState(s) {
  try {
    mkdirSync(dirname(stateFile), { recursive: true })
    writeFileSync(stateFile, JSON.stringify(s))
  } catch {}
}
const today = () => new Date().toISOString().slice(0, 10)

const state = loadState()
const done = new Set(state.done)
if (!has("repair")) work = work.filter((w) => !done.has(w.place))
// --limit is applied *after* the resume filter, so it means "this many more
// destinations", not "the first N of the list, minus whatever is done".
work = work.slice(0, limit)

if (has("dry-run")) {
  console.log(`${work.length} destinations (tier ≤ ${maxTier}), ~${work.length * CALLS_PER_REPORT} model calls`)
  for (const w of work.slice(0, 40)) console.log(`  [t${w.tier}] ${w.place}`)
  if (work.length > 40) console.log(`  … and ${work.length - 40} more`)
  process.exit(0)
}

console.log(
  `Generating ${work.length} reports via ${host}\n` +
    `  concurrency ${concurrency} · daily budget ${dailyBudget} model calls ` +
    `(~${Math.floor(dailyBudget / CALLS_PER_REPORT)} new reports/day)\n`
)

// ── surviving a deploy ──────────────────────────────────────────────
// A push restarts the service mid-run. Worse, this script's own long-lived
// SSE connections are what make that restart slow: systemd waits out the
// in-flight streams, so the app is unreachable for the best part of a minute.
// Treating that window as "these destinations failed" would burn a chunk of
// the work-list every time someone deploys — and this run spans days. So a
// connection-level failure is not a failure: wait for the app to come back and
// try the same place again.

/** The free tier's per-minute ceiling. "Try later", not "this place is broken". */
const isRateLimited = (msg) => /\b429\b|rate.?limit|quota/i.test(msg ?? "")

const isConnectionError = (err) =>
  /fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|other side closed|EAI_AGAIN|terminated/i.test(
    err?.message ?? ""
  )

async function waitForServer(maxWaitMs = 10 * 60_000) {
  const until = Date.now() + maxWaitMs
  let announced = false
  while (Date.now() < until && !stop) {
    try {
      const res = await fetch(`${host}/`, { method: "HEAD" })
      if (res.ok) {
        if (announced) console.log("  …app is back, resuming")
        return true
      }
    } catch {}
    if (!announced) {
      console.log("  app unreachable (deploy?) — waiting for it to come back…")
      announced = true
    }
    await new Promise((r) => setTimeout(r, 5_000))
  }
  return false
}

// ── one report ──────────────────────────────────────────────────────
async function generate(place, refresh) {
  const started = Date.now()
  const res = await fetch(`${host}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refresh ? { place, refresh: true } : { place }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  let buf = ""
  let outcome = null
  let cached = false
  let error = null
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString()
    let idx
    while ((idx = buf.indexOf("\n")) > -1) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith("data: ")) continue
      try {
        const ev = JSON.parse(line.slice(6))
        if (ev.type === "done") {
          outcome = ev.path ?? "?"
          cached = !!ev.cached
        } else if (ev.type === "error") error = ev.message
      } catch {}
    }
  }
  return { outcome, cached, error, secs: (Date.now() - started) / 1000 }
}

// ── run ─────────────────────────────────────────────────────────────
// Consecutive rate limits mean the account's daily free-model allowance is
// gone, not that we are going too fast — backing off harder just grinds
// through the work-list turning destinations into failures. Stand down and
// let the budget gate pick things up after the quota resets.
const RATE_LIMIT_GIVE_UP = 4
let consecutiveRateLimits = 0

let ok = 0
let fromCache = 0
let failed = 0
let index = 0
let stop = false

process.on("SIGINT", () => {
  console.log("\ninterrupted — state saved, re-run to resume")
  stop = true
})

/**
 * Block until the next UTC day when today's model budget is spent. The wait is
 * chunked into hours so an interrupt is still responsive, but it announces
 * itself once — a heartbeat every hour for 21 hours is noise that buries the
 * events worth reading.
 */
async function awaitBudget() {
  let announced = false
  for (;;) {
    const spent = state.spentByDay[today()] ?? 0
    if (spent + CALLS_PER_REPORT <= dailyBudget) {
      if (announced) console.log(`\n  quota reset — resuming\n`)
      return true
    }
    const midnight = new Date()
    midnight.setUTCHours(24, 0, 0, 0)
    const waitMs = midnight - Date.now() + 60_000
    if (!announced) {
      console.log(
        `\n  daily budget reached (${spent}/${dailyBudget} calls). ` +
          `Sleeping ${(waitMs / 3600e3).toFixed(1)}h until the quota resets…\n`
      )
      announced = true
    }
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 3600e3)))
    if (stop) return false
  }
}

async function worker() {
  while (!stop) {
    const i = index++
    if (i >= work.length) return
    const { place, refresh } = work[i]
    const label = `[${i + 1}/${work.length}] ${place}`
    if (!(await awaitBudget())) return

    let r = null
    let lastErr = null
    for (let attempt = 0; attempt < 3 && !stop; attempt++) {
      try {
        r = await generate(place, refresh)
        if (r.error && isRateLimited(r.error)) {
          consecutiveRateLimits++
          if (consecutiveRateLimits >= RATE_LIMIT_GIVE_UP) {
            console.log(
              `${label} — rate limited ${consecutiveRateLimits}x in a row; ` +
                `today's free-model allowance looks spent. Standing down until it resets.`
            )
            state.spentByDay[today()] = dailyBudget // trips awaitBudget's sleep
            saveState(state)
            r = null
            break
          }
          if (attempt < 2) {
            const backoffMs = 60_000 * (attempt + 1)
            console.log(`${label} — rate limited, backing off ${backoffMs / 1000}s`)
            await new Promise((res) => setTimeout(res, backoffMs))
            r = null
            continue
          }
        } else if (r.error == null) {
          consecutiveRateLimits = 0
        }
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        // A real error (bad response, parse failure) is this place's problem —
        // report it and move on. A connection error means the app is
        // restarting: hold the place, wait, and try it again.
        if (!isConnectionError(err)) break
        if (!(await waitForServer())) break
      }
    }

    if (lastErr) {
      failed++
      console.log(`${label} — failed: ${lastErr.message}`)
    } else if (!r) {
      failed++
      console.log(`${label} — skipped`)
    } else if (r.error) {
      failed++
      console.log(`${label} — error: ${r.error.slice(0, 80)}`)
    } else if (r.cached) {
      fromCache++
      done.add(place)
      console.log(`${label} — already cached \u2192 ${r.outcome}`)
    } else {
      ok++
      done.add(place)
      state.spentByDay[today()] = (state.spentByDay[today()] ?? 0) + CALLS_PER_REPORT
      console.log(`${label} — built in ${r.secs.toFixed(0)}s \u2192 ${r.outcome}`)
    }

    state.done = [...done]
    if ((i & 7) === 0) saveState(state)
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))
state.done = [...done]
saveState(state)

console.log(
  `\nFinished: ${ok} built, ${fromCache} already cached, ${failed} failed.\n` +
    `Model calls spent today: ${state.spentByDay[today()] ?? 0}/${dailyBudget}`
)
