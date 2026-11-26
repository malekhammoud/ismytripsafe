// Run directly, or through tests/report-client.test.cjs in `npm run
// test:nightlife`. The build-time guard in lib/seo/city-metadata.ts also
// enforces the title/description lengths during `npm run build`.
require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { cityMetadataOverride } = require('../lib/seo/city-metadata.ts')
// The report route keys its lookup on `meta.path`, which is built from the
// GeoPoint. Deriving each expected path here catches a key that drifts from
// the slug ("Tromsø" → /norway/troms) and would silently disable the override.
const { pathForGeo } = require('../lib/reports.ts')

// pagePath is what the runtime computes for this GeoPoint; the `city` spelling
// is deliberately the ungainly one the research pipeline stores, so accents and
// spaces are exercised by the real slug function.
const TREATMENT = [
  { pagePath: '/united-states/los-angeles', city: 'Los Angeles', countryCode: 'US' },
  { pagePath: '/australia/melbourne', city: 'Melbourne', countryCode: 'AU' },
  { pagePath: '/sweden/malmo', city: 'Malmö', countryCode: 'SE' },
  { pagePath: '/french-polynesia/bora-bora', city: 'Bora Bora', countryCode: 'PF' },
  { pagePath: '/germany/dusseldorf', city: 'Düsseldorf', countryCode: 'DE' },
  { pagePath: '/norway/troms', city: 'Tromsø', countryCode: 'NO' },
  { pagePath: '/philippines/cebu-city', city: 'Cebu City', countryCode: 'PH' },
  { pagePath: '/puerto-rico/rincon', city: 'Rincón', countryCode: 'PR' },
  { pagePath: '/spain/barcelona', city: 'Barcelona', countryCode: 'ES' },
  { pagePath: '/india/hyderabad', city: 'Hyderabad', countryCode: 'IN' },
]

// /dominican-republic/la-romana is a city report, so it exercises the same
// city-page fallback as the treatment pages. /it is a country hub on a
// different route: it must not gain or lose city overrides at all.
const CITY_CONTROL = {
  pagePath: '/dominican-republic/la-romana',
  city: 'La Romana',
  countryCode: 'DO',
}
const COUNTRY_CONTROL = '/it'

// Score width changes the rendered length, so every width is checked.
const SCORES = [0, 7, 42, 92, 100]
const YEAR = 2026
const SUFFIX = ' | IsMyTripSafe'

test('treatment keys are exactly the slug-derived paths the report route uses', () => {
  for (const { pagePath, city, countryCode } of TREATMENT) {
    const derived = pathForGeo({ city, country: '', countryCode })
    assert.equal(
      derived,
      pagePath,
      `${city} (${countryCode}) resolves to ${derived}, but the override is keyed on ${pagePath}`
    )
    assert.ok(
      cityMetadataOverride(derived, { year: YEAR, score: 92 }),
      `${derived} must have a treatment override`
    )
  }
})

test('treatment city reports get rewritten titles that stay within 60 characters', () => {
  for (const { pagePath } of TREATMENT) {
    for (const score of SCORES) {
      const { title } = cityMetadataOverride(pagePath, { year: YEAR, score })
      const rendered = `${title}${SUFFIX}`
      assert.ok(
        rendered.length <= 60,
        `${pagePath} at score ${score}: rendered title is ${rendered.length} chars — "${rendered}"`
      )
      assert.ok(title.includes(String(YEAR)), `${pagePath} states the current year`)
      assert.doesNotMatch(title, /\{[a-z]+\}/, `${pagePath} has an unfilled token`)
    }
  }
})

test('treatment descriptions stay between 140 and 160 characters at any score width', () => {
  for (const { pagePath } of TREATMENT) {
    for (const score of SCORES) {
      const { description } = cityMetadataOverride(pagePath, { year: YEAR, score })
      assert.ok(
        description.length >= 140 && description.length <= 160,
        `${pagePath} at score ${score}: description is ${description.length} chars — "${description}"`
      )
      assert.ok(description.includes(`${score}/100`), `${pagePath} states the live score`)
      assert.ok(description.includes(String(YEAR)), `${pagePath} states the current year`)
      assert.doesNotMatch(description, /\{[a-z]+\}/, `${pagePath} has an unfilled token`)
    }
  }
})

