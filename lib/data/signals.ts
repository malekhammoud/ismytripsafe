import type {
  SafetySignal,
  SignalGroup,
  Comparison,
  GeoPoint,
  HealthNotice,
} from "../types"
import { fetchJson } from "./geo"
import { countryNameVariants, englishCountryName, iso3Code, normalizeCountryName } from "./country"
import { getEnvironment } from "./environment"
import { getHazards, type HazardEvent } from "./hazards"
import {
  resolveMetric,
  wbLatest,
  wbRegionCode,
  owidLatest,
  ghoLatest,
  type RefHit,
} from "./refdata"
import { SIGNAL_BANDS } from "../scoring"
import { timed, withBudget } from "../timing"

// ─── Scoring ─────────────────────────────────────────────────────────
// Every 0–100 curve lives in lib/scoring.ts, keyed by signal, so the score a
// signal gets when it is fetched is identical to the score it gets when a
// cached report is re-scored later. `score` below is looked up from there.

/** The central band for a signal key, or null-scoring if it has none. */
function scoreFor(key: string, v: number): number | null {
  const fn = SIGNAL_BANDS[key]
  if (!fn) return null
  const out = fn(v)
  return Number.isFinite(out) ? Math.round(out) : null
}

// ─── Signal definitions ──────────────────────────────────────────────
// Each signal: how to fetch it + how to score it + what it means.

interface SignalDef {
  key: string
  label: string
  group: SignalGroup
  source: string
  wb?: { indicator: string; source?: number } // primary World Bank fetch
  unit: string
  lowerIsBetter: boolean
  format: (v: number) => string
  note: string
}

const GTD = "Global Terrorism Database"
const WHO_GHO = "WHO Global Health Observatory"

const WB_WDI = "World Bank Open Data"
const WB_WGI = "World Bank Governance Indicators"
const WB_ENTERPRISE = "World Bank Enterprise Surveys"
const UN_SDG = "UN SDG Global Database"

const SIGNAL_DEFS: SignalDef[] = [
  {
    key: "homicide",
    label: "Homicide rate",
    group: "Violent crime",
    source: WB_WDI,
    wb: { indicator: "VC.IHR.PSRC.P5" },
    unit: "per 100k",
    lowerIsBetter: true,
    format: (v) => `${v.toFixed(1)} / 100k`,
    note: "Intentional homicides per 100,000 people — the clearest measure of lethal violence.",
  },
  {
    key: "firm_crime_losses",
    label: "Businesses hit by theft/vandalism",
    group: "Violent crime",
    source: WB_ENTERPRISE,
    wb: { indicator: "IC.FRM.THEV.ZS" },
    unit: "%",
    lowerIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "Share of firms reporting losses from theft/vandalism (Enterprise Surveys) — a practical proxy for everyday property-crime pressure.",
  },
  {
    key: "crime_major_constraint",
    label: "Crime seen as a major business constraint",
    group: "Violent crime",
    source: WB_ENTERPRISE,
    wb: { indicator: "IC.FRM.OBS.OBST6" },
    unit: "%",
    lowerIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    note: "Share of firms naming crime, theft and disorder as their biggest obstacle — signals broad law-and-order strain.",
  },
  {
    // Per million residents, not the raw count. Scoring the absolute number
    // rated 4,337 deaths in Afghanistan (~125/M) the same as 4,337 would be
    // in India (~3/M) — it made big countries look like war zones and small
    // war zones look calm.
    key: "terrorism_deaths_pm",
    label: "Terrorism deaths (latest year)",
    group: "Conflict & terrorism",
    source: GTD,
    unit: "per million",
    lowerIsBetter: true,
    format: (v) =>
      v === 0 ? "0 recorded" : v < 1 ? `${v.toFixed(2)} / million` : `${v.toFixed(1)} / million`,
    note: "Deaths from terrorist attacks in the most recent recorded year (Global Terrorism Database), per million residents. Countries with no recorded incidents count as zero.",
  },
  {
    key: "road_deaths",
    label: "Road traffic deaths",
    group: "Everyday hazards",
    source: WHO_GHO,
    unit: "per 100k",
    lowerIsBetter: true,
    format: (v) => `${v.toFixed(1)} / 100k`,
    note: "Estimated road-traffic deaths per 100,000 people (WHO) — statistically one of the biggest physical risks to travellers.",
  },
  {
    key: "stability",
    label: "Political stability & no terrorism",
    group: "Conflict & terrorism",
    source: WB_WGI,
    wb: { indicator: "GOV_WGI_PV.SC", source: 3 },
    unit: "/100",
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(0)}/100`,
    note: "Likelihood of political instability or politically-motivated violence, incl. terrorism (percentile).",
  },
  {
    key: "rule_of_law",
    label: "Rule of law",
    group: "Institutions & rule of law",
    source: WB_WGI,
    wb: { indicator: "GOV_WGI_RL.SC", source: 3 },
    unit: "/100",
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(0)}/100`,
    note: "Confidence in police, courts and contract enforcement (percentile rank vs all countries).",
  },
  {
    key: "corruption",
    label: "Control of corruption",
    group: "Institutions & rule of law",
    source: WB_WGI,
    wb: { indicator: "GOV_WGI_CC.SC", source: 3 },
    unit: "/100",
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(0)}/100`,
    note: "How well public power resists private/corrupt capture — affects police shakedowns & bribery.",
  },
  {
    key: "gov_effectiveness",
    label: "Government effectiveness",
    group: "Institutions & rule of law",
    source: WB_WGI,
    wb: { indicator: "GOV_WGI_GE.SC", source: 3 },
    unit: "/100",
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(0)}/100`,
    note: "Quality of public services and emergency response — matters when something goes wrong.",
  },
  {
    key: "regulatory",
    label: "Regulatory quality",
    group: "Institutions & rule of law",
    source: WB_WGI,
    wb: { indicator: "GOV_WGI_RQ.SC", source: 3 },
    unit: "/100",
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(0)}/100`,
    note: "Soundness of rules governing business, transport and health & safety.",
  },
  {
    key: "voice",
    label: "Voice & accountability",
    group: "Institutions & rule of law",
    source: WB_WGI,
    wb: { indicator: "GOV_WGI_VA.SC", source: 3 },
    unit: "/100",
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(0)}/100`,
    note: "Freedom of expression & association — low scores correlate with arbitrary detention risk.",
  },
]

