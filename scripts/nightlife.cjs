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
const args = process.argv.slice(2)
const BATCH = ['hu_budapest', 'gb_london', 'ge_tbilisi', 'al_shkoder', 'pl_gdansk', 'la_luang-prabang']
async function main() {
  if (args.includes('--audit')) {
    const all = await listNightlife(true)
    console.log(JSON.stringify(all.map(r => ({ city: r.city.city, outcome: r.outcome, overall: r.overall, reasons: r.reasons })), null, 2)); return
  }
  const allFiles = (await fs.readdir(CACHE_DIR)).filter(f => f.endsWith('.json') && !f.includes('.tmp'))
  const due = args.includes('--refresh-due') ? (await listNightlife(true)).filter(r => !r.refresh.venues || Date.now() - Date.parse(r.refresh.venues) > 30 * 86400000 || (!!process.env.TICKETMASTER_API_KEY && (!r.refresh.events || Date.now() - Date.parse(r.refresh.events) > 7 * 86400000))) : []
  const keys = args.includes('--refresh-due') ? due.map(r => r.city.key) : args.includes('--test-batch') ? BATCH : args.filter(a => !a.startsWith('--'))
  if (args.includes('--refresh-due') && !keys.length) { console.log('No nightlife reports are due for refresh'); return }
  if (!keys.length) throw new Error('Usage: npm run nightlife -- <cache-key> [...] | --test-batch | --audit | <key> --rescore | <key> --events-only')
  if (keys.length > 10 && usesPublicOverpass()) throw new Error('Public Overpass pilot limited to 10 cities per run; configure private OVERPASS_URL and OVERPASS_FALLBACK_URL before scaling')
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
