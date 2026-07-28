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
const concurrency = Number(flag("concurrency", 2))
const limit = Number(flag("limit", 0)) || Infinity
const maxTier = Number(flag("tier", 3))
// Free-tier budget is ~1,000 model calls/day account-wide and each report costs
// two (the report itself, then the district pass). Stay under it and leave room
// for real visitors, who are generating reports at the same time.
const dailyBudget = Number(flag("daily-budget", 800))
const stateFile = flag("state", "/var/lib/ismytripsafe/pregenerate-state.json")
const cacheDir = process.env.REPORT_CACHE_DIR || "/var/lib/ismytripsafe/reports"
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
work = work.slice(0, limit)

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
let ok = 0
let fromCache = 0
let failed = 0
let index = 0
let stop = false

process.on("SIGINT", () => {
  console.log("\ninterrupted — state saved, re-run to resume")
  stop = true
})

/** Block until the next UTC day when today's model budget is spent. */
async function awaitBudget() {
  for (;;) {
    const spent = state.spentByDay[today()] ?? 0
    if (spent + CALLS_PER_REPORT <= dailyBudget) return true
    const midnight = new Date()
    midnight.setUTCHours(24, 0, 0, 0)
    const waitMs = midnight - Date.now() + 60_000
    console.log(
      `\n  daily budget reached (${spent}/${dailyBudget} calls). ` +
        `Sleeping ${(waitMs / 3600e3).toFixed(1)}h until the quota resets…\n`
    )
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 3600e3)))
    if (stop) return false
  }
}

async function worker(id) {
  while (!stop) {
    const i = index++
    if (i >= work.length) return
    const { place, refresh } = work[i]
    if (!(await awaitBudget())) return

    try {
      const r = await generate(place, refresh)
      if (r.error) {
        failed++
        console.log(`[${i + 1}/${work.length}] ${place} — error: ${r.error.slice(0, 80)}`)
      } else if (r.cached) {
        fromCache++
        done.add(place)
        console.log(`[${i + 1}/${work.length}] ${place} — already cached → ${r.outcome}`)
      } else {
        ok++
        done.add(place)
        state.spentByDay[today()] = (state.spentByDay[today()] ?? 0) + CALLS_PER_REPORT
        console.log(
          `[${i + 1}/${work.length}] ${place} — built in ${r.secs.toFixed(0)}s → ${r.outcome}`
        )
      }
    } catch (err) {
      failed++
      console.log(`[${i + 1}/${work.length}] ${place} — failed: ${err.message}`)
    }

    state.done = [...done]
    if ((i & 7) === 0) saveState(state)
  }
}

await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)))
state.done = [...done]
saveState(state)

console.log(
  `\nFinished: ${ok} built, ${fromCache} already cached, ${failed} failed.\n` +
    `Model calls spent today: ${state.spentByDay[today()] ?? 0}/${dailyBudget}`
)
