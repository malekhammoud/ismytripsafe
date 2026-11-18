#!/usr/bin/env node
require('./typescript-worker.cjs')
require('@next/env').loadEnvConfig(process.cwd(), false)
const { promises: fs } = require('node:fs')
const path = require('node:path')
const { CACHE_DIR } = require('../lib/cache.ts')
const { buildNightlife } = require('../lib/nightlife/build.ts')
const { usesPublicOverpass } = require('../lib/nightlife/overpass.ts')
const { countrySlugFor } = require('../lib/reports.ts')
const { slug } = require('../lib/cache.ts')
const { listNightlife, NIGHTLIFE_DIR, writeJson } = require('../lib/nightlife/store.ts')
const rawArgs = process.argv.slice(2)
const limitArg = rawArgs.find(arg => arg.startsWith('--limit='))
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 0) : null
const args = rawArgs.filter(arg => !arg.startsWith('--limit='))
const BATCH = ['hu_budapest', 'gb_london', 'ge_tbilisi', 'al_shkoder', 'pl_gdansk', 'la_luang-prabang']
// Best nightlife coverage first: TIER1 destinations that have a safety report
// but no published nightlife report yet.
async function tier1Keys(allFiles) {
  const { TIER1 } = await import('./destinations.mjs')
  const byPlace = new Map(), byCity = new Map()
  for (const file of allFiles) {
    try {
      const r = JSON.parse(await fs.readFile(path.join(CACHE_DIR, file), 'utf8')), key = file.slice(0, -5)
      byPlace.set(`${r.geo.city}, ${r.geo.country}`.toLowerCase(), key)
      const list = byCity.get(r.geo.city.toLowerCase()) ?? []
      list.push(key); byCity.set(r.geo.city.toLowerCase(), list)
    } catch { /* Ignore a corrupt safety cache entry; the next file may match. */ }
  }
  const published = new Set((await listNightlife(true)).filter(r => r.outcome !== 'withheld').map(r => r.city.key))
  const keys = []
  for (const place of TIER1) {
    const key = byPlace.get(place.toLowerCase()) ?? (byCity.get(place.split(',')[0].trim().toLowerCase())?.length === 1 ? byCity.get(place.split(',')[0].trim().toLowerCase())[0] : null)
    if (key && !published.has(key)) keys.push(key)
  }
  return keys
}
async function main() {
  if (args.includes('--audit')) {
    const all = await listNightlife(true)
    console.log(JSON.stringify(all.map(r => ({ city: r.city.city, outcome: r.outcome, overall: r.overall, reasons: r.reasons })), null, 2)); return
  }
  const allFiles = (await fs.readdir(CACHE_DIR)).filter(f => f.endsWith('.json') && !f.includes('.tmp'))
  const due = args.includes('--refresh-due') ? (await listNightlife(true)).filter(r => !r.refresh.venues || Date.now() - Date.parse(r.refresh.venues) > 30 * 86400000 || (!!process.env.TICKETMASTER_API_KEY && (!r.refresh.events || Date.now() - Date.parse(r.refresh.events) > 7 * 86400000))) : []
  const selected = args.includes('--refresh-due') ? due.map(r => r.city.key) : args.includes('--tier1') ? await tier1Keys(allFiles) : args.includes('--test-batch') ? BATCH : args.filter(a => !a.startsWith('--'))
  const keys = LIMIT ? selected.slice(0, LIMIT) : selected
  if ((args.includes('--refresh-due') || args.includes('--tier1')) && !keys.length) { console.log(args.includes('--tier1') ? 'No TIER1 nightlife reports are missing' : 'No nightlife reports are due for refresh'); return }
  if (!keys.length) throw new Error('Usage: npm run nightlife -- <cache-key> [...] | --tier1 [--limit=N] | --refresh-due | --test-batch | --audit | <key> --rescore | <key> --events-only')
  if (keys.length > 25 && usesPublicOverpass()) throw new Error('Public Overpass batch limited to 25 cities per run; use --limit=25 or configure a private OVERPASS_URL before scaling')
  const failures = []
  const results = []
  for (const key of keys) {
    try {
      // Allow country/city slugs in addition to stable safety cache keys.
      let file = allFiles.find(f => f === key + '.json')
      if (!file) {
        for (const candidate of allFiles) {
          const r = JSON.parse(await fs.readFile(path.join(CACHE_DIR, candidate), 'utf8'))
          if (`${countrySlugFor(r.geo.countryCode, r.geo.country)}/${slug(r.geo.city)}` === key) { file = candidate; break }
        }
      }
      if (!file) throw new Error('No existing safety report for ' + key)
      const r = JSON.parse(await fs.readFile(path.join(CACHE_DIR, file), 'utf8'))
      const countrySlug = countrySlugFor(r.geo.countryCode, r.geo.country), citySlug = slug(r.geo.city)
      if (countrySlug === citySlug) throw new Error('Country-level report cannot seed a city')
      const city = { key: file.slice(0, -5), city: r.geo.city, country: r.geo.country, countryCode: r.geo.countryCode, countrySlug, citySlug, safetyPath: `/${countrySlug}/${citySlug}`, lat: r.geo.lat, lon: r.geo.lon, wikidataId: null, population: null, populationDate: null, relationId: null, boundaryVerified: false }
      const prior = due.find(d => d.city.key === city.key)
      const onlyEvents = prior && prior.refresh.venues && Date.now() - Date.parse(prior.refresh.venues) < 30 * 86400000
      const report = await buildNightlife(city, r, { force: args.includes('--force'), rescore: args.includes('--rescore'), eventsOnly: args.includes('--events-only') || !!onlyEvents })
      const summary = { city: report.city.city, outcome: report.outcome, overall: report.overall, venues: report.venues.length, reasons: report.reasons, sources: report.sources.map(s => ({ id: s.id, status: s.status })) }
      results.push(summary)
      if (report.sources.some(s => s.status === 'error')) failures.push({ key, error: report.sources.filter(s => s.status === 'error').map(s => s.name + ': ' + s.note).join('; ') })
      console.log(JSON.stringify(summary))
    } catch (error) { failures.push({ key, error: error.message }); console.error(key + ': ' + error.message) }
  }
  await writeJson(path.join(NIGHTLIFE_DIR, 'last-run.json'), { at: new Date().toISOString(), results, failures })
  if (failures.length) process.exitCode = 1
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
