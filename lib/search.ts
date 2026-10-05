// ─────────────────────────────────────────────────────────────────────
// Destination search engine.
//
// The autocomplete used to ask Open-Meteo's geocoder on every keystroke and
// take whatever order it chose: populated places first, countries nowhere.
// This module replaces that with a curated local index — every country
// (with official names, alt spellings, demonyms and aliases), every city we
// have a report for (with real coordinates and its popularity tier), and the
// tier-1 list of what people actually search — matched in quality tiers
// (exact → phrase → prefix → token-inclusion → fuzzy) and ranked by intent:
// a bare country name beats the cities inside it, a popular destination
// beats an obscure one, a place we can answer instantly beats a geocoder
// guess.
//
// Server-side only: it reads the report index from disk (lib/reports.ts).
// The /api/search route serves it to the browser.
// ─────────────────────────────────────────────────────────────────────

import countries from "world-countries"
import { listReports } from "./reports"
import { TIER1 } from "../scripts/destinations.mjs"
import { COUNTRY_ALIASES, CITY_ALIASES } from "./data/aliases"

interface RawCountry {
  cca2: string
  cca3?: string
  cioc?: string
  name?: { common?: string; official?: string }
  altSpellings?: string[]
  demonyms?: Record<string, { f?: string; m?: string }>
  flag?: string
  region?: string
  subregion?: string
  capital?: string[]
  latlng?: number[]
}

export interface SearchHit {
  type: "country" | "city"
  /** Display name of the place itself (never includes the country). */
  name: string
  country: string
  countryCode: string // ISO2
  region?: string // country area ("Southern Europe") or admin region
  lat: number
  lon: number
  population: number | null
  flag: string // emoji
  tier: number // 1 = what people actually search … 3 = long tail, 0 = unknown
  hasReport: boolean // we can answer this place instantly from cache
  path?: string // canonical page when hasReport (/portugal/lisbon)
  score?: number // the report's safety score, when hasReport
  /** quality is how confidently the query matched (100 = exact). */
  quality: number
  /** true when surfaced only because the query exactly hit the country. */
  inCountry?: boolean
  /** the raw query this hit was produced from (alias redirects etc.). */
  resolvedFrom?: string
}

interface Entity {
  key: string
  type: "country" | "city"
  name: string
  country: string
  countryCode: string
  region: string
  lat: number
  lon: number
  population: number | null
  tier: number
  hasReport: boolean
  path?: string
  score?: number
  flag: string
  variants: string[] // normalized searchable forms
}

// ─── Normalization ──────────────────────────────────────────────────

const FOLD = /[\u0300-\u036f]/g
const JUNK = /[^a-z0-9]+/g

