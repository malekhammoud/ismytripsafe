// ─────────────────────────────────────────────────────────────────────
// AI resolver for the search long tail.
//
// The local index + geocoder answer ~everything a traveller types. What is
// left is free text that names no place we know: "anywhere warm in
// december", "the capital of chile". For those, ask a small model to map the
// query onto OUR candidate list — the model may only pick real entries (it
// is grounded, so it cannot hallucinate a place that doesn't exist), and the
// answer is cached and rate-capped so a few minutes of typing can't burn the
// daily free-model quota the batch pregenerator shares.
// ─────────────────────────────────────────────────────────────────────

import { candidateNames, findByName, normQuery, type SearchHit } from "./search"
import { withBudget } from "./timing"

const FREE_MODELS = (process.env.OPENROUTER_MODELS ??
  "nvidia/nemotron-3-nano-30b-a3b:free").split(",").map((m) => m.trim())

const CACHE_MAX = 200
const HOURLY_BUDGET = 40
/**
 * Hard wall-clock ceiling for the whole resolve, whatever the upstream does.
 * The search box already waited 550ms on the local engine before calling
 * here — nobody should wait on a model for longer. (The per-request socket
 * abort below handles the polite case; this catches the rest, e.g. an
 * undici body read that doesn't react to abort().)
 */
const RESOLVE_DEADLINE_MS = Number(process.env.RESOLVE_TIMEOUT_MS ?? 8000)

const cache = new Map<string, SearchHit | null>()
let callsThisHour = 0
let hourStarted = Date.now()

function withinBudget(): boolean {
  if (Date.now() - hourStarted > 3_600_000) {
    hourStarted = Date.now()
    callsThisHour = 0
  }
  return callsThisHour < HOURLY_BUDGET
}

function remember(q: string, hit: SearchHit | null): void {
  cache.set(q, hit)
  if (cache.size > CACHE_MAX) {
    // Map keeps insertion order; evict the oldest.
    cache.delete(cache.keys().next().value as string)
  }
}

/** Extract the model's JSON object, tolerating fences and prose. */
function extractJson(text: string): Record<string, unknown> | null {
  const clean = text.replace(/```(?:json)?/g, "").replace(/[\s\S]*?(\{)/, "$1")
  const start = clean.indexOf("{")
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(clean.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/**
 * Resolve a free-text query to a real destination from our own list.
 * Returns null when the model can't pin it down (or any failure — this is a
 * progressive enhancement, never a blocker). Never takes longer than
 * RESOLVE_DEADLINE_MS: the fallback is null, not a hang.
 */
export async function aiResolvePlace(query: string): Promise<SearchHit | null> {
  const q = normQuery(query)
  if (q.length < 4) return null
  if (cache.has(q)) return cache.get(q) ?? null
  if (!withinBudget()) return null

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !FREE_MODELS.length) return null

  // The budget races the model call and answers null at the deadline even if
  // the upstream is stuck; the call itself keeps running and still lands in
  // the cache (see lib/timing.ts:withBudget).
  const out = await withBudget(modelResolve(q, query, apiKey), RESOLVE_DEADLINE_MS)
  callsThisHour++
  remember(q, out)
  return out
}

/** The upstream round-trip: candidate list + one grounded model call. */
async function modelResolve(q: string, rawQuery: string, apiKey: string): Promise<SearchHit | null> {
  const candidates = await candidateNames(420)
  const system =
    "You map a traveller's free-text query to exactly one destination from a provided list. " +
    'Respond with ONLY a JSON object: {"place": "<exact string from the list>"} if a place on ' +
    'the list clearly matches, otherwise {"place": null}. Ignore filler words like "is it ' +
    'safe", "travelling to", "beach holiday", dates and adjectives. Prefer the most literal ' +
    "reading. Do not invent names that are not on the list."

  const user = `Queries so far are one line each, in the form: query | destination list items separated by commas.\n\nQuery: "${rawQuery}"\n\nDestinations: ${candidates.join(", ")}`

  let out: SearchHit | null = null
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ismytripsafe.com",
          "X-Title": "IsMyTripSafe search",
        },
        body: JSON.stringify({
          model: FREE_MODELS[0],
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0,
          max_tokens: 64,
          response_format: { type: "json_object" },
        }),
      })
      const body = await res.json()
      const text = body?.choices?.[0]?.message?.content
      if (typeof text === "string") {
        const json = extractJson(text)
        const place = json?.place
        if (typeof place === "string" && place.length > 0 && place.length < 64) {
          const hit = await findByName(place, null)
          if (hit) out = hit
        }
      }
    } finally {
      clearTimeout(t)
    }
  } catch {
    // null is the graceful failure state
  }

  return out
}