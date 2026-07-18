import type {
  SafetyLevel,
  SafetySignal,
  SafetyReport,
  SafetyEnrichment,
  RiskLevel,
} from "./types"

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

/** Level band for a 0–100 safety index. */
export function levelFromIndex(index: number): SafetyLevel {
  if (index >= 80) return "VERY_SAFE"
  if (index >= 66) return "SAFE"
  if (index >= 50) return "MODERATE"
  if (index >= 34) return "CAUTION"
  return "HIGH_RISK"
}

// ─── Final published score (databases + field research) ──────────────

/** 0–100 equivalents for the analyst's qualitative street-crime risk levels. */
const RISK_LEVEL_SCORE: Record<RiskLevel, number> = {
  Low: 88,
  Moderate: 62,
  High: 38,
  Severe: 15,
}

export interface FinalScore {
  index: number
  level: SafetyLevel
  /** true when the on-the-ground research contributed to the number */
  includesFieldResearch: boolean
}

/**
 * The headline score shown in the hero. The multi-database composite is the
 * backbone (75%); once the field research finishes, its street-crime ratings
 * and current traveller sentiment fold in (25%). The report is held until the
 * research completes, so this final number always reflects everything in it.
 */
export function computeFinalScore(
  safety: SafetyReport,
  intel: SafetyEnrichment | null
): FinalScore {
  const ground: number[] = []
  // Record lookup can miss at runtime if the model emits an off-schema level.
  const riskScore = (r?: { level: RiskLevel }) => {
    const v = r ? RISK_LEVEL_SCORE[r.level] : undefined
    if (v != null) ground.push(v)
  }
  riskScore(intel?.robbery)
  riskScore(intel?.pickpocket)
  const sentiment = Number(intel?.consumerSentiment?.score)
  if (Number.isFinite(sentiment)) ground.push(Math.max(0, Math.min(100, sentiment)))

  if (!ground.length) {
    return { index: safety.index, level: safety.level, includesFieldResearch: false }
  }
  const groundScore = ground.reduce((a, b) => a + b, 0) / ground.length
  const index = Math.round(0.75 * safety.index + 0.25 * groundScore)
  return { index, level: levelFromIndex(index), includesFieldResearch: true }
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
 * Roll the raw signals up into the four headline categories shown as clickable
 * tiles at the top of the report. Each tile links to its detail section below.
 */
export function computeCategories(signals: SafetySignal[]): CategoryScore[] {
  const byKey = new Map(signals.map((s) => [s.key, s]))
  const scoreOf = (k: string) => byKey.get(k)?.score ?? null

  const mean = (keys: string[]): number | null => {
    const vals = keys.map(scoreOf).filter((v): v is number => v != null)
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  const weightedMean = (weighted: [string, number][]): number | null => {
    let sum = 0
    let wsum = 0
    for (const [k, w] of weighted) {
      const v = scoreOf(k)
      if (v == null) continue
      sum += v * w
      wsum += w
    }
    return wsum === 0 ? null : Math.round(sum / wsum)
  }

  // Advisories — colour by the advisory LEVEL itself, not a raw score, because
  // an advisory is categorical: Level 1 = normal precautions (green), Level 2 =
  // "exercise increased caution" (yellow — neither good nor bad), Level 3 =
  // reconsider (orange), Level 4 = do not travel (red). No advisory ≈ green.
  const adv = byKey.get("advisory")
  const advLevel = (adv?.value ?? null) as number | null
  const advScore =
    advLevel == null ? 90 : advLevel <= 1 ? 90 : advLevel === 2 ? 62 : advLevel === 3 ? 45 : 15
  const advNote = adv
    ? adv.value == null
      ? "No advisory issued"
      : adv.display
    : "No advisory issued"

  const crimeNote = byKey.get("numbeo_crime_index")?.value != null
    ? `Crime index ${byKey.get("numbeo_crime_index")!.display}`
    : byKey.get("homicide")?.value != null
      ? `Homicide ${byKey.get("homicide")!.display}`
      : "Street & violent crime"
  const healthNote = byKey.get("air_quality")?.value != null
    ? byKey.get("air_quality")!.display
    : "Air, disease & care"

  const cats: CategoryScore[] = [
    {
      key: "advisories",
      label: "Advisories",
      score: advScore,
      note: advNote,
      signalKeys: ["advisory"],
      levelName: "",
      color: "",
    },
    {
      key: "crime",
      label: "Crime",
      score: weightedMean([
        ["homicide", 0.26],
        ["safe_walking_dark", 0.16],
        ["violence_victimization", 0.13],
        ["sexual_violence", 0.09],
        ["numbeo_crime_index", 0.11],
        ["numbeo_safety_index", 0.11],
        ["human_trafficking_victims", 0.07],
        ["bribery_contact_rate", 0.04],
        ["firm_crime_losses", 0.02],
        ["crime_major_constraint", 0.01],
      ]),
      note: crimeNote,
      signalKeys: [
        "homicide",
        "safe_walking_dark",
        "violence_victimization",
        "sexual_violence",
        "human_trafficking_victims",
        "bribery_contact_rate",
        "numbeo_crime_index",
        "numbeo_safety_index",
        "firm_crime_losses",
        "crime_major_constraint",
      ],
      levelName: "",
      color: "",
    },
    {
      key: "health",
      label: "Health & Air",
      score: mean(["air_quality", "health", "hospitals", "weather", "road_deaths"]),
      note: healthNote,
      signalKeys: ["air_quality", "health", "hospitals", "weather", "road_deaths"],
      levelName: "",
      color: "",
    },
    {
      key: "stability",
      label: "Stability",
      score: mean([
        "stability",
        "rule_of_law",
        "corruption",
        "gov_effectiveness",
        "regulatory",
        "voice",
        "terrorism_deaths",
      ]),
      note: "Governance & conflict basket",
      signalKeys: [
        "stability",
        "rule_of_law",
        "corruption",
        "gov_effectiveness",
        "regulatory",
        "voice",
        "terrorism_deaths",
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