/** ISO2 country code → flag emoji ("PT" → 🇵🇹). "" for anything else. */
export function flagOf(cc: string): string {
  if (!cc || cc.length !== 2) return ""
  const a = cc.toUpperCase()
  if (!/^[A-Z]{2}$/.test(a)) return ""
  return String.fromCodePoint(...[...a].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** Case-fold, strip accents and punctuation. "Côte d'Ivoire" → "cote d ivoire". */
export function normQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(FOLD, "")
    .replace(JUNK, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)the(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

/** Levenshtein distance with an early cut-off (cheap; names are short). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = 0
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = Math.min(
        row[j] + 1, // deletion
        row[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      )
      prev = row[j]
      row[j] = cur
    }
  }
  return row[b.length]
}

/** Match quality of a token list ("barcode korea") against one variant: 0 = no match. */
function variantQuality(tokens: string[], vt: string[]): number {
  const n = tokens.length
  const vn = vt.length

  // Full phrase: the query tokens are exactly the variant's start. The last
  // token may be an allowed prefix ("mexico cit" → Mexico City). A phrase that
  // started right but diverged is a miss — "the maldives" must not fall
  // through to weak prefix matches like "the hague".
  if (vn >= n) {
    let ok = true
    for (let i = 0; i < n - 1; i++) {
      if (tokens[i] !== vt[i]) {
        ok = false
        break
      }
    }
    if (ok) {
      if (tokens[n - 1] === vt[n - 1]) return 100
      if (n >= 2 && vt[n - 1].startsWith(tokens[n - 1])) return 92
      return 0
    }
  }

  // Name plus one extra word ("barcelona spain", "paris hotels").
  if (vn === n - 1) {
    let all = true
    for (let i = 0; i < vn; i++) {
      if (tokens[i] !== vt[i]) {
        all = false
        break
      }
    }
    if (all) return 95
  }

  // Every query token appears in the variant in order, possibly after leading
  // filler ("is barcelona safe" → the variant lacks "is", so the scan starts
  // at the first real word). Strict: every query word must land, or this is
  // not the place they meant — trailing noise is the resolver's job.
  for (let s = 0; s < n; s++) {
    let ti = s
    for (const t of vt) {
      if (ti >= n) break
      if (t === tokens[ti]) ti++
    }
    if (ti === n) return Math.max(70 - 6 * s, 50)
  }

  // First token prefixes the first variant token. Short words are disabled:
  // "is" must not light up "Islamic Emirate of Afghanistan".
  const f = tokens[0]
  if (f.length >= 3 && vt[0].startsWith(f)) return 85

  // Fuzzy: a short typo against any whole variant word ("barcellona",
  // "fransisco") — single-word queries only, so "hor" can't ride "hotel" in.
  if (n === 1 && f.length >= 4) {
    const budget = Math.max(1, Math.floor(f.length / 5))
    for (const t of vt) {
      if (t.length >= 4 && editDistance(f, t, budget) <= budget) return 55
    }
  }

  return 0
}

// ─── Index ──────────────────────────────────────────────────────────

const COUNTRY_BY_NAME = new Map<string, string>() // norm(common) → cca2
const NAME_BY_CODE = new Map<string, string>() // cca2 → common name

function countryVariants(c: RawCountry): string[] {
  const out = new Set<string>()
  const add = (s?: string) => {
    const n = normQuery(s ?? "")
    if (n.length >= 2) out.add(n)
  }
  add(c.name?.common)
  add(c.name?.official)
  c.altSpellings?.forEach(add)
  const dem = c.demonyms?.eng
  add(dem?.f)
  add(dem?.m)
  add(c.cca2)
  add(c.cca3)
  add(c.cioc)
  ;(COUNTRY_ALIASES[c.cca2] ?? []).forEach(add)
  return [...out]
}

interface Index {
  entities: Entity[]
  builtAt: number
}

let indexPromise: Promise<Index> | null = null

/** The country half of the index — pure world-countries data, built once at
 *  module load so `matchCountryQuery` can answer synchronously (no disk, no
 *  network) for the server-side geocode ladder. */
const STATIC_COUNTRIES: Entity[] = []
const COUNTRY_BY_VARIANT = new Map<string, Entity>()
/** normalized country-name variant → ISO2 ("turkey" → TR, "turkiye" → TR). */
const HINT_CC = new Map<string, string>()

for (const c of countries as RawCountry[]) {
  const common = c.name?.common
  if (!common) continue
  const [lat, lon] = c.latlng ?? [0, 0]
  const e: Entity = {
    key: `c:${c.cca2}`,
    type: "country",
    name: common,
    country: common,
    countryCode: c.cca2,
    region: c.subregion || c.region || "",
    lat,
    lon,
    population: null,
    tier: 0,
    hasReport: false,
    flag: flagOf(c.cca2),
    variants: countryVariants(c),
  }
  STATIC_COUNTRIES.push(e)
  COUNTRY_BY_NAME.set(normQuery(common), c.cca2)
  NAME_BY_CODE.set(c.cca2, common)
  for (const v of e.variants) {
    if (!COUNTRY_BY_VARIANT.has(v)) COUNTRY_BY_VARIANT.set(v, e)
    if (v.length >= 3) HINT_CC.set(v, e.countryCode)
  }
}

/**
 * The no-network rung of the geocode ladder: does a raw query unambiguously
 * mean a country ("spain", "usa", "holland")? Exact matches always answer;
 * a prefix ("mexi") only when exactly one single-word country name starts
 * with it, so "dom" (Dominica vs Dominican Republic) gets a second opinion.
 */
export function matchCountryQuery(q: string): {
  name: string
  countryCode: string
  lat: number
  lon: number
} | null {
  const n = normQuery(q)
  if (n.length < MIN_QUERY) return null

  const exact = COUNTRY_BY_VARIANT.get(n)
  if (exact) {
    return {
      name: exact.name,
      countryCode: exact.countryCode,
      lat: exact.lat,
      lon: exact.lon,
    }
  }

  if (n.length >= 3) {
    let found: Entity | null = null
    for (const v of COUNTRY_BY_VARIANT.keys()) {
      if (!v.startsWith(n)) continue
      const e = COUNTRY_BY_VARIANT.get(v)!
      // Only unambiguous single-word country names answer a bare prefix.
      if (normQuery(e.name).split(/\s+/).length !== 1) continue
      if (found && found !== e) return null // two countries share the prefix
      found = e
    }
    if (found) {
      return {
        name: found.name,
        countryCode: found.countryCode,
        lat: found.lat,
        lon: found.lon,
      }
    }
  }
  return null
}

/** Country capitals + tier-1 popularity sets, keyed "cca2:norm(city)". */
function tierMaps(): {
  tier1: Set<string>
  capitals: Set<string>
} {
  const tier1 = new Set<string>()
  const capitals = new Set<string>()
  for (const place of TIER1) {
    const [city, ...rest] = place.split(",")
    const cc = COUNTRY_BY_NAME.get(normQuery(rest.join(",").trim()))
    if (!city || !cc) continue
    tier1.add(`${cc}:${normQuery(city)}`)
  }
  for (const c of countries as RawCountry[]) {
    const cap = c.capital?.[0]
    if (cap) capitals.add(`${c.cca2}:${normQuery(cap)}`)
  }
  return { tier1, capitals }
}

async function buildIndex(): Promise<Index> {
  const countryEntities = STATIC_COUNTRIES.map((e) => ({ ...e, variants: e.variants }))
  const seen = new Set<string>()

  const reports = await listReports()
  const countryReports = new Set<string>()
  const { tier1, capitals } = tierMaps()

  const cities: Entity[] = []
  for (const m of reports) {
    if (m.path.split("/").filter(Boolean).length !== 2) continue // country hubs
    const cc = m.countryCode.toUpperCase()
    if (m.city === NAME_BY_CODE.get(cc)) continue // city named like its country
    const key = `${cc}:${normQuery(m.city)}`
    if (seen.has(key)) continue
    seen.add(key)
    const tier = tier1.has(key) ? 1 : capitals.has(key) ? 2 : 3
    cities.push({
      key: `p:${key}`,
      type: "city",
      name: m.city,
      country: m.country,
      countryCode: cc,
      region: "",
      lat: m.lat,
      lon: m.lon,
      population: m.population ?? null,
      tier,
      hasReport: true,
      path: m.path,
      score: m.score,
      flag: flagOf(cc),
      variants: [normQuery(m.city)],
    })
  }
  for (const m of reports) {
    if (m.path.split("/").filter(Boolean).length === 1) {
      countryReports.add(m.countryCode.toUpperCase())
    }
  }
  for (const e of countryEntities) {
    if (countryReports.has(e.countryCode)) e.hasReport = true
  }

  const entities = [...countryEntities, ...cities]
  return { entities, builtAt: Date.now() }
}

/** The searchable index — countries + every report city, rebuilt at most
 *  once a minute (new reports land from pregeneration asynchronously). */
export function getIndex(): Promise<Index> {
  if (!indexPromise) {
    indexPromise = buildIndex().finally(() => {
      setTimeout(() => {
        indexPromise = null
      }, 60_000)
    })
  }
  return indexPromise
}

// ─── Scoring ────────────────────────────────────────────────────────

function matchEntity(e: Entity, tokens: string[]): number {
  let best = 0
  for (const v of e.variants) {
    const vt = v.split(/\s+/)
    const q = variantQuality(tokens, vt)
    if (q > best) best = q
  }
  return best
}

function hintScore(e: Entity, hint: string): number {
  if (!hint) return 0
  const hn = normQuery(hint)
  if (!hn) return 0
  if (e.countryCode.toLowerCase() === hn) return 35
  // "turkey" vs the Türkiye the report metadata uses: resolve the hint to the
  // country it names and compare codes (typed hints, alias targets).
  const hintCC = HINT_CC.get(hn)
  if (hintCC && hintCC === e.countryCode) return 35
  if (hn.length >= 2) {
    if (normQuery(e.country).includes(hn)) return 35
    if (e.region && normQuery(e.region).includes(hn)) return 30
  }
  return -200 // hint names a different country — suppress this hit
}

function entityScore(
  e: Entity,
  tokens: string[],
  hint: string,
  quality: number
): number {
  let s = quality
  if (e.type === "country") s += 12
  if (e.tier === 1) s += 25
  else if (e.tier === 2) s += 12
  else if (e.tier === 3) s += 4
  if (e.hasReport) s += 18
  s += hintScore(e, hint)
  return s
}

/** The countries whose names the bare query is a prefix of — for surfacing
 *  "mexi" → Mexico ahead of "Mexico City". */
function bareCountryBonus(e: Entity, tokens: string[], quality: number): number {
  if (e.type !== "country" || quality < 85) return 0
  const q = normQuery(e.name)
  const qWords = q.split(/\s+/)
  // Whole-query-prefix (single word country names), or first-token prefix.
  const joined = tokens.join(" ")
  if (qWords[0].startsWith(tokens[0]) && (tokens.length === 1 || q.startsWith(joined))) return 35
  return 0
}

// ─── Search ─────────────────────────────────────────────────────────

export const MIN_QUERY = 2

export interface SearchResult {
  hits: SearchHit[]
  /** true when the query was redirected through a curated alias. */
  aliased: boolean
  /** the canonical "City, Country" an alias redirected to, for the geocoder. */
  resolvedQuery?: string
}

/**
 * Ranked destination suggestions for a query. Local index first; the caller
 * (app/api/search) merges the geocoder long tail when this returns thin.
 */
export async function searchPlace(
  query: string,
  limit = 10,
  opts: { allowAliasRedirect?: boolean } = {}
): Promise<SearchResult> {
  const raw = query.trim()
  if (raw.length < MIN_QUERY) return { hits: [], aliased: false }

  // "barcelona, spain" → city tokens + country hint.
  const [head, ...rest] = raw.split(",")
  let tokens = (normQuery(head) || normQuery(raw)).split(/\s+/)
  const hint = normQuery(rest.join(",").trim())

  // Exact-match city aliases ("bkk", "vegas", "machu picchu") redirect to the
  // canonical "City, Country" the report index knows.
  const whole = tokens.join(" ")
  const aliasTarget = !hint ? CITY_ALIASES[whole] : undefined
  if (aliasTarget) {
    if (opts.allowAliasRedirect === false) return { hits: [], aliased: true }
    const redirected = await searchPlace(aliasTarget, limit, { allowAliasRedirect: false })
    return {
      hits: redirected.hits.map((h) => ({ ...h, resolvedFrom: whole })),
      aliased: true,
      // The canonical "City, Country" this alias resolved to — the geocoder
      // long tail should search that (with its country hint), not the raw
      // abbreviation: "goa" must geocode as "Goa, India", never as "Goa".
      resolvedQuery: aliasTarget,
    }
  }

  const { entities } = await getIndex()
  const scored: Array<{ e: Entity; quality: number; score: number }> = []
  for (const e of entities) {
    const quality = matchEntity(e, tokens)
    if (quality < 45) continue
    const score =
      entityScore(e, tokens, hint, quality) + bareCountryBonus(e, tokens, quality)
    // A hint naming a different country suppresses that hit outright (-200);
    // never surface negative scores — a clean miss beats wrong hits.
    if (score <= 0) continue
    scored.push({ e, quality, score })
  }

  // Exact matches always win over fuzzy ones, however famous the fuzzy hit.
  scored.sort(
    (a, b) =>
      (b.quality === 100 ? 1 : 0) - (a.quality === 100 ? 1 : 0) ||
      b.score - a.score
  )
  const hits: SearchHit[] = []
  const seen = new Set<string>()
  const add = (e: Entity, quality: number, extra?: Partial<SearchHit>) => {
    const key = `${e.type}:${e.key}`
    if (seen.has(key) || hits.length >= limit) return
    seen.add(key)
    hits.push({
      type: e.type,
      name: e.name,
      country: e.country,
      countryCode: e.countryCode,
      region: e.region || undefined,
      lat: e.lat,
      lon: e.lon,
      population: e.population,
      flag: e.flag,
      tier: e.tier,
      hasReport: e.hasReport,
      path: e.path,
      score: e.score,
      quality,
      ...extra,
    })
  }

  for (const s of scored) add(s.e, s.quality)

  // A near-exact country hit should carry its best-known cities underneath
  // ("mexi" → Mexico, then Mexico City). Only when nothing else is in front.
  const top = scored[0]
  if (
    top &&
    top.e.type === "country" &&
    top.quality >= 90 &&
    hits.length < limit
  ) {
    const best = entities
      .filter(
        (e) =>
          e.type === "city" &&
          e.countryCode === top.e.countryCode &&
          e.hasReport
      )
      .sort(
        (a, b) =>
          (b.tier === 1 ? 1 : 0) - (a.tier === 1 ? 1 : 0) ||
          (b.population ?? 0) - (a.population ?? 0)
      )
      .slice(0, 3)
    for (const c of best) add(c, 70, { inCountry: true })
  }

  return { hits, aliased: false }
}

/**
 * A bounded list of candidate display names for the AI resolver — every
 * country, plus the best-known cities (tier 1 first, then by population),
 * capped so the prompt stays small.
 */
export async function candidateNames(cap = 420): Promise<string[]> {
  const { entities } = await getIndex()
  const countries = entities.filter((e) => e.type === "country")
  const cities = entities
    .filter((e) => e.type === "city")
    .sort(
      (a, b) =>
        (b.tier === 1 ? 1 : 0) - (a.tier === 1 ? 1 : 0) ||
        (b.population ?? 0) - (a.population ?? 0)
    )
  const out: string[] = []
  for (const e of countries) out.push(e.name)
  for (const c of cities) {
    if (out.length >= cap) break
    out.push(`${c.name} (${c.country})`)
  }
  return out
}

/** Find one entity by its canonical display name (AI-resolver output). */
export async function findByName(
  name: string,
  country: string | null
): Promise<SearchHit | null> {
  const { entities } = await getIndex()
  for (const e of entities) {
    if (e.name.toLowerCase() !== name.toLowerCase()) continue
    if (country && e.type === "city" && normQuery(e.country) !== normQuery(country)) continue
    return {
      type: e.type,
      name: e.name,
      country: e.country,
      countryCode: e.countryCode,
      region: e.region || undefined,
      lat: e.lat,
      lon: e.lon,
      population: e.population,
      flag: e.flag,
      tier: e.tier,
      hasReport: e.hasReport,
      path: e.path,
      score: e.score,
      quality: 100,
    }
  }
  return null
}

export { MIN_QUERY as MIN_QUERY_LEN }