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
import {
  resolveMetric,
  wbLatest,
  wbRegionCode,
  owidLatest,
  ghoLatest,
  type RefHit,
} from "./refdata"

// ─── Normalization helpers (everything → 0–100, 100 = safest) ────────

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

/** Piecewise map of a "lower is better" rate to a 0–100 safety score. */
function bandLowerBetter(value: number, points: [number, number][]): number {
  // points: ascending [rawValue, score]; interpolate linearly, clamp at ends.
  if (value <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (value >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    if (value <= x2) {
      const t = (value - x1) / (x2 - x1)
      return clamp(y1 + t * (y2 - y1))
    }
  }
  return last[1]
}

/** Piecewise map of a "higher is better" rate to a 0–100 safety score. */
function bandHigherBetter(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (value >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    if (value <= x2) {
      const t = (value - x1) / (x2 - x1)
      return clamp(y1 + t * (y2 - y1))
    }
  }
  return last[1]
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
  score: (v: number) => number
  note: string
}

const GTD = "Global Terrorism Database"
const WHO_GHO = "WHO Global Health Observatory"

const WB_WDI = "World Bank Open Data"
const WB_WGI = "World Bank Governance Indicators"
const WB_ENTERPRISE = "World Bank Enterprise Surveys"
const UN_SDG = "UN SDG Global Database"

// WGI scores are already 0–100 (higher = safer/better) → use directly.
const wgiScore = (v: number) => clamp(v)

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
    score: (v) =>
      bandLowerBetter(v, [
        [0, 100],
        [1, 92],
        [3, 78],
        [5, 68],
        [10, 50],
        [20, 30],
        [40, 12],
        [60, 3],
      ]),
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
    score: (v) =>
      bandLowerBetter(v, [
        [1, 97],
        [3, 88],
        [8, 72],
        [15, 55],
        [25, 36],
        [40, 16],
        [60, 4],
      ]),
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
    score: (v) =>
      bandLowerBetter(v, [
        [1, 96],
        [4, 87],
        [10, 74],
        [18, 58],
        [30, 40],
        [45, 20],
        [65, 5],
      ]),
    note: "Share of firms naming crime, theft and disorder as their biggest obstacle — signals broad law-and-order strain.",
  },
  {
    key: "terrorism_deaths",
    label: "Terrorism deaths (latest year)",
    group: "Conflict & terrorism",
    source: GTD,
    unit: "deaths",
    lowerIsBetter: true,
    format: (v) => (v === 0 ? "0 recorded" : `${Math.round(v)}`),
    score: (v) =>
      bandLowerBetter(v, [
        [0, 96],
        [1, 88],
        [5, 80],
        [25, 68],
        [100, 52],
        [500, 32],
        [2000, 12],
        [5000, 3],
      ]),
    note: "Deaths from terrorist attacks in the most recent recorded year (Global Terrorism Database). Countries with no recorded incidents count as zero.",
  },
  {
    key: "road_deaths",
    label: "Road traffic deaths",
    group: "Everyday hazards",
    source: WHO_GHO,
    unit: "per 100k",
    lowerIsBetter: true,
    format: (v) => `${v.toFixed(1)} / 100k`,
    score: (v) =>
      bandLowerBetter(v, [
        [2, 95],
        [4, 88],
        [8, 74],
        [12, 62],
        [18, 48],
        [25, 34],
        [35, 18],
        [50, 6],
      ]),
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
    score: wgiScore,
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
    score: wgiScore,
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
    score: wgiScore,
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
    score: wgiScore,
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
    score: wgiScore,
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
    score: wgiScore,
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
        const data = (await fetchJson(url, 14000)) as [unknown, WBBatchRow[] | null]
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
    terrorism_deaths: [
      async () => {
        const h = await owidLatest("terrorism-deaths", iso3)
        // The GTD only lists countries with recorded incidents — absence
        // genuinely means zero recorded deaths, not missing data.
        return h ?? { value: 0, year: null }
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
        const data = (await fetchJson(url, 12000)) as SDGIndicatorData
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
      12000
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
    return { crimeIndex, safetyIndex, scope: "city" }
  } catch {
    return null
  }
}

async function fetchNumbeoCountry(iso2: string): Promise<NumbeoHit | null> {
  try {
    const html = await fetchText(
      "https://r.jina.ai/http://www.numbeo.com/crime/rankings_by_country.jsp",
      12000
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

/** City first, then country — the "expand outward until data exists" ladder. */
async function fetchNumbeo(iso2: string, city: string): Promise<NumbeoHit | null> {
  const cityish = city && normalizeCountryName(city) !== normalizeCountryName(englishCountryName(iso2) ?? "")
  if (cityish) {
    const hit = await fetchNumbeoCity(city)
    if (hit) return hit
  }
  return fetchNumbeoCountry(iso2)
}

async function fetchCrimeExtras(iso2: string, city: string): Promise<SafetySignal[]> {
  const [areaCode, numbeo] = await Promise.all([
    fetchSdgAreaCode(iso2),
    fetchNumbeo(iso2, city),
  ])

  const signals: SafetySignal[] = []

  if (numbeo) {
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
      score: Math.round(clamp(100 - numbeo.crimeIndex)),
      lowerIsBetter: true,
      note: `${scopeNote} Higher index = more perceived crime.`,
    })
    signals.push({
      key: "numbeo_safety_index",
      label: "Safety index (crowdsourced)",
      group: "Violent crime",
      source: "Numbeo Crime Index",
      value: numbeo.safetyIndex,
      display: `${numbeo.safetyIndex.toFixed(1)} / 100${scopeSuffix}`,
      year: null,
      score: Math.round(clamp(numbeo.safetyIndex)),
      lowerIsBetter: false,
      note: `${scopeNote} Higher = people report feeling safer.`,
    })
  }

  if (areaCode == null) return signals

  const sdgDefs: Array<{
    indicator: string
    key: string
    label: string
    lowerIsBetter: boolean
    seriesMatch?: RegExp
    score: (v: number) => number
    note: string
    display: (v: number) => string
  }> = [
    {
      indicator: "16.1.4",
      key: "safe_walking_dark",
      label: "Feel safe walking alone after dark",
      lowerIsBetter: false,
      score: (v) =>
        bandHigherBetter(v, [
          [20, 15],
          [35, 30],
          [50, 50],
          [65, 67],
          [80, 84],
          [95, 97],
        ]),
      note: "Share of people who report feeling safe walking alone at night in their area (SDG 16.1.4).",
      display: (v) => `${v.toFixed(1)}%`,
    },
    {
      indicator: "16.1.3",
      key: "violence_victimization",
      label: "Physical assault (past year)",
      lowerIsBetter: true,
      seriesMatch: /physical violence/i,
      score: (v) =>
        bandLowerBetter(v, [
          [1, 97],
          [3, 90],
          [7, 76],
          [12, 60],
          [20, 40],
          [35, 18],
          [50, 5],
        ]),
      note: "Share of people subjected to physical violence (assault) in the previous 12 months — UNODC-backed survey data (SDG 16.1.3).",
      display: (v) => `${v.toFixed(1)}%`,
    },
    {
      indicator: "16.1.3",
      key: "sexual_violence",
      label: "Sexual violence (past year)",
      lowerIsBetter: true,
      seriesMatch: /sexual violence/i,
      score: (v) =>
        bandLowerBetter(v, [
          [0.5, 95],
          [1, 88],
          [2, 78],
          [4, 62],
          [7, 45],
          [12, 25],
          [20, 8],
        ]),
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
      score: (v) =>
        bandLowerBetter(v, [
          [0, 98],
          [0.5, 88],
          [1, 78],
          [2, 60],
          [4, 38],
          [8, 18],
          [15, 5],
        ]),
      note: "Detected victims of human trafficking per 100,000 population (SDG 16.2.2) — the metric behind the UNODC Global Report on Trafficking in Persons.",
      display: (v) => `${v.toFixed(2)} / 100k`,
    },
    {
      indicator: "16.5.1",
      key: "bribery_contact_rate",
      label: "Bribery during public-official contact",
      lowerIsBetter: true,
      score: (v) =>
        bandLowerBetter(v, [
          [1, 97],
          [5, 88],
          [10, 76],
          [20, 58],
          [30, 41],
          [45, 20],
          [60, 6],
        ]),
      note: "People who had contact with a public official and were asked for/paid a bribe in the last 12 months (SDG 16.5.1).",
      display: (v) => `${v.toFixed(1)}%`,
    },
  ]

  const sdgHits = await Promise.all(
    sdgDefs.map((d) => fetchSdgLatest(areaCode, d.indicator, d.seriesMatch))
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
      score: hit ? Math.round(d.score(hit.value)) : null,
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

  const [defResults, comparisons, environment, crimeExtras] = await Promise.all([
    Promise.all(defPromises),
    fetchComparisons(iso2),
    getEnvironment(geo),
    fetchCrimeExtras(iso2, geo.city),
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
      score: res ? Math.round(d.score(res.value)) : null,
      lowerIsBetter: d.lowerIsBetter,
      note: d.note,
    })
  })

  signals.push(...crimeExtras)

  // Air quality + CDC health + hospitals + weather (direct from source)
  signals.push(...environment.signals)

  return { signals, comparisons, health: environment.health }
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