test('Malmö attributes its own score to the city, never to Sweden', () => {
  for (const score of SCORES) {
    const copy = cityMetadataOverride('/sweden/malmo', { year: YEAR, score })
    assert.ok(copy, 'Malmö must keep its override')
    assert.match(copy.title, /Malmö Safety Score/)
    assert.match(copy.description, new RegExp(`Malmö's safety score is ${score}/100`))
    assert.doesNotMatch(copy.title, /Sweden Safety Score/)
    assert.doesNotMatch(copy.description, /score \d+\/100 for Sweden/)
  }
})

test('an untreated city report falls back to the shared report metadata', () => {
  const derived = pathForGeo({
    city: CITY_CONTROL.city,
    country: '',
    countryCode: CITY_CONTROL.countryCode,
  })
  assert.equal(
    derived,
    CITY_CONTROL.pagePath,
    `${CITY_CONTROL.city} resolves to ${derived}, not ${CITY_CONTROL.pagePath}`
  )
  assert.equal(cityMetadataOverride(derived, { year: YEAR, score: 92 }), null)
})

test('the country hub route stays outside the city override', () => {
  assert.equal(cityMetadataOverride(COUNTRY_CONTROL, { year: YEAR, score: 92 }), null)

  const countryPage = fs.readFileSync(
    path.join(__dirname, '..', 'app/[country]/page.tsx'),
    'utf8'
  )
  assert.doesNotMatch(countryPage, /cityMetadataOverride/)
})

test('each treatment page gets its own title and description', () => {
  const titles = new Set()
  const descriptions = new Set()
  for (const { pagePath } of TREATMENT) {
    const copy = cityMetadataOverride(pagePath, { year: YEAR, score: 92 })
    titles.add(copy.title)
    descriptions.add(copy.description)
  }
  assert.equal(titles.size, TREATMENT.length)
  assert.equal(descriptions.size, TREATMENT.length)
})

test('the city report metadata uses the override without changing the visible report', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '..', 'app/[country]/[city]/page.tsx'),
    'utf8'
  )
  assert.match(page, /cityMetadataOverride\(meta\.path/)
  assert.match(page, /override\?\.title \?\?/)
  assert.match(page, /override\?\.description \?\?/)
  // The shared fallback and the default description helper stay intact.
  assert.ok(page.includes('metaDescription(report)'))
  assert.ok(page.includes('Safety Score ${meta.score}/100'))
})

// ─── CTR cohort (Nov 2026) ───────────────────────────────────────────
// Ten page-one city reports were rewritten for query intent. The slug
// spellings below are the ones the research pipeline stores, so `pathForGeo`
// proves the override key matches the route's `meta.path`.
const CTR_TREATMENT = [
  { pagePath: '/malaysia/langkawi', city: 'Langkawi', countryCode: 'MY' },
  { pagePath: '/malaysia/johor-bahru', city: 'Johor Bahru', countryCode: 'MY' },
  { pagePath: '/hungary/budapest', city: 'Budapest', countryCode: 'HU' },
  { pagePath: '/brazil/sao-luis', city: 'São Luís', countryCode: 'BR' },
  { pagePath: '/india/darjeeling', city: 'Darjeeling', countryCode: 'IN' },
  { pagePath: '/finland/rovaniemi', city: 'Rovaniemi', countryCode: 'FI' },
  { pagePath: '/italy/lecce', city: 'Lecce', countryCode: 'IT' },
  { pagePath: '/united-states/jersey-city', city: 'Jersey City', countryCode: 'US' },
  { pagePath: '/china/chengdu', city: 'Chengdu', countryCode: 'CN' },
  { pagePath: '/portugal/faro', city: 'Faro', countryCode: 'PT' },
]

// Matched controls must stay on the shared template. The last two are
// non-city routes, which never read the city override at all.
const CTR_CITY_CONTROLS = [
  { pagePath: '/spain/madrid', city: 'Madrid', countryCode: 'ES' },
  { pagePath: '/norway/oslo', city: 'Oslo', countryCode: 'NO' },
  { pagePath: '/thailand/bangkok', city: 'Bangkok', countryCode: 'TH' },
  { pagePath: '/brazil/paraty', city: 'Paraty', countryCode: 'BR' },
  { pagePath: '/peru/chiclayo', city: 'Chiclayo', countryCode: 'PE' },
]
const CTR_PAGE_CONTROLS = ['/', '/libya/be']

