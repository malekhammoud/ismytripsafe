#!/usr/bin/env node
/**
 * One-off cache migration: `terrorism_deaths` → `terrorism_deaths_pm`.
 *
 * Terrorism used to be scored on the absolute death count, so 4,337 deaths in
 * Afghanistan scored the same as 4,337 would in India. The scoring engine now
 * reads a per-million rate under a new key, which cached reports do not carry
 * until their 7-day TTL expires — until then their conflict pillar rests on
 * political stability alone.
 *
 * Converting in place needs a population figure the cached report does not
 * store, so this fetches it from the World Bank once per country. Reports that
 * already carry the new key, and reports whose population lookup fails, are
 * left untouched.
 *
 *   node scripts/migrate-terrorism-per-capita.mjs [--dry-run]
 */
import { promises as fs } from "node:fs"
import path from "node:path"

const DIR = process.env.REPORT_CACHE_DIR || "/var/lib/ismytripsafe/reports"
const DRY = process.argv.includes("--dry-run")

const popCache = new Map()

async function population(iso2) {
  const key = iso2.toUpperCase()
  if (popCache.has(key)) return popCache.get(key)
  let value = null
  try {
    const res = await fetch(
      `https://api.worldbank.org/v2/country/${key}/indicator/SP.POP.TOTL?format=json&mrv=5`
    )
    const json = await res.json()
    const rows = Array.isArray(json?.[1]) ? json[1] : []
    const hit = rows.find((r) => typeof r?.value === "number" && r.value > 0)
    value = hit?.value ?? null
  } catch {
    value = null
  }
  popCache.set(key, value)
  return value
}

const format = (v) =>
  v === 0 ? "0 recorded" : v < 1 ? `${v.toFixed(2)} / million` : `${v.toFixed(1)} / million`

const NOTE =
  "Deaths from terrorist attacks in the most recent recorded year (Global Terrorism Database), per million residents. Countries with no recorded incidents count as zero."

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".json") && !f.includes(".tmp"))
  let converted = 0
  let skipped = 0

  for (const file of files) {
    const full = path.join(DIR, file)
    let report
    try {
      report = JSON.parse(await fs.readFile(full, "utf8"))
    } catch {
      continue
    }
    const signals = report?.bundle?.safety?.signals
    if (!Array.isArray(signals)) continue

    const idx = signals.findIndex((s) => s.key === "terrorism_deaths")
    if (idx === -1) continue
    if (signals.some((s) => s.key === "terrorism_deaths_pm")) {
      // both keys present — the stale one is dead weight, drop it
      signals.splice(idx, 1)
      if (!DRY) await fs.writeFile(full, JSON.stringify(report), "utf8")
      converted++
      continue
    }

    const iso2 = report?.geo?.countryCode
    const deaths = signals[idx].value
    if (!iso2 || typeof deaths !== "number") {
      skipped++
      continue
    }
    const pop = await population(iso2)
    if (!pop) {
      console.log(`  skip ${file}: no population for ${iso2}`)
      skipped++
      continue
    }

    const perMillion = (deaths / pop) * 1e6
    signals[idx] = {
      ...signals[idx],
      key: "terrorism_deaths_pm",
      value: perMillion,
      display: format(perMillion),
      note: NOTE,
      // recomputed from the raw value on render; set here so the file is
      // self-consistent if anything reads it directly
      score: null,
    }

    console.log(
      `  ${file.padEnd(28)} ${iso2}  ${deaths} deaths / ${(pop / 1e6).toFixed(1)}M = ${format(perMillion)}`
    )
    if (!DRY) await fs.writeFile(full, JSON.stringify(report), "utf8")
    converted++
  }

  console.log(`\n${DRY ? "[dry run] " : ""}converted ${converted}, skipped ${skipped}, of ${files.length} reports`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
