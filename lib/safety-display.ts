import type {
  SafetyLevel,
  SafetySignal,
  SafetyReport,
  SafetyEnrichment,
  RiskLevel,
  RiskRating,
} from "./types"
import {
  computeSafetyIndex,
  levelFromIndex,
  saferThanPct,
  RESEARCH_ROBBERY,
  RESEARCH_PICKPOCKET,
  type PillarKey,
} from "./scoring"

export { levelFromIndex }

export interface LevelConfig {
  label: string
  short: string
  color: string
  answer: string // the blunt "is it safe?" answer
}

export const LEVELS: Record<SafetyLevel, LevelConfig> = {
  VERY_SAFE: {
    label: "Very Safe",
    short: "Yes",
    color: "#1f9d5a",
    answer: "Yes — very safe",
  },
  SAFE: {
    label: "Safe",
    short: "Yes",
    color: "#3a9e6f",
    answer: "Yes — generally safe",
  },
  MODERATE: {
    label: "Moderate",
    short: "Mostly",
    color: "#c8973f",
    answer: "Mostly — take normal precautions",
  },
  CAUTION: {
    label: "Use Caution",
    short: "Caution",
    color: "#e0773b",
    answer: "Caution advised",
  },
  HIGH_RISK: {
    label: "High Risk",
    short: "No",
    color: "#d4503a",
    answer: "Elevated risk — reconsider",
  },
}

// ─── Final published score (databases + field research) ──────────────

// 0–100 equivalents for the analyst's qualitative street-crime ratings.
// These ARE the same curves the scoring engine uses for the crime pillar
// (RESEARCH_ROBBERY / RESEARCH_PICKPOCKET in scoring.ts) — one table, one
// truth. Robbery and pickpocketing keep separate scales because they are not
// the same kind of risk. Armed robbery is a threat to life; pickpocketing is
// a threat to a wallet. On a single shared scale, "High pickpocket risk"
// scored 38 — which is what pushed Barcelona and Rome, two cities with very
// little violent crime, below Yerevan and Skagway.

/** Value 1=Severe … 4=Low → risk level name. */
const LEVEL_VALUE: Record<RiskLevel, number> = {
  Low: 4,
  Moderate: 3,
  High: 2,
  Severe: 1,
}

const fromBands = (bands: [number, number][]) =>
  Object.fromEntries(
    (Object.keys(LEVEL_VALUE) as RiskLevel[]).map((l) => [
      l,
      bands.find(([v]) => v === LEVEL_VALUE[l])![1],
    ])
  ) as Record<RiskLevel, number>

/** Mugging / armed robbery — a risk to the traveller's person. */
const ROBBERY_SCORE: Record<RiskLevel, number> = fromBands(RESEARCH_ROBBERY)

/** Pickpocketing / bag-snatching — costly and common, but rarely dangerous. */
const PICKPOCKET_SCORE: Record<RiskLevel, number> = fromBands(RESEARCH_PICKPOCKET)

export interface FinalScore {
  index: number
  level: SafetyLevel
  /** true when the on-the-ground research contributed to the number */
  includesFieldResearch: boolean
  /** share of the database pillars backed by real data, 0–1 */
  confidence: number
  /** "safer than X% of countries", derived from this same index */
  saferThanPct: number
  /** non-compensatory ceilings that bound the score, worst first */
  caps: { max: number; reason: string }[]
  /** the database-only composite, before field research folded in */
  baseIndex: number
  /** the field-research score that carries the remaining 18%, if any */
  sentiment: SentimentScore
}

// ─── Traveller sentiment (the field-research score) ──────────────────

/** Share of the published score carried by live field research. */
export const FIELD_RESEARCH_WEIGHT = 0.18

const SENTIMENT_WEIGHTS = { robbery: 0.45, reported: 0.35, pickpocket: 0.2 }

export interface SentimentScore {
  /** 0–100 (100 = travellers report feeling safe); null when no research yet */
  score: number | null
  label: string // "Mostly positive"
  summary: string // 1–2 sentences, verbatim from the research
  /** true when travellers' own reported feel is part of the number */
  fromTravellers: boolean
  /** the components, for the tooltip and the JSON feed */
  parts: { label: string; score: number; weight: number; detail: string }[]
}

/**
 * The traveller-sentiment score: what people on the ground report, expressed
 * on the same 0–100 scale as the database pillars.
 *
 * It is exactly the term that carries the final 18% of the published score —
 * the tile is not a separate opinion sitting beside the headline, it is the
 * part of the headline the databases cannot see. Reported feel is the largest
 * single input, weighted alongside the two street-crime risks a visitor
 * actually meets.
 */
