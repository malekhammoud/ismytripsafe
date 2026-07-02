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

/** Open-Meteo geocoding — fast, returns timezone, but matches on a bare place name. */
async function openMeteoGeocode(name: string): Promise<GeoPoint | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=en&format=json`
    const data = (await fetchJson(url)) as {
      results?: Array<{
        name: string
        latitude: number
        longitude: number
        country_code: string
        country: string
        timezone: string
        population?: number
      }>
    }
    const r = data.results?.[0]
    if (!r) return null
    return {
      city: r.name,
      lat: r.latitude,
      lon: r.longitude,
      countryCode: r.country_code,
      country: r.country ?? englishCountryName(r.country_code) ?? "",
      timezone: r.timezone,
      population: r.population ?? null,
    }
  } catch {
    return null
  }
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
 * databases. Tries Open-Meteo (fast, bare name), then Open-Meteo on the part
 * before a comma, then OpenStreetMap/Nominatim (handles "City, Country" and
 * obscure locations). Returns null only if every source misses.
 */
export async function geocode(name: string): Promise<GeoPoint | null> {
  const query = name.trim()
  if (!query) return null

  // 1. Open-Meteo with the raw query — fast path for plain city names.
  const direct = await openMeteoGeocode(query)
  if (direct) return direct

  // 2. Nominatim with the full string — country-aware, so "Sé, Benin" resolves
  // to Benin rather than a same-named city elsewhere.
  const osm = await nominatimGeocode(query)
  if (osm) return osm

  // 3. Last resort: Open-Meteo on just the city part (may lose country context).
  if (query.includes(",")) {
    const cityOnly = query.split(",")[0].trim()
    if (cityOnly && cityOnly !== query) {
      const byCity = await openMeteoGeocode(cityOnly)
      if (byCity) return byCity
    }
  }

  return null
}

export { fetchJson }
