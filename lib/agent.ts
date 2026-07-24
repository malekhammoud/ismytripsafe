import type { SafetyBundle, GeoPoint, StreamEvent, SafetyEnrichment } from "./types"
import type { WikivoyageSafety } from "./data/wikivoyage"
import {
  buildQueryPlan,
  searchGoogleNews,
  searchDuckDuckGo,
  pickArticleUrls,
  fetchArticle,
  formatDossier,
  type ResearchDossier,
} from "./research"

// Research runs on OpenRouter's free models — the account-wide free-model
// budget is ~1,000 requests/day (20/min), and each report costs exactly ONE
// request because all searching/crawling happens in lib/research.ts, not in
// a model tool loop. Ordered strongest-first; we fall through on any failure.
const DEFAULT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
]

const LLM_DEADLINE_MS = 230_000 // route maxDuration is 300s; leave room for research + cache write
const STALL_TIMEOUT_MS = 60_000 // abort a model that stops sending chunks

const SYSTEM_PROMPT = `You are a travel-safety analyst. Your ONE job: tell a traveler whether a place is safe, and why. Stay focused on personal safety — not flights, hotels, food or attractions.

You will receive a REAL, multi-database safety profile (World Bank crime & governance indicators, live air quality, nearby-hospital data, seasonal weather, live disaster alerts) AND the official government travel advisories (U.S. State Department, UK FCDO, Canada) pulled straight from those governments' own data feeds. You may also receive the Wikivoyage "Stay safe" section — traveller-maintained background that can be months old: treat it as leads, not current fact. Treat the databases and advisories as ground truth. The official advisory wording is already shown to the user verbatim from the source — do NOT restate, summarize, or invent advisory levels.

You will ALSO receive a LIVE WEB RESEARCH DOSSIER: real, current news headlines, web search results and full-text page extracts gathered moments ago specifically for this city. This dossier is your window onto the current situation — you cannot search the web yourself, so it is your ONLY source for anything recent. Use it for:
- Recent incidents, unrest, protests, crime trends
- Neighborhood-level detail: which specific districts are safe vs. which to avoid
- Street-crime specifics: robbery/mugging and pickpocketing/bag-snatching risk for a visitor
- How safe visitors actually feel day-to-day (traveller sentiment)
- Scams and threats that specifically target visitors
- Seasonal hazards to watch for right now, and practical safety advice

GROUNDING RULES — non-negotiable:
- Every entry in "recentIncidents" MUST come from a dated item in the dossier (headline or extract). Copy its real date and real source name. NEVER invent an incident, a date, or a publication. If the dossier has nothing notable, use [].
- Neighborhood names in mapZones/safeAreas/avoidAreas must be real districts of this city — prefer ones the dossier or Wikivoyage actually mentions; fill gaps only with districts you are certain exist.
- If dossier items contradict each other, trust the more recent, more local source, and say so in the briefing.
- If the dossier is thin or empty, be conservative: lean on the database profile, keep recentIncidents empty, and never fabricate currency ("as of this month…") you do not have.

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
  "watchOuts": ["specific thing to watch out for in this city right now (incl. any seasonal weather hazard)", "another", "another"],
  "recentIncidents": [
    { "when": "Jun 2026", "what": "one line: a real recent incident, trend or development relevant to visitor safety", "source": "publication or site name" }
  ],
  "mapZones": [
    { "name": "specific real district/neighbourhood name", "level": "safe|caution|avoid", "note": "one line: why it's this level for a visitor" }
  ]
}
END_SAFETY

For "level" use exactly one of: Low, Moderate, High, Severe. For "score" use a number 0-100. For "recentIncidents" list 2-4 REAL, dated items from the dossier, most recent first ("when" is a month + year); use [] if genuinely nothing notable. For "mapZones" list 5-8 REAL, individually named districts/neighbourhoods of this specific city (not the whole country) that can be found on a map, each rated "safe" (green), "caution" (yellow — okay but stay alert / avoid after dark) or "avoid" (red). Include a mix of levels where the city warrants it.

DIVISION OF LABOUR — these render on two different pages, so keep them strictly separate:
- District-by-district safety judgments belong ONLY in mapZones / safeAreas / avoidAreas (shown on the map page). safeAreas and avoidAreas must agree with your mapZones ratings.
- The prose briefing (shown on the report page) covers the overall picture: verdict, what the data means, the current situation, how to stay safe. Do NOT re-rate individual neighbourhoods in the prose, and never contradict your own mapZones.
- Do NOT quote the numeric composite index in the prose — the published score is recomputed after your research lands and may differ.

Then write a focused 3-4 paragraph safety briefing: the bottom-line verdict, what the data means on the ground, the real current situation (cite what the dossier found, with source names and dates), and how to stay safe. Be specific and honest — do not sugar-coat genuine risks, and do not exaggerate for safe places. Output the JSON block and briefing directly with no preamble.`

