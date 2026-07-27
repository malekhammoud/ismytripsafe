import { promises as fs } from "fs"
import path from "path"
import { fetchJson } from "./geo"
import { withBudget } from "../timing"

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

async function recallGood(key: string, maxAgeDays = STALE_MAX_DAYS): Promise<RefHit | null> {
  const s = await loadStore()
  const e = s[key]
  if (!e) return null
  const ageDays = (Date.now() - Date.parse(e.savedAt)) / 86_400_000
  if (!Number.isFinite(ageDays) || ageDays > maxAgeDays) return null
  return e
}

/** fetchJson with retries and growing timeouts. */
export async function fetchJsonRetry(
  url: string,
  // Tightened from [8000, 14000]. These sources answer in ~1s when healthy
  // (measured: World Bank 0.9s, WHO GHO 1.2s); a 22s ladder per call only ever
  // bought us slow failures, and `resolveMetric` now has a wall-clock budget
  // over the whole chain anyway.
  timeouts: number[] = [4000, 6000]
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

/** How long a stored value is served immediately, without touching the network. */
const FRESH_MAX_DAYS = Number(process.env.REFDATA_FRESH_DAYS) || 7
/**
 * Whole-chain wall-clock budget. A chain that blows it falls back to disk.
 * Healthy sources answer in ~1s (World Bank 0.9s, WHO GHO 1.2s), so this only
 * bites when one is genuinely struggling — and in that case the last-known-good
 * value is the better answer anyway, since these figures move once a year.
 */
const CHAIN_BUDGET_MS = 4_000

/** Walk the fallback chain in order, first source that answers wins. */
async function resolveLive(
  key: string,
  fetchers: Array<() => Promise<RefHit | null>>,
  deadline: number
): Promise<RefHit | null> {
  for (const f of fetchers) {
    if (Date.now() > deadline) break
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
  return null
}

/**
 * Resolve one metric.
 *
 * These are country-level statistics — homicide rates, WGI governance scores,
 * road deaths — that upstream revises at most once a year. The disk store used
 * to be a last resort, consulted only after every live source had failed,
 * which meant every report paid full network cost for numbers that had not
 * moved in months.
 *
 * Now it leads: a value stored within FRESH_MAX_DAYS is returned immediately
 * and refreshed in the background, so any country we have seen before costs
 * nothing on the critical path. Only a genuine miss blocks on the network, and
 * even then the chain is bounded — past its budget we serve the last-known-good
 * value rather than keep dialling.
 */
export async function resolveMetric(
  key: string,
  fetchers: Array<() => Promise<RefHit | null>>
): Promise<RefHit | null> {
  const fresh = await recallGood(key, FRESH_MAX_DAYS)
  if (fresh) {
    // Revalidate out of band; this report is already served from the store.
    void resolveLive(key, fetchers, Date.now() + CHAIN_BUDGET_MS).catch(() => {})
    return fresh
  }

  // A hard ceiling, not just a between-sources check: an individual fetcher
  // can honour every one of its own timeouts and still take their sum (the
  // retry ladder is 4s + 6s), which is how a "6s budget" turned into 10s.
  const live = await withBudget(
    resolveLive(key, fetchers, Date.now() + CHAIN_BUDGET_MS),
    CHAIN_BUDGET_MS
  )
  if (live) return live
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
/**
 * OWID now returns 403 to server-side requests (any User-Agent). The fetchers
 * are kept in the fallback chains in case that changes, but once we've seen a
 * refusal there's no point paying the round-trip on every subsequent report —
 * trip a breaker for the life of the process. A restart re-probes.
 */
let owidBlocked = false
export async function owidLatest(
  slug: string,
  iso3: string
): Promise<RefHit | null> {
  if (owidBlocked) return null
  let bySlug = owidCache.get(slug)
  if (!bySlug) {
    const url = `https://ourworldindata.org/grapher/${slug}.csv?csvType=filtered`
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    let text: string
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "TravelAI/1.0 (travel research app)" },
      })
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) owidBlocked = true
        return null
      }
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
