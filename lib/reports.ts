import { promises as fs } from "fs"
import path from "path"
import { CACHE_DIR, readCacheAnyAge, slug, type CachedReport } from "./cache"
import { computeCategories, computeFinalScore, levelFromIndex, LEVELS } from "./safety-display"
import { englishCountryName } from "./data/country"
import type { SafetyLevel } from "./types"

// ─────────────────────────────────────────────────────────────────────
// Server-side report store. Every completed report on disk becomes a
// permanent, crawlable page:
//
//   /{countrySlug}                → country hub  (e.g. /portugal)
//   /{countrySlug}/{citySlug}     → city report  (e.g. /portugal/lisbon)
//
// This module indexes the report directory (lightweight metadata for
// listing/linking) and resolves slugs → full reports. The index is
// incremental: files are re-parsed only when their mtime changes.
// ─────────────────────────────────────────────────────────────────────

export interface ReportMeta {
  key: string // cache key = file basename
  city: string
  country: string
  countryCode: string // ISO2
  countrySlug: string
  citySlug: string
  path: string // canonical path, e.g. "/portugal/lisbon"
  score: number // final published score (databases + field research)
  level: SafetyLevel
  answer: string // "Yes — generally safe"
  verdict: string // one-line AI verdict
  flag: string
  region: string
  population: number | null
  lat: number
  lon: number
  updatedAt: string // ISO — last data refresh
  createdAt: string // ISO — first build
  /**
   * The destination's own lead photograph, if the report found one — see
   * `lib/data/images.ts`. About three reports in four have one. Carried on
   * the metadata so cards and panels can show a picture of the actual place
   * without loading the whole report.
   */
  image: string | null
}

export function countrySlugFor(countryCode: string, countryName: string): string {
  return slug(englishCountryName(countryCode) ?? countryName ?? countryCode)
}

/** Canonical permanent path for a place ("/portugal/lisbon", or "/portugal" for a country query). */
export function pathForGeo(geo: { city: string; country: string; countryCode: string }): string {
  const cs = countrySlugFor(geo.countryCode, geo.country)
  const city = slug(geo.city)
  if (!cs || !city || city === cs) return `/${cs || city}`
  return `/${cs}/${city}`
}

/** Flags, coats of arms, locator maps and SVGs are not photographs. */
function usablePhoto(url: string | null | undefined): url is string {
  return !!url && !/flag_of|coat_of_arms|locator|_map\b|\.svg/i.test(url)
}

function metaFromReport(report: CachedReport): ReportMeta | null {
  const { geo, bundle, enrichment } = report
  if (!geo?.city || !geo.countryCode || !bundle?.safety || !enrichment) return null
  const final = computeFinalScore(bundle.safety, enrichment)
  const countrySlug = countrySlugFor(geo.countryCode, geo.country)
  const citySlug = slug(geo.city)
  if (!countrySlug || !citySlug) return null
  // A "city" that's really the whole country gets no city page — the country
  // hub covers it (avoids /portugal/portugal thin duplicates).
  const isCountryQuery = citySlug === countrySlug
  return {
    key: report.key,
    city: geo.city,
    country: englishCountryName(geo.countryCode) ?? geo.country,
    countryCode: geo.countryCode.toUpperCase(),
    countrySlug,
    citySlug: isCountryQuery ? countrySlug : citySlug,
    path: isCountryQuery ? `/${countrySlug}` : `/${countrySlug}/${citySlug}`,
    score: final.index,
    level: final.level,
    answer: LEVELS[final.level].answer,
    verdict: enrichment.verdict ?? "",
    flag: bundle.country?.flag ?? "",
    region: bundle.country?.region ?? "",
    population: geo.population,
    lat: geo.lat,
    lon: geo.lon,
    updatedAt: report.cachedAt,
    createdAt: report.createdAt || report.cachedAt,
    image: usablePhoto(report.images?.hero) ? report.images.hero : null,
  }
}

// ─── Incremental index ───────────────────────────────────────────────

interface IndexEntry {
  mtimeMs: number
  meta: ReportMeta | null
}

const fileIndex = new Map<string, IndexEntry>()
let lastScan = 0
let scanning: Promise<ReportMeta[]> | null = null
const SCAN_INTERVAL_MS = 30_000

async function scan(): Promise<ReportMeta[]> {
  let names: string[] = []
  try {
    names = await fs.readdir(CACHE_DIR)
  } catch {
    return [] // no reports yet
  }
  const jsonFiles = names.filter((n) => n.endsWith(".json") && !n.includes(".tmp"))
  const seen = new Set<string>()

  await Promise.all(
    jsonFiles.map(async (name) => {
      seen.add(name)
      try {
        const stat = await fs.stat(path.join(CACHE_DIR, name))
        const existing = fileIndex.get(name)
        if (existing && existing.mtimeMs === stat.mtimeMs) return
        const report = await readCacheAnyAge(name.replace(/\.json$/, ""))
        fileIndex.set(name, {
          mtimeMs: stat.mtimeMs,
          meta: report ? metaFromReport(report) : null,
        })
      } catch {
        fileIndex.delete(name)
      }
    })
  )

  // Drop entries whose files vanished.
  for (const name of fileIndex.keys()) {
    if (!seen.has(name)) fileIndex.delete(name)
  }

  const out: ReportMeta[] = []
  for (const entry of fileIndex.values()) {
    if (entry.meta) out.push(entry.meta)
  }
  return out
}