function buildPrompt(
  geo: GeoPoint,
  bundle: SafetyBundle,
  wikivoyage: WikivoyageSafety | null,
  dossierBlock: string
): string {
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

  const hazardLines = s.hazardEvents?.length
    ? s.hazardEvents
        .map(
          (h) =>
            `- [${h.severity.toUpperCase()}] ${h.kind}: ${h.title} (~${h.distanceKm} km away)`
        )
        .join("\n")
    : "- (no active disaster alerts within 500 km)"

  const wikivoyageBlock = wikivoyage
    ? `\nWikivoyage "Stay safe" background for ${wikivoyage.pageTitle} (traveller-maintained, may be stale — trust the dossier over this where they disagree):\n"""\n${wikivoyage.text}\n"""\n`
    : ""

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return `Assess the safety of ${geo.city}, ${geo.country} (${geo.countryCode}) for a traveler. Today's date is ${today}.

=== REAL MULTI-DATABASE SAFETY PROFILE (ground truth) ===
Composite safety index: ${s.index}/100 (${s.level.replace("_", " ")})
${s.saferThanPct != null ? `Safer than ~${s.saferThanPct}% of countries (governance percentile)\n` : ""}
Signals:
${signalLines}

Official government advisories (already shown to the user — do NOT repeat):
${advisoryLines}

CDC travel health notices (already shown to the user — do NOT repeat, but you may reference for health tips):
${healthLines}

Live disaster alerts near the destination (GDACS):
${hazardLines}
${s.quakeSummary ? `Seismic history (USGS): ${s.quakeSummary}\n` : ""}
How it compares:
${comparisonLines}
========================================================
${wikivoyageBlock}
${dossierBlock}

Interpret this for the traveler and add neighborhood-level safety, current incidents (from the dossier), scams, and practical tips. ${geo.city} is the specific city — focus on it, not just the country. Output the START_SAFETY JSON block first, then your prose briefing.`
}

// ─── Free web research (Google News RSS + DuckDuckGo + crawling) ────

async function* runResearch(
  geo: GeoPoint,
  dossier: ResearchDossier
): AsyncGenerator<StreamEvent> {
  const plan = buildQueryPlan(geo)

  for (const q of [...plan.news, ...plan.web]) {
    yield { type: "searching", query: q.replace(/"/g, "") }
  }

  const [newsResults, webResults] = await Promise.all([
    Promise.all(plan.news.map((q) => searchGoogleNews(q))),
    Promise.all(plan.web.map((q) => searchDuckDuckGo(q))),
  ])

  const seenTitles = new Set<string>()
  for (const h of newsResults.flat()) {
    const key = h.title.toLowerCase()
    if (seenTitles.has(key)) continue
    seenTitles.add(key)
    dossier.headlines.push(h)
  }

  const seenUrls = new Set<string>()
  for (const r of webResults.flat()) {
    if (seenUrls.has(r.url)) continue
    seenUrls.add(r.url)
    dossier.webResults.push(r)
  }

  const toCrawl = pickArticleUrls(dossier.webResults)
  for (const r of toCrawl) {
    yield { type: "searching", query: `Reading ${new URL(r.url).hostname.replace(/^www\./, "")}…` }
  }
  const extracts = await Promise.all(toCrawl.map((r) => fetchArticle(r.url)))
  dossier.extracts.push(...extracts.filter((e): e is NonNullable<typeof e> => e != null))
}

// ─── OpenRouter streaming ───────────────────────────────────────────

function getModels(): string[] {
  const env = process.env.OPENROUTER_MODELS
  if (env) return env.split(",").map((m) => m.trim()).filter(Boolean)
  return DEFAULT_MODELS
}

/** Stream one OpenRouter completion, yielding accumulated content text. */
async function* streamModel(
  model: string,
  apiKey: string,
  system: string,
  user: string,
  deadline: number
): AsyncGenerator<string> {
  const controller = new AbortController()
  const hardTimer = setTimeout(
    () => controller.abort(),
    Math.max(1, deadline - Date.now())
  )
  let stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS)

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ismytripsafe.com",
        "X-Title": "IsMyTripSafe",
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.35,
        max_tokens: 8192,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "")
      throw new Error(`OpenRouter ${res.status} for ${model}: ${detail.slice(0, 300)}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS)

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const payload = trimmed.slice(5).trim()
        if (payload === "[DONE]") return
        let json: { choices?: { delta?: { content?: string } }[]; error?: { message?: string } }
        try {
          json = JSON.parse(payload)
        } catch {
          continue
        }
        if (json.error) throw new Error(`OpenRouter mid-stream error: ${json.error.message}`)
        // reasoning models also send delta.reasoning — only content is output
        const content = json.choices?.[0]?.delta?.content
        if (content) yield content
      }
    }
  } finally {
    clearTimeout(hardTimer)
    clearTimeout(stallTimer)
  }
}

// ─── Output parsing (START_SAFETY block + prose) ────────────────────

/** Some open models leak chain-of-thought as <think>…</think> in content. */
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^<think>[\s\S]*$/, "")
}

/** Models sometimes repeat the block markers or fences after the JSON —
 *  scrub them (and any partially-emitted trailing marker) out of the prose. */
function sanitizeProse(text: string): string {
  let t = text.replace(/START_SAFETY|END_SAFETY|```(?:json)?/g, "")
  for (const marker of ["END_SAFETY", "START_SAFETY"]) {
    for (let len = marker.length - 1; len >= 3; len--) {
      if (t.trimEnd().endsWith(marker.slice(0, len))) {
        t = t.trimEnd().slice(0, -len)
        break
      }
    }
  }
  return t
}