// ─── Fetchers ────────────────────────────────────────────────────────

interface WBRow {
  date: string
  value: number | null
  country?: { value: string }
  countryiso3code?: string
}

interface SDGGeoArea {
  geoAreaCode: string
  geoAreaName: string
}

interface SDGDataPoint {
  timePeriodStart?: number
  value?: string
  dimensions?: Record<string, string>
  seriesDescription?: string
}

interface SDGIndicatorData {
  data?: SDGDataPoint[]
}

// All six WGI indicators in ONE World Bank request — one round-trip instead
// of six halves the odds of the flaky API blanking the Stability section.
const WGI_CODES: Record<string, string> = {
  stability: "GOV_WGI_PV.SC",
  rule_of_law: "GOV_WGI_RL.SC",
  corruption: "GOV_WGI_CC.SC",
  gov_effectiveness: "GOV_WGI_GE.SC",
  regulatory: "GOV_WGI_RQ.SC",
  voice: "GOV_WGI_VA.SC",
}

interface WBBatchRow extends WBRow {
  indicator?: { id?: string }
}

const wgiBatchCache = new Map<string, Promise<Map<string, RefHit> | null>>()

function wgiBatch(iso2: string): Promise<Map<string, RefHit> | null> {
  let p = wgiBatchCache.get(iso2)
  if (!p) {
    p = (async () => {
      try {
        const codes = Object.values(WGI_CODES).join(";")
        const url = `https://api.worldbank.org/v2/country/${iso2}/indicator/${codes}?format=json&mrv=10&source=3&per_page=600`
        const data = (await fetchJson(url, 8000)) as [unknown, WBBatchRow[] | null]
        const rows = data?.[1]
        if (!Array.isArray(rows)) return null
        const out = new Map<string, RefHit>()
        for (const r of rows) {
          const id = r.indicator?.id
          if (!id || r.value == null || out.has(id)) continue
          out.set(id, { value: r.value, year: r.date })
        }
        return out.size ? out : null
      } catch {
        return null
      }
    })()
    p.then((m) => {
      if (!m) wgiBatchCache.delete(iso2)
    })
    wgiBatchCache.set(iso2, p)
  }
  return p
}

/**
 * Country population, for per-capita normalisation. Cached through
 * resolveMetric like every other indicator, so it costs one request per
 * country per process and survives a World Bank outage.
 */
async function countryPopulation(iso2: string): Promise<number | null> {
  const hit = await resolveMetric(`${iso2}:population`, [
    () => wbLatest(iso2, "SP.POP.TOTL"),
  ])
  return hit && hit.value > 0 ? hit.value : null
}

/**
 * Fallback chains — the heart of "no metric goes missing". Each signal tries
 * its primary source, then independent secondary databases, then a coarser
 * geography (country → region), and finally the durable last-known-good
 * store (see refdata.ts). Values from a non-primary source are labeled.
 */