/** All published reports (lightweight metadata), newest first. */
export async function listReports(): Promise<ReportMeta[]> {
  const now = Date.now()
  if (now - lastScan > SCAN_INTERVAL_MS || fileIndex.size === 0) {
    if (!scanning) {
      scanning = scan().finally(() => {
        lastScan = Date.now()
        scanning = null
      })
    }
    await scanning
  }
  const out: ReportMeta[] = []
  for (const entry of fileIndex.values()) {
    if (entry.meta) out.push(entry.meta)
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

// ─── Lookups ─────────────────────────────────────────────────────────

/** Full report for a country+city slug pair, or null (→ 404). */
export async function getCityReport(
  countrySlug: string,
  citySlug: string
): Promise<{ report: CachedReport; meta: ReportMeta } | null> {
  const all = await listReports()
  const meta = all.find(
    (m) => m.countrySlug === countrySlug && m.citySlug === citySlug && m.path.includes("/", 1)
  )
  if (!meta) return null
  const report = await readCacheAnyAge(meta.key)
  if (!report) return null
  return { report, meta }
}

/**
 * The one report with this city slug, wherever it now lives.
 *
 * Reports move between countries: two Tahitian islands sat under `/france/`
 * until the geocoder stopped believing OpenStreetMap's claim that French
 * Polynesia is France, and moved to `/french-polynesia/`. The old addresses
 * were live and in the sitemap, so a 404 is the wrong answer — the page still
 * exists, it is just somewhere else.
 *
 * Only answers when exactly one country has the slug. Plenty of cities share a
 * name (Santiago is in Chile, Spain, Cuba and the Dominican Republic), and
 * guessing which one a stale link meant is worse than admitting the miss.
 */
export async function findCityElsewhere(citySlug: string): Promise<ReportMeta | null> {
  const all = await listReports()
  const hits = all.filter(
    (m) => m.citySlug === citySlug && m.path.split("/").filter(Boolean).length === 2
  )
  return hits.length === 1 ? hits[0] : null
}

export interface CountryHub {
  countrySlug: string
  country: string
  countryCode: string
  flag: string
  region: string
  cities: ReportMeta[] // city reports in this country, best score first
  /** The country-level report (a report generated for the country itself), if any. */
  countryReport: ReportMeta | null
  avgScore: number | null
  updatedAt: string // latest refresh across the country's reports
}

/** Hub data for a country slug: all its reports + aggregates. Null → 404. */
export async function getCountryHub(countrySlug: string): Promise<CountryHub | null> {
  const all = await listReports()
  const mine = all.filter((m) => m.countrySlug === countrySlug)
  if (!mine.length) return null
  const cities = mine
    .filter((m) => m.path !== `/${countrySlug}`)
    .sort((a, b) => b.score - a.score)
  const countryReport = mine.find((m) => m.path === `/${countrySlug}`) ?? null
  const scores = mine.map((m) => m.score)
  const first = mine[0]
  return {
    countrySlug,
    country: first.country,
    countryCode: first.countryCode,
    flag: first.flag,
    region: first.region,
    cities,
    countryReport,
    avgScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    updatedAt: mine.map((m) => m.updatedAt).sort().at(-1) as string,
  }
}

/** Every country that has at least one report, most reports first. */
export async function listCountries(): Promise<CountryHub[]> {
  const all = await listReports()
  const bySlug = new Map<string, ReportMeta[]>()
  for (const m of all) {
    const arr = bySlug.get(m.countrySlug) ?? []
    arr.push(m)
    bySlug.set(m.countrySlug, arr)
  }
  const hubs = await Promise.all(
    Array.from(bySlug.keys()).map((s) => getCountryHub(s))
  )
  return (hubs.filter(Boolean) as CountryHub[]).sort(
    (a, b) => b.cities.length + (b.countryReport ? 1 : 0) - (a.cities.length + (a.countryReport ? 1 : 0))
  )
}

// ─── Related-report modules (the internal-linking system) ────────────

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export interface RelatedReports {
  /** Other reports in the same country (excl. this one), best score first. */
  sameCountry: ReportMeta[]
  /** Geographically nearest reports in other countries. */
  nearby: (ReportMeta & { distanceKm: number })[]
  /** Reports elsewhere with the closest safety score ("if you're comparing"). */
  similarScore: ReportMeta[]
}

export async function getRelated(meta: ReportMeta, limit = 6): Promise<RelatedReports> {
  const all = (await listReports()).filter((m) => m.path !== meta.path)

  const sameCountry = all
    .filter((m) => m.countrySlug === meta.countrySlug)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit + 2)

  const others = all.filter((m) => m.countrySlug !== meta.countrySlug)

  const nearby = others
    .map((m) => ({ ...m, distanceKm: Math.round(haversineKm(meta.lat, meta.lon, m.lat, m.lon)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)

  const nearbySet = new Set(nearby.map((m) => m.path))
  const similarScore = others
    .filter((m) => !nearbySet.has(m.path))
    .sort((a, b) => Math.abs(a.score - meta.score) - Math.abs(b.score - meta.score))
    .slice(0, limit)

  return { sameCountry, nearby, similarScore }
}

export { levelFromIndex }
