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
const { listNightlifeRequests, completeNightlifeRequest } = require('../lib/nightlife/requests.ts')
const rawArgs = process.argv.slice(2)
const limitArg = rawArgs.find(arg => arg.startsWith('--limit='))
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 0) : null
const args = rawArgs.filter(arg => !arg.startsWith('--limit='))
const BATCH = ['hu_budapest', 'gb_london', 'ge_tbilisi', 'al_shkoder', 'pl_gdansk', 'la_luang-prabang']
// Islands/regions in the destination list are not cities. They have no
// settlement item or city boundary, so retrying them every night only creates
// withheld placeholders. Explicit keys can still be requested by hand.
const NON_CITY_KEYS = new Set(['gr_santorini', 'in_goa', 'jo_petra'])
const COUNTRY_ALIASES = { turkey: 'TR', 'republic of turkey': 'TR' }
const normalizeCity = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\bst\.?\b/g, 'saint').replace(/[^a-z0-9]+/g, ' ').trim()
const cityVariants = (value) => {
  const base = normalizeCity(value), variants = new Set([base])
  for (const suffix of ['city', 'town', 'municipality']) if (base.endsWith(` ${suffix}`)) variants.add(base.slice(0, -suffix.length - 1))
  return variants
}
// Best nightlife coverage first: TIER1 destinations that have a safety report
// but no published nightlife report yet. Match on city plus ISO country code,
// never city name alone: "Cappadocia, Turkey" must not resolve to the Italian
// town of Cappadocia.
async function tier1Keys(allFiles) {
  const [{ TIER1 }, { default: countries }] = await Promise.all([import('./destinations.mjs'), import('world-countries')])
  const codeByName = new Map()
  for (const country of countries) for (const name of [country.name.common, country.name.official, ...(country.altSpellings ?? [])]) if (name) codeByName.set(name.toLowerCase(), country.cca2)
  const byPlace = new Map(), byCityCode = new Map(), countryLevel = new Set()
  for (const file of allFiles) {
    try {
      const r = JSON.parse(await fs.readFile(path.join(CACHE_DIR, file), 'utf8')), key = file.slice(0, -5)
      byPlace.set(`${r.geo.city}, ${r.geo.country}`.toLowerCase(), key)
      if (r.geo.countryCode) for (const name of cityVariants(r.geo.city)) byCityCode.set(`${name}|${r.geo.countryCode.toUpperCase()}`, key)
      if (r.geo.city.toLowerCase() === r.geo.country.toLowerCase()) countryLevel.add(key)
    } catch { /* Ignore a corrupt safety cache entry; the next file may match. */ }
  }
  const published = new Set((await listNightlife(true)).filter(r => r.outcome !== 'withheld').map(r => r.city.key))
  const keys = []
  for (const place of TIER1) {
    const [city, ...rest] = place.split(','), country = rest.join(',').trim().toLowerCase()
    const code = codeByName.get(country) ?? COUNTRY_ALIASES[country]
    const key = byPlace.get(place.toLowerCase()) ?? (code ? [...cityVariants(city.trim())].map(name => byCityCode.get(`${name}|${code}`)).find(Boolean) : null)
    // Country-level reports (Singapore, Hong Kong) cannot seed the two-segment
    // nightlife route. Skip them rather than throwing mid-batch.
    if (!key || countryLevel.has(key) || NON_CITY_KEYS.has(key) || published.has(key)) continue
    keys.push(key)
  }
  return keys
}
async function main() {
  if (args.includes('--audit')) {
    const all = await listNightlife(true)
    const requests = await listNightlifeRequests('all')
    console.log(JSON.stringify({ reports: all.map(r => ({ city: r.city.city, outcome: r.outcome, overall: r.overall, reasons: r.reasons })), requests }, null, 2)); return
  }
  const allFiles = (await fs.readdir(CACHE_DIR)).filter(f => f.endsWith('.json') && !f.includes('.tmp'))
  const due = args.includes('--refresh-due') ? (await listNightlife(true)).filter(r => !NON_CITY_KEYS.has(r.city.key))
    .filter(r => !r.refresh.venues || Date.now() - Date.parse(r.refresh.venues) > 30 * 86400000 || (!!process.env.TICKETMASTER_API_KEY && (!r.refresh.events || Date.now() - Date.parse(r.refresh.events) > 7 * 86400000))) : []
  const rescoreAll = args.includes('--rescore-all'), testimonialsAll = args.includes('--testimonials-all'), testimonialsOnly = args.includes('--testimonials-only')
  // Visitor requests jump the queue. `--refresh-due` is the nightly command,
  // so a request made on /nightlife is picked up tomorrow night rather than
  // waiting for a slot behind thirty stale venue lists.
  const pendingRequests = args.includes('--refresh-due') || args.includes('--requests') ? await listNightlifeRequests('pending') : []
  const requestedKeys = pendingRequests.map(r => r.key).filter(key => allFiles.includes(`${key}.json`))
  const dueKeys = due.map(r => r.city.key)
  const selected = rescoreAll || testimonialsAll ? (await listNightlife(true)).filter(r => r.outcome !== 'withheld').map(r => r.city.key)
    : args.includes('--refresh-due') || args.includes('--requests') ? [...new Set([...requestedKeys, ...dueKeys])]
    : args.includes('--tier1') ? await tier1Keys(allFiles) : args.includes('--test-batch') ? BATCH : args.filter(a => !a.startsWith('--'))
  const keys = LIMIT ? selected.slice(0, LIMIT) : selected
  if ((args.includes('--refresh-due') || args.includes('--requests') || args.includes('--tier1') || rescoreAll || testimonialsAll) && !keys.length) { console.log(args.includes('--requests') ? 'No pending city requests' : args.includes('--tier1') ? 'No TIER1 nightlife reports are missing' : rescoreAll ? 'No published nightlife reports to rescore' : testimonialsAll ? 'No published nightlife reports to search' : 'No nightlife reports are due for refresh'); return }
  if (!keys.length) throw new Error('Usage: npm run nightlife -- <cache-key> [...] | --tier1 [--limit=N] | --refresh-due | --requests | --rescore-all | --testimonials-all | --test-batch | --audit | <key> --rescore | <key> --events-only | <key> --testimonials-only')
  if (!rescoreAll && !testimonialsAll && !testimonialsOnly && keys.length > 25 && usesPublicOverpass()) throw new Error('Public Overpass batch limited to 25 cities per run; use --limit=25 or configure a private OVERPASS_URL before scaling')
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
      const city = { key: file.slice(0, -5), city: r.geo.city, country: r.geo.country, countryCode: r.geo.countryCode, countrySlug, citySlug, safetyPath: `/${countrySlug}/${citySlug}`, lat: r.geo.lat, lon: r.geo.lon, wikidataId: null, population: r.geo.population ?? null, populationDate: null, relationId: null, boundaryVerified: false }
      const prior = due.find(d => d.city.key === city.key)
      const onlyEvents = prior && prior.refresh.venues && Date.now() - Date.parse(prior.refresh.venues) < 30 * 86400000
      const report = await buildNightlife(city, r, { force: args.includes('--force'), rescore: args.includes('--rescore') || rescoreAll, eventsOnly: args.includes('--events-only') || !!onlyEvents, testimonialsOnly: testimonialsOnly || testimonialsAll })
      // Mark the ask complete with whatever answer the pipeline reached:
      // published, small-scene, or withheld. A withheld city must not be
      // retried every night on the strength of one request.
      if (pendingRequests.some(request => request.key === city.key)) await completeNightlifeRequest(city.key, report.outcome)
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
