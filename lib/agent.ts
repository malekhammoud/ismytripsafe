import { spawn } from "child_process"
import { tmpdir } from "os"
import type { SafetyBundle, GeoPoint, StreamEvent, SafetyEnrichment } from "./types"
import type { WikivoyageSafety } from "./data/wikivoyage"
import { timeLog } from "./timing"
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
// a model tool loop.
//
// Ordered FASTEST-first, not strongest-first: the whole report budget is ~10s
// and the model is most of it. Measured on a report-sized prompt —
//   nemotron-3-nano-30b   4.9s to first token, 195 tok/s   ← primary
//   nemotron-3-super-120b 4.5s to first token,  ~90 tok/s
//   gemma-4-26b-a4b      16.1s to first token,   45 tok/s   ← last resort
// The old primary (nemotron-3-ultra-550b) took 14s to first token and ran at
// 28 tok/s — ~45s for one report on its own. gpt-oss-20b:free was also in this
// list and is now gone: it only streams `delta.reasoning`, never `delta.content`,
// so it can never satisfy the parser and just burned a slot.
const DEFAULT_MODELS = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
]

const LLM_DEADLINE_MS = 45_000 // whole-chain ceiling; the target for one report is <10s
const STALL_TIMEOUT_MS = 12_000 // abort a model that stops sending chunks
// A model that streams only reasoning deltas and never any content can't
// produce a usable report. The timer only starts once we've seen the stream is
// alive, and it is generous: these are reasoning models, and a long think that
// ends in good output is still a win over falling through to a slower model.
const NO_CONTENT_TIMEOUT_MS = 25_000


// Shared grounding preamble for both model calls. Kept in one place so the
// zones pass can't drift from the core pass on what counts as evidence.
const GROUNDING = `You are a travel-safety analyst. Your ONE job: tell a traveler whether a place is safe, and why. Stay focused on personal safety — not flights, hotels, food or attractions.

You will receive a REAL, multi-database safety profile (World Bank crime & governance indicators, live air quality, nearby-hospital data, seasonal weather, live disaster alerts) AND the official government travel advisories (U.S. State Department, UK FCDO, Canada) pulled straight from those governments' own data feeds. You may also receive the Wikivoyage "Stay safe" section — traveller-maintained background that can be months old: treat it as leads, not current fact. Treat the databases and advisories as ground truth. The official advisory wording is already shown to the user verbatim from the source — do NOT restate, summarize, or invent advisory levels.

You will ALSO receive a LIVE WEB RESEARCH DOSSIER: real, current news headlines, web search results and full-text page extracts gathered moments ago specifically for this city. This dossier is your window onto the current situation — you cannot search the web yourself, so it is your ONLY source for anything recent.

GROUNDING RULES — non-negotiable:
- NEVER invent an incident, a date, or a publication. Anything dated must come from a dated item in the dossier, copying its real date and real source name.
- Neighborhood names must be real districts of this city — prefer ones the dossier or Wikivoyage actually mentions; fill gaps only with districts you are certain exist.
- If dossier items contradict each other, trust the more recent, more local source.
- If the dossier is thin or empty, be conservative: lean on the database profile and never fabricate currency ("as of this month…") you do not have.`

