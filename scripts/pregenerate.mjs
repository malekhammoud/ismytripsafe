#!/usr/bin/env node
// Batch-generate safety reports so their permanent pages exist before anyone
// searches. Feeds places one at a time through the same pipeline as the UI
// (already-cached places replay instantly and cost nothing).
//
// Usage:
//   node scripts/pregenerate.mjs places.txt            # one "City, Country" per line
//   node scripts/pregenerate.mjs places.txt --host http://localhost:3001
//
// Lines starting with # are skipped. Run it under nohup/tmux for long lists.

import { readFileSync } from "fs"

const file = process.argv[2]
if (!file) {
  console.error("Usage: node scripts/pregenerate.mjs <places.txt> [--host http://localhost:3000]")
  process.exit(1)
}
const hostIdx = process.argv.indexOf("--host")
const host = hostIdx > -1 ? process.argv[hostIdx + 1] : "http://localhost:3000"

const places = readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))

console.log(`Generating ${places.length} reports via ${host} …`)

let ok = 0
let failed = 0
for (const [i, place] of places.entries()) {
  const started = Date.now()
  process.stdout.write(`[${i + 1}/${places.length}] ${place} … `)
  try {
    const res = await fetch(`${host}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place }),
    })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    // Drain the SSE stream; note the outcome events as they pass.
    let buf = ""
    let outcome = "no result"
    for await (const chunk of res.body) {
      buf += Buffer.from(chunk).toString()
      let idx
      while ((idx = buf.indexOf("\n")) > -1) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line.startsWith("data: ")) continue
        try {
          const ev = JSON.parse(line.slice(6))
          if (ev.type === "done") outcome = `done${ev.cached ? " (cached)" : ""} → ${ev.path ?? "?"}`
          if (ev.type === "error") outcome = `error: ${ev.message}`
        } catch {}
      }
    }
    const secs = ((Date.now() - started) / 1000).toFixed(0)
    console.log(`${outcome} [${secs}s]`)
    outcome.startsWith("done") ? ok++ : failed++
  } catch (err) {
    console.log(`failed: ${err.message}`)
    failed++
  }
}
console.log(`\nFinished: ${ok} ok, ${failed} failed.`)
