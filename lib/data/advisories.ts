import type { GeoPoint, OfficialAdvisory } from "../types"
import {
  englishCountryName,
  countryNameVariants,
  normalizeCountryName,
} from "./country"

// ─────────────────────────────────────────────────────────────────────
// Official government travel advisories, pulled DIRECTLY from the issuing
// governments' own data feeds — no AI, no web search. Two independent
// sources, each free and key-less:
//   • U.S. Department of State — Travel Advisories RSS (Level 1–4, all
//     countries in a single feed).
//   • UK FCDO — per-country travel-advice content API (structured
//     alert_status + summary text).
// ─────────────────────────────────────────────────────────────────────

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TravelAI/1.0 (travel safety research)" },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// ─── U.S. State Department ───────────────────────────────────────────

const STATE_DEPT_RSS = "https://travel.state.gov/_res/rss/TAsTWs.xml"

/** Strip HTML tags / entities and collapse whitespace into plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function firstSentences(text: string, max = 2): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  return parts.slice(0, max).join(" ")
}

interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  for (const block of blocks) {
    const tag = (name: string): string => {
      const m = block.match(
        new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i")
      )
      if (!m) return ""
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
    }
    items.push({
      title: tag("title"),
      link: tag("link"),
      description: tag("description"),
      pubDate: tag("pubDate"),
    })
  }
  return items
}

/** US advisory title → e.g. "Kuwait - Level 3: Reconsider Travel". */
function parseStateTitle(
  title: string
): { country: string; level: number; label: string } | null {
  const m = title.match(/^(.*?)\s*[-–]\s*Level\s*(\d)\s*:\s*(.*)$/i)
  if (!m) return null
  // Some titles read "Mexico Travel Advisory - Level 2: …" — strip that suffix.
  const country = m[1].replace(/\s*Travel\s+(Advisory|Warning)\s*$/i, "").trim()
  return { country, level: Number(m[2]), label: m[3].trim() }
}

async function fetchStateDept(iso2: string): Promise<OfficialAdvisory | null> {
  const xml = await fetchText(STATE_DEPT_RSS, 8000)
  if (!xml) return null

  const variants = countryNameVariants(iso2)
  if (variants.size === 0) return null

  for (const item of parseRssItems(xml)) {
    const parsed = parseStateTitle(item.title)
    if (!parsed) continue
    if (!variants.has(normalizeCountryName(parsed.country))) continue

    return {
      source: "U.S. Department of State",
      sourceShort: "US",
      level: parsed.level,
      levelLabel: parsed.label,
      headline: `Level ${parsed.level}: ${parsed.label}`,
      summary: firstSentences(stripHtml(item.description), 2),
      url: item.link,
      updated: item.pubDate || null,
    }
  }
  return null
}

// ─── UK Foreign, Commonwealth & Development Office ───────────────────

interface FcdoContent {
  details?: {
    alert_status?: string[]
    change_description?: string
    parts?: Array<{ title: string; slug: string; body: string }>
    updated_at?: string
    reviewed_at?: string
  }
  updated_at?: string
}