// ── Call A: everything the report page renders. On the critical path, so it
// is kept deliberately small — district-by-district zone ratings (the single
// largest chunk of the old output) moved to call B below.
const SYSTEM_PROMPT = `${GROUNDING}

Use the dossier for: recent incidents and crime trends; street-crime specifics (robbery/mugging and pickpocketing/bag-snatching risk for a visitor); how safe visitors actually feel day-to-day; scams that target visitors; and practical safety advice.

CRITICAL: Output a single JSON block in EXACTLY this format, then a prose briefing:

START_SAFETY
{
  "verdict": "One direct sentence answering 'is it safe?' — e.g. 'Yes — Lisbon is one of Europe's safest capitals for visitors.'",
  "summary": "2-3 sentences interpreting the real safety data for a traveler.",
  "scams": ["common scam targeting visitors", "another"],
  "tips": ["specific actionable safety tip", "another", "another"],
  "robbery": { "level": "Low|Moderate|High|Severe", "note": "one line on mugging/armed-robbery risk to visitors and where it happens" },
  "pickpocket": { "level": "Low|Moderate|High|Severe", "note": "one line on pickpocketing/bag-snatching risk and the hotspots" },
  "consumerSentiment": { "score": 0-100, "label": "short label e.g. 'Mostly positive'", "summary": "1-2 sentences on how safe visitors report feeling day-to-day, from recent traveller reports" },
  "recentIncidents": [
    { "when": "Jun 2026", "what": "one line: a real recent incident, trend or development relevant to visitor safety", "source": "publication or site name" }
  ]
}
END_SAFETY

For "level" use exactly one of: Low, Moderate, High, Severe. For "score" use a number 0-100. For "recentIncidents" list 2-4 REAL, dated items from the dossier, most recent first ("when" is a month + year); use [] if genuinely nothing notable.

Keep the JSON tight — it is what the reader waits on. Then write a focused 3-4 paragraph safety briefing: the bottom-line verdict, what the data means on the ground, the real current situation (cite what the dossier found, with source names and dates), and how to stay safe. Be specific and honest — do not sugar-coat genuine risks, and do not exaggerate for safe places.

Do NOT re-rate individual neighbourhoods in the prose — district ratings render on a separate page. Do NOT quote the numeric composite index in the prose: the published score is recomputed after your research lands and may differ. Output the JSON block and briefing directly with no preamble.`

// ── Call B: the map page's district ratings. Runs after the report has already
// been delivered, so it never costs the reader a second.
const ZONES_SYSTEM_PROMPT = `${GROUNDING}

Your task here is ONLY district-by-district ratings for the map page. No prose, no briefing, no preamble — output the JSON block and nothing else.

START_SAFETY
{
  "mapZones": [
    { "name": "specific real district/neighbourhood name", "level": "safe|caution|avoid", "note": "one line: why it's this level for a visitor" }
  ],
  "safeAreas": ["District A", "District B", "District C"],
  "avoidAreas": ["Area to avoid (with why, briefly)", "another"],
  "watchOuts": ["specific thing to watch out for in this city right now (incl. any seasonal weather hazard)", "another", "another"]
}
END_SAFETY

For "mapZones" list 5-8 REAL, individually named districts/neighbourhoods of this specific city (not the whole country) that can be found on a map, each rated "safe" (green), "caution" (yellow — okay but stay alert / avoid after dark) or "avoid" (red). Include a mix of levels where the city warrants it. "safeAreas" and "avoidAreas" must agree with your own mapZones ratings.`

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
${s.saferThanPct != null ? `Safer than ~${s.saferThanPct}% of countries\n` : ""}${
    s.pillars?.length
      ? `Hazard-family scores (0–100, 100 = safest): ${s.pillars
          .filter((p) => p.score != null)
          .map((p) => `${p.label} ${p.score}${p.imputed ? " (estimated)" : ""}`)
          .join(" · ")}\n`
      : ""
  }${
    s.caps?.length
      ? `Score is capped at ${s.caps[0].max} because: ${s.caps[0].reason}\n`
      : ""
  }
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

/**
 * Search + crawl into a dossier. Nothing here depends on the safety bundle, so
 * the route kicks this off in parallel with the database gather rather than
 * waiting for it — see app/api/research/route.ts. Progress is reported through
 * `onQuery` instead of yielded, because the caller is no longer a generator.
 */
