// Does every report say it is where it actually is?
//
//   node scripts/check-locations.mjs
//
// Two Tahitian islands shipped filed under France, drawn on the globe 15,900 km
// from Paris, because OpenStreetMap tags French Polynesia's country as France
// and the geocoder believed it. Nothing caught that, so this does.
//
// The test is: how far is a city from its own country? Distance alone is too
// blunt to judge on — Honolulu is 6,000 km from the middle of the United
// States and perfectly correctly filed — so a country's allowance scales with
// how big it is, and a second pass asks GeoNames what country it thinks the
// coordinates are in. A place is only reported when the two databases disagree
// about the country, which is the shape the real error had.
import { readdir, readFile } from "node:fs/promises"
import worldCountries from "world-countries"

const DIR = process.env.REPORT_CACHE_DIR || "/var/lib/ismytripsafe/reports"
const byIso = new Map(worldCountries.map((c) => [c.cca2, c]))

function km(aLat, aLon, bLat, bLon) {
  const t = Math.PI / 180
  const dLat = (bLat - aLat) * t
  const dLon = (bLon - aLon) * t
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

async function ask(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=10&language=en&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return []
  return (await res.json()).results ?? []
}

/**
 * Ask GeoNames about a city name and return every country it offers.
 *
 * Twice, if the first ask comes back empty: the stored name is whatever the
 * geocoder called the place, and "Mo’orea" with a typographic apostrophe finds
 * nothing in a database that spells it "Moorea". Missing the second island of
 * the pair that started all this would have been a poor showing for a checker.
 */
async function probe(city) {
  const hits = await ask(city)
  if (hits.length) return hits
  const plain = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
  return plain && plain !== city ? ask(plain) : []
}

const files = (await readdir(DIR)).filter((f) => f.endsWith(".json"))
const far = []

for (const f of files) {
  let j
  try {
    j = JSON.parse(await readFile(`${DIR}/${f}`, "utf8"))
  } catch {
    continue
  }
  const g = j.geo ?? {}
  if (typeof g.lat !== "number" || typeof g.lon !== "number") {
    console.log(`no coordinates   ${f}`)
    continue
  }
  const iso = String(g.countryCode || f.split("_")[0]).toUpperCase()
  const c = byIso.get(iso)
  if (!c?.latlng) {
    console.log(`unknown country  ${iso.padEnd(4)} ${f}`)
    continue
  }
  const d = km(g.lat, g.lon, c.latlng[0], c.latlng[1])
  // Land area → a rough radius, then a generous multiple of it. Big and
  // scattered countries get a long leash; a 600 km floor keeps small ones from
  // failing on their own suburbs.
  const allowance = Math.max(600, Math.sqrt(Math.max(c.area || 1, 1) / Math.PI) * 2.6)
  if (d > allowance) far.push({ f, city: g.city, iso, lat: g.lat, lon: g.lon, d: Math.round(d) })
}

// Second pass: only the far ones, and only to ask whether another database
// puts them in a different country. Serial, because it is a public API.
const wrong = []
for (const r of far) {
  const hits = await probe(r.city ?? "")
  const near = hits.filter((h) => km(r.lat, r.lon, h.latitude, h.longitude) <= 60)
  const codes = new Set(near.map((h) => String(h.country_code || "").toUpperCase()).filter(Boolean))
  if (codes.size && !codes.has(r.iso)) {
    wrong.push({ ...r, geonames: [...codes].join("/") })
  }
  await new Promise((r) => setTimeout(r, 250))
}

console.log(`\n${files.length} reports · ${far.length} far from their country · ${wrong.length} disagree`)
for (const w of wrong) {
  console.log(
    `  MISFILED  ${(w.city ?? "?").padEnd(24)} filed ${w.iso}  GeoNames says ${w.geonames}  (${w.d} km out)  ${w.f}`
  )
}
if (!wrong.length) console.log("  every report agrees with GeoNames about which country it is in")
process.exit(wrong.length ? 1 : 0)