function buildChains(
  iso2: string,
  iso3: string
): Record<string, Array<() => Promise<RefHit | null>>> {
  const regionFallback =
    (indicator: string) => async (): Promise<RefHit | null> => {
      const region = await wbRegionCode(iso2)
      if (!region) return null
      const hit = await wbLatest(region, indicator)
      return (
        hit && {
          ...hit,
          sourceOverride: "World Bank Open Data (regional average)",
          displaySuffix: " · regional avg",
        }
      )
    }

  const wgiChains = Object.fromEntries(
    Object.entries(WGI_CODES).map(([key, code]) => [
      key,
      [
        async (): Promise<RefHit | null> => (await wgiBatch(iso2))?.get(code) ?? null,
        () => wbLatest(iso2, code, 3),
      ],
    ])
  )

  return {
    ...wgiChains,
    homicide: [
      () => wbLatest(iso2, "VC.IHR.PSRC.P5"),
      async () => {
        const h = await owidLatest("homicide-rate-unodc", iso3)
        return h && { ...h, sourceOverride: "UNODC (via Our World in Data)" }
      },
      async () => {
        const h = await ghoLatest("VIOLENCE_HOMICIDERATE", iso3)
        return h && { ...h, sourceOverride: WHO_GHO }
      },
      regionFallback("VC.IHR.PSRC.P5"),
    ],
    rule_of_law: [
      async (): Promise<RefHit | null> =>
        (await wgiBatch(iso2))?.get(WGI_CODES.rule_of_law) ?? null,
      () => wbLatest(iso2, "GOV_WGI_RL.SC", 3),
      async () => {
        // V-Dem's rule-of-law index runs 0–1; ×100 approximates a percentile.
        const h = await owidLatest("rule-of-law-index", iso3)
        return (
          h && {
            value: Math.round(h.value * 100),
            year: h.year,
            sourceOverride: "V-Dem Rule of Law Index",
          }
        )
      },
    ],
    terrorism_deaths_pm: [
      async () => {
        const [h, pop] = await Promise.all([
          owidLatest("terrorism-deaths", iso3),
          countryPopulation(iso2),
        ])
        // The GTD only lists countries with recorded incidents — absence
        // genuinely means zero recorded deaths, not missing data.
        const deaths = h?.value ?? 0
        // Without a population we cannot normalise, and the raw count is not
        // comparable between countries, so report no data rather than a
        // number that would mean something different for every place.
        if (pop == null || pop <= 0) return null
        return { value: (deaths / pop) * 1e6, year: h?.year ?? null }
      },
    ],
    road_deaths: [
      () => ghoLatest("RS_198", iso3),
      async () => {
        const h = await owidLatest("death-rate-road-traffic-injuries", iso3)
        return h && { ...h, sourceOverride: "UN SDG (via Our World in Data)" }
      },
    ],
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TravelAI/1.0 (travel safety research)" },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function fetchSdgAreaCode(iso2: string): Promise<number | null> {
  try {
    const list = (await fetchJson(
      "https://unstats.un.org/SDGAPI/v1/sdg/GeoArea/List",
      7000
    )) as SDGGeoArea[]
    if (!Array.isArray(list)) return null
    const wanted = countryNameVariants(iso2)
    if (!wanted.size) return null
    for (const row of list) {
      const norm = normalizeCountryName(row.geoAreaName ?? "")
      if (!norm || !wanted.has(norm)) continue
      const code = Number(row.geoAreaCode)
      if (Number.isFinite(code)) return code
    }
    return null
  } catch {
    return null
  }
}

function sdgPriority(point: SDGDataPoint): number {
  const dims = point.dimensions ?? {}
  let rank = 0
  const asValues = Object.values(dims).map((v) => v.toUpperCase())
  if (asValues.some((v) => /BOTHSEX|BOTH|TOTAL/.test(v))) rank += 2
  if (asValues.some((v) => /ALLAREA|TOTAL/.test(v))) rank += 1
  return rank
}

/** Wall-clock cap for one SDG indicator on a cold country. */
const SDG_BUDGET_MS = 3_000

// One request per SDG indicator per country; series are filtered locally.
const sdgDataCache = new Map<string, Promise<SDGDataPoint[] | null>>()

function fetchSdgRows(areaCode: number, indicator: string): Promise<SDGDataPoint[] | null> {
  const key = `${areaCode}:${indicator}`
  let p = sdgDataCache.get(key)
  if (!p) {
    p = (async () => {
      try {
        const url =
          `https://unstats.un.org/SDGAPI/v1/sdg/Indicator/Data` +
          `?indicator=${encodeURIComponent(indicator)}&areaCode=${areaCode}&pageSize=1000`
        const data = (await fetchJson(url, 8000)) as SDGIndicatorData
        return Array.isArray(data.data) ? data.data : null
      } catch {
        return null
      }
    })()
    p.then((rows) => {
      // never cache a failure — the next request should retry
      if (!rows) sdgDataCache.delete(key)
    })
    sdgDataCache.set(key, p)
  }
  return p
}

async function fetchSdgLatest(
  areaCode: number,
  indicator: string,
  seriesMatch?: RegExp
): Promise<{ value: number; year: string | null } | null> {
  try {
    const rows = await fetchSdgRows(areaCode, indicator)
    if (!Array.isArray(rows) || rows.length === 0) return null
    const clean = rows
      .filter((r) => !seriesMatch || seriesMatch.test(r.seriesDescription ?? ""))
      .map((r) => ({
        value: Number(r.value),
        year: r.timePeriodStart != null ? String(Math.trunc(r.timePeriodStart)) : null,
        rank: sdgPriority(r),
      }))
      .filter((r) => Number.isFinite(r.value))
      .sort((a, b) => {
        const yA = Number(a.year ?? 0)
        const yB = Number(b.year ?? 0)
        if (yA !== yB) return yB - yA
        return b.rank - a.rank
      })
    if (!clean.length) return null
    return { value: clean[0].value, year: clean[0].year }
  } catch {
    return null
  }
}

interface NumbeoHit {
  crimeIndex: number
  safetyIndex: number
  scope: "city" | "country"
  /**
   * The city-level detail panel. Every other scored signal in this file is a
   * national statistic, which is why cities in one country used to land within
   * a couple of points of each other — Munich and Berlin both scored 87-88
   * while Numbeo rated their crime 16.9 and 48.2. These are the numbers that
   * tell those two apart, and they only exist for city pages.
   */
  detail?: NumbeoDetail
}

interface NumbeoDetail {
  /** 0–100, higher = safer. Already on our scale, no banding needed. */
  safetyNight?: number
  safetyDay?: number
  /** 0–100, higher = worse. */
  worryMugged?: number
  problemViolentCrime?: number
  problemPropertyCrime?: number
  problemDrugs?: number
}

/** City-level Numbeo crime page — the finest-grained crime read we have. */
async function fetchNumbeoCity(city: string): Promise<NumbeoHit | null> {
  try {
    const slug = city
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
    if (!slug) return null
    const html = await fetchText(
      `https://r.jina.ai/http://www.numbeo.com/crime/in/${slug}`,
      4000
    )
    if (!html) return null
    const crime = html.match(/Crime Index:?\s*\|?\s*([0-9]+(?:\.[0-9]+)?)/i)
    const safety = html.match(/Safety Index:?\s*\|?\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (!crime || !safety) return null
    const crimeIndex = Number(crime[1])
    const safetyIndex = Number(safety[1])
    if (!Number.isFinite(crimeIndex) || !Number.isFinite(safetyIndex)) return null
    // The page renders zeros when a city has too few contributors.
    if (crimeIndex === 0 && safetyIndex === 0) return null

    // The same page carries a breakdown that is far more useful to a traveller
    // than the headline index: how safe people feel walking alone at night,
    // and how much they worry about being mugged. Rows read
    // "<label> <value> <band>", e.g. "Safety walking alone during night 72.17 High".
    const row = (label: string): number | undefined => {
      const m = html.match(
        new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+([0-9]+(?:\\.[0-9]+)?)", "i")
      )
      const v = m ? Number(m[1]) : NaN
      return Number.isFinite(v) ? v : undefined
    }
    const detail: NumbeoDetail = {
      safetyNight: row("Safety walking alone during night"),
      safetyDay: row("Safety walking alone during daylight"),
      worryMugged: row("Worries being mugged or robbed"),
      problemViolentCrime: row("Problem violent crimes such as assault and armed robbery"),
      problemPropertyCrime: row("Problem property crimes such as vandalism and theft"),
      problemDrugs: row("Problem people using or dealing drugs"),
    }
    const hasDetail = Object.values(detail).some((v) => v != null)

    return { crimeIndex, safetyIndex, scope: "city", ...(hasDetail ? { detail } : {}) }
  } catch {
    return null
  }
}

async function fetchNumbeoCountry(iso2: string): Promise<NumbeoHit | null> {
  try {
    const html = await fetchText(
      "https://r.jina.ai/http://www.numbeo.com/crime/rankings_by_country.jsp",
      4000
    )
    if (!html) return null
    const variants = countryNameVariants(iso2)
    if (!variants.size) return null
    const rowRe = /\|\s*[^|]*\|\s*([^|]+?)\s*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|/g
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(html))) {
      const country = normalizeCountryName(m[1].trim())
      if (!variants.has(country)) continue
      const crimeIndex = Number(m[2])
      const safetyIndex = Number(m[3])
      if (!Number.isFinite(crimeIndex) || !Number.isFinite(safetyIndex)) return null
      return { crimeIndex, safetyIndex, scope: "country" }
    }
    return null
  } catch {
    return null
  }
}

