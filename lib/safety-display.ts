import type { SafetyLevel } from "./types"

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
