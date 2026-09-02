import type { SafetyLevel, SafetySignal } from "./types"

// ─────────────────────────────────────────────────────────────────────
// The scoring engine. Single source of truth for how raw indicators become
// the 0–100 headline number.
//
// Design, and why it is not a weighted average:
//
// A weighted mean over ~22 indicators is *compensatory* — a benign indicator
// cancels a severe one. That is wrong for travel risk. Kabul has clean-ish
// air, no active GDACS alert and (on paper) a 4/100k homicide rate, because
// war deaths are not counted as homicides. Averaging those against a Level 4
// "Do Not Travel" produced 42/100 — the same band as Mexico City. Everything
// collapsed toward the middle: 55 real reports spanned 42–90, mean 67.
//
// Three structural fixes:
//
//  1. PILLARS. Indicators are grouped by the hazard they measure. *Within* a
//     pillar we average — several noisy reads of one underlying construct,
//     so averaging cancels noise, which is what averaging is good at.
//
//  2. POWER MEAN ACROSS PILLARS. Distinct hazards compound rather than
//     offset, so pillars combine on the *risk* scale (r = 1 − s/100) through
//     a generalised mean with exponent p > 1. High risk in any one pillar
//     dominates; clean air cannot buy off a war. p = 1 would restore the old
//     arithmetic mean; p → ∞ would be a pure worst-case. p = 3 sits close to
//     worst-case while still letting the other pillars matter.
//
//  3. NON-COMPENSATORY CAPS. Some facts are categorical, not quantitative.
//     "Do not travel" is a statement no amount of good data outweighs, so it
//     sets a ceiling on the score instead of contributing a term to it.
//
// Then a calibration curve spreads the result across the usable range, and
// the level bands are cut to match that spread.
// ─────────────────────────────────────────────────────────────────────

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/**
 * Piecewise-linear map from a raw value to a 0–100 safety score, clamped at
 * both ends. Points ascend by raw value; the score column may run either
 * direction, so this serves "lower is better" and "higher is better" alike.
 */