export function computeSentiment(intel: SafetyEnrichment | null): SentimentScore {
  const parts: SentimentScore["parts"] = []

  // Record lookup can miss at runtime if the model emits an off-schema level.
  const risk = (
    table: Record<RiskLevel, number>,
    weight: number,
    label: string,
    r?: RiskRating
  ) => {
    const v = r ? table[r.level] : undefined
    if (v != null) parts.push({ label, score: v, weight, detail: `${r!.level} risk` })
  }

  const reported = Number(intel?.consumerSentiment?.score)
  const fromTravellers = Number.isFinite(reported)
  if (fromTravellers) {
    parts.push({
      label: "Reported feel",
      score: Math.max(0, Math.min(100, reported)),
      weight: SENTIMENT_WEIGHTS.reported,
      detail: intel?.consumerSentiment?.label ?? "traveller reports",
    })
  }
  risk(ROBBERY_SCORE, SENTIMENT_WEIGHTS.robbery, "Robbery risk", intel?.robbery)
  risk(PICKPOCKET_SCORE, SENTIMENT_WEIGHTS.pickpocket, "Pickpocket risk", intel?.pickpocket)

  if (!parts.length) {
    return { score: null, label: "Researching…", summary: "", fromTravellers: false, parts }
  }

  const wsum = parts.reduce((a, p) => a + p.weight, 0)
  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / wsum)

  return {
    score,
    label: intel?.consumerSentiment?.label?.trim() || sentimentLabel(score),
    summary: intel?.consumerSentiment?.summary ?? "",
    fromTravellers,
    parts,
  }
}

/** Fallback wording when the research returned risk levels but no label. */
function sentimentLabel(score: number): string {
  if (score >= 80) return "Positive"
  if (score >= 62) return "Mostly positive"
  if (score >= 45) return "Mixed"
  if (score >= 30) return "Wary"
  return "Negative"
}

/**
 * The headline score shown in the hero.
 *
 * The database composite is recomputed here from the report's raw signal
 * values rather than read off `safety.index`. That makes the published number
 * a pure function of the stored inputs, so a change to the scoring engine
 * re-scores every cached report on its next render instead of leaving old
 * reports frozen at numbers the current engine would never produce.
 *
 * Field research then folds in at 18%: the analyst's street-crime ratings and
 * current traveller sentiment. It is capped the same way the composite is —
 * a "Do Not Travel" advisory is not something a positive sentiment read gets
 * to argue away.
 */
export function computeFinalScore(
  safety: SafetyReport,
  intel: SafetyEnrichment | null
): FinalScore {
  const base = computeSafetyIndex(safety.signals)
  const sentiment = computeSentiment(intel)

  if (sentiment.score == null) {
    return {
      index: base.index,
      level: base.level,
      includesFieldResearch: false,
      confidence: base.confidence,
      saferThanPct: base.saferThanPct,
      caps: base.caps,
      baseIndex: base.index,
      sentiment,
    }
  }

  const w = FIELD_RESEARCH_WEIGHT
  let index = Math.round((1 - w) * base.index + w * sentiment.score)
  for (const c of base.caps) index = Math.min(index, c.max)
  index = Math.max(0, Math.min(100, index))

  return {
    index,
    level: levelFromIndex(index),
    includesFieldResearch: true,
    confidence: base.confidence,
    saferThanPct: saferThanPct(index),
    caps: base.caps,
    baseIndex: base.index,
    sentiment,
  }
}

/** Color for a 0–100 signal score. */
export function scoreColor(score: number): string {
  if (score >= 75) return "#1f9d5a"
  if (score >= 55) return "#3a9e6f"
  if (score >= 40) return "#c8973f"
  if (score >= 25) return "#e0773b"
  return "#d4503a"
}

// ─── Category tiles ──────────────────────────────────────────────────
//
// Five scores sit under the headline, laid out as a pyramid: the two a
// traveller feels most directly (crime, and what people on the ground
// report) on the upper tier, the three contextual ones below.

export type CategoryKey =
  | "advisories"
  | "crime"
  | "sentiment"
  | "health"
  | "stability"

export interface CategoryScore {
  key: CategoryKey
  label: string
  /** One-word form for the pyramid tiles, which are narrow on a phone. */
  short: string
  score: number | null // 0–100 (100 = safest) or null when no data
  levelName: string // "Good" | "Fair" | "Caution" | "Elevated" | "No data"
  color: string
  note: string // short one-liner shown on the tile
  signalKeys: string[] // signal keys rendered in the detail section
  /** Report section this tile scrolls to. */
  section: string
  /** 1 = upper tier of the pyramid (felt directly), 2 = lower tier. */
  tier: 1 | 2
}

/** Pyramid tiers, widest last. */
export const PYRAMID: CategoryKey[][] = [
  ["crime", "sentiment"],
  ["advisories", "stability", "health"],
]

/** Level name + color for a category tile score. */
export function tileLevel(score: number | null): { name: string; color: string } {
  if (score == null) return { name: "No data", color: "#8a8f98" }
  if (score >= 70) return { name: "Good", color: "#1f9d5a" }
  if (score >= 55) return { name: "Fair", color: "#c8973f" }
  if (score >= 40) return { name: "Caution", color: "#e0773b" }
  return { name: "Elevated", color: "#d4503a" }
}