/** Turn a country name into the FCDO URL slug ("United States" → "usa" etc.). */
function fcdoSlug(iso2: string, name: string): string {
  const overrides: Record<string, string> = {
    US: "usa",
    GB: "uk",
    AE: "united-arab-emirates",
    MM: "myanmar-burma",
    CD: "democratic-republic-of-the-congo",
    CG: "congo",
    KR: "south-korea",
    KP: "north-korea",
    CI: "ivory-coast",
  }
  if (overrides[iso2]) return overrides[iso2]
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Map FCDO structured alert codes to a human label + ordinal severity.
 *
 * The FCDO distinguishes warnings that cover the whole country from warnings
 * that cover parts of it ("to parts" statuses), and that difference matters
 * enormously to a traveller: "advise against all travel to the country" and
 * "advise against all travel to parts of the country" are not the same
 * rating. Here a parts-scoped "all travel" warning is graded 3 — the same
 * severity as "all but essential travel" — because both are severe
 * but scoped, while a country-wide one is a genuine 4.
 */
function fcdoAlert(status: string[]): { label: string; rank: number } {
  const s = status.join(" ")
  const all = /advise_against_all_travel|avoid_all_travel/.test(s)
  const essential = /all_but_essential/.test(s)
  const parts = /to_parts|in_parts|localis|localiz/.test(s)
  if (all && !parts)
    return { label: "Advises against all travel", rank: 4 }
  if (parts && (all || essential))
    return { label: "Advises against all travel to parts of the country", rank: 3 }
  if (essential)
    return { label: "Advises against all-but-essential travel", rank: 3 }
  if (status.length > 0)
    return { label: "Active warnings in place", rank: 2 }
  return { label: "No advisory against travel", rank: 1 }
}

async function fetchFCDO(iso2: string): Promise<OfficialAdvisory | null> {
  const name = englishCountryName(iso2)
  if (!name) return null
  const slug = fcdoSlug(iso2, name)
  const raw = await fetchText(
    `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`,
    7000
  )
  if (!raw) return null

  let data: FcdoContent
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const det = data.details
  if (!det) return null

  const alert = fcdoAlert(det.alert_status ?? [])

  // Prefer the "Warnings and insurance" section body for the summary text.
  const warn = det.parts?.find((p) => /warning/i.test(p.title))
  const summarySrc = warn?.body || det.change_description || ""
  const summary =
    firstSentences(stripHtml(summarySrc), 2) ||
    det.change_description ||
    alert.label

  return {
    source: "UK Foreign Office (FCDO)",
    sourceShort: "UK",
    level: alert.rank,
    levelLabel: alert.label,
    headline: alert.label,
    summary,
    url: `https://www.gov.uk/foreign-travel-advice/${slug}`,
    updated: det.updated_at || data.updated_at || det.reviewed_at || null,
  }
}

// ─── Government of Canada ────────────────────────────────────────────

const CANADA_JSON =
  "https://data.international.gc.ca/travel-voyage/index-alpha-eng.json"

interface CanadaEntry {
  "country-iso"?: string
  "advisory-state"?: number
  "date-published"?: { asp?: string; date?: string }
  eng?: { name?: string; "url-slug"?: string; "advisory-text"?: string }
}

/** Canada's advisory-state runs 0–3; map onto the familiar 1–4 scale. */
const CANADA_LABEL: Record<number, string> = {
  0: "Exercise normal security precautions",
  1: "Exercise a high degree of caution",
  2: "Avoid non-essential travel",
  3: "Avoid all travel",
}

async function fetchCanada(iso2: string): Promise<OfficialAdvisory | null> {
  const raw = await fetchText(CANADA_JSON, 9000)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { data?: Record<string, CanadaEntry> }
    const entry = parsed.data?.[iso2]
    if (!entry || entry["advisory-state"] == null) return null
    const state = entry["advisory-state"]
    const label = entry.eng?.["advisory-text"] || CANADA_LABEL[state] || "See advisory"
    const slug = entry.eng?.["url-slug"]
    return {
      source: "Government of Canada",
      sourceShort: "CA",
      level: state + 1, // 0–3 → 1–4, aligned with the US scale
      levelLabel: label,
      headline: label,
      summary: `Canada's official risk level for ${entry.eng?.name ?? iso2}: ${label.toLowerCase()}.`,
      url: slug
        ? `https://travel.gc.ca/destinations/${slug}`
        : "https://travel.gc.ca/travelling/advisories",
      updated: entry["date-published"]?.asp || entry["date-published"]?.date || null,
    }
  } catch {
    return null
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Fetch official government travel advisories for a place, straight from the
 * issuing governments' data feeds. Three independent sources (US, UK, Canada)
 * run in parallel; any that fail are simply omitted (never blocks the others).
 */
export async function getOfficialAdvisories(
  geo: GeoPoint
): Promise<OfficialAdvisory[]> {
  const iso2 = geo.countryCode.toUpperCase()
  const results = await Promise.allSettled([
    fetchStateDept(iso2),
    fetchFCDO(iso2),
    fetchCanada(iso2),
  ])
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((a): a is OfficialAdvisory => a != null)
}