/** Chars held back while streaming so a marker split across chunks can't leak. */
const PROSE_HOLDBACK = 12

function parseEnrichment(
  text: string
): { data: SafetyEnrichment; proseOffset: number } | null {
  const startIdx = text.indexOf("START_SAFETY")
  const endIdx = text.lastIndexOf("END_SAFETY")
  let jsonStr: string | null = null
  let proseOffset = 0

  if (startIdx !== -1 && endIdx > startIdx) {
    jsonStr = text.slice(startIdx + "START_SAFETY".length, endIdx).trim()
    proseOffset = endIdx + "END_SAFETY".length
  } else {
    // fallback: model dropped the markers — take the outermost JSON object
    const first = text.indexOf("{")
    const last = text.lastIndexOf("}")
    if (first !== -1 && last > first && text.includes('"verdict"')) {
      jsonStr = text.slice(first, last + 1)
      proseOffset = last + 1
    }
  }
  if (!jsonStr) return null

  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
  try {
    const data = JSON.parse(jsonStr)
    if (typeof data?.verdict !== "string") return null
    return { data, proseOffset }
  } catch {
    return null
  }
}

// ─── The agent ──────────────────────────────────────────────────────

export async function* runSafetyAgent(
  geo: GeoPoint,
  bundle: SafetyBundle,
  wikivoyage: WikivoyageSafety | null = null
): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    yield { type: "error", message: "OPENROUTER_API_KEY is not configured" }
    return
  }

  // 1. Free web research: search + crawl, streaming progress to the UI.
  const dossier: ResearchDossier = { headlines: [], webResults: [], extracts: [] }
  try {
    yield* runResearch(geo, dossier)
  } catch {
    // research is best-effort; the model is told how to behave with a thin dossier
  }

  const userPrompt = buildPrompt(geo, bundle, wikivoyage, formatDossier(dossier, new Date()))

  // 2. One free-model completion, falling through the chain on any failure.
  yield { type: "searching", query: "Analyzing findings…" }
  const deadline = Date.now() + LLM_DEADLINE_MS
  const errors: string[] = []

  for (const model of getModels()) {
    if (Date.now() > deadline - 15_000) break

    let accumulated = ""
    let enrichment: { data: SafetyEnrichment; proseOffset: number } | null = null
    let prevProseLength = 0

    try {
      for await (const chunk of streamModel(model, apiKey, SYSTEM_PROMPT, userPrompt, deadline)) {
        accumulated += chunk
        const clean = stripThink(accumulated)

        if (!enrichment && clean.includes("END_SAFETY")) {
          enrichment = parseEnrichment(clean)
          if (enrichment) yield { type: "enrichment", data: enrichment.data }
        }
        if (enrichment) {
          const prose = sanitizeProse(clean.slice(enrichment.proseOffset))
          const flushable = Math.max(0, prose.length - PROSE_HOLDBACK)
          if (flushable > prevProseLength) {
            const delta = prose.slice(prevProseLength, flushable)
            if (delta.trim()) yield { type: "text", content: delta }
            prevProseLength = flushable
          }
        }
      }

      // stream ended cleanly — flush the held-back tail of the prose
      if (enrichment) {
        const prose = sanitizeProse(stripThink(accumulated).slice(enrichment.proseOffset))
        if (prose.length > prevProseLength) {
          const delta = prose.slice(prevProseLength).trimEnd()
          if (delta.trim()) yield { type: "text", content: delta }
        }
      }
    } catch (err) {
      errors.push(String(err))
      if (enrichment) {
        // stream died after the structured block landed — ship what we have
        yield { type: "done" }
        return
      }
      continue // nothing user-visible emitted yet; safe to try the next model
    }

    // stream finished cleanly — the markers may only be parseable now
    if (!enrichment) {
      enrichment = parseEnrichment(stripThink(accumulated))
      if (enrichment) {
        yield { type: "enrichment", data: enrichment.data }
        const prose = sanitizeProse(stripThink(accumulated).slice(enrichment.proseOffset)).trim()
        if (prose) yield { type: "text", content: prose }
      }
    }

    if (enrichment) {
      yield { type: "done" }
      return
    }
    errors.push(`${model}: finished without a parseable START_SAFETY block`)
  }

  yield {
    type: "error",
    message: `All research models failed. ${errors.slice(-2).join(" | ")}`,
  }
}