/**
 * City first, then country — the "expand outward until data exists" ladder.
 * Both go out at once (they used to run in series, two 12s proxied fetches on
 * the critical path); the city result still wins when it exists.
 */
async function fetchNumbeo(iso2: string, city: string): Promise<NumbeoHit | null> {
  const cityish = city && normalizeCountryName(city) !== normalizeCountryName(englishCountryName(iso2) ?? "")
  const [cityHit, countryHit] = await Promise.all([
    cityish ? fetchNumbeoCity(city).catch(() => null) : Promise.resolve(null),
    fetchNumbeoCountry(iso2).catch(() => null),
  ])
  return cityHit ?? countryHit
}

// ─── FBI UCR city crime (US destinations only) ───────────────────────
//
// The FBI Crime Data Explorer's own API needs an api.data.gov key, so this
// reads the same official numbers from the keyless Wikipedia mirror of the
// CDE's "Table 8 — Offenses Known to Law Enforcement by City" (city-agency
// crime rates per 100,000). It is the one source that ranks St. Louis
// against St. Paul on the same yardstick, which the national homicide rate
// cannot do. Fetched once per process and cached; non-US places skip it.

const FBI_CDE_WIKI =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_United_States_cities_by_crime_rate&format=json&prop=wikitext&formatversion=2"

