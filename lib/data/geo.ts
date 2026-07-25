import type { GeoPoint } from "../types"
import { englishCountryName } from "./country"

const TIMEOUT = 8000

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
async function openMeteoSearch(name: string, hint: string): Promise<OpenMeteoHit[]> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=10&language=en&format=json`
    const data = (await fetchJson(url)) as { results?: OpenMeteoHit[] }
    const results = data.results ?? []
    const wanted = norm(name)
    const h = norm(hint)

    return results
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
  } catch {
    return []
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
      timezone: (await getTimezone(lat, lon)) ?? "UTC",
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
    const data = (await fetchJson(url, 6000)) as { timezone?: string }
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

  // 1. Open-Meteo, ranked. Taken only when the winner is clearly the place a
  //    traveller means — a populated town, a capital or an admin division.
  const hits = await openMeteoSearch(cityPart, hint)
  if (hits.length && isConfident(hits[0])) return toPoint(hits[0])

  // 2. Nominatim with the full string — country-aware, so "Sé, Benin" resolves
  //    to Benin rather than a same-named city elsewhere, and "new jersey"
  //    resolves to the state rather than a village in Trinidad.
  const osm = await nominatimGeocode(query)
  if (osm) return osm

  // 3. Fall back to Open-Meteo's best guess rather than failing outright.
  if (hits.length) return toPoint(hits[0])

  return null
}

export { fetchJson }
