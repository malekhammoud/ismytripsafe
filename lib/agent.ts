import { spawn } from "child_process"
import type { SafetyBundle, GeoPoint, StreamEvent } from "./types"

const SYSTEM_PROMPT = `You are a travel-safety analyst. Your ONE job: tell a traveler whether a place is safe, and why. Stay focused on personal safety — not flights, hotels, food or attractions.

You will receive a REAL, multi-database safety profile (World Bank crime & governance indicators, live air quality, nearby-hospital data, seasonal weather) AND the official government travel advisories (U.S. State Department, UK FCDO) pulled straight from those governments' own data feeds. Treat ALL of these as ground truth. The official advisory wording is already shown to the user verbatim from the source — do NOT restate, summarize, or invent advisory levels. Your job is to interpret the data for a human and add the on-the-ground intelligence databases can't capture, verified with live web search:
- Recent incidents, unrest, protests, crime trends (search the news)
- Neighborhood-level detail: which specific districts are safe vs. which to avoid
- Street-crime specifics: how bad is robbery/mugging, and pickpocketing/bag-snatching, for a visitor here
- How safe visitors actually feel day-to-day (traveller sentiment)
- Scams and threats that specifically target visitors
- Seasonal hazards to watch for right now, and practical safety advice

CRITICAL: Output a single JSON block in EXACTLY this format, then a prose briefing:

START_SAFETY
{
  "verdict": "One direct sentence answering 'is it safe?' — e.g. 'Yes — Lisbon is one of Europe's safest capitals for visitors.'",
  "summary": "2-3 sentences interpreting the real safety data for a traveler.",
  "safeAreas": ["District A", "District B", "District C"],
  "avoidAreas": ["Area to avoid (with why, briefly)", "another"],
  "scams": ["common scam targeting visitors", "another"],
  "tips": ["specific actionable safety tip", "another", "another"],
  "robbery": { "level": "Low|Moderate|High|Severe", "note": "one line on mugging/armed-robbery risk to visitors and where it happens" },
  "pickpocket": { "level": "Low|Moderate|High|Severe", "note": "one line on pickpocketing/bag-snatching risk and the hotspots" },
  "consumerSentiment": { "score": 0-100, "label": "short label e.g. 'Mostly positive'", "summary": "1-2 sentences on how safe visitors report feeling day-to-day, from recent traveller reports" },
  "watchOuts": ["specific thing to watch out for in this city right now (incl. any seasonal weather hazard)", "another", "another"]
}
END_SAFETY

For "level" use exactly one of: Low, Moderate, High, Severe. For "score" use a number 0-100. Then write a focused 3-4 paragraph safety briefing: the bottom-line verdict, what the data means on the ground, the real current situation (cite what you found), and how to stay safe. Be specific and honest — do not sugar-coat genuine risks, and do not exaggerate for safe places.`

function buildPrompt(geo: GeoPoint, bundle: SafetyBundle): string {
  const s = bundle.safety
  const signalLines = s.signals
    .map(
      (sig) =>
        `- ${sig.label}: ${sig.display}${sig.score != null ? ` (safety score ${sig.score}/100)` : " — no data"} [${sig.source}${sig.year ? `, ${sig.year}` : ""}]`
    )
    .join("\n")

  const comparisonLines = s.comparisons
    .map(
      (c) =>
        `- ${c.metric} (${c.unit}): ` +
        c.entries.map((e) => `${e.name} ${e.value}${e.isTarget ? " ◀ HERE" : ""}`).join(", ")
    )
    .join("\n")

  const advisoryLines = s.advisories.length
    ? s.advisories
        .map(
          (a) =>
            `- ${a.source}: ${a.headline}${a.updated ? ` (updated ${a.updated})` : ""} — ${a.summary}`
        )
        .join("\n")
    : "- (no official advisory currently published)"

  const healthLines = s.health.length
    ? s.health
        .map((h) => `- [${h.levelLabel}] ${h.title}${h.scope === "global" ? " (worldwide)" : ""}`)
        .join("\n")
    : "- (no active CDC health notices)"

  return `Assess the safety of ${geo.city}, ${geo.country} (${geo.countryCode}) for a traveler.

=== REAL MULTI-DATABASE SAFETY PROFILE (ground truth) ===
Composite safety index: ${s.index}/100 (${s.level.replace("_", " ")})
${s.saferThanPct != null ? `Safer than ~${s.saferThanPct}% of countries (governance percentile)\n` : ""}
Signals:
${signalLines}

Official government advisories (already shown to the user — do NOT repeat):
${advisoryLines}

CDC travel health notices (already shown to the user — do NOT repeat, but you may reference for health tips):
${healthLines}

How it compares:
${comparisonLines}
========================================================

Interpret this for the traveler and add neighborhood-level safety, current incidents (use web search), scams, and practical tips. ${geo.city} is the specific city — focus on it, not just the country. Output the START_SAFETY JSON block first, then your prose briefing.`
}