test('CTR treatment keys are exactly the slug-derived paths the report route uses', () => {
  for (const { pagePath, city, countryCode } of CTR_TREATMENT) {
    const derived = pathForGeo({ city, country: '', countryCode })
    assert.equal(
      derived,
      pagePath,
      `${city} (${countryCode}) resolves to ${derived}, but the override is keyed on ${pagePath}`
    )
    assert.ok(
      cityMetadataOverride(derived, { year: YEAR, score: 92 }),
      `${derived} must have a CTR treatment override`
    )
  }
})

test('CTR treatment titles stay within 60 characters and state the year', () => {
  for (const { pagePath } of CTR_TREATMENT) {
    for (const score of SCORES) {
      const { title } = cityMetadataOverride(pagePath, { year: YEAR, score })
      const rendered = `${title}${SUFFIX}`
      assert.ok(
        rendered.length <= 60,
        `${pagePath} at score ${score}: rendered title is ${rendered.length} chars — "${rendered}"`
      )
      assert.ok(title.includes(String(YEAR)), `${pagePath} states the current year`)
      assert.doesNotMatch(title, /\{[a-z]+\}/, `${pagePath} has an unfilled token`)
    }
  }
})

test('CTR treatment descriptions stay between 140 and 160 characters at any score width', () => {
  for (const { pagePath } of CTR_TREATMENT) {
    for (const score of SCORES) {
      const { description } = cityMetadataOverride(pagePath, { year: YEAR, score })
      assert.ok(
        description.length >= 140 && description.length <= 160,
        `${pagePath} at score ${score}: description is ${description.length} chars — "${description}"`
      )
      assert.ok(description.includes(`${score}/100`), `${pagePath} states the live score`)
      assert.ok(description.includes(String(YEAR)), `${pagePath} states the current year`)
      assert.doesNotMatch(description, /\{[a-z]+\}/, `${pagePath} has an unfilled token`)
    }
  }
})

test('Rovaniemi copy describes the live forecast, not climate averages', () => {
  for (const score of SCORES) {
    const copy = cityMetadataOverride('/finland/rovaniemi', { year: YEAR, score })
    assert.ok(copy, 'Rovaniemi must keep its override')
    assert.match(copy.title, /Rovaniemi Weather Forecast & Safety/)
    assert.match(copy.description, /weather forecast/)
    // The page shows a 16-day Open-Meteo outlook, not climate normals, so the
    // snippet must not claim average-temperature data the report never renders.
    assert.doesNotMatch(`${copy.title} ${copy.description}`, /\baverage\b|climate/i)
  }
})

test('CTR treatment descriptions name the city itself', () => {
  for (const { pagePath, city } of CTR_TREATMENT) {
    const copy = cityMetadataOverride(pagePath, { year: YEAR, score: 92 })
    assert.ok(
      copy.description.includes(city),
      `${pagePath} description must name ${city} — "${copy.description}"`
    )
  }
})

test('Johor Bahru names the city in its closing clause', () => {
  const copy = cityMetadataOverride('/malaysia/johor-bahru', { year: YEAR, score: 92 })
  assert.match(copy.description, /for Johor Bahru\.$/)
})

test('the SEO suite stays wired into the package test gate', () => {
  // package.json cannot gain a script for every file, so the nightlife gate
  // runs this suite through report-client.test.cjs. Assert that link so it
  // cannot be dropped silently.
  const gate = fs.readFileSync(path.join(__dirname, 'report-client.test.cjs'), 'utf8')
  assert.match(gate, /require\('\.\/seo-metadata-overrides\.test\.cjs'\)/)
})

test('CTR treatment pages get their own copy and every control keeps the shared fallback', () => {
  const titles = new Set()
  const descriptions = new Set()
  for (const { pagePath } of CTR_TREATMENT) {
    const copy = cityMetadataOverride(pagePath, { year: YEAR, score: 92 })
    titles.add(copy.title)
    descriptions.add(copy.description)
  }
  assert.equal(titles.size, CTR_TREATMENT.length)
  assert.equal(descriptions.size, CTR_TREATMENT.length)

  for (const { pagePath, city, countryCode } of CTR_CITY_CONTROLS) {
    const derived = pathForGeo({ city, country: '', countryCode })
    assert.equal(derived, pagePath, `${city} resolves to ${derived}, not ${pagePath}`)
    assert.equal(
      cityMetadataOverride(derived, { year: YEAR, score: 92 }),
      null,
      `${pagePath} must keep the shared report metadata`
    )
  }
  for (const pagePath of CTR_PAGE_CONTROLS) {
    assert.equal(cityMetadataOverride(pagePath, { year: YEAR, score: 92 }), null)
  }
})
