require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { HomeHeading } = require('../components/home/HomeHeading.tsx')

const HEADLINE = 'Is it safe to travel there? Check any city with real safety data.'

test('the home page renders exactly one visible, descriptive H1', () => {
  const html = renderToStaticMarkup(React.createElement(HomeHeading))
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one H1')
  assert.ok(html.includes(HEADLINE), 'H1 carries the approved, descriptive copy')

  const openTag = html.match(/<h1[^>]*>/)[0]
  // The heading must be real, visible text for crawlers and screen readers.
  assert.doesNotMatch(openTag, /sr-only|\bhidden\b|aria-hidden|display:\s*none/)
  assert.ok(html.includes(`>${HEADLINE}</h1>`), 'H1 is not wrapped in a hidden container')
})

test('the H1 is wired into the server-rendered home page and is not duplicated', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const page = read('app/page.tsx')
  assert.ok(page.includes('<HomeHeading />'), 'home page renders the heading component')

  // The page shell and the landing hero must not introduce another H1.
  for (const file of [
    'app/page.tsx',
    'components/HomeClient.tsx',
    'components/home/HeaderBand.tsx',
    'components/SiteHeader.tsx',
  ]) {
    assert.equal((read(file).match(/<h1[\s>]/g) || []).length, 0, `${file} must not add a second H1`)
  }
})
