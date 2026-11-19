#!/usr/bin/env node
// Portfolio-level consistency check for the nightlife report store.
//
//   node scripts/check-nightlife-portfolio.cjs
//   node scripts/check-nightlife-portfolio.cjs --origin=https://beta.ismytripsafe.com --require-index
//
// The JSON checks are the source of truth. --origin additionally requests every
// published page, its data export and its canonical metadata.
require('./typescript-worker.cjs')
require('@next/env').loadEnvConfig(process.cwd(), false)
const { listNightlife, readNightlife, nightlifePath, nightlifeUrl } = require('../lib/nightlife/store.ts')
const { PIPELINE_VERSION } = require('../lib/nightlife/version.ts')

const args = process.argv.slice(2)
const origin = args.find(arg => arg.startsWith('--origin='))?.split('=').slice(1).join('=').replace(/\/$/, "") || null
const requireIndex = args.includes('--require-index')
const allowWithheld = args.includes('--allow-withheld')
const concurrency = Math.max(1, Math.min(12, Number(args.find(arg => arg.startsWith('--concurrency='))?.split('=')[1]) || 6))
const failures = [], warnings = []
const add = (key, message) => failures.push(`${key}: ${message}`)

async function pool(items, size, run) {
  const results = []
  let cursor = 0
  await Promise.all(Array.from({ length: size }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await run(items[index])
    }
  }))
  return results
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  return { status: response.status, text: await response.text() }
}

async function main() {
  const summaries = await listNightlife(true)
  const reports = []
  let published = 0, withheld = 0
  const coverage = { venues: 0, withHours: 0, withNeighborhood: 0, lateKnown: 0, quality: 0, vibe: 0, density: 0, safety: 0, events: 0, beer: 0, mentions: 0 }
  for (const summary of summaries) {
    const report = await readNightlife(summary.city.key)
    if (!report) { add(summary.city.key, 'report file is missing or unreadable'); continue }
    reports.push(report)
    if (report.outcome === 'withheld') {
      withheld++
      if (!allowWithheld) add(summary.city.key, 'outcome is withheld')
      continue
    }
    published++
    if (report.pipelineVersion !== PIPELINE_VERSION) add(summary.city.key, `pipeline ${report.pipelineVersion ?? 'missing'} != ${PIPELINE_VERSION}`)
    if (!report.city.boundaryVerified) add(summary.city.key, 'city boundary is not verified')
    if (!(Number(report.city.population) > 0)) add(summary.city.key, 'city population is missing')
    if (report.venues.length < 3) add(summary.city.key, `only ${report.venues.length} venues`)
    else if (report.venues.length < 10) warnings.push(`${summary.city.key}: small-scene report with ${report.venues.length} venues`)
    for (const key of ['density', 'quality', 'variety', 'vibe', 'safety']) {
      if (report.scores.find(score => score.key === key)?.value == null) add(summary.city.key, `${key} score is missing`)
    }
    for (const id of ['osm', 'safety']) {
      const source = report.sources.find(item => item.id === id)
      if (!source) add(summary.city.key, `${id} source is missing`)
      else if (source.status !== 'ok') add(summary.city.key, `${id} source is ${source.status}`)
    }
    // A containing-area fallback can publish without a city Wikidata item, but
    // only when OSM and a finite area population make density meaningful.
    const wikidata = report.sources.find(item => item.id === 'wikidata')
    if (!wikidata) add(summary.city.key, 'wikidata source is missing')
    else if (wikidata.status !== 'ok' && !(report.city.boundaryVerified && Number(report.city.population) > 0)) add(summary.city.key, `wikidata source is ${wikidata.status}`)
    if (report.sources.some(source => source.status === 'error')) add(summary.city.key, 'contains an error source')
    if (!report.refresh?.venues || !Number.isFinite(Date.parse(report.refresh.venues))) add(summary.city.key, 'venue refresh date is missing')
    if (report.lateness.total !== report.venues.length) add(summary.city.key, 'lateness denominator does not match venues')
    coverage.venues += report.venues.length
    coverage.withHours += report.venues.filter(venue => !!venue.hours).length
    coverage.withNeighborhood += report.venues.filter(venue => !!venue.neighborhood).length
    coverage.lateKnown += report.lateness.known
    coverage.events += report.events.length
    coverage.beer += report.beer ? 1 : 0
    coverage.mentions += report.mentions.length
    if (report.scores.find(score => score.key === 'quality')?.value != null) coverage.quality++
    if (report.scores.find(score => score.key === 'vibe')?.value != null) coverage.vibe++
    if (report.scores.find(score => score.key === 'density')?.value != null) coverage.density++
    if (report.scores.find(score => score.key === 'safety')?.value != null) coverage.safety++
  }

  let liveOk = 0, dataOk = 0
  if (origin) {
    await pool(reports.filter(report => report.outcome !== 'withheld'), concurrency, async report => {
      const path = nightlifePath(report), canonical = nightlifeUrl(path)
      try {
        const page = await get(origin + path)
        if (page.status !== 200) { add(report.city.key, `page HTTP ${page.status}`); return }
        for (const id of ['the-stars', 'venues', 'data-notes']) if (!page.text.includes(`id="${id}"`)) add(report.city.key, `page missing #${id}`)
        if (!page.text.includes(`rel="canonical" href="${canonical}"`) && !page.text.includes(`rel="canonical" href="${canonical.replace(/&/g, '&amp;')}"`)) add(report.city.key, 'canonical URL does not match the nightlife origin')
        if (requireIndex && !/<meta[^>]+name="robots"[^>]+content="[^"]*index/.test(page.text)) add(report.city.key, 'page is not indexable')
        if (!page.text.includes('"@type":"BreadcrumbList"')) add(report.city.key, 'missing breadcrumb JSON-LD')
        if (!page.text.includes('"@type":"Article"')) add(report.city.key, 'missing article JSON-LD')
        liveOk++
        const data = await get(`${origin}${path}/data.json`)
        if (data.status !== 200 || !/\"licence\":\"ODbL 1\.0\"/.test(data.text)) add(report.city.key, 'data.json is not a valid ODbL export')
        else dataOk++
      } catch (error) { add(report.city.key, `live request failed: ${error.message}`) }
    })
  }

  const totalVenues = reports.reduce((sum, report) => sum + report.venues.length, 0)
  console.log(`Reports: ${summaries.length} total, ${published} published, ${withheld} withheld`)
  console.log(`Venues: ${totalVenues.toLocaleString('en')}; hours ${coverage.withHours.toLocaleString('en')}; neighbourhood labels ${coverage.withNeighborhood.toLocaleString('en')}; interpretable late hours ${coverage.lateKnown.toLocaleString('en')}`)
  console.log(`Scored: density ${coverage.density}, safety ${coverage.safety}, quality ${coverage.quality}, vibe ${coverage.vibe}`)
  console.log(`Optional data: events ${coverage.events}, beer prices ${coverage.beer}, mentions ${coverage.mentions}`)
  if (origin) console.log(`Live: ${liveOk} pages and ${dataOk} ODbL exports checked on ${origin}`)
  if (warnings.length) console.log(`Warnings:\n${warnings.map(line => `  - ${line}`).join('\n')}`)
  if (failures.length) {
    console.error(`FAIL: ${failures.length} issue${failures.length === 1 ? '' : 's'}\n${failures.map(line => `  - ${line}`).join('\n')}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${published} published reports meet the portfolio invariants${origin ? ' and live page checks' : ''}`)
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