export async function collectResearch(
  geo: GeoPoint,
  onQuery: (query: string) => void = () => {}
): Promise<ResearchDossier> {
  const dossier: ResearchDossier = { headlines: [], webResults: [], extracts: [] }
  const plan = buildQueryPlan(geo)

  for (const q of [...plan.news, ...plan.web]) onQuery(q.replace(/"/g, ""))

  try {
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
      onQuery(`Reading ${new URL(r.url).hostname.replace(/^www\./, "")}…`)
    }
    const extracts = await Promise.all(toCrawl.map((r) => fetchArticle(r.url)))
    dossier.extracts.push(...extracts.filter((e): e is NonNullable<typeof e> => e != null))
  } catch {
    // research is best-effort; the prompts say how to behave with a thin dossier
  }
  return dossier
}

// ─── OpenRouter streaming ───────────────────────────────────────────

function getModels(): string[] {
  const env = process.env.OPENROUTER_MODELS
  if (env) return env.split(",").map((m) => m.trim()).filter(Boolean)
  return DEFAULT_MODELS
}

// Paid models, for when the free pool is spent. These bill per token instead of
// drawing on the free daily allowance, so they are unaffected by the 429 that
// takes the free tier out once a day.
//
// Gemini 2.5 Flash Lite is both the fastest thing measured on the real prompt
// and among the cheapest: 0.6s to first token, whole report in 2.4s — quicker
// than the free models it stands in for, and ~$0.0007 per report.
const DEFAULT_PAID_MODELS = ["google/gemini-2.5-flash-lite"]

function getPaidModels(): string[] {
  const env = process.env.OPENROUTER_PAID_MODELS
  if (env) return env.split(",").map((m) => m.trim()).filter(Boolean)
  return DEFAULT_PAID_MODELS
}

/**
 * When OpenRouter's *daily* free-model allowance is gone, every model in the
 * chain returns 429 — so each request would spend three round-trips learning
 * what the first one already told us. The 429 body carries the reset time;
 * remember it and skip straight to the fallback until then.
 */
let openRouterBlockedUntil = 0

function openRouterAvailable(): boolean {
  return Date.now() >= openRouterBlockedUntil
}

/** Record a daily-quota 429 so the rest of the day doesn't re-discover it. */
function noteRateLimit(body: string): void {
  if (!/free-models-per-day|openrouter_free_tier_daily/i.test(body)) return
  const reset = Number(body.match(/"X-RateLimit-Reset":"(\d+)"/)?.[1])
  // Fall back to the next UTC midnight if the header isn't where we expect.
  const until = Number.isFinite(reset) && reset > Date.now() ? reset : nextUtcMidnight()
  if (until > openRouterBlockedUntil) {
    openRouterBlockedUntil = until
    const mins = Math.round((until - Date.now()) / 60_000)
    console.log(`[agent] OpenRouter daily free quota exhausted; using fallback for ~${mins} min`)
  }
}

function nextUtcMidnight(): number {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.getTime()
}

/** Stream one OpenRouter completion, yielding accumulated content text. */
async function* streamModel(
  model: string,
  apiKey: string,
  system: string,
  user: string,
  deadline: number,
  maxTokens = 1500
): AsyncGenerator<string> {
  const controller = new AbortController()
  const hardTimer = setTimeout(
    () => controller.abort(),
    Math.max(1, deadline - Date.now())
  )
  let stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS)
  // Some models stream only `delta.reasoning` and never emit any content.
  // Cut them loose quickly rather than letting the stall timer run.
  let sawContent = false
  const noContentTimer = setTimeout(() => {
    if (!sawContent) controller.abort()
  }, NO_CONTENT_TIMEOUT_MS)

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
        max_tokens: maxTokens,
        // The strong free models are hybrid-reasoning: left on, they spend
        // 15-20s and most of the token budget thinking before emitting a
        // single character of content. Measured on the real prompt, turning
        // reasoning off takes the primary from 20.5s to 4.4s end-to-end
        // (first token 0.7s, JSON block closed at 3.5s) with no loss of
        // structure — the prompt already dictates the schema. This is the
        // single biggest lever on report latency.
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "")
      if (res.status === 429) noteRateLimit(detail)
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
        if (content) {
          sawContent = true
          yield content
        }
      }
    }
  } finally {
    clearTimeout(hardTimer)
    clearTimeout(stallTimer)
    clearTimeout(noContentTimer)
  }
}