/**
 * Roll the report up into the five headline categories shown as the score
 * pyramid. Each tile links to its detail section below.
 *
 * Four read straight off the scoring engine's pillars rather than recomputing
 * their own averages, so a tile can never disagree with the headline score it
 * sits under. "Health & Air" and "Stability" each merge two pillars, weighted
 * the same way the engine weights them. The fifth, traveller sentiment, is the
 * field-research term — the 18% of the headline the databases cannot see.
 */
export function computeCategories(
  signals: SafetySignal[],
  intel: SafetyEnrichment | null = null
): CategoryScore[] {
  const { pillars } = computeSafetyIndex(signals)
  const byKey = new Map(signals.map((s) => [s.key, s]))
  const pillar = (k: PillarKey) => pillars.find((p) => p.key === k)

  /** Weighted blend of several pillars, skipping any that resolved nothing. */
  const blend = (parts: [PillarKey, number][]): number | null => {
    let sum = 0
    let wsum = 0
    for (const [k, w] of parts) {
      const score = pillar(k)?.score
      if (score == null) continue
      sum += score * w
      wsum += w
    }
    return wsum === 0 ? null : Math.round(sum / wsum)
  }

  const adv = byKey.get("advisory")
  const advNote =
    adv && adv.value != null ? adv.display : "No advisory issued"

  const crimeNote =
    byKey.get("numbeo_crime_index")?.value != null
      ? `Crime index ${byKey.get("numbeo_crime_index")!.display}`
      : byKey.get("homicide")?.value != null
        ? `Homicide ${byKey.get("homicide")!.display}`
        : "Street & violent crime"

  const healthNote =
    byKey.get("air_quality")?.value != null
      ? byKey.get("air_quality")!.display
      : "Air, disease & care"

  const sentiment = computeSentiment(intel)

  const cats: CategoryScore[] = [
    {
      key: "advisories",
      label: "Advisories",
      short: "Advisories",
      // An advisory with no grade is not a bad advisory — an ungraded or
      // absent one reads as "no government is warning about this place".
      // But if a government DID grade this place and the pillar still did not
      // resolve, that is a machinery failure, not a good sign: grey 0.
      score:
        pillar("advisory")?.score ??
        (byKey.get("advisory")?.value != null ? 0 : 90),
      note: advNote,
      signalKeys: ["advisory"],
      levelName: "",
      color: "",
      section: "sec-advisories",
      tier: 2,
    },
    {
      key: "crime",
      label: "Crime",
      short: "Crime",
      score: pillar("crime")?.score ?? null,
      note: crimeNote,
      section: "sec-crime",
      tier: 1,
      signalKeys: [
        // City-level first — these are the ones that describe this place
        // rather than its country, and carry most of the pillar.
        "research_robbery_risk",
        "research_pickpocket_risk",
        "research_sentiment_score",
        "numbeo_safety_night",
        "numbeo_safety_day",
        "numbeo_worry_mugged",
        "numbeo_violent_crime",
        "numbeo_property_crime",
        "numbeo_drugs",
        "numbeo_crime_index",
        "city_population_scale",
        "city_scale",
        // National statistics.
        "homicide",
        "safe_walking_dark",
        "violence_victimization",
        "sexual_violence",
        "human_trafficking_victims",
        "bribery_contact_rate",
        "firm_crime_losses",
        "crime_major_constraint",
      ],
      levelName: "",
      color: "",
    },
    {
      key: "sentiment",
      label: "Traveller Sentiment",
      short: "Sentiment",
      score: sentiment.score,
      note: sentiment.score == null ? "Field research pending" : sentiment.label,
      signalKeys: [],
      levelName: "",
      color: "",
      section: "sec-local-intel",
      tier: 1,
    },
    {
      key: "health",
      label: "Health & Air",
      short: "Health",
      score: blend([
        ["hazards", 0.1],
        ["health", 0.06],
      ]),
      note: healthNote,
      signalKeys: [
        "air_quality",
        "health",
        "hospitals",
        "weather",
        "road_deaths",
        "natural_hazards",
      ],
      levelName: "",
      color: "",
      section: "sec-health",
      tier: 2,
    },
    {
      key: "stability",
      label: "Stability",
      short: "Stability",
      score: blend([
        ["conflict", 0.2],
        ["institutions", 0.14],
      ]),
      note: "Governance & conflict basket",
      signalKeys: [
        "stability",
        "terrorism_deaths_pm",
        "rule_of_law",
        "corruption",
        "gov_effectiveness",
        "regulatory",
        "voice",
      ],
      levelName: "",
      color: "",
      section: "sec-stability",
      tier: 2,
    },
  ]

  // Emitted in pyramid order so any consumer that just maps over the array
  // (the JSON feed, the OG card) shows them the same way the page does.
  const order = PYRAMID.flat()
  return cats
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((c) => {
      const lv = tileLevel(c.score)
      return { ...c, levelName: lv.name, color: lv.color }
    })
}
