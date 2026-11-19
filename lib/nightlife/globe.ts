import countries from "world-countries"
import { listCountries } from "@/lib/reports"
import { listNightlife, nightlifePath } from "./store"

// The nightlife globe is a different map from the safety globe: the sea is
// night, country fills are a faint score wash, and the cities are the lights.
// Only published nightlife reports become lights; a country with none stays
// dark but can still be opened for its safety reports.
const NUMERIC_BY_ISO2 = new Map<string, string>(
  countries.filter(country => country.ccn3).map(country => [country.cca2, country.ccn3 as string])
)

export interface NightlifeGlobeCountry {
  id: string
  iso2: string
  name: string
  slug: string
  flag: string
  region: string
  score: number | null
  reports: number
  venues: number
  updatedAt: string | null
}

export interface NightlifeGlobePoint {
  lat: number
  lng: number
  city: string
  country: string
  countrySlug: string
  citySlug: string
  path: string
  overall: number | null
  venueCount: number
  density: number | null
  limited: boolean
  updatedAt: string
  flag: string
}

export interface NightlifeGlobePayload {
  countries: NightlifeGlobeCountry[]
  points: NightlifeGlobePoint[]
  totals: { reports: number; countries: number; venues: number; cities: number }
  updatedAt: string | null
}

export async function getNightlifeGlobePayload(): Promise<NightlifeGlobePayload> {
  const [hubs, reports] = await Promise.all([listCountries(), listNightlife()])
  const stats = new Map<string, { score: number; rated: number; reports: number; venues: number; updatedAt: string }>()
  for (const report of reports) {
    const slug = report.city.countrySlug
    const current = stats.get(slug) ?? { score: 0, rated: 0, reports: 0, venues: 0, updatedAt: "" }
    current.reports++
    current.venues += report.venueCount
    if (report.overall != null) { current.score += report.overall; current.rated++ }
    if (report.updatedAt > current.updatedAt) current.updatedAt = report.updatedAt
    stats.set(slug, current)
  }

  const globeCountries: NightlifeGlobeCountry[] = []
  const flagBySlug = new Map<string, string>()
  for (const hub of hubs) {
    const id = NUMERIC_BY_ISO2.get(hub.countryCode)
    if (!id) continue
    const stat = stats.get(hub.countrySlug)
    flagBySlug.set(hub.countrySlug, hub.flag)
    globeCountries.push({
      id,
      iso2: hub.countryCode,
      name: hub.country,
      slug: hub.countrySlug,
      flag: hub.flag,
      region: hub.region || "Other",
      score: stat?.rated ? stat.score / stat.rated : null,
      reports: stat?.reports ?? 0,
      venues: stat?.venues ?? 0,
      updatedAt: stat?.updatedAt || null,
    })
  }

  const points: NightlifeGlobePoint[] = reports
    .filter(report => Number.isFinite(report.city.lat) && Number.isFinite(report.city.lon))
    .map(report => ({
      lat: report.city.lat,
      lng: report.city.lon,
      city: report.city.city,
      country: report.city.country,
      countrySlug: report.city.countrySlug,
      citySlug: report.city.citySlug,
      path: nightlifePath(report),
      overall: report.overall,
      venueCount: report.venueCount,
      density: report.density,
      limited: report.outcome === "limited",
      updatedAt: report.updatedAt,
      flag: flagBySlug.get(report.city.countrySlug) ?? "",
    }))

  return {
    countries: globeCountries,
    points,
    totals: {
      reports: reports.length,
      countries: globeCountries.filter(country => country.reports > 0).length,
      venues: reports.reduce((sum, report) => sum + report.venueCount, 0),
      cities: reports.length,
    },
    updatedAt: reports.map(report => report.updatedAt).sort().at(-1) ?? null,
  }
}
