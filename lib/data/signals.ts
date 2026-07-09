import type {
  SafetySignal,
  SignalGroup,
  Comparison,
  GeoPoint,
  HealthNotice,
} from "../types"
import { fetchJson } from "./geo"
import { countryNameVariants, englishCountryName, normalizeCountryName } from "./country"
import { getEnvironment } from "./environment"

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
  wb?: { indicator: string; source?: number } // World Bank fetch
  unit: string
  lowerIsBetter: boolean
  format: (v: number) => string
  score: (v: number) => number
  note: string
}

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
}

interface SDGIndicatorData {
  data?: SDGDataPoint[]
}

/** Fetch most-recent non-null value for one World Bank indicator. */
async function fetchWB(
  iso2: string,
  indicator: string,
  source?: number
): Promise<{ value: number; year: string } | null> {
  try {
    const src = source ? `&source=${source}` : ""
    const url = `https://api.worldbank.org/v2/country/${iso2}/indicator/${indicator}?format=json&mrv=15${src}`
    const data = (await fetchJson(url, 7000)) as [unknown, WBRow[] | null]
    const rows = data[1]
    if (!Array.isArray(rows)) return null
    const hit = rows.find((r) => r.value != null)
    if (!hit || hit.value == null) return null
    return { value: hit.value, year: hit.date }
  } catch {
    return null
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

async function fetchSdgLatest(
  areaCode: number,
  indicator: string
): Promise<{ value: number; year: string | null } | null> {
  try {
    const url =
      `https://unstats.un.org/SDGAPI/v1/sdg/Indicator/Data` +
      `?indicator=${encodeURIComponent(indicator)}&areaCode=${areaCode}&pageSize=1000`
    const data = (await fetchJson(url, 9000)) as SDGIndicatorData
    const rows = data.data
    if (!Array.isArray(rows) || rows.length === 0) return null
    const clean = rows
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

async function fetchNumbeoCountry(
  iso2: string
): Promise<{ crimeIndex: number; safetyIndex: number } | null> {
  try {
    const html = await fetchText(
      "https://r.jina.ai/http://www.numbeo.com/crime/rankings_by_country.jsp",
      10000
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
      return { crimeIndex, safetyIndex }
    }
    return null
  } catch {
    return null
  }
}

async function fetchCrimeExtras(iso2: string): Promise<SafetySignal[]> {
  const [areaCode, numbeo] = await Promise.all([
    fetchSdgAreaCode(iso2),
    fetchNumbeoCountry(iso2),
  ])

  const signals: SafetySignal[] = []

  if (numbeo) {
    signals.push({
      key: "numbeo_crime_index",
      label: "Crime index (crowdsourced)",
      group: "Violent crime",
      source: "Numbeo Crime Index",
      value: numbeo.crimeIndex,
      display: `${numbeo.crimeIndex.toFixed(1)} / 100`,
      year: null,
      score: Math.round(clamp(100 - numbeo.crimeIndex)),
      lowerIsBetter: true,
      note: "Numbeo's country-level crowdsourced crime index. Higher index = more perceived crime.",
    })
    signals.push({
      key: "numbeo_safety_index",
      label: "Safety index (crowdsourced)",
      group: "Violent crime",
      source: "Numbeo Crime Index",
      value: numbeo.safetyIndex,
      display: `${numbeo.safetyIndex.toFixed(1)} / 100`,
      year: null,
      score: Math.round(clamp(numbeo.safetyIndex)),
      lowerIsBetter: false,
      note: "Numbeo's country-level crowdsourced safety sentiment (higher = residents/visitors feel safer).",
    })
  }

  if (areaCode == null) return signals

  const sdgDefs: Array<{
    indicator: string
    key: string
    label: string
    lowerIsBetter: boolean
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
      label: "People reporting recent violence",
      lowerIsBetter: true,
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
      note: "Population subjected to physical/psychological/sexual violence in the previous 12 months (SDG 16.1.3).",
      display: (v) => `${v.toFixed(1)}%`,
    },
    {
      indicator: "16.2.2",
      key: "human_trafficking_victims",
      label: "Detected human-trafficking victims",
      lowerIsBetter: true,
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
      note: "Detected victims of human trafficking per 100,000 population (SDG 16.2.2, UNODC-backed reporting).",
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
    sdgDefs.map((d) => fetchSdgLatest(areaCode, d.indicator))
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

  // Fire every World Bank indicator + quakes + comparisons + environment at once.
  const wbDefs = SIGNAL_DEFS.filter((d) => d.wb)
  const wbPromises = wbDefs.map((d) =>
    fetchWB(iso2, d.wb!.indicator, d.wb!.source)
  )

  const [wbResults, comparisons, environment, crimeExtras] = await Promise.all([
    Promise.all(wbPromises),
    fetchComparisons(iso2),
    getEnvironment(geo),
    fetchCrimeExtras(iso2),
  ])

  const signals: SafetySignal[] = []

  wbDefs.forEach((d, i) => {
    const res = wbResults[i]
    signals.push({
      key: d.key,
      label: d.label,
      group: d.group,
      source: d.source,
      value: res?.value ?? null,
      display: res ? d.format(res.value) : "No data",
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