export async function* runSafetyAgent(
  geo: GeoPoint,
  bundle: SafetyBundle
): AsyncGenerator<StreamEvent> {
  const proc = spawn(
    "/usr/bin/claude",
    [
      "-p",
      "--verbose",
      "--output-format", "stream-json",
      "--allowedTools", "WebSearch,WebFetch",
      "--append-system-prompt", SYSTEM_PROMPT,
      buildPrompt(geo, bundle),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: process.env.PATH ?? "/usr/bin:/usr/local/bin" },
    }
  )

  let lineBuffer = ""
  let accumulatedText = ""
  let prevProseLength = 0
  let enrichmentSent = false
  let proseOffset = 0

  function tryParse(text: string): StreamEvent | null {
    const startIdx = text.indexOf("START_SAFETY")
    const endIdx = text.lastIndexOf("END_SAFETY")
    if (startIdx === -1 || endIdx <= startIdx) return null
    let jsonStr = text.slice(startIdx + "START_SAFETY".length, endIdx).trim()
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    try {
      const data = JSON.parse(jsonStr)
      proseOffset = endIdx + "END_SAFETY".length
      return { type: "enrichment", data }
    } catch {
      return null
    }
  }

  function* processLine(line: string): Generator<StreamEvent> {
    if (!line.trim()) return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line)
    } catch {
      return
    }

    if (event.type === "assistant") {
      const message = (event as { message?: { content?: unknown[] } }).message
      for (const block of message?.content ?? []) {
        const b = block as Record<string, unknown>
        if (b.type === "tool_use") {
          const inp = b.input as Record<string, unknown> | undefined
          const query = String(inp?.query ?? inp?.url ?? b.name ?? "researching")
          if (b.name === "WebSearch" || b.name === "WebFetch") {
            yield { type: "searching", query }
          }
        }
        if (b.type === "text") {
          const fullText = String(b.text ?? "")
          if (fullText.length >= accumulatedText.length) accumulatedText = fullText
          else accumulatedText += fullText

          if (!enrichmentSent && accumulatedText.includes("END_SAFETY")) {
            const ev = tryParse(accumulatedText)
            if (ev) {
              yield ev
              enrichmentSent = true
            }
          }
          if (enrichmentSent) {
            const prose = accumulatedText.slice(proseOffset)
            if (prose.length > prevProseLength) {
              const chunk = prose.slice(prevProseLength)
              if (chunk.trim()) yield { type: "text", content: chunk }
              prevProseLength = prose.length
            }
          }
        }
      }
    }

    if (event.type === "result") {
      const resultText = String((event as { result?: unknown }).result ?? "")
      if (!enrichmentSent && resultText.includes("END_SAFETY")) {
        const ev = tryParse(resultText)
        if (ev) {
          yield ev
          enrichmentSent = true
          const prose = resultText.slice(proseOffset).trim()
          if (prose) yield { type: "text", content: prose }
        }
      }
      yield { type: "done" }
    }
  }

  let stderrBuffer = ""
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString()
  })

  try {
    for await (const chunk of proc.stdout!) {
      lineBuffer += (chunk as Buffer).toString()
      const lines = lineBuffer.split("\n")
      lineBuffer = lines.pop() ?? ""
      for (const line of lines) yield* processLine(line)
    }
    if (lineBuffer.trim()) yield* processLine(lineBuffer)
  } catch (err) {
    yield { type: "error", message: String(err) }
  }

  await new Promise<void>((resolve) => proc.on("close", resolve))

  if (stderrBuffer && !accumulatedText) {
    yield { type: "error", message: stderrBuffer.trim() }
  }
}