// ─── Local Claude CLI fallback ──────────────────────────────────────
// The free-model pool runs out once a day. When it does, every remaining
// request used to end at "Couldn't complete the check" — a visitor asking
// whether a city is safe got an error page because of our supply problem.
//
// Claude Code is installed on this box, so it becomes the backstop: same
// system prompt, same dossier, same START_SAFETY contract, so the output flows
// through the identical parser and nothing downstream can tell the difference.
// It needs no tools — the research dossier is already assembled in code and
// passed in the prompt.
//
// This runs ONLY after every free model has failed, so it costs nothing on a
// normal day. It is slower (~30s vs ~5s) and it is not free, which is exactly
// the trade you want for "answer the visitor rather than show them an error".

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude"
/** Cheapest capable model — this is a fallback, not the main path. */
const CLAUDE_MODEL = process.env.CLAUDE_FALLBACK_MODEL || "haiku"
const CLAUDE_TIMEOUT_MS = 120_000

/**
 * Run one prompt through the local Claude CLI, yielding its output. Shaped as
 * a generator so it is interchangeable with `streamModel` — the CLI returns
 * one complete response rather than a token stream, so this yields once.
 */
async function* streamClaudeCli(
  system: string,
  user: string
): AsyncGenerator<string> {
  const text = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      CLAUDE_BIN,
      [
        "-p",
        "--output-format", "text",
        "--model", CLAUDE_MODEL,
        // This is a text-generation call: the dossier is already in the
        // prompt and there is nothing here worth a tool. Lock them off so a
        // travel-safety prompt can never reach the filesystem or the network.
        "--strict-mcp-config",
        "--mcp-config", '{"mcpServers":{}}',
        "--disallowedTools",
        "Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Task",
        "--append-system-prompt", system,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        // Deliberately NOT the repo. Claude Code reads CLAUDE.md from its
        // working directory, and this project's tells it to commit and deploy
        // — instructions that have no business in the context of a prompt
        // asking whether Lisbon is safe.
        cwd: tmpdir(),
        env: { ...process.env, PATH: process.env.PATH ?? "/usr/bin:/root/.local/bin" },
      }
    )

    let out = ""
    let err = ""
    const timer = setTimeout(() => {
      proc.kill("SIGKILL")
      reject(new Error(`claude CLI timed out after ${CLAUDE_TIMEOUT_MS}ms`))
    }, CLAUDE_TIMEOUT_MS)

    proc.stdout.on("data", (d) => (out += d))
    proc.stderr.on("data", (d) => (err += d))
    proc.on("error", (e) => {
      clearTimeout(timer)
      reject(new Error(`claude CLI unavailable: ${e.message}`))
    })
    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) reject(new Error(`claude CLI exited ${code}: ${err.slice(0, 200)}`))
      else if (!out.trim()) reject(new Error("claude CLI returned nothing"))
      else resolve(out)
    })

    // The prompt goes over stdin — it carries the whole dossier and is far too
    // big to be comfortable as an argv entry.
    proc.stdin.write(user)
    proc.stdin.end()
  })

  yield text
}

/**
 * Everything we can try, in order:
 *
 *   1. free OpenRouter models      — the normal path, costs nothing
 *   2. cheap paid models           — when the free daily allowance is spent
 *   3. the local Claude CLI        — last resort, when OpenRouter is unusable
 *
 * Tiers 2 and 3 are for people, not for bulk work: `allowFallback` is false for
 * pregeneration and for background refreshes, so neither ever spends money on
 * something a free model will happily do tomorrow.
 *
 * Tier 2 sits above tier 3 because it is both cheaper and far faster — 2.4s
 * against 55-100s — so the CLI is genuinely a last resort rather than the
 * first thing a visitor falls into.
 */