interface FbiCityRate {
  /** Violent crimes per 100,000 — murder, rape, robbery, aggravated assault. */
  violent: number
  /** Property crimes per 100,000 — burglary, larceny-theft, motor vehicle theft. */
  property: number
}

/** "St. Louis" → {stlouis, saintlouis} … so our names match the table's. */
function fbiNameVariants(name: string): string[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
  const base = norm(name)
  const out = [base]
  if (/^st[\s.]/i.test(name.trim()))
    out.push(norm(name.trim().replace(/^st[\s.]/i, "saint ")))
  else if (/^saint\s+/i.test(name.trim()))
    out.push(norm(name.trim().replace(/^saint\s+/i, "st ")))
  if (/\bdc\b|[d.]\s*c\./i.test(name))
    out.push(norm(name.trim().replace(/\s*d\.?\s*c\.?\s*$/i, "")))
  return Array.from(new Set(out))
}

let fbiTablePromise: Promise<Map<string, FbiCityRate> | null> | null = null

async function fetchFbiTable(): Promise<Map<string, FbiCityRate> | null> {
  const html = await fetchText(FBI_CDE_WIKI, 9000)
  if (!html) return null
  let data: { parse?: { wikitext?: string } } | null = null
  try {
    data = JSON.parse(html)
  } catch {
    return null
  }
  const wt = data?.parse?.wikitext
  if (!wt) return null

  // Some rows carry <sup> footnotes and multi-line <ref> citations inline
  // (e.g. Baltimore) that would break line-by-line parsing — strip them first.
  const cleaned = wt
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")

  const map = new Map<string, FbiCityRate>()
  const lines = cleaned.replace(/\\n/g, "\n").split("\n")
  for (let i = 0; i < lines.length; i++) {
    // Row opener: {{flaglist|State}} || … [[City, State|City]] || population
    const row = lines[i].match(
      /\{\{flaglist\|[^}]+\}\}\s*\|\|.*?\[\[(?:[^\]|]+\|)?([^\]|]+)\]\]\s*\|\|.*?[\d,]+$/
    )
    if (!row) continue
    const nums = (lines[i + 1]?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
    // Decoded columns: 0 Total, 1 Murder, 2 Rape, 3 Robbery, 4 Agg. assault,
    // 5 Violent, 6 Arson, 7 Burglary, 8 Larceny, 9 Motor vehicle, 10 Property.
    const violent = nums[5]
    const property = nums[10]
    if (!Number.isFinite(violent) || !Number.isFinite(property)) continue
    for (const key of fbiNameVariants(row[1])) map.set(key, { violent, property })
    i++
  }
  return map.size ? map : null
}

async function fetchFbiCityRates(city: string): Promise<FbiCityRate | null> {
  fbiTablePromise ??= fetchFbiTable()
  const table = await fbiTablePromise
  if (!table) return null
  for (const key of fbiNameVariants(city)) {
    const hit = table.get(key)
    if (hit) return hit
  }
  // City not in the CDE table (FBI only covers places with a full year of
  // reports) — no data, never a guess.
  return null
}

