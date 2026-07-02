import type {
  SafetySignal,
  SignalGroup,
  Comparison,
  GeoPoint,
  HealthNotice,
} from "../types"
import { fetchJson } from "./geo"
import { englishCountryName } from "./country"
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
    key: "road",
    label: "Road traffic deaths",
    group: "Everyday hazards",
    source: WB_WDI,
    wb: { indicator: "SH.STA.TRAF.P5" },
    unit: "per 100k",
    lowerIsBetter: true,
    format: (v) => `${v.toFixed(1)} / 100k`,
    score: (v) =>
      bandLowerBetter(v, [
        [2, 96],
        [5, 86],
        [10, 66],
        [18, 42],
        [27, 20],
        [40, 6],
      ]),
    note: "Road traffic fatalities per 100,000 — the most common cause of injury death for visitors.",
  },
  {
    key: "battle",
    label: "Armed-conflict deaths",
    group: "Conflict & terrorism",
    source: WB_WDI,
    wb: { indicator: "VC.BTL.DETH" },
    unit: "deaths/yr",
    lowerIsBetter: true,
    format: (v) => (v < 1 ? "None reported" : `${Math.round(v).toLocaleString()}/yr`),
    score: (v) =>
      bandLowerBetter(v, [
        [0, 100],
        [1, 70],
        [25, 45],
        [100, 25],
        [1000, 8],
        [5000, 1],
      ]),
    note: "Battle-related deaths per year — direct indicator of active armed conflict.",
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

/** Recent significant earthquakes near the city (USGS, last 90 days, M4.5+). */
async function fetchEarthquakes(
  lat: number,
  lon: number
): Promise<{ count: number; maxMag: number } | null> {
  try {
    const url =
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
      `&latitude=${lat}&longitude=${lon}&maxradiuskm=300&minmagnitude=4.5` +
      `&starttime=now-90days&limit=200`
    const data = (await fetchJson(url, 7000)) as {
      features?: Array<{ properties: { mag: number } }>
    }
    const feats = data.features ?? []
    const maxMag = feats.reduce((m, f) => Math.max(m, f.properties.mag ?? 0), 0)
    return { count: feats.length, maxMag }
  } catch {
    return null
  }
}

function quakeScore(count: number, maxMag: number): number {
  if (count === 0) return 100
  // More frequent and stronger quakes lower the score.
  const magPenalty = bandLowerBetter(maxMag, [
    [4.5, 20],
    [5.5, 35],
    [6.5, 55],
    [7.5, 75],
  ])
  const freqPenalty = Math.min(25, count * 2)
  return clamp(100 - magPenalty - freqPenalty)
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

  const [wbResults, quakes, comparisons, environment] = await Promise.all([
    Promise.all(wbPromises),
    fetchEarthquakes(geo.lat, geo.lon),
    fetchComparisons(iso2),
    getEnvironment(geo),
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

  // Seismic hazard
  signals.push({
    key: "seismic",
    label: "Recent earthquakes",
    group: "Everyday hazards",
    source: "USGS Earthquake Catalog",
    value: quakes?.count ?? null,
    display: quakes
      ? quakes.count === 0
        ? "None (90 days)"
        : `${quakes.count} quakes · max M${quakes.maxMag.toFixed(1)}`
      : "No data",
    year: null,
    score: quakes ? Math.round(quakeScore(quakes.count, quakes.maxMag)) : null,
    lowerIsBetter: true,
    note: "Magnitude 4.5+ earthquakes within 300 km in the last 90 days.",
  })

  // Air quality + CDC health notices (direct from source)
  signals.push(...environment.signals)

  return { signals, comparisons, health: environment.health }
}

const BENCHMARKS = "JP;CH;US;BR;ZA;WLD" // safe → risky + world

/** Comparison bars: target country vs benchmark countries + world average. */
async function fetchComparisons(iso2: string): Promise<Comparison[]> {
  const metrics: { indicator: string; metric: string; unit: string }[] = [
    { indicator: "VC.IHR.PSRC.P5", metric: "Homicide rate", unit: "per 100k" },
    { indicator: "SH.STA.TRAF.P5", metric: "Road traffic deaths", unit: "per 100k" },
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
