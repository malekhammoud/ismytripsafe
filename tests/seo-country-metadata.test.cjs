require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { countryTitleOverride } = require('../lib/seo/country-metadata.ts')
// Country hubs are keyed on `/{countrySlug}`. Deriving the expected path from
// the same GeoPoint the report index stores catches a key that drifts from the
// slug and would silently leave the long title in place.
const { pathForGeo } = require('../lib/reports.ts')

const TREATMENT = {
  pagePath: '/kyrgyzstan',
  country: 'Kyrgyzstan',
  countryCode: 'KG',
}

// Matched controls from the experiment. /gabon is another country hub; the
// other two are static public pages that must keep their own metadata.
const CONTROL_PATHS = ['/gabon', '/credits', '/how-it-works']

const YEARS = [2025, 2026]
const SUFFIX = ' | IsMyTripSafe'

test('the treatment path is exactly the slug-derived country hub path', () => {
  const derived = pathForGeo({
    city: TREATMENT.country,
    country: '',
    countryCode: TREATMENT.countryCode,
  })
  assert.equal(
    derived,
    TREATMENT.pagePath,
    `${TREATMENT.country} resolves to ${derived}, but the override is keyed on ${TREATMENT.pagePath}`
  )
})

test('the Kyrgyzstan title fits 60 characters and keeps the country and year', () => {
  for (const year of YEARS) {
    const title = countryTitleOverride(TREATMENT.pagePath, { year })
    assert.ok(title, `${TREATMENT.pagePath} must have a title override`)
    const rendered = `${title}${SUFFIX}`
    assert.ok(
      rendered.length <= 60,
      `${TREATMENT.pagePath} in ${year}: rendered title is ${rendered.length} chars — "${rendered}"`
    )
    assert.ok(title.includes(String(year)), `${TREATMENT.pagePath} states the current year`)
    assert.match(title, /Kyrgyzstan/, `${TREATMENT.pagePath} names the country`)
    assert.match(title, /\bSafe\b/, `${TREATMENT.pagePath} keeps the safety question`)
    assert.doesNotMatch(title, /\{[a-z]+\}/, `${TREATMENT.pagePath} has an unfilled token`)
  }
})

test('matched control pages keep the shared template', () => {
  for (const pagePath of CONTROL_PATHS) {
    assert.equal(
      countryTitleOverride(pagePath, { year: 2026 }),
      null,
      `${pagePath} is a control and must not receive a rewritten title`
    )
  }
})

test('the country route applies the override to metadata only', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '..', 'app/[country]/page.tsx'),
    'utf8'
  )
  assert.ok(
    page.includes('countryTitleOverride(`/${hub.countrySlug}`'),
    'the route looks up the override by the canonical country path'
  )
  assert.ok(
    page.includes('}) ??'),
    'an untreated hub still falls back to the shared title'
  )
  // The default title and shared description stay in place for every control.
  assert.ok(page.includes('Advisories, Crime Data & City Scores'))
  assert.ok(page.includes('travel safety:'))
})
