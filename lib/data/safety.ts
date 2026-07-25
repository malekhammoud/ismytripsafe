import type {
  SafetyReport,
  SafetySignal,
  SafetySource,
  OfficialAdvisory,
} from "../types"
import { computeSafetyIndex, advisoryScore } from "../scoring"
import { gatherSignals } from "./signals"
import { getOfficialAdvisories } from "./advisories"
import type { GeoPoint } from "../types"

/**
 * Build the "Official guidance" index signal from every graded advisory.
 * The US and Canadian levels share a 1–4 scale and are averaged; the UK's
 * structured alert rank only stands in when neither is available.
 */
function advisorySignal(advisories: OfficialAdvisory[]): SafetySignal {
  const graded = advisories.filter(
    (a) => a.level != null && (a.sourceShort === "US" || a.sourceShort === "CA")
  )
  const pool = graded.length
    ? graded
    : advisories.filter((a) => a.level != null)

  const us = advisories.find((a) => a.sourceShort === "US" && a.level != null)
  const lead = us ?? pool[0]

  // Average the advisory *level* across issuing governments, then let the
  // scoring engine map that to a 0–100 score — the level is also what drives
  // the "Do Not Travel" cap, so the two must read the same number.
  const level = pool.length
    ? pool.reduce((sum, a) => sum + (a.level as number), 0) / pool.length
    : null

  const display = lead
    ? `Level ${lead.level} — ${lead.levelLabel}` +
      (pool.length > 1 ? ` · ${pool.length} govts` : "")
    : "No advisory"

  return {
    key: "advisory",
    label: "Government travel advisory",
    group: "Official guidance",
    source: us
      ? pool.length > 1
        ? "US State Dept · Canada"
        : "U.S. Department of State"
      : (lead?.source ?? "U.S. Department of State"),
    value: level,
    display,
    year: null,
    note:
      lead?.summary ||
      "Official government travel advisory levels (1 = normal precautions, 4 = do not travel), averaged across issuing governments.",
    score: level == null ? null : Math.round(advisoryScore(level)),
    lowerIsBetter: true,
  }
}

export async function getSafetyReport(geo: GeoPoint): Promise<SafetyReport> {
  const [{ signals: baseSignals, comparisons, health, hazardEvents, quakeSummary }, advisories] =
    await Promise.all([gatherSignals(geo), getOfficialAdvisories(geo)])

  // Fold the official advisory into the scored signals (drives the index).
  const signals = [...baseSignals, advisorySignal(advisories)]

  const scored = computeSafetyIndex(signals)

  // Distinct databases that actually returned data, for honest attribution.
  const withData = signals.filter((s) => s.score != null)
  const sourceNames = Array.from(new Set(withData.map((s) => s.source)))
  const sources: SafetySource[] = sourceNames.map((name) => {
    const count = withData.filter((s) => s.source === name).length
    return { name, detail: `${count} indicator${count > 1 ? "s" : ""}` }
  })

  return {
    index: scored.index,
    level: scored.level,
    saferThanPct: scored.saferThanPct,
    pillars: scored.pillars,
    confidence: scored.confidence,
    caps: scored.caps,
    signals,
    comparisons,
    advisories,
    health,
    sources,
    hazardEvents,
    quakeSummary,
  }
}
