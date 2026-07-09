import type {
  SafetyReport,
  SafetyLevel,
  SafetySignal,
  SafetySource,
  OfficialAdvisory,
} from "../types"
import { gatherSignals } from "./signals"
import { getOfficialAdvisories, stateDeptLevelScore } from "./advisories"
import type { GeoPoint } from "../types"

// Weights for the composite index (signals not present are skipped & renormalized).
const WEIGHTS: Record<string, number> = {
  homicide: 0.22,
  safe_walking_dark: 0.09,
  violence_victimization: 0.08,
  human_trafficking_victims: 0.07,
  bribery_contact_rate: 0.06,
  numbeo_crime_index: 0.05,
  numbeo_safety_index: 0.05,
  firm_crime_losses: 0.05,
  crime_major_constraint: 0.04,
  stability: 0.16,
  advisory: 0.12,
  rule_of_law: 0.1,
  corruption: 0.07,
  gov_effectiveness: 0.07,
  health: 0.05,
  hospitals: 0.04,
  weather: 0.04,
  air_quality: 0.03,
  regulatory: 0.03,
  voice: 0.03,
}

function levelFromIndex(index: number): SafetyLevel {
  if (index >= 80) return "VERY_SAFE"
  if (index >= 66) return "SAFE"
  if (index >= 50) return "MODERATE"
  if (index >= 34) return "CAUTION"
  return "HIGH_RISK"
}

function compositeIndex(signals: SafetySignal[]): number {
  let sum = 0
  let wsum = 0
  for (const s of signals) {
    if (s.score == null) continue
    const w = WEIGHTS[s.key] ?? 0.04
    sum += s.score * w
    wsum += w
  }
  if (wsum === 0) return 60 // neutral when nothing resolved
  return Math.round(sum / wsum)
}

/**
 * "Safer than X% of countries" — derived from the governance percentile
 * signals (WGI scores are already country percentiles 0–100). Falls back to
 * the composite index when no WGI data is available.
 */
function saferThanPct(signals: SafetySignal[], index: number): number | null {
  const wgiKeys = ["stability", "rule_of_law", "corruption", "gov_effectiveness", "regulatory", "voice"]
  const vals = signals
    .filter((s) => wgiKeys.includes(s.key) && s.value != null)
    .map((s) => s.value as number)
  if (vals.length === 0) return Math.max(0, Math.min(100, index))
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** Build the "Official guidance" index signal from the US State Dept level. */
function advisorySignal(advisories: OfficialAdvisory[]): SafetySignal {
  const us = advisories.find((a) => a.sourceShort === "US" && a.level != null)
  const score = us?.level != null ? stateDeptLevelScore(us.level) : null
  return {
    key: "advisory",
    label: "Government travel advisory",
    group: "Official guidance",
    source: "U.S. Department of State",
    value: us?.level ?? null,
    display: us ? `Level ${us.level} — ${us.levelLabel}` : "No advisory",
    year: null,
    score,
    lowerIsBetter: true,
    note:
      us?.summary ||
      "U.S. State Department travel advisory level (1 = normal precautions, 4 = do not travel).",
  }
}

export async function getSafetyReport(geo: GeoPoint): Promise<SafetyReport> {
  const [{ signals: baseSignals, comparisons, health }, advisories] =
    await Promise.all([gatherSignals(geo), getOfficialAdvisories(geo)])

  // Fold the official advisory into the scored signals (drives the index).
  const signals = [...baseSignals, advisorySignal(advisories)]

  const index = compositeIndex(signals)
  const level = levelFromIndex(index)
  const safer = saferThanPct(signals, index)

  // Distinct databases that actually returned data, for honest attribution.
  const withData = signals.filter((s) => s.score != null)
  const sourceNames = Array.from(new Set(withData.map((s) => s.source)))
  const sources: SafetySource[] = sourceNames.map((name) => {
    const count = withData.filter((s) => s.source === name).length
    return { name, detail: `${count} indicator${count > 1 ? "s" : ""}` }
  })

  return {
    index,
    level,
    saferThanPct: safer,
    signals,
    comparisons,
    advisories,
    health,
    sources,
  }
}
