require('../scripts/typescript-worker.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { promises: fs } = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function run() {
  process.env.NIGHTLIFE_CACHE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nightlife-sources-'))
  const { parseWikivoyageListings, listingVenues, splitTemplateParams } = require('../lib/nightlife/wikivoyage.ts')
  const { upcomingHolidays } = require('../lib/nightlife/holidays.ts')
  const { venueQuery } = require('../lib/nightlife/overpass.ts')
  const { mergeVenues, venueType } = require('../lib/nightlife/venues.ts')

  const guide = `
==See==
{{listing|name=City Museum|content=A museum with a courtyard.}}
{{listing|name=Jazz Club|content=Live music and cocktails every night.}}
{{listing|name=Tourist Information|content=Maps and brochures.}}

==Drink==
{{drink
| name=Café Central
| url=https://example.com/cafe
| address=Herrengasse 14
| lat=48.2104 | long=16.3656
| hours=Daily 20:00-02:00
| price=€€
| phone=+43 1 123
| content=A storied [[café|bar]] with '''cocktails''' and live music.
}}
{{listing|name=Nightclub X|lat=48.2000|long=16.3600|content=Techno club with a dark room.}}
`
  const picks = parseWikivoyageListings(guide, 'Vienna')
  assert.equal(picks.length, 3)
  const central = picks.find(p => p.name === 'Café Central')
  const jazz = picks.find(p => p.name === 'Jazz Club')
  const club = picks.find(p => p.name === 'Nightclub X')
  assert.ok(central && jazz && club)
  assert.equal(central.type, 'Cocktail bar')
  assert.equal(central.hours, 'Daily 20:00-02:00')
  assert.equal(central.price, '€€')
  assert.equal(central.url, 'https://example.com/cafe')
  assert.equal(central.lat, 48.2104)
  assert.equal(central.lon, 16.3656)
  assert.match(central.description, /cocktails/)
  assert.doesNotMatch(central.description, /\[\[|'''/)
  assert.match(central.sourceUrl, /Vienna#Drink$/)
  assert.equal(jazz.type, 'Live music')
  assert.equal(club.type, 'Nightclub')
  assert.ok(!picks.some(p => p.name === 'City Museum'))
  assert.ok(!picks.some(p => p.name === 'Tourist Information'))

  // A malicious URL never becomes a link, and duplicate listings collapse.
  const unsafe = parseWikivoyageListings('==Drink==\n{{drink|name=Bad Link|url=javascript:alert(1)|content=Cocktail bar.}}\n{{drink|name=Bad Link|url=javascript:alert(1)|content=Cocktail bar.}}', 'Test')
  assert.equal(unsafe.length, 1)
  assert.equal(unsafe[0].url, undefined)

  const boundary = { outer: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], inner: [] }
  const inside = { ...central, id: 'pick-inside', lat: 1, lon: 1 }
  const outside = { ...central, id: 'pick-outside', lat: 5, lon: 5 }
  const mapped = listingVenues([inside, outside], boundary)
  assert.equal(mapped.length, 1)
  assert.match(mapped[0].id, /^wv-/)
  assert.equal(mapped[0].tags?.['wv:guide'], 'yes')
  assert.equal(mapped[0].tags?.website, undefined, 'guide contact fields must not enter the ODbL venue tags')
  assert.equal(mapped[0].sources[0].id, 'wikivoyage')
  assert.equal(listingVenues([inside], null).length, 0, 'without geometry, unmatched guide venues must not become counts')
  const osmMatch = { id: 'osm-1', name: 'Café Central', lat: 1, lon: 1, type: 'Dive / casual bar', sources: [{ id: 'osm', url: 'https://www.openstreetmap.org/node/1' }] }
  assert.equal(listingVenues([inside], null, [osmMatch]).length, 1, 'a name-and-proximity match may enrich an OSM venue')

  const now = Date.parse('2026-11-26T12:00:00Z')
  const holidays = upcomingHolidays([
    { date: '2026-12-25', name: 'Christmas Day', localName: 'Weihnachten', global: true },
    { date: '2026-12-26', name: 'Boxing Day', global: false },
    { date: '2026-11-01', name: 'Past holiday', global: true },
    { date: '2027-06-01', name: 'Too far away', global: true },
    { date: '2026-12-25', name: 'Christmas Day', global: true },
    { date: 'not-a-date', name: 'Invalid', global: true },
  ], now)
  assert.deepEqual(holidays, [{ date: '2026-12-25', name: 'Christmas Day', localName: 'Weihnachten' }])
  const many = upcomingHolidays(Array.from({ length: 12 }, (_, i) => ({ date: `2026-12-${String(i + 1).padStart(2, '0')}`, name: `Holiday ${i}`, global: true })), now)
  assert.equal(many.length, 8)

  const query = venueQuery(3600000123)
  for (const tag of ['amenity=casino', 'amenity=stripclub', 'amenity=hookah_lounge', 'leisure=dance', 'out count']) {
    assert.ok(query.includes(tag), `venue query must include ${tag}`)
  }

  assert.equal(venueType('casino'), 'Casino')
  assert.equal(venueType('dance hall'), 'Dance hall')
  assert.equal(venueType('hookah lounge'), 'Hookah lounge')
  assert.equal(venueType('strip club'), 'Adult entertainment')

  const osm = { id: 'osm-node-1', name: 'Café Central', lat: 48.2104, lon: 16.3656, type: 'Dive / casual bar', hours: 'Mo-Su 18:00-04:00', tags: { outdoor_seating: 'yes' }, sources: [{ id: 'osm', url: 'https://www.openstreetmap.org/node/1' }] }
  const listing = { id: 'wv-1', name: 'Cafe Central', lat: 48.2104, lon: 16.3656, type: 'Cocktail bar', tags: { 'wv:guide': 'yes' }, sources: [{ id: 'wikivoyage', url: 'https://en.wikivoyage.org/wiki/Vienna#Drink' }] }
  const merged = mergeVenues([osm], [listing])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].hours, 'Mo-Su 18:00-04:00', 'a guide listing without hours must not erase OSM hours')
  assert.equal(merged[0].type, 'Dive / casual bar', 'guide taxonomy must not overwrite the ODbL venue type')
  assert.equal(merged[0].tags?.outdoor_seating, 'yes')
  assert.equal(merged[0].tags?.['wv:guide'], 'yes')
  assert.equal(merged[0].tags?.website, undefined)
  assert.equal(merged[0].sources.length, 2)

  const fsq = { ...osm, id: 'fsq-1', rating: 9, votes: 50, popularity: 0.8, sources: [{ id: 'foursquare', url: 'https://foursquare.com/v/1' }] }
  const both = mergeVenues(mergeVenues([osm], [fsq]), [listing])
  assert.equal(both.length, 1)
  assert.equal(both[0].rating, 9)
  assert.equal(both[0].hours, 'Mo-Su 18:00-04:00')
  assert.equal(both[0].type, 'Dive / casual bar')
  assert.deepEqual(both[0].sources.map(source => source.id), ['osm', 'foursquare', 'wikivoyage'])
  assert.equal(both[0].tags?.['wv:guide'], 'yes')

  assert.deepEqual(splitTemplateParams('a=1|b=[[x|y]]|c={{d|e}}'), ['a=1', 'b=[[x|y]]', 'c={{d|e}}'])
  console.log('PASS: Wikivoyage listings, coordinate clipping, holiday window, expanded OSM categories, and non-destructive venue merging')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
