require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { cityMetadataOverride } = require('../lib/seo/city-metadata.ts')
// The report route keys its lookup on `meta.path`; derive each expected path
// from the stored GeoPoint so a slug change cannot silently disable the copy.
const { pathForGeo } = require('../lib/reports.ts')

// Approved treatment pages. `queryPhrase` is the distinguishing wording each
// page ranks for (or, for George, the disambiguated place name) that the
// rewritten title has to carry.
const TREATMENT = [
  {
    pagePath: '/canada/montreal',
    city: 'Montreal',
    countryCode: 'CA',
    queryPhrase: /Old Montreal/,
  },
  {
    pagePath: '/cyprus/larnaca',
    city: 'Larnaca',
    countryCode: 'CY',
    queryPhrase: /Larnaka/,
  },
  {
    pagePath: '/china/hong-kong',
    city: 'Hong Kong',
    countryCode: 'CN',
    queryPhrase: /Hong Kong/,
  },
  {
    pagePath: '/south-africa/george',
    city: 'George',
    countryCode: 'ZA',
    queryPhrase: /George, South Africa/,
  },
  {
    pagePath: '/poland/gdansk',
    city: 'Gdańsk',
    countryCode: 'PL',
    queryPhrase: /Gdańsk/,
  },
]

// Matched controls from the experiment. They must keep the shared template.
const CONTROL_PATHS = [
  '/romania/cluj-napoca',
  '/netherlands/eindhoven',
  '/new-zealand/auckland',
  '/ukraine/uzhhorod',
  '/india/madurai',
]

// Score width changes rendered length, so every width is checked.
const SCORES = [0, 7, 42, 92, 100]
const YEAR = 2026
const SUFFIX = ' | IsMyTripSafe'

test('treatment paths are exactly the slug-derived city report paths', () => {
  for (const { pagePath, city, countryCode } of TREATMENT) {
    const derived = pathForGeo({ city, country: '', countryCode })
    assert.equal(
      derived,
      pagePath,
      `${city} (${countryCode}) resolves to ${derived}, but the override is keyed on ${pagePath}`
    )
  }
})

test('treatment titles carry the query wording and stay within 60 characters', () => {
  for (const { pagePath, queryPhrase } of TREATMENT) {
    for (const score of SCORES) {
      const copy = cityMetadataOverride(pagePath, { year: YEAR, score })
      assert.ok(copy, `${pagePath} must have a metadata override`)
      const rendered = `${copy.title}${SUFFIX}`
      assert.ok(
        rendered.length <= 60,
        `${pagePath} at score ${score}: rendered title is ${rendered.length} chars — "${rendered}"`
      )
      assert.ok(copy.title.includes(String(YEAR)), `${pagePath} states the current year`)
      assert.match(copy.title, queryPhrase, `${pagePath} echoes its query wording`)
      assert.doesNotMatch(copy.title, /\{[a-z]+\}/, `${pagePath} has an unfilled token`)
    }
  }
})

test('treatment descriptions stay between 140 and 160 characters at any score width', () => {
  for (const { pagePath, queryPhrase } of TREATMENT) {
    for (const score of SCORES) {
      const copy = cityMetadataOverride(pagePath, { year: YEAR, score })
      assert.ok(copy, `${pagePath} must have a metadata override`)
      assert.ok(
        copy.description.length >= 140 && copy.description.length <= 160,
        `${pagePath} at score ${score}: description is ${copy.description.length} chars — "${copy.description}"`
      )
      assert.ok(copy.description.includes(`${score}/100`), `${pagePath} states the live score`)
      assert.ok(copy.description.includes(String(YEAR)), `${pagePath} states the current year`)
      assert.match(copy.description, queryPhrase, `${pagePath} echoes its query wording`)
      assert.doesNotMatch(copy.description, /\{[a-z]+\}/, `${pagePath} has an unfilled token`)
    }
  }
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

test('matched control pages keep the shared report template', () => {
  for (const pagePath of CONTROL_PATHS) {
    assert.equal(
      cityMetadataOverride(pagePath, { year: YEAR, score: 92 }),
      null,
      `${pagePath} is a control and must not receive rewritten metadata`
    )
  }
})

test('the city report route applies the copy only to metadata', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '..', 'app/[country]/[city]/page.tsx'),
    'utf8'
  )
  assert.match(page, /cityMetadataOverride\(meta\.path/)
  assert.match(page, /override\?\.title \?\?/)
  assert.match(page, /override\?\.description \?\?/)
  // The visible report and its shared fallback stay untouched.
  assert.ok(page.includes('metaDescription(report)'))
  assert.ok(page.includes('Safety Score ${meta.score}/100'))
})
