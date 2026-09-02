import worldCountries from "world-countries"
import type { GeoPoint } from "../types"
import { englishCountryName } from "./country"
import { withBudget } from "../timing"
import { normQuery, matchCountryQuery } from "../search"
import { CITY_ALIASES } from "./aliases"

// The geocode ladder is serial by necessity (Nominatim's usage policy rules out
// firing it speculatively alongside Open-Meteo just to save a round-trip), so
// each rung has to be cheap. Most searches skip this entirely — the autocomplete
// resolves coordinates in the browser and posts them as `placeGeo`.
const TIMEOUT = 4000

async function fetchJson(url: string, timeoutMs: number = TIMEOUT): Promise<unknown> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TravelAI/1.0 (travel research app)" },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

interface OpenMeteoHit {
  name: string
  latitude: number
  longitude: number
  country_code: string
  country: string
  timezone: string
  population?: number
  /** GeoNames code: PPLC = capital, PPLA* = admin seat, ADM* = division, AIRP… */
  feature_code?: string
  admin1?: string
  admin2?: string
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Territories that ISO 3166-1 gives their own code but that a sovereign state
 * administers — French Polynesia, New Caledonia, Réunion, Puerto Rico, Guam,
 * Hong Kong and fifty more.
 *
 * They matter here because the two databases disagree about them. GeoNames
 * (through Open-Meteo) uses the territory's own code; OpenStreetMap tags them
 * by sovereign, so asking Nominatim about Bora Bora gets `country_code: "fr"`
 * — French Polynesia is, legally, France. Believed literally, that files two
 * Tahitian islands under France and draws them on the globe 15,900 km from
 * Paris, which is what it did.
 */
const DEPENDENCY = new Set(
  (worldCountries as { cca2: string; independent?: boolean | null }[])
    .filter((c) => c.independent === false)
    .map((c) => c.cca2)
)

/** Great-circle kilometres. */
function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const t = Math.PI / 180
  const dLat = (bLat - aLat) * t
  const dLon = (bLon - aLon) * t
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * Give a dependency back its own country code.
 *
 * Only fires when the resolved country is a sovereign state *and* GeoNames has
 * a dependency-coded record for what is plainly the same spot — within 60 km,
 * which no mainland city has. A place that really is in France stays in France
 * because there is no French dependency sitting on top of it.
 */
function ownTerritory(p: GeoPoint, geonames: OpenMeteoHit[]): GeoPoint {
  if (!p.countryCode || DEPENDENCY.has(p.countryCode.toUpperCase())) return p
  const hit = geonames.find(
    (h) =>
      h.country_code &&
      DEPENDENCY.has(h.country_code.toUpperCase()) &&
      km(p.lat, p.lon, h.latitude, h.longitude) <= 60
  )
  if (!hit) return p
  const iso2 = hit.country_code.toUpperCase()
  return { ...p, countryCode: iso2, country: englishCountryName(iso2) ?? p.country }
}

/** Rank bonus by GeoNames feature code — a capital outranks a hamlet. */
function featureRank(code: string | undefined): number {
  if (!code) return 0
  if (code === "PPLC") return 5_000_000
  if (code.startsWith("PPLA")) return 1_000_000
  if (code.startsWith("ADM")) return 500_000
  if (code.startsWith("PPL")) return 0
  return -1 // airports, parks, heliports — not places a traveller means
}

/**
 * Open-Meteo geocoding — fast and returns a timezone, but it matches on a bare
 * name and returns candidates in an order that has nothing to do with which
 * one a traveller means. Asking for one result got "new jersey" a 400-person
 * village in Trinidad, ahead of both the US state and every larger match.
 *
 * So take ten and rank them: population first, with a bonus for capitals and
 * administrative seats, a penalty for non-places (the "New Jersey Turnpike
 * Authority Heliport" is a real Open-Meteo hit), and a strong preference for
 * candidates matching the country/region hinted after a comma in the query.
 */
export async function openMeteoSearch(
  name: string,
  hint: string
): Promise<{ ranked: OpenMeteoHit[]; all: OpenMeteoHit[] }> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=10&language=en&format=json`
    const data = (await fetchJson(url)) as { results?: OpenMeteoHit[] }
    const results = data.results ?? []
    const wanted = norm(name)
    const h = norm(hint)

    const ranked = results
      .map((r) => {
        let rank = (r.population ?? 0) + featureRank(r.feature_code)
        if (norm(r.name) === wanted) rank += 250_000 // exact name, not a prefix match
        if (h) {
          const matchesHint = [r.country, r.country_code, r.admin1, r.admin2]
            .filter(Boolean)
            .some((v) => norm(String(v)) === h || norm(String(v)).includes(h))
          if (matchesHint) rank += 50_000_000
        }
        return { r, rank }
      })
      .filter((x) => featureRank(x.r.feature_code) >= 0)
      .sort((a, b) => b.rank - a.rank)
      .map((x) => x.r)

    // `all` keeps what the ranking discards. Bora Bora is an ISL and its only
    // other record is an AIRP, so the filter empties the list for exactly the
    // places whose country code most needs checking.
    return { ranked, all: results }
  } catch {
    return { ranked: [], all: [] }
  }
}

function toPoint(r: OpenMeteoHit): GeoPoint {
  return {
    city: r.name,
    lat: r.latitude,
    lon: r.longitude,
    countryCode: r.country_code,
    country: r.country ?? englishCountryName(r.country_code) ?? "",
    timezone: r.timezone,
    population: r.population ?? null,
  }
}

/**
 * Is this hit a confident answer, or should a second database get a say?
 *
 * A named place with real population, a capital, an admin seat or an admin
 * division is what people mean. An unranked dot with no population is a
 * coin-flip against every same-named place on earth — worth checking against
 * Nominatim, which understands states and regions.
 */
function isConfident(r: OpenMeteoHit): boolean {
  if ((r.population ?? 0) >= 5000) return true
  const code = r.feature_code ?? ""
  return code === "PPLC" || code.startsWith("PPLA") || code.startsWith("ADM")
}

/** OpenStreetMap Nominatim — handles full "City, Country" strings and obscure places worldwide. */
async function nominatimGeocode(query: string): Promise<GeoPoint | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=jsonv2&limit=1&addressdetails=1&accept-language=en`
    const data = (await fetchJson(url)) as Array<{
      lat: string
      lon: string
      name?: string
      display_name?: string
      address?: { country?: string; country_code?: string }
    }>
    const r = data?.[0]
    if (!r) return null
    const lat = parseFloat(r.lat)
    const lon = parseFloat(r.lon)
    const iso2 = (r.address?.country_code ?? "").toUpperCase()
    const cityName =
      r.name || r.display_name?.split(",")[0] || query.split(",")[0]
    return {
      city: cityName.trim(),
      lat,
      lon,
      countryCode: iso2,
      country: englishCountryName(iso2) ?? r.address?.country ?? "",
      // A nested lookup on the slowest rung of the ladder, for a cosmetic
      // field with a working fallback — it gets a short leash.
      timezone: (await withBudget(getTimezone(lat, lon), 1500)) ?? "UTC",
      population: null,
    }
  } catch {
    return null
  }
}