function buildAttempts(
  apiKey: string | undefined,
  system: string,
  user: string,
  deadline: number,
  maxTokens: number,
  allowFallback = true
): Array<{ label: string; stream: () => AsyncGenerator<string> }> {
  const attempts: Array<{ label: string; stream: () => AsyncGenerator<string> }> = []
  const openRouter = (model: string) => ({
    label: model,
    stream: () => streamModel(model, apiKey!, system, user, deadline, maxTokens),
  })

  if (apiKey && openRouterAvailable()) attempts.push(...getModels().map(openRouter))

  if (allowFallback) {
    // Paid models bill per token rather than drawing on the free allowance, so
    // the daily 429 that disables tier 1 does not apply to them.
    if (apiKey) attempts.push(...getPaidModels().map(openRouter))
    attempts.push({ label: "claude-cli", stream: () => streamClaudeCli(system, user) })
  }
  return attempts
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

/**
 * Index just past the close brace matching the object that starts at `from`,
 * or -1 if it hasn't been streamed yet. String-aware, so braces inside values
 * don't throw off the depth count.
 */
function objectEnd(text: string, from: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return i + 1
  }
  return -1
}

/**
 * Pull the leading JSON object out of a (possibly still-streaming) response.
 * Balances braces rather than waiting for END_SAFETY, so the report unblocks
 * the instant the object closes — models often dawdle before the marker, and
 * some drop it entirely.
 */
function parseJsonBlock(
  text: string
): { data: Record<string, unknown>; proseOffset: number } | null {
  const marker = text.indexOf("START_SAFETY")
  const braceStart = text.indexOf("{", marker === -1 ? 0 : marker)
  if (braceStart === -1) return null

  const end = objectEnd(text, braceStart)
  if (end === -1) return null // object still streaming

  const jsonStr = text
    .slice(braceStart, end)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
  try {
    const data = JSON.parse(jsonStr)
    if (!data || typeof data !== "object" || Array.isArray(data)) return null
    // The prose starts after the object; sanitizeProse strips any trailing
    // END_SAFETY marker, so we don't need to have seen it yet.
    return { data, proseOffset: end }
  } catch {
    return null
  }
}

function parseEnrichment(
  text: string
): { data: SafetyEnrichment; proseOffset: number } | null {
  const hit = parseJsonBlock(text)
  if (!hit || typeof hit.data.verdict !== "string") return null
  return { data: hit.data as unknown as SafetyEnrichment, proseOffset: hit.proseOffset }
}

// ─── The agent ──────────────────────────────────────────────────────

