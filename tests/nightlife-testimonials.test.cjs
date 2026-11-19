require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { extractTestimonials, testimonialSentiment } = require('../lib/nightlife/testimonials.ts')

test('testimonials keep short attributed first-hand nightlife excerpts', () => {
  const text = "We loved the rooftop bars and the live music in the old town. The clubs were overpriced and far too crowded after midnight. Booking is easy, click here to reserve a table now."
  const quotes = extractTestimonials(text, 'example.com', 'https://example.com/nightlife', '2026-05-01T00:00:00.000Z', 'article')
  assert.equal(quotes.length, 2)
  assert.equal(quotes[0].source, 'example.com')
  assert.equal(quotes[0].publishedAt, '2026-05-01T00:00:00.000Z')
  assert.match(quotes[0].quote, /rooftop bars/)
  assert.equal(quotes[0].sentiment, 'positive')
  assert.equal(quotes[1].sentiment, 'negative')
  assert.ok(quotes.every(item => !/click here/i.test(item.quote)))
})

test('testimonial sentiment is mixed when one sentence has both signals', () => {
  assert.equal(testimonialSentiment('Great bars, but the area felt unsafe and overpriced.'), 'mixed')
  assert.equal(testimonialSentiment('The night market was fun and friendly.'), 'positive')
  assert.equal(testimonialSentiment('The clubs were dirty and rude.'), 'negative')
  assert.equal(testimonialSentiment('We went out on Friday.'), 'mixed')
})

test('testimonial excerpts are bounded and deduplicated', () => {
  const sentence = `We loved the ${'very '.repeat(80)}lively bar scene and would go again.`
  const quotes = extractTestimonials(`${sentence} ${sentence}`, 'example.com', 'https://example.com/a', null, 'search snippet')
  assert.equal(quotes.length, 1)
  assert.ok(quotes[0].quote.length <= 261)
  assert.equal(quotes[0].kind, 'search snippet')
  assert.equal(quotes[0].publishedAt, null)
})