/** Resolve a timezone string for coordinates via Open-Meteo (used when a source lacks it). */
export async function getTimezone(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1`
    const data = (await fetchJson(url, 3000)) as { timezone?: string }
    return data.timezone ?? null
  } catch {
    return null
  }
}

/**
 * Resolve a free-text place to coordinates + country, robust across multiple
 * databases. Open-Meteo answers first (fast, and it carries a timezone), but
 * only when its best-ranked candidate is unambiguous; otherwise
 * OpenStreetMap/Nominatim gets the call, because it understands states,
 * regions and "City, Country" strings. Returns null only if every source
 * misses.
 */
export async function geocode(name: string): Promise<GeoPoint | null> {
  const query = name.trim()
  if (!query) return null

  // Anything after the first comma is a country/region hint ("Bogota, US").
  const [head, ...rest] = query.split(",")
  const cityPart = head.trim() || query
  const hint = rest.join(",").trim()

  // 0. Curated, zero-network rung. A colloquial alias ("bkk" → Bangkok)
  //    redirects; a query that unambiguously names a country ("spain",
  //    "usa", "czech republic", "mexi") is the country itself, instantly —
  //    and its report page key matches the existing country hubs.
  const aliasTarget = !hint ? CITY_ALIASES[normQuery(cityPart)] : undefined
  if (aliasTarget) return geocode(aliasTarget)
  const countryHit = matchCountryQuery(cityPart)
  if (countryHit) {
    return {
      city: countryHit.name,
      lat: countryHit.lat,
      lon: countryHit.lon,
      countryCode: countryHit.countryCode,
      country: countryHit.name,
      timezone: "",
      population: null,
    }
  }

  // 1. Open-Meteo, ranked. Taken only when the winner is clearly the place a
  //    traveller means — a populated town, a capital or an admin division.
  const { ranked, all } = await openMeteoSearch(cityPart, hint)
  if (ranked.length && isConfident(ranked[0])) return toPoint(ranked[0])

  // 2. Nominatim with the full string — country-aware, so "Sé, Benin" resolves
  //    to Benin rather than a same-named city elsewhere, and "new jersey"
  //    resolves to the state rather than a village in Trinidad. It is also the
  //    rung that hands back a sovereign where ISO wants a territory, so its
  //    answer is reconciled against GeoNames before it is believed.
  const osm = await nominatimGeocode(query)
  if (osm) return ownTerritory(osm, all)

  // 3. Fall back to Open-Meteo's best guess rather than failing outright.
  if (ranked.length) return toPoint(ranked[0])

  return null
}

export { fetchJson }
