import { promises as fs } from "fs"
import path from "path"
import { fetchJson } from "./geo"

// ─────────────────────────────────────────────────────────────────────
// Resilient reference-data layer. Country-level statistics (WGI, homicide,
// road deaths…) change at most yearly, but the upstream APIs flake hourly.
// Three defences, in order:
//   1. retries with growing timeouts on every fetch
//   2. multiple independent sources per metric (fallback chains live in
//      signals.ts; the helpers for each source live here)
//   3. a durable last-known-good store on disk — when every source is down,
//      serve the previous good value instead of "No data"
// The store lives outside the repo so deploys never wipe it.
// ─────────────────────────────────────────────────────────────────────

const STORE_FILE =
  process.env.REFDATA_FILE || "/var/lib/ismytripsafe/refdata.json"
const STALE_MAX_DAYS = 60

export interface RefHit {
  value: number
  year: string | null
  /** set when the value came from somewhere coarser/other than the primary
   *  source — shown to the user for honesty (e.g. "regional average") */
  sourceOverride?: string
  displaySuffix?: string
}

type StoreEntry = RefHit & { savedAt: string }

let store: Record<string, StoreEntry> | null = null
let writeChain: Promise<void> = Promise.resolve()

async function loadStore(): Promise<Record<string, StoreEntry>> {
  if (store) return store
  try {
    store = JSON.parse(await fs.readFile(STORE_FILE, "utf8"))
  } catch {
    store = {}
  }
  return store!
}

function persistStore(): void {
  // Serialize writes; losing one on crash is fine (it's only a cache).
  writeChain = writeChain
    .then(async () => {
      if (!store) return
      await fs.mkdir(path.dirname(STORE_FILE), { recursive: true })
      await fs.writeFile(STORE_FILE, JSON.stringify(store), "utf8")
    })
    .catch(() => {})
}

async function rememberGood(key: string, hit: RefHit): Promise<void> {
  const s = await loadStore()
  s[key] = { ...hit, savedAt: new Date().toISOString() }
  persistStore()
}

async function recallGood(key: string): Promise<RefHit | null> {
  const s = await loadStore()
  const e = s[key]
  if (!e) return null
  const ageDays = (Date.now() - Date.parse(e.savedAt)) / 86_400_000
  if (!Number.isFinite(ageDays) || ageDays > STALE_MAX_DAYS) return null
  return e
}

/** fetchJson with retries and growing timeouts. */
export async function fetchJsonRetry(
  url: string,
  timeouts: number[] = [8000, 14000]
): Promise<unknown> {
  let lastErr: unknown
  for (const t of timeouts) {
    try {
      return await fetchJson(url, t)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/**
 * Run a fallback chain for one metric. Returns the first source that
 * produces a value (and remembers it); if every source fails, returns the
 * last-known-good value from disk (marked stale=false — the year label
 * already communicates data age).
 */
export async function resolveMetric(
  key: string,
  fetchers: Array<() => Promise<RefHit | null>>
): Promise<RefHit | null> {
  for (const f of fetchers) {
    try {
      const hit = await f()
      if (hit && Number.isFinite(hit.value)) {
        void rememberGood(key, hit)
        return hit
      }
    } catch {
      // try the next source
    }
  }
  return recallGood(key)
}

// ─── Source helpers ─────────────────────────────────────────────────

interface WBRow {
  date: string
  value: number | null
}

/** Most-recent non-null value for a World Bank indicator (with retries). */
export async function wbLatest(
  code: string,
  indicator: string,
  source?: number
): Promise<RefHit | null> {
  const src = source ? `&source=${source}` : ""
  const url = `https://api.worldbank.org/v2/country/${code}/indicator/${indicator}?format=json&mrv=15${src}`
  const data = (await fetchJsonRetry(url)) as [unknown, WBRow[] | null]
  const rows = data?.[1]
  if (!Array.isArray(rows)) return null
  const hit = rows.find((r) => r.value != null)
  if (!hit || hit.value == null) return null
  return { value: hit.value, year: hit.date }
}

/** The World Bank region aggregate code for a country (e.g. MX → LCN). */
const regionCache = new Map<string, string | null>()
export async function wbRegionCode(iso2: string): Promise<string | null> {
  if (regionCache.has(iso2)) return regionCache.get(iso2)!
  try {
    const data = (await fetchJsonRetry(
      `https://api.worldbank.org/v2/country/${iso2}?format=json`
    )) as [unknown, Array<{ region?: { id?: string } }> | null]
    const id = data?.[1]?.[0]?.region?.id ?? null
    const code = id && id !== "NA" ? id : null
    regionCache.set(iso2, code)
    return code
  } catch {
    return null
  }
}

/**
 * Our World in Data grapher snapshot: `csvType=filtered` returns the chart's
 * current (latest-year) view for every country in one small CSV. Cached per
 * slug in memory, keyed by ISO3.
 */
const owidCache = new Map<string, Map<string, RefHit>>()
export async function owidLatest(
  slug: string,
  iso3: string
): Promise<RefHit | null> {
  let bySlug = owidCache.get(slug)
  if (!bySlug) {
    const url = `https://ourworldindata.org/grapher/${slug}.csv?csvType=filtered`
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 14000)
    let text: string
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "TravelAI/1.0 (travel research app)" },
      })
      if (!res.ok) return null
      text = await res.text()
    } finally {
      clearTimeout(t)
    }
    bySlug = new Map()
    for (const line of text.split("\n").slice(1)) {
      // Entity,Code,Year,Value[,extra…] — quoted commas only appear in headers
      const cols = line.split(",")
      if (cols.length < 4) continue
      const code = cols[1]?.trim()
      const year = cols[2]?.trim()
      const value = Number(cols[3])
      if (!code || !Number.isFinite(value)) continue
      bySlug.set(code, { value, year: year || null })
    }
    if (bySlug.size) owidCache.set(slug, bySlug)
  }
  return bySlug.get(iso3) ?? null
}

/**
 * WHO Global Health Observatory: latest total value for an indicator.
 * Rows are filtered to the both-sexes/total dimension when present.
 */
export async function ghoLatest(
  indicator: string,
  iso3: string
): Promise<RefHit | null> {
  const url = `https://ghoapi.azureedge.net/api/${indicator}?$filter=SpatialDim%20eq%20%27${iso3}%27`
  const data = (await fetchJsonRetry(url)) as {
    value?: Array<{
      TimeDim?: number
      Dim1?: string | null
      NumericValue?: number | null
    }>
  }
  const rows = (data.value ?? [])
    .filter(
      (r) =>
        r.NumericValue != null &&
        (r.Dim1 == null || /BTSX|TOTAL|ALL/i.test(String(r.Dim1)))
    )
    .sort((a, b) => (b.TimeDim ?? 0) - (a.TimeDim ?? 0))
  const hit = rows[0]
  if (!hit || hit.NumericValue == null) return null
  return { value: hit.NumericValue, year: hit.TimeDim != null ? String(hit.TimeDim) : null }
}