export async function* runSafetyAgent(
  geo: GeoPoint,
  bundle: SafetyBundle,
  wikivoyage: WikivoyageSafety | null = null,
  dossier: ResearchDossier = { headlines: [], webResults: [], extracts: [] },
  allowFallback = true
): AsyncGenerator<StreamEvent> {
  // No key is no longer fatal — the local CLI can still answer.
  const apiKey = process.env.OPENROUTER_API_KEY

  // The dossier is gathered by the route in parallel with the safety bundle
  // (see collectResearch) — by the time we get here it's already done.
  const userPrompt = buildPrompt(geo, bundle, wikivoyage, formatDossier(dossier, new Date()))

  // One free-model completion, falling through the chain on any failure.
  yield { type: "searching", query: "Analyzing findings…" }
  const deadline = Date.now() + LLM_DEADLINE_MS
  const errors: string[] = []

  for (const { label: model, stream } of buildAttempts(
    apiKey,
    SYSTEM_PROMPT,
    userPrompt,
    deadline,
    1500,
    allowFallback
  )) {
    // The CLI fallback runs on its own clock — don't let a spent OpenRouter
    // deadline skip past the one provider that can still answer.
    if (model !== "claude-cli" && Date.now() > deadline - 5_000) continue

    let accumulated = ""
    let enrichment: { data: SafetyEnrichment; proseOffset: number } | null = null
    let prevProseLength = 0
    let emittedProse = false
    const modelStart = Date.now()
    let firstChunkAt = 0

    try {
      for await (const chunk of stream()) {
        accumulated += chunk
        if (!firstChunkAt) {
          firstChunkAt = Date.now()
          timeLog("llm.ttft", firstChunkAt - modelStart, model)
        }
        const clean = stripThink(accumulated)

        // Fire as soon as the JSON object closes — don't wait for END_SAFETY.
        if (!enrichment && clean.includes("}")) {
          enrichment = parseEnrichment(clean)
          if (enrichment) {
            timeLog("llm.json", Date.now() - modelStart, model)
            yield { type: "enrichment", data: enrichment.data }
          }
        }
        if (enrichment) {
          const prose = sanitizeProse(clean.slice(enrichment.proseOffset))
          const flushable = Math.max(0, prose.length - PROSE_HOLDBACK)
          if (flushable > prevProseLength) {
            const delta = prose.slice(prevProseLength, flushable)
            // Only the blank run between the JSON block and the first real
            // character may be dropped. A whitespace-only delta *inside* the
            // prose is a real space: skipping it while still advancing the
            // cursor silently fuses words together ("centre'smain plazas").
            if (emittedProse) {
              yield { type: "text", content: delta }
              prevProseLength = flushable
            } else if (delta.trim()) {
              yield { type: "text", content: delta.replace(/^\s+/, "") }
              emittedProse = true
              prevProseLength = flushable
            } else {
              prevProseLength = flushable // leading blank run — safe to drop
            }
          }
        }
      }

      // stream ended cleanly — flush the held-back tail of the prose
      if (enrichment) {
        const prose = sanitizeProse(stripThink(accumulated).slice(enrichment.proseOffset))
        if (prose.length > prevProseLength) {
          const tail = prose.slice(prevProseLength).trimEnd()
          const delta = emittedProse ? tail : tail.replace(/^\s+/, "")
          if (delta) yield { type: "text", content: delta }
        }
      }
    } catch (err) {
      errors.push(String(err))
      timeLog("llm.abort", Date.now() - modelStart, `${model} ${String(err).slice(0, 60)}`)
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
      timeLog("llm.total", Date.now() - modelStart, model)
      yield { type: "done" }
      return
    }
    timeLog("llm.unparseable", Date.now() - modelStart, model)
    errors.push(`${model}: finished without a parseable START_SAFETY block`)
  }

  yield {
    type: "error",
    message: `All research models failed. ${errors.slice(-2).join(" | ")}`,
  }
}

// ─── Deferred pass: district ratings for the map page ────────────────

/** The slice of the enrichment produced by the second, off-critical-path call. */
export type ZonesResult = Pick<
  SafetyEnrichment,
  "mapZones" | "safeAreas" | "avoidAreas" | "watchOuts"
>

/**
 * District-by-district ratings. These render only on the map page and the SEO
 * city page — never on the report the user is waiting for — so they are
 * generated *after* the report has been delivered and merged into the cached
 * record. Returns null if every model fails; callers degrade to no zones.
 */
export async function generateMapZones(
  geo: GeoPoint,
  bundle: SafetyBundle,
  wikivoyage: WikivoyageSafety | null,
  dossier: ResearchDossier,
  allowFallback = true
): Promise<ZonesResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const userPrompt = buildPrompt(geo, bundle, wikivoyage, formatDossier(dossier, new Date()))
  const deadline = Date.now() + LLM_DEADLINE_MS

  for (const { label: model, stream } of buildAttempts(
    apiKey,
    ZONES_SYSTEM_PROMPT,
    userPrompt,
    deadline,
    1200,
    allowFallback
  )) {
    if (model !== "claude-cli" && Date.now() > deadline - 5_000) continue
    let accumulated = ""
    try {
      for await (const chunk of stream()) {
        accumulated += chunk
      }
    } catch {
      // fall through to the next provider
    }

    const hit = parseJsonBlock(stripThink(accumulated))
    if (hit && Array.isArray(hit.data.mapZones)) {
      return {
        mapZones: hit.data.mapZones as ZonesResult["mapZones"],
        safeAreas: (hit.data.safeAreas as string[]) ?? [],
        avoidAreas: (hit.data.avoidAreas as string[]) ?? [],
        watchOuts: (hit.data.watchOuts as string[]) ?? [],
      }
    }
  }
  return null
}