export function band(value: number, points: [number, number][]): number {
  if (!Number.isFinite(value)) return NaN
  if (value <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (value >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    if (value <= x2) return clamp(y1 + ((value - x1) / (x2 - x1)) * (y2 - y1))
  }
  return last[1]
}

/**
 * Numbeo's "worries" and "problems" rows: 0–100 where higher is worse. The
 * curve is deliberately not a straight `100 - v`. These are perception
 * questions with self-selected samples, so the extremes are softer than they
 * look — a city at 90 is genuinely troubled, but a city at 5 has mostly told
 * us its respondents are relaxed, not that it is measurably flawless.
 */
function invertedConcern(v: number): number {
  return band(v, [
    [5, 96],
    [15, 90],
    [25, 80],
    [35, 70],
    [45, 59],
    [55, 48],
    [65, 36],
    [75, 24],
    [85, 13],
    [100, 3],
  ])
}

// ─── Per-signal bands ────────────────────────────────────────────────
//
// Every band reaches a true 0 and a true 100 where the underlying reality
// warrants it. The old curves floored around 3–8 and capped around 95–97,
// which alone removed ~12 points from each end of the scale.
//
// Keyed by signal, so the same curves are used when a signal is first
// fetched and when a cached report is re-scored (see rescoreSignals).

export const SIGNAL_BANDS: Record<string, (v: number) => number> = {
  // Intentional homicides per 100k. The single best-measured violence signal.
  // Western Europe sits near 1, the US near 6, Brazil/Mexico 20–30, the worst
  // Latin American and Caribbean states 40–60+.
  homicide: (v) =>
    band(v, [
      [0.3, 100],
      [1, 94],
      [2, 86],
      [3, 78],
      [5, 66],
      [8, 52],
      [12, 40],
      [20, 26],
      [30, 15],
      [45, 6],
      [70, 0],
    ]),

  // Terrorism deaths per million residents — per-capita, so 4,337 deaths in
  // Afghanistan (~125/M) is not scored like 4,337 deaths would be in India
  // (~3/M). Scoring the absolute count, as this used to, made large countries
  // look like war zones and small war zones look calm.
  terrorism_deaths_pm: (v) =>
    band(v, [
      [0, 100],
      [0.05, 94],
      [0.3, 85],
      [1, 72],
      [3, 58],
      [10, 40],
      [30, 22],
      [80, 8],
      [200, 0],
    ]),

  // Road-traffic deaths per 100k (WHO). Statistically the likeliest way a
  // healthy traveller dies abroad, so it earns a real band, not a footnote.
  road_deaths: (v) =>
    band(v, [
      [1.5, 100],
      [3, 92],
      [5, 84],
      [8, 72],
      [12, 60],
      [18, 46],
      [25, 32],
      [32, 20],
      [45, 6],
      [60, 0],
    ]),

  // Share of firms reporting theft/vandalism losses (Enterprise Surveys).
  firm_crime_losses: (v) =>
    band(v, [
      [0.5, 100],
      [3, 88],
      [8, 72],
      [15, 55],
      [25, 36],
      [40, 16],
      [60, 0],
    ]),

  // Share of firms naming crime as their single biggest obstacle.
  crime_major_constraint: (v) =>
    band(v, [
      [0.5, 100],
      [4, 87],
      [10, 74],
      [18, 58],
      [30, 40],
      [45, 20],
      [65, 0],
    ]),

  // SDG 16.1.4 — feel safe walking alone after dark (higher is better).
  safe_walking_dark: (v) =>
    band(v, [
      [15, 0],
      [30, 20],
      [45, 42],
      [60, 60],
      [72, 74],
      [85, 90],
      [95, 100],
    ]),

  // SDG 16.1.3 — physical assault in the past 12 months.
  violence_victimization: (v) =>
    band(v, [
      [0.3, 100],
      [1, 94],
      [3, 84],
      [7, 68],
      [12, 52],
      [20, 32],
      [35, 12],
      [50, 0],
    ]),

  // SDG 16.1.3 — sexual violence in the past 12 months.
  sexual_violence: (v) =>
    band(v, [
      [0.2, 100],
      [0.7, 92],
      [1.5, 82],
      [3, 68],
      [5, 54],
      [8, 38],
      [14, 18],
      [22, 0],
    ]),

  // SDG 16.2.2 — detected trafficking victims per 100k. Detection-biased
  // (good policing raises it), so the curve is deliberately shallow.
  human_trafficking_victims: (v) =>
    band(v, [
      [0, 92],
      [0.5, 85],
      [1, 78],
      [2, 66],
      [4, 50],
      [8, 32],
      [15, 14],
    ]),

  // SDG 16.5.1 — asked for or paid a bribe when dealing with an official.
  bribery_contact_rate: (v) =>
    band(v, [
      [0.5, 100],
      [4, 90],
      [10, 76],
      [20, 58],
      [30, 41],
      [45, 20],
      [65, 0],
    ]),

  // NOTE: urban scale (population) is deliberately kept on a SHORT leash. A
  // full-weight run pulled every city toward the middle — population says
  // "2 million people" identically for a safe metro and a dangerous one, so
  // it dragged Brazzaville up 13 points and Algiers up 12 on no evidence
  // about either. It still earns a small weight (0.05) in the crime pillar,
  // because it is the only city-level input that exists for nearly every
  // place we publish (Numbeo covers ~7%, and the long tail would otherwise
  // inherit its country's score outright) — enough to separate a big metro
  // from a hill town without deciding a big metro is dangerous.
  // It is still gathered and shown as context in the signal list.

  // ── City-level survey signals ──────────────────────────────────────
  // Everything else scored here is a national statistic, so these are the only
  // inputs that can separate two cities in one country. Munich and Berlin
  // score 16.9 and 48.2 on Numbeo's crime index while the published index put
  // them one point apart, because these were not being read.
  //
  // "Safety walking alone" is already 0–100 with higher = safer, which is our
  // scale exactly, so it maps close to one-to-one — only gently compressed at
  // the top, because a crowdsourced 95 is not the same evidence as a measured
  // homicide rate of 0.3.
  // Calibrated against Numbeo's own labels rather than mapped one-to-one.
  // Numbeo calls 72 "High" and 88 "Very High" — a city where people are
  // comfortable walking alone at night is a safe city, and scoring 72 as 72
  // would drag it below what its homicide rate alone already earns. Mapped
  // naively, every city on the site lost 7-24 points purely because
  // perception numbers sit lower than statistic-derived ones.
  //   Numbeo band:  Very Low <20 · Low 20-40 · Moderate 40-60 · High 60-80 · Very High 80+
  numbeo_safety_night: (v) =>
    band(v, [
      [10, 12],
      [25, 32],
      [40, 52],
      [55, 70],
      [70, 85],
      [85, 94],
      [100, 99],
    ]),
  numbeo_safety_day: (v) =>
    band(v, [
      [20, 20],
      [40, 45],
      [55, 62],
      [70, 78],
      [85, 91],
      [100, 99],
    ]),

  // Worry/problem rows run the other way: 0–100 where higher = worse.
  numbeo_worry_mugged: (v) => invertedConcern(v),
  numbeo_violent_crime: (v) => invertedConcern(v),
  numbeo_property_crime: (v) => invertedConcern(v),
  numbeo_drugs: (v) => invertedConcern(v),

  // Numbeo's crowdsourced crime index (0–100, higher = more crime). Sample
  // sizes are thin and self-selected, so it is compressed toward the middle
  // rather than mapped one-to-one as it was before.
  numbeo_crime_index: (v) =>
    band(v, [
      [10, 96],
      [20, 88],
      [30, 78],
      [40, 66],
      [50, 54],
      [60, 42],
      [70, 28],
      [80, 14],
      [90, 4],
    ]),

  // ── City Differentiation Signals ──
  // Urban scale factor based on city population. Larger metropolitan areas carry higher
  // petty crime, transit risk, and theft density compared to small towns.
  city_population_scale: (v) =>
    band(v, [
      [20000, 92],
      [100000, 86],
      [500000, 78],
      [1500000, 70],
      [5000000, 60],
      [12000000, 50],
    ]),

  // Qualitative street-crime ratings (1=Severe, 2=High, 3=Moderate, 4=Low).
  // Robbery and pickpocketing are NOT the same kind of risk: armed robbery
  // threatens a person, pickpocketing threatens a wallet. Scoring them on one
  // shared scale made "High pickpocket risk" worth the same as "High robbery
  // risk" and pushed Barcelona and Rome — cities with very little violent
  // crime — below Yerevan. So the two keep their own curves, and these are
  // the single source of truth for both the crime pillar (here) and the
  // traveller-sentiment section (lib/safety-display.ts imports them).
  research_robbery_risk: (v) => band(v, RESEARCH_ROBBERY),
  research_pickpocket_risk: (v) => band(v, RESEARCH_PICKPOCKET),

  // Visitor sentiment score (0–100, higher = safer)
  research_sentiment_score: (v) => clamp(v),
}

/** Robbery / mugging — a threat to the traveller's person. */
export const RESEARCH_ROBBERY: [number, number][] = [
  [1, 12],
  [2, 34],
  [3, 62],
  [4, 92],
]

/** Pickpocketing / bag-snatching — costly and common, rarely dangerous. */
export const RESEARCH_PICKPOCKET: [number, number][] = [
  [1, 40],
  [2, 58],
  [3, 78],
  [4, 96],
]

// WGI percentile ranks are already 0–100 with higher = better, so they map
// straight through. All six behave identically.
const WGI_KEYS = [
  "stability",
  "rule_of_law",
  "corruption",
  "gov_effectiveness",
  "regulatory",
  "voice",
] as const
for (const k of WGI_KEYS) SIGNAL_BANDS[k] = (v) => clamp(v)

/**
 * Official government advisory level → score. The level fed in here is the
 * AVERAGE across issuing governments (see advisorySignal in lib/data/safety),
 * so it can be fractional — the curve reads averages directly:
 *
 *   all at level 1          → 100
 *   average under 2         → 75
 *   average under 3         → 50
 *   average under 4         → 25
 *   both at level 4         → 0
 *
 * The average also drives the hard cap (see hardCaps), so score and ceiling
 * read the same number. An ungraded advisory returns NaN (no data) instead of
 * the old 60, which quietly voted "average" for every place we could not
 * grade.
 */
export const advisoryScore = (level: number): number => {
  if (!Number.isFinite(level) || level <= 0) return NaN
  if (level <= 1) return 100
  if (level < 2) return 75
  if (level < 3) return 50
  if (level < 4) return 25
  return 0
}

SIGNAL_BANDS.advisory = advisoryScore

/**
 * Recompute a signal's score from its raw value using the current bands.
 *
 * This is what lets a cached report pick up a scoring change without
 * re-fetching a single database: the raw values are cached, so the score is
 * derived, never trusted. Signals whose score is not a function of one scalar
 * (weather, hospitals, health notices, natural hazards — each folds several
 * inputs into its score at fetch time) keep the score they were built with.
 */
export function rescoreSignals(signals: SafetySignal[]): SafetySignal[] {
  return signals.map((s) => {
    const fn = SIGNAL_BANDS[s.key]
    if (!fn || s.value == null) return s
    const score = fn(s.value)
    if (!Number.isFinite(score)) return { ...s, score: null }
    return { ...s, score: Math.round(score) }
  })
}

// ─── Pillars ─────────────────────────────────────────────────────────
//
// Weights are within-pillar. The pillar's own weight is what it carries into
// the cross-pillar power mean.

export type PillarKey =
  | "crime"
  | "conflict"
  | "advisory"
  | "institutions"
  | "hazards"
  | "health"

export interface PillarDef {
  key: PillarKey
  label: string
  /** Weight in the cross-pillar power mean. */
  weight: number
  /** Signal key → weight within this pillar. */
  signals: Record<string, number>
  /**
   * Pillars a traveller is directly exposed to. When one of these has no data
   * at all we impute rather than drop it, so missing crime statistics cannot
   * flatter a place. Ambient pillars are simply skipped when absent.
   */
  core?: boolean
}

export const PILLARS: PillarDef[] = [
  {
    // Crime & Street Safety is where a city genuinely differs from its country.
    // City-specific evidence (AI research findings, Numbeo surveys, urban scale)
    // carries 75% of this pillar, ensuring cities in the same nation produce
    // distinct, accurate safety indexes.
    key: "crime",
    label: "Crime",
    weight: 0.45,
    core: true,
    signals: {
      // ── city-level signals & AI research (0.75) ──
      research_sentiment_score: 0.22,
      research_robbery_risk: 0.18,
      research_pickpocket_risk: 0.15,
      numbeo_safety_night: 0.10,
      numbeo_crime_index: 0.08,
      city_population_scale: 0.05,
      numbeo_violent_crime: 0.04,
      numbeo_worry_mugged: 0.04,
      numbeo_property_crime: 0.02,
      // ── national statistics baseline (0.25) ──
      homicide: 0.12,
      safe_walking_dark: 0.05,
      violence_victimization: 0.03,
      sexual_violence: 0.02,
      bribery_contact_rate: 0.02,
      human_trafficking_victims: 0.01,
    },
  },
  {
    key: "conflict",
    label: "Conflict & terrorism",
    weight: 0.15,
    core: true,
    signals: {
      stability: 0.62,
      terrorism_deaths_pm: 0.38,
    },
  },
  {
    key: "advisory",
    label: "Official guidance",
    weight: 0.15,
    core: true,
    signals: { advisory: 1 },
  },
  {
    key: "institutions",
    label: "Institutions & rule of law",
    weight: 0.15,
    core: true,
    signals: {
      rule_of_law: 0.34,
      corruption: 0.24,
      gov_effectiveness: 0.22,
      voice: 0.12,
      regulatory: 0.08,
    },
  },
  {
    key: "hazards",
    label: "Everyday hazards",
    weight: 0.06,
    signals: {
      road_deaths: 0.6,
      natural_hazards: 0.25,
      weather: 0.15,
    },
  },
  {
    key: "health",
    label: "Health & environment",
    weight: 0.04,
    signals: {
      health: 0.42,
      hospitals: 0.3,
      air_quality: 0.28,
    },
  },
]

/** Severity emphasis in the cross-pillar mean. 1 = arithmetic, ∞ = worst-case. */
const RISK_EXPONENT = 3

// ─── Non-compensatory caps ───────────────────────────────────────────
//
// A ceiling, not a term. These encode facts that no combination of good
// indicators should be able to argue away.

interface Cap {
  /** Highest index the report may reach while this condition holds. */
  max: number
  /** Shown in the UI so a capped score is never unexplained. */
  reason: string
}

function hardCaps(byKey: Map<string, SafetySignal>): Cap[] {
  const caps: Cap[] = []
  const val = (k: string) => {
    const v = byKey.get(k)?.value
    return typeof v === "number" && Number.isFinite(v) ? v : null
  }

  const adv = val("advisory")
  if (adv != null) {
    // The cap and the advisory's own score must read the same number (see
    // advisoryScore). A pair of "Do Not Travel" ratings caps at 20 — the
    // pillar scores 0, but ambient hazards like a bad health system or poor
    // roads are still allowed to tell on the verdict a little. An average at
    // level 3 ("reconsider travel") caps at 44.
    if (adv >= 4) caps.push({ max: 20, reason: 'Level 4 advisory — "Do Not Travel"' })
    else if (adv >= 3) caps.push({ max: 44, reason: "Level 3 advisory — reconsider travel" })
  }

  // Extreme homicide rates (50+/100k) represent extreme threat environments.
  // Moderate national homicide rates (20-40) are already scored in SIGNAL_BANDS
  // and fed into the power mean, allowing city-level evidence to differentiate cities.
  const hom = val("homicide")
  if (hom != null && hom >= 50) {
    caps.push({ max: 28, reason: `Extreme homicide rate ${hom.toFixed(0)}/100k` })
  }

  // WGI political stability in the bottom decile means active or near-active
  // armed conflict. Recorded homicide is unreliable in exactly these places
  // (war deaths are classified separately), so the cap does the work.
  const stab = val("stability")
  if (stab != null) {
    if (stab <= 4) caps.push({ max: 22, reason: "Bottom-5% political stability (active conflict)" })
    else if (stab <= 12) caps.push({ max: 40, reason: "Bottom-12% political stability" })
  }

  // Terrorism at this per-capita intensity is a sustained campaign.
  const terror = val("terrorism_deaths_pm")
  if (terror != null && terror >= 25) {
    caps.push({ max: 32, reason: `Terrorism deaths ${terror.toFixed(0)}/million` })
  }

  return caps
}

// ─── Calibration ─────────────────────────────────────────────────────
//
// The power mean is correct about ordering but lands in a narrow band,
// because a place has to be bad in most pillars at once to push the mean to
// an extreme. This curve stretches that band across the usable range, so the
// published number reads the way people expect a 0–100 score to read.
//
// Monotone, so it never reorders two places — it only spaces them out.
const CALIBRATION: [number, number][] = [
  [0, 0],
  [15, 6],
  [25, 14],
  [35, 26],
  [45, 40],
  [55, 55],
  [65, 70],
  [72, 79],
  [80, 87],
  [88, 94],
  [95, 99],
  [100, 100],
]

// ─── Level bands ─────────────────────────────────────────────────────

/**
 * Level band for a 0–100 safety index. Cut against the real spread of the
 * scores rather than round numbers: under the old aggregation these
 * thresholds put 34 of 55 destinations — Cairo and Delhi included — in
 * "generally safe", and put nothing at all in HIGH_RISK, not even Kabul.
 */
export function levelFromIndex(index: number): SafetyLevel {
  if (index >= 85) return "VERY_SAFE"
  if (index >= 68) return "SAFE"
  if (index >= 48) return "MODERATE"
  if (index >= 28) return "CAUTION"
  return "HIGH_RISK"
}

/**
 * "Safer than X% of countries." Derived from the index through a reference
 * CDF of the world's countries rather than from the governance percentiles,
 * which used to be averaged separately and so could disagree with the
 * headline score (Afghanistan read "safer than 23%" beside a 42/100).
 */
const REFERENCE_CDF: [number, number][] = [
  [5, 1],
  [15, 4],
  [25, 10],
  [35, 20],
  [45, 33],
  [55, 48],
  [62, 60],
  [70, 72],
  [78, 84],
  [86, 93],
  [93, 98],
  [100, 100],
]

export function saferThanPct(index: number): number {
  return Math.round(clamp(band(index, REFERENCE_CDF)))
}

// ─── The composite ───────────────────────────────────────────────────

export interface PillarScore {
  key: PillarKey
  label: string
  /** 0–100, 100 = safest. null when the pillar resolved no data. */
  score: number | null
  /** Share of the pillar's within-pillar weight that resolved. */
  coverage: number
  /** True when the score is a prior rather than measured data. */
  imputed: boolean
}

export interface IndexResult {
  index: number
  level: SafetyLevel
  saferThanPct: number
  pillars: PillarScore[]
  /** Share of total pillar weight backed by real data, 0–1. */
  confidence: number
  /** Caps that bound the score, worst first. Empty when none applied. */
  caps: { max: number; reason: string }[]
  /** The index before caps and calibration — useful for debugging. */
  raw: number
}

/**
 * Score a set of signals. Pure function of the signals' raw values, so a
 * cached report re-scores correctly without touching a database.
 */
export function computeSafetyIndex(input: SafetySignal[]): IndexResult {
  const signals = rescoreSignals(input)
  const byKey = new Map(signals.map((s) => [s.key, s]))

  // ── Within-pillar averages ──
  const pillars: PillarScore[] = PILLARS.map((p) => {
    let sum = 0
    let wsum = 0
    let wtotal = 0
    for (const [key, w] of Object.entries(p.signals)) {
      wtotal += w
      const score = byKey.get(key)?.score
      if (score == null || !Number.isFinite(score)) continue
      sum += score * w
      wsum += w
    }
    return {
      key: p.key,
      label: p.label,
      score: wsum === 0 ? null : sum / wsum,
      coverage: wtotal === 0 ? 0 : wsum / wtotal,
      imputed: false,
    }
  })

  const at = (k: PillarKey) => pillars.find((p) => p.key === k)!

  // ── Reporting-reliability discount on the crime pillar ──
  //
  // Recorded-crime statistics are only as good as the institutions producing
  // them. Egypt reports 1.2 homicides per 100k and Switzerland reports 0.5;
  // those numbers are not comparable, because one is produced by a system
  // that ranks in the 40th percentile for rule of law and the other by one in
  // the 87th. Untreated, this made Cairo's crime pillar (78) statistically
  // indistinguishable from Paris's (80).
  //
  // So where institutions are weak, flattering crime figures are shrunk
  // toward what the institutional read supports. Deliberately one-directional:
  // it never *raises* a crime score, because a country with strong
  // institutions honestly reporting high crime should keep its high crime.
  const crime = at("crime")
  const inst = at("institutions")
  if (crime.score != null && inst.score != null && crime.score > inst.score) {
    const shrink = ((100 - inst.score) / 100) * 0.45
    crime.score = crime.score - (crime.score - inst.score) * shrink
  }

  // ── Impute missing core pillars ──
  //
  // Dropping a missing pillar and renormalising the rest is the same as
  // assuming it matches the pillars we do have — which reliably flattered
  // closed and unsurveyed countries, the exact places least likely to report
  // crime statistics. Instead, fall back to a conservative prior built from
  // the pillars that did resolve.
  const measured = pillars.filter((p) => p.score != null)
  const institutions = at("institutions")
  const conflict = at("conflict")

  for (const p of pillars) {
    const def = PILLARS.find((d) => d.key === p.key)!
    if (!def.core || p.score != null || measured.length === 0) continue

    // Governance quality is the best available predictor of unmeasured
    // street-level risk; lean on it, then shade down for the uncertainty.
    const basis =
      institutions.score ??
      conflict.score ??
      measured.reduce((a, b) => a + (b.score ?? 0), 0) / measured.length
    p.score = clamp(basis * 0.85)
    p.imputed = true
  }

  // ── Cross-pillar power mean, on the risk scale ──
  const parts = pillars
    .filter((p) => p.score != null)
    .map((p) => ({
      risk: clamp(100 - (p.score as number)) / 100,
      weight: PILLARS.find((d) => d.key === p.key)!.weight,
    }))

  if (parts.length === 0) {
    // Nothing resolved at all. Refuse to invent a number near the middle;
    // report the floor of "we don't know" and let confidence say why.
    return {
      index: 50,
      level: levelFromIndex(50),
      saferThanPct: saferThanPct(50),
      pillars,
      confidence: 0,
      caps: [],
      raw: 50,
    }
  }

  let num = 0
  let den = 0
  for (const { risk, weight } of parts) {
    num += weight * Math.pow(risk, RISK_EXPONENT)
    den += weight
  }
  const risk = Math.pow(num / den, 1 / RISK_EXPONENT)
  const raw = clamp(100 * (1 - risk))

  // ── Calibrate, then apply the caps ──
  let index = band(raw, CALIBRATION)
  const caps = hardCaps(byKey).sort((a, b) => a.max - b.max)
  for (const c of caps) index = Math.min(index, c.max)

  const rounded = Math.round(clamp(index))

  // Confidence: how much of the pillar weight is real data, not a prior.
  const totalWeight = PILLARS.reduce((a, p) => a + p.weight, 0)
  const backed = pillars
    .filter((p) => p.score != null && !p.imputed)
    .reduce((a, p) => a + PILLARS.find((d) => d.key === p.key)!.weight * p.coverage, 0)

  return {
    index: rounded,
    level: levelFromIndex(rounded),
    saferThanPct: saferThanPct(rounded),
    pillars: pillars.map((p) => ({
      ...p,
      score: p.score == null ? null : Math.round(p.score),
    })),
    confidence: Math.round((backed / totalWeight) * 100) / 100,
    caps,
    raw: Math.round(raw),
  }
}

/**
 * Attach qualitative AI research findings (robbery risk, pickpocket risk, consumer sentiment)
 * to the raw signals array so that city-specific research directly differentiates city scores.
 */
export function attachResearchSignals(
  signals: SafetySignal[],
  intel: { robbery?: { level: string; note?: string }; pickpocket?: { level: string; note?: string }; consumerSentiment?: { score: number; label?: string; summary?: string } } | null
): SafetySignal[] {
  if (!intel) return signals
  const remove = new Set([
    "research_robbery_risk",
    "research_pickpocket_risk",
    "research_sentiment_score",
  ])
  const filtered = signals.filter((s) => !remove.has(s.key))

  const levelVal = (lvl?: string): number | null => {
    switch (lvl) {
      case "Low": return 4
      case "Moderate": return 3
      case "High": return 2
      case "Severe": return 1
      default: return null
    }
  }

  if (intel.robbery?.level) {
    const v = levelVal(intel.robbery.level)
    if (v != null) {
      filtered.push({
        key: "research_robbery_risk",
        label: "Mugging & robbery risk",
        group: "Violent crime",
        source: "City Web Research",
        value: v,
        display: `${intel.robbery.level} risk`,
        year: null,
        score: Math.round(band(v, RESEARCH_ROBBERY)),
        lowerIsBetter: true,
        note: intel.robbery.note || "Mugging and armed robbery risk to visitors based on city news and web research.",
      })
    }
  }

  if (intel.pickpocket?.level) {
    const v = levelVal(intel.pickpocket.level)
    if (v != null) {
      filtered.push({
        key: "research_pickpocket_risk",
        label: "Pickpocketing & theft risk",
        group: "Violent crime",
        source: "City Web Research",
        value: v,
        display: `${intel.pickpocket.level} risk`,
        year: null,
        score: Math.round(band(v, RESEARCH_PICKPOCKET)),
        lowerIsBetter: true,
        note: intel.pickpocket.note || "Pickpocketing and bag-snatching risk to visitors based on city news and web research.",
      })
    }
  }

  if (intel.consumerSentiment?.score != null) {
    const score = Math.max(0, Math.min(100, Math.round(intel.consumerSentiment.score)))
    filtered.push({
      key: "research_sentiment_score",
      label: "Visitor safety sentiment",
      group: "Violent crime",
      source: "City Web Research",
      value: score,
      display: `${score} / 100 (${intel.consumerSentiment.label || "Sentiment"})`,
      year: null,
      score,
      lowerIsBetter: false,
      note: intel.consumerSentiment.summary || "How safe visitors report feeling day-to-day, derived from recent traveler research.",
    })
  }

  return filtered
}
