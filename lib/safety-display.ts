import type {
  SafetyLevel,
  SafetySignal,
  SafetyReport,
  SafetyEnrichment,
  RiskLevel,
} from "./types"
import {
  computeSafetyIndex,
  levelFromIndex,
  saferThanPct,
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
//
// Robbery and pickpocketing get separate scales because they are not the same
// kind of risk. Armed robbery is a threat to life; pickpocketing is a threat
// to a wallet. On a single shared scale, "High pickpocket risk" scored 38 —
// which is what pushed Barcelona and Rome, two cities with very little
// violent crime, below Yerevan and Skagway.

/** Mugging / armed robbery — a risk to the traveller's person. */
const ROBBERY_SCORE: Record<RiskLevel, number> = {
  Low: 92,
  Moderate: 62,
  High: 34,
  Severe: 12,
}

/** Pickpocketing / bag-snatching — costly and common, but rarely dangerous. */
const PICKPOCKET_SCORE: Record<RiskLevel, number> = {
  Low: 96,
  Moderate: 78,
  High: 58,
  Severe: 40,
}

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
 * Field research then folds in at 20%: the analyst's street-crime ratings and
 * current traveller sentiment. It is capped the same way the composite is —
 * a "Do Not Travel" advisory is not something a positive sentiment read gets
 * to argue away.
 */
export function computeFinalScore(
  safety: SafetyReport,
  intel: SafetyEnrichment | null
): FinalScore {
  const base = computeSafetyIndex(safety.signals)

  const ground: { score: number; weight: number }[] = []
  // Record lookup can miss at runtime if the model emits an off-schema level.
  const add = (
    table: Record<RiskLevel, number>,
    weight: number,
    r?: { level: RiskLevel }
  ) => {
    const v = r ? table[r.level] : undefined
    if (v != null) ground.push({ score: v, weight })
  }
  add(ROBBERY_SCORE, 0.45, intel?.robbery)
  add(PICKPOCKET_SCORE, 0.2, intel?.pickpocket)
  const sentiment = Number(intel?.consumerSentiment?.score)
  if (Number.isFinite(sentiment)) {
    ground.push({ score: Math.max(0, Math.min(100, sentiment)), weight: 0.35 })
  }

  if (!ground.length) {
    return {
      index: base.index,
      level: base.level,
      includesFieldResearch: false,
      confidence: base.confidence,
      saferThanPct: base.saferThanPct,
      caps: base.caps,
    }
  }

  const wsum = ground.reduce((a, g) => a + g.weight, 0)
  const groundScore = ground.reduce((a, g) => a + g.score * g.weight, 0) / wsum
  let index = Math.round(0.8 * base.index + 0.2 * groundScore)
  for (const c of base.caps) index = Math.min(index, c.max)
  index = Math.max(0, Math.min(100, index))

  return {
    index,
    level: levelFromIndex(index),
    includesFieldResearch: true,
    confidence: base.confidence,
    saferThanPct: saferThanPct(index),
    caps: base.caps,
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

// ─── Category tiles (Advisories · Crime · Health & Air · Stability) ───

export type CategoryKey = "advisories" | "crime" | "health" | "stability"

export interface CategoryScore {
  key: CategoryKey
  label: string
  score: number | null // 0–100 (100 = safest) or null when no data
  levelName: string // "Good" | "Fair" | "Caution" | "Elevated" | "No data"
  color: string
  note: string // short one-liner shown on the tile
  signalKeys: string[] // signal keys rendered in the detail section
}

/** Level name + color for a category tile score. */
export function tileLevel(score: number | null): { name: string; color: string } {
  if (score == null) return { name: "No data", color: "#8a8f98" }
  if (score >= 70) return { name: "Good", color: "#1f9d5a" }
  if (score >= 55) return { name: "Fair", color: "#c8973f" }
  if (score >= 40) return { name: "Caution", color: "#e0773b" }
  return { name: "Elevated", color: "#d4503a" }
}

/**
 * Roll the signals up into the four headline categories shown as clickable
 * tiles at the top of the report. Each tile links to its detail section below.
 *
 * The tiles read straight off the scoring engine's pillars rather than
 * recomputing their own averages, so a tile can never disagree with the
 * headline score it sits under. "Health & Air" and "Stability" each merge two
 * pillars, weighted the same way the engine weights them.
 */
export function computeCategories(signals: SafetySignal[]): CategoryScore[] {
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

  const cats: CategoryScore[] = [
    {
      key: "advisories",
      label: "Advisories",
      // An advisory with no grade is not a bad advisory — an ungraded or
      // absent one reads as "no government is warning about this place".
      score: pillar("advisory")?.score ?? 90,
      note: advNote,
      signalKeys: ["advisory"],
      levelName: "",
      color: "",
    },
    {
      key: "crime",
      label: "Crime",
      score: pillar("crime")?.score ?? null,
      note: crimeNote,
      signalKeys: [
        "homicide",
        "safe_walking_dark",
        "violence_victimization",
        "sexual_violence",
        "human_trafficking_victims",
        "bribery_contact_rate",
        "numbeo_crime_index",
        "firm_crime_losses",
        "crime_major_constraint",
      ],
      levelName: "",
      color: "",
    },
    {
      key: "health",
      label: "Health & Air",
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
    },
    {
      key: "stability",
      label: "Stability",
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
    },
  ]

  return cats.map((c) => {
    const lv = tileLevel(c.score)
    return { ...c, levelName: lv.name, color: lv.color }
  })
}
