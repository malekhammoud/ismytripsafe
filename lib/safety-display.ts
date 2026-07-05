import type { SafetyLevel, SafetySignal } from "./types"

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

  // Advisories — driven by the official State Dept advisory signal.
  const adv = byKey.get("advisory")
  const advScore = adv?.score ?? (adv ? 88 : null) // no advisory issued ≈ good
  const advNote = adv
    ? adv.value == null
      ? "No advisory issued"
      : adv.display
    : "No advisory issued"

  const crimeNote = byKey.get("homicide")?.value != null
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
        ["homicide", 0.7],
        ["road", 0.3],
      ]),
      note: crimeNote,
      signalKeys: ["homicide", "road"],
      levelName: "",
      color: "",
    },
    {
      key: "health",
      label: "Health & Air",
      score: mean(["air_quality", "health", "hospitals", "weather"]),
      note: healthNote,
      signalKeys: ["air_quality", "health", "hospitals", "weather"],
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
      ]),
      note: "WGI governance basket",
      signalKeys: [
        "stability",
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