async function fetchCrimeExtras(iso2: string, city: string): Promise<SafetySignal[]> {
  // Numbeo and the SDG series are independent; only the SDG *data* depends on
  // the area-code lookup. Awaiting both up front chained Numbeo's budget in
  // front of the SDG wave and made this stage cost the sum of the two (4s + 3s)
  // instead of the larger of them.
  const numbeoPromise = timed("crime.numbeo", fetchNumbeo(iso2, city))
  const areaCode = await timed("crime.sdgArea", fetchSdgAreaCode(iso2))
  const sdgPromise = areaCode == null ? null : fetchSdgSignals(iso2, areaCode)

  const numbeo = await numbeoPromise
  const signals: SafetySignal[] = []

  if (numbeo) {
    // Only the crime index is kept. Numbeo's "safety index" is definitionally
    // ~100 − crime index, so scoring both counted one crowdsourced perception
    // measure twice and gave it double its intended weight.
    const scopeSuffix = numbeo.scope === "city" ? " · city-level" : ""
    const scopeNote =
      numbeo.scope === "city"
        ? `Numbeo's crowdsourced index for ${city} itself (city-level).`
        : "Numbeo's country-level crowdsourced index (no city-level data for this place)."
    signals.push({
      key: "numbeo_crime_index",
      label: "Crime index (crowdsourced)",
      group: "Violent crime",
      source: "Numbeo Crime Index",
      value: numbeo.crimeIndex,
      display: `${numbeo.crimeIndex.toFixed(1)} / 100${scopeSuffix}`,
      year: null,
      score: scoreFor("numbeo_crime_index", numbeo.crimeIndex),
      lowerIsBetter: true,
      note: `${scopeNote} Higher index = more perceived crime. Self-selected samples, so it is weighted below the recorded-crime statistics.`,
    })

    // The city-level breakdown. These are the only signals in the whole set
    // that describe *this city* rather than its country, so they carry the
    // weight that separates one city from another (see PILLARS in scoring.ts).
    const d = numbeo.detail
    if (d) {
      const cityNote = (what: string) =>
        `${what} in ${city} itself, from Numbeo's resident survey. City-level — this is what distinguishes ${city} from elsewhere in ${englishCountryName(iso2) ?? "the country"}.`

      const add = (
        key: string,
        label: string,
        value: number | undefined,
        lowerIsBetter: boolean,
        fmt: (v: number) => string,
        what: string
      ) => {
        if (value == null) return
        signals.push({
          key,
          label,
          group: "Violent crime",
          source: "Numbeo (city survey)",
          value,
          display: fmt(value),
          year: null,
          score: scoreFor(key, value),
          lowerIsBetter,
          note: cityNote(what),
        })
      }

      add("numbeo_safety_night", "Feeling safe walking alone at night", d.safetyNight, false,
        (v) => `${v.toFixed(0)} / 100`, "How safe residents feel walking alone after dark")
      add("numbeo_safety_day", "Feeling safe walking alone in daylight", d.safetyDay, false,
        (v) => `${v.toFixed(0)} / 100`, "How safe residents feel walking alone by day")
      add("numbeo_worry_mugged", "Worry about being mugged or robbed", d.worryMugged, true,
        (v) => `${v.toFixed(0)} / 100`, "How much residents worry about mugging and robbery")
      add("numbeo_violent_crime", "Violent crime as a local problem", d.problemViolentCrime, true,
        (v) => `${v.toFixed(0)} / 100`, "How much of a problem assault and armed robbery are")
      add("numbeo_property_crime", "Property crime as a local problem", d.problemPropertyCrime, true,
        (v) => `${v.toFixed(0)} / 100`, "How much of a problem vandalism and theft are")
      add("numbeo_drugs", "Drug dealing or use as a local problem", d.problemDrugs, true,
        (v) => `${v.toFixed(0)} / 100`, "How visible drug use and dealing are")
    }
  }

  if (sdgPromise) signals.push(...(await sdgPromise))

  // FBI city-agency crime rates — the strongest US-specific street-crime read.
  // Only US places have this, so it runs in parallel with nothing blocking.
  if (iso2.toUpperCase() === "US" && city) {
    const fbi = await timed("crime.fbi", fetchFbiCityRates(city).catch(() => null))
    if (fbi) {
      signals.push({
        key: "fbi_violent_crime_rate",
        label: "Violent crime rate (FBI)",
        group: "Violent crime",
        source: "FBI Crime Data Explorer",
        value: fbi.violent,
        display: `${fbi.violent.toFixed(0)} / 100k`,
        year: null,
        score: scoreFor("fbi_violent_crime_rate", fbi.violent),
        lowerIsBetter: true,
        note: `FBI-published violent crime per 100,000 people (murder, rape, robbery and aggravated assault) reported by ${city}'s own law-enforcement agency — UCR Table 8, most recent annual release. City-level, which is what separates ${city} from other US cities.`,
      })
      signals.push({
        key: "fbi_property_crime_rate",
        label: "Property crime rate (FBI)",
        group: "Violent crime",
        source: "FBI Crime Data Explorer",
        value: fbi.property,
        display: `${fbi.property.toFixed(0)} / 100k`,
        year: null,
        score: scoreFor("fbi_property_crime_rate", fbi.property),
        lowerIsBetter: true,
        note: `FBI-published property crime per 100,000 people (burglary, larceny-theft, motor vehicle theft) reported by ${city}'s own law-enforcement agency — UCR. City-level.`,
      })
    }
  }

  return signals
}

/** The UN SDG victimisation/bribery survey series for a country, as signals. */
async function fetchSdgSignals(iso2: string, areaCode: number): Promise<SafetySignal[]> {
  const signals: SafetySignal[] = []

  const sdgDefs: Array<{
    indicator: string
    key: string
    label: string
    lowerIsBetter: boolean
    seriesMatch?: RegExp
    note: string
    display: (v: number) => string
  }> = [
    {
      indicator: "16.1.4",
      key: "safe_walking_dark",
      label: "Feel safe walking alone after dark",
      lowerIsBetter: false,
      note: "Share of people who report feeling safe walking alone at night in their area (SDG 16.1.4).",
      display: (v) => `${v.toFixed(1)}%`,
    },
    {
      indicator: "16.1.3",
      key: "violence_victimization",
      label: "Physical assault (past year)",
      lowerIsBetter: true,
      seriesMatch: /physical violence/i,
      note: "Share of people subjected to physical violence (assault) in the previous 12 months — UNODC-backed survey data (SDG 16.1.3).",
      display: (v) => `${v.toFixed(1)}%`,
    },
    {
      indicator: "16.1.3",
      key: "sexual_violence",
      label: "Sexual violence (past year)",
      lowerIsBetter: true,
      seriesMatch: /sexual violence/i,
      note: "Share of people subjected to sexual violence in the previous 12 months — UNODC-backed survey data (SDG 16.1.3).",
      display: (v) => `${v.toFixed(1)}%`,
    },
    {
      indicator: "16.2.2",
      key: "human_trafficking_victims",
      label: "Detected human-trafficking victims",
      lowerIsBetter: true,
      // the indicator also publishes absolute victim counts — only the
      // per-100k series is comparable across countries
      seriesMatch: /per 100,?000/i,
      note: "Detected victims of human trafficking per 100,000 population (SDG 16.2.2) — the metric behind the UNODC Global Report on Trafficking in Persons. Detection-biased, since better policing finds more victims, so it carries little weight.",
      display: (v) => `${v.toFixed(2)} / 100k`,
    },
    {
      indicator: "16.5.1",
      key: "bribery_contact_rate",
      label: "Bribery during public-official contact",
      lowerIsBetter: true,
      note: "People who had contact with a public official and were asked for/paid a bribe in the last 12 months (SDG 16.5.1).",
      display: (v) => `${v.toFixed(1)}%`,
    },
  ]

  // These are country-level survey statistics revised at most yearly, so they
  // go through the same warm store as every other country stat: a value seen
  // in the last week is served from disk and revalidated in the background.
  // That matters here more than anywhere else — SDG 16.2.2 answers with the
  // entire global dataset (~550KB, ~6.4s), and paying that on every report for
  // a number that moves once a year was the single largest cost in the bundle.
  //
  // The wave is also bounded: one slow indicator must not hold the whole
  // report hostage. On a country we've never seen, a straggler resolves to "no
  // data" for that one report and is correct from the next one on, once the
  // background revalidation has filled the store.
  const sdgHits = await timed(
    "crime.sdgData",
    Promise.all(
      sdgDefs.map((d) =>
        withBudget(
          resolveMetric(`${iso2}:${d.key}`, [
            () => fetchSdgLatest(areaCode, d.indicator, d.seriesMatch),
          ]),
          SDG_BUDGET_MS
        )
      )
    )
  )

  sdgDefs.forEach((d, i) => {
    const hit = sdgHits[i]
    signals.push({
      key: d.key,
      label: d.label,
      group: "Violent crime",
      source: UN_SDG,
      value: hit?.value ?? null,
      display: hit ? d.display(hit.value) : "No data",
      year: hit?.year ?? null,
      score: hit ? scoreFor(d.key, hit.value) : null,
      lowerIsBetter: d.lowerIsBetter,
      note: d.note,
    })
  })

  return signals
}

// ─── Public API ──────────────────────────────────────────────────────

export interface SignalsResult {
  signals: SafetySignal[]
  comparisons: Comparison[]
  health: HealthNotice[]
  /** Active nearby GDACS disaster alerts — extra context for the agent. */
  hazardEvents: HazardEvent[]
  /** One-line USGS seismic-history summary, for the agent prompt. */
  quakeSummary: string | null
}

/** Gather all safety signals for a place from every database, in parallel. */
export async function gatherSignals(geo: GeoPoint): Promise<SignalsResult> {
  const iso2 = geo.countryCode
  const iso3 = iso3Code(iso2) ?? iso2
  const chains = buildChains(iso2, iso3)

  // Every signal resolves through its fallback chain: primary source →
  // secondary databases → regional aggregate → last-known-good store.
  const defPromises = SIGNAL_DEFS.map((d) => {
    // A def either has a bespoke multi-source chain (which already includes
    // its primary fetch) or falls back to its plain World Bank fetch.
    const chain =
      chains[d.key] ??
      (d.wb ? [() => wbLatest(iso2, d.wb!.indicator, d.wb!.source)] : [])
    return resolveMetric(`${iso2}:${d.key}`, chain)
  })

  const [defResults, comparisons, environment, crimeExtras, hazards] = await Promise.all([
    timed("sig.metrics", Promise.all(defPromises)),
    // comparison bars are context, not a scored signal — never let the World
    // Bank's multi-country query (7s timeout, no retries) gate the report
    timed("sig.comparisons", withBudget(fetchComparisons(iso2), 3_000).then((c) => c ?? [])),
    timed("sig.environment", getEnvironment(geo)),
    timed("sig.crimeExtras", fetchCrimeExtras(iso2, geo.city)),
    timed("sig.hazards", getHazards(geo)),
  ])

  const signals: SafetySignal[] = []

  SIGNAL_DEFS.forEach((d, i) => {
    const res = defResults[i]
    // Enterprise Surveys genuinely skip many (mostly high-income) countries —
    // say so, rather than an ambiguous "No data".
    const nullDisplay =
      d.source === WB_ENTERPRISE ? "Not surveyed here" : "No data"
    signals.push({
      key: d.key,
      label: d.label,
      group: d.group,
      source: res?.sourceOverride ?? d.source,
      value: res?.value ?? null,
      display: res ? d.format(res.value) + (res.displaySuffix ?? "") : nullDisplay,
      year: res?.year ?? null,
      score: res ? scoreFor(d.key, res.value) : null,
      lowerIsBetter: d.lowerIsBetter,
      note: d.note,
    })
  })

  // Urban scale — the one city-level input available for nearly every place.
  // Numbeo has pages for major cities only, so without this the long tail of
  // secondary cities carries no city-specific evidence at all and simply
  // inherits its country's score.
  if (geo.population && geo.population > 0) {
    const p = geo.population
    const pretty =
      p >= 1_000_000 ? `${(p / 1_000_000).toFixed(1)}M` : `${Math.round(p / 1000)}k`
    signals.push({
      key: "city_population_scale",
      label: "Urban scale factor",
      group: "Violent crime",
      source: "City Geocoding",
      value: p,
      display: `${pretty} residents`,
      year: null,
      score: scoreFor("city_population_scale", p),
      lowerIsBetter: true,
      note: `${geo.city} has about ${pretty} residents. Metro area scale introduces non-linear urban transit and opportunistic theft density variance vs smaller towns in the same country.`,
    })
  }

  signals.push(...crimeExtras)

  // Air quality + CDC health + hospitals + weather (direct from source)
  signals.push(...environment.signals)

  // Live disaster alerts + seismic history (GDACS / USGS)
  signals.push(hazards.signal)

  return {
    signals,
    comparisons,
    health: environment.health,
    hazardEvents: hazards.events,
    quakeSummary: hazards.quakeSummary,
  }
}

const BENCHMARKS = "JP;CH;US;BR;ZA;WLD" // safe → risky + world

/** Comparison bars: target country vs benchmark countries + world average. */
async function fetchComparisons(iso2: string): Promise<Comparison[]> {
  const metrics: { indicator: string; metric: string; unit: string }[] = [
    { indicator: "VC.IHR.PSRC.P5", metric: "Homicide rate", unit: "per 100k" },
  ]

  const out: Comparison[] = []
  await Promise.all(
    metrics.map(async (m) => {
      try {
        const codes = `${iso2};${BENCHMARKS}`
        const url = `https://api.worldbank.org/v2/country/${codes}/indicator/${m.indicator}?format=json&mrv=12&per_page=400`
        const data = (await fetchJson(url, 7000)) as [unknown, WBRow[] | null]
        const rows = data[1]
        if (!Array.isArray(rows)) return
        // most-recent non-null per country (keyed by ISO3 to match the target)
        const best = new Map<string, { name: string; value: number }>()
        for (const r of rows) {
          if (r.value == null || !r.country) continue
          const iso3 = r.countryiso3code ?? r.country.value
          if (!best.has(iso3)) best.set(iso3, { name: r.country.value, value: r.value })
        }
        const targetName = englishCountryName(iso2) ?? iso2
        const cleanName = (n: string) =>
          n === "World" ? "World avg" : n.split(",")[0].trim()
        const isTargetRow = (name: string) => {
          const a = cleanName(name).toLowerCase()
          const b = targetName.toLowerCase()
          return a === b || a.startsWith(b) || b.startsWith(a)
        }
        const entries = Array.from(best.values())
          .map(({ name, value }) => ({
            name: cleanName(name),
            value: Math.round(value * 10) / 10,
            isTarget: isTargetRow(name),
            isWorld: name === "World",
          }))
          .sort((a, b) => a.value - b.value)
        if (entries.length) {
          out.push({ metric: m.metric, unit: m.unit, lowerIsBetter: true, entries })
        }
      } catch {
        /* skip */
      }
    })
  )
  return out
}
