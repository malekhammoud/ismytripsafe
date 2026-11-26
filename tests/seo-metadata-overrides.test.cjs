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
