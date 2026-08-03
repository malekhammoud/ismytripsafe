import countries from "world-countries"
import { listCountries, listReports, type ReportMeta } from "./reports"
import { LEVELS } from "./safety-display"

// ─────────────────────────────────────────────────────────────────────
// Payload for the interactive globe.
//
// The globe joins two things that key on different identifiers:
//
//   • world-atlas TopoJSON, whose features are keyed by ISO 3166 *numeric*
//     ("620" = Portugal)
//   • our report index, which keys on ISO 3166 alpha-2 ("PT")
//
// `world-countries` carries both, so this module builds the numeric → our
// data bridge once, on the server, and ships a flat, small payload. The
// browser never sees a report object it can't draw.
// ─────────────────────────────────────────────────────────────────────

interface Raw {
  cca2: string
  ccn3?: string
}

/** ISO2 → ISO numeric, the id world-atlas features carry. */
const NUMERIC_BY_ISO2 = new Map<string, string>(
  (countries as Raw[]).filter((c) => c.ccn3).map((c) => [c.cca2, c.ccn3 as string])
)

/** One country as the globe needs it: a polygon tint and a place to go. */
export interface GlobeCountry {
  id: string // ISO numeric — joins to the TopoJSON feature
  iso2: string
  name: string
  slug: string
  flag: string
  region: string
  /** Country-level score if one exists, else the mean of its city reports. */
  score: number
  reports: number
  cities: number
  updatedAt: string
}

/** One city report as a point on the globe. */
export interface GlobePoint {
  lat: number
  lng: number
  city: string
  country: string
  countrySlug: string
  path: string
  score: number
  level: string
  levelLabel: string
  flag: string
  population: number | null
}

export interface GlobePayload {
  countries: GlobeCountry[]
  points: GlobePoint[]
  totals: { reports: number; countries: number; cities: number }
  updatedAt: string | null
  /** Best-scoring and worst-scoring city reports — the globe's opening cards. */
  highlights: { safest: ReportMeta[]; hardest: ReportMeta[]; biggest: ReportMeta[] }
}

export async function getGlobePayload(): Promise<GlobePayload> {
  const [hubs, reports] = await Promise.all([listCountries(), listReports()])

  const globeCountries: GlobeCountry[] = []
  for (const h of hubs) {
    const id = NUMERIC_BY_ISO2.get(h.countryCode)
    if (!id) continue // a territory world-atlas doesn't draw — points still show
    const score = h.countryReport?.score ?? h.avgScore
    if (score == null) continue
    globeCountries.push({
      id,
      iso2: h.countryCode,
      name: h.country,
      slug: h.countrySlug,
      flag: h.flag,
      region: h.region || "Other",
      score,
      reports: h.cities.length + (h.countryReport ? 1 : 0),
      cities: h.cities.length,
      updatedAt: h.updatedAt,
    })
  }

  // City-level reports only — a country-level report has no meaningful pin.
  const cityReports = reports.filter(
    (m) => m.path.split("/").filter(Boolean).length === 2 && Number.isFinite(m.lat) && Number.isFinite(m.lon)
  )

  const points: GlobePoint[] = cityReports.map((m) => ({
    lat: m.lat,
    lng: m.lon,
    city: m.city,
    country: m.country,
    countrySlug: m.countrySlug,
    path: m.path,
    score: m.score,
    level: m.level,
    levelLabel: LEVELS[m.level].label,
    flag: m.flag,
    population: m.population,
  }))

  // One city per country in each deck. Without this the "safest" row is six
  // Nordic towns all scoring 95, which tells a reader nothing they didn't
  // already know after the first card.
  function oneEach(list: ReportMeta[], n: number): ReportMeta[] {
    const seen = new Set<string>()
    const out: ReportMeta[] = []
    for (const m of list) {
      if (seen.has(m.countrySlug)) continue
      seen.add(m.countrySlug)
      out.push(m)
      if (out.length === n) break
    }
    return out
  }

  const byScore = [...cityReports].sort((a, b) => b.score - a.score)
  const highlights = {
    safest: oneEach(byScore, 6),
    hardest: oneEach([...byScore].reverse(), 6),
    biggest: oneEach([...cityReports].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)), 6),
  }

  return {
    countries: globeCountries,
    points,
    totals: {
      reports: reports.length,
      countries: hubs.length,
      cities: cityReports.length,
    },
    updatedAt: reports.map((m) => m.updatedAt).sort().at(-1) ?? null,
    highlights,
  }
}
