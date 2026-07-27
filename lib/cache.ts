import { promises as fs } from "fs"
import path from "path"
import type { GeoPoint, SafetyBundle, SafetyEnrichment, DestinationImages } from "./types"

// ─────────────────────────────────────────────────────────────────────
// Durable report cache. Every completed report is saved to disk, keyed by
// the resolved place (country + city), so a later search for the same place
// replays the stored result instantly — no databases, no paid Claude run.
//
// The directory lives OUTSIDE the git repo so `git reset --hard` deploys and
// service restarts never wipe it.
// ─────────────────────────────────────────────────────────────────────

export const CACHE_DIR = process.env.REPORT_CACHE_DIR || "/var/lib/ismytripsafe/reports"
const TTL_MS = (Number(process.env.REPORT_CACHE_TTL_HOURS) || 168) * 3600 * 1000 // 7 days
// Past the TTL a report is no longer served as-is, but up to this age it's
// still good enough to show *immediately* while a fresh one builds in the
// background — far better than making the reader wait out a full cold build.
const SWR_MAX_MS =
  (Number(process.env.REPORT_CACHE_SWR_HOURS) || 720) * 3600 * 1000 // 30 days

const CACHE_VERSION = 1

export interface CachedReport {
  version: number
  key: string
  place: string
  cachedAt: string // ISO timestamp of the latest data refresh
  createdAt?: string // ISO timestamp of the FIRST build (survives refreshes)
  geo: GeoPoint
  images: DestinationImages
  bundle: SafetyBundle
  enrichment: SafetyEnrichment
  prose: string
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** Stable cache key for a resolved place: same city+country → same report. */
export function cacheKey(geo: GeoPoint): string {
  const cc = (geo.countryCode || "xx").toLowerCase()
  const city = slug(geo.city || "")
  if (city) return `${cc}_${city}`
  // Fall back to rounded coordinates when we somehow have no city name.
  return `${cc}_${geo.lat.toFixed(2)}_${geo.lon.toFixed(2)}`
}

function fileFor(key: string): string {
  // key is already slug-safe, but guard against traversal just in case.
  const safe = key.replace(/[^a-z0-9_.-]/gi, "_")
  return path.join(CACHE_DIR, `${safe}.json`)
}

/** Read a cached report if it exists and is still within its TTL. */
export async function readCache(key: string): Promise<CachedReport | null> {
  const data = await readCacheAnyAge(key)
  if (!data) return null
  const age = Date.now() - new Date(data.cachedAt).getTime()
  if (!Number.isFinite(age) || age > TTL_MS) return null
  return data
}

/**
 * Read a report that is past its TTL but still within the stale-while-
 * revalidate window. Callers serve this immediately and rebuild in the
 * background. Returns null for a fresh report (use `readCache`) or an
 * ancient one (worth a real rebuild).
 */
export async function readStale(key: string): Promise<CachedReport | null> {
  const data = await readCacheAnyAge(key)
  if (!data) return null
  const age = Date.now() - new Date(data.cachedAt).getTime()
  if (!Number.isFinite(age) || age <= TTL_MS || age > SWR_MAX_MS) return null
  return data
}

/**
 * Read a cached report regardless of TTL. The permanent report pages (and the
 * sitemap) serve every report we've ever completed, labeled with its real
 * "last updated" date — the TTL only decides when the interactive flow
 * regenerates.
 */
export async function readCacheAnyAge(key: string): Promise<CachedReport | null> {
  try {
    const raw = await fs.readFile(fileFor(key), "utf8")
    const data = JSON.parse(raw) as CachedReport
    if (data.version !== CACHE_VERSION || !data.enrichment || !data.bundle) return null
    return data
  } catch {
    return null // missing / unreadable / corrupt → treat as a miss
  }
}

/** Persist a completed report. Best-effort — cache failures never break a request. */
export async function writeCache(
  key: string,
  report: Omit<CachedReport, "version" | "key" | "cachedAt"> & { cachedAt?: string }
): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    // A refresh keeps the original publish date — cachedAt tracks the latest
    // data refresh, createdAt the first build (for honest datePublished).
    const prior = await readCacheAnyAge(key)
    const payload: CachedReport = {
      version: CACHE_VERSION,
      key,
      cachedAt: report.cachedAt || new Date().toISOString(),
      createdAt:
        prior?.createdAt || prior?.cachedAt || report.cachedAt || new Date().toISOString(),
      place: report.place,
      geo: report.geo,
      images: report.images,
      bundle: report.bundle,
      enrichment: report.enrichment,
      prose: report.prose,
    }
    // Atomic write: temp file then rename, so a reader never sees a half file.
    const tmp = fileFor(`${key}.${process.pid}.tmp`)
    await fs.writeFile(tmp, JSON.stringify(payload), "utf8")
    await fs.rename(tmp, fileFor(key))
  } catch {
    /* best-effort */
  }
}
