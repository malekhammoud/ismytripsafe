#!/usr/bin/env node
// Measure cold report latency against a running server, stage by stage.
//
// The pipeline fans out over ~40 upstream calls in three stages, so "it feels
// slow" is never actionable on its own. This reports the three moments that
// actually matter to a reader:
//
//   safety      → the report appears on screen (everything database-derived)
//   enrichment  → the published score stops being provisional
//   done        → the prose has finished streaming
//
// Run the server with TIMING=1 to also get the per-source breakdown in its log,
// which is what you want once this tells you *which* stage regressed.
//
//   TIMING=1 npx next start -p 3099 &
//   node scripts/bench-report.mjs --url http://127.0.0.1:3099 "Lisbon, Portugal" …
//
// Every request sends refresh:true — otherwise you would be timing the cache.

const args = process.argv.slice(2)
let base = "http://127.0.0.1:3000"
const places = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url") base = args[++i]
  else places.push(args[i])
}
if (!places.length) {
  console.error("usage: bench-report.mjs [--url http://host:port] \"City, Country\" …")
  process.exit(1)
}

async function measure(place) {
  const t0 = Date.now()
  const at = {}
  let prose = 0
  let error = null

  const res = await fetch(`${base}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place, refresh: true }),
  })
  if (!res.body) throw new Error("no response stream")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      let ev
      try {
        ev = JSON.parse(line.slice(6))
      } catch {
        continue
      }
      const t = Date.now() - t0
      if (ev.type === "text") {
        prose += ev.content.length
        at.firstText ??= t
      } else if (ev.type === "error") {
        error = ev.message
      } else if (ev.type !== "searching") {
        at[ev.type] ??= t
      }
    }
  }
  return { place, at, prose, error, total: Date.now() - t0 }
}

const ms = (v) => (v == null ? "    —" : `${(v / 1000).toFixed(2)}s`)
const results = []

for (const place of places) {
  const r = await measure(place)
  results.push(r)
  console.log(
    `${r.place.padEnd(24)} visible ${ms(r.at.safety)}  score ${ms(r.at.enrichment)}` +
      `  done ${ms(r.at.done ?? r.total)}  (${r.prose} chars)` +
      (r.error ? `  ERROR: ${r.error}` : "")
  )
}

// p50/p95 over whichever runs produced each mark
function pct(values, p) {
  const v = values.filter((n) => n != null).sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))]
}
const visible = results.map((r) => r.at.safety)
const score = results.map((r) => r.at.enrichment)
const done = results.map((r) => r.at.done ?? r.total)
const failed = results.filter((r) => r.error).length

console.log(
  `\nn=${results.length}  failed=${failed}\n` +
    `  visible  p50 ${ms(pct(visible, 50))}  p95 ${ms(pct(visible, 95))}\n` +
    `  score    p50 ${ms(pct(score, 50))}  p95 ${ms(pct(score, 95))}\n` +
    `  done     p50 ${ms(pct(done, 50))}  p95 ${ms(pct(done, 95))}`
)
