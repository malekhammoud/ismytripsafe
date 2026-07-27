import type { GeoPoint } from "../types"
import { fetchJson } from "./geo"

// ─────────────────────────────────────────────────────────────────────
// Wikivoyage "Stay safe" intelligence. Wikivoyage's city guides carry a
// traveller-maintained "Stay safe" section — the densest source of
// city-specific safety knowledge on the open web. We pull it via the
// MediaWiki API (free, key-less) and feed it to the research agent as
// background context to verify and build on, with attribution.
// ─────────────────────────────────────────────────────────────────────

export interface WikivoyageSafety {
  /** Cleaned plain text of the "Stay safe" section (truncated). */
  text: string
  /** Canonical page URL for attribution. */
  url: string
  pageTitle: string
}

const WV_TIMEOUT_MS = 6_000
/** Trimmed from 4000: this block is prompt bulk, and time-to-first-token
 *  scales with prompt size. The dossier carries the current picture. */
const WV_MAX_CHARS = 2_000

interface WvSection {
  index: string
  line: string
  level: string
}

interface WvParseSections {
  parse?: { title?: string; sections?: WvSection[] }
}

interface WvParseWikitext {
  parse?: { title?: string; wikitext?: string }
}

/** Strip wiki markup down to readable plain text. */
function cleanWikitext(raw: string): string {
  return (
    raw
      // drop templates ({{...}}, possibly nested one level) & HTML comments
      .replace(/\{\{[^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*\}\}/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // [[target|label]] → label, [[target]] → target
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      // [url label] → label
      .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
      .replace(/\[https?:\/\/[^\]]+\]/g, "")
      // bold/italic quotes
      .replace(/'{2,}/g, "")
      // section headings → keep the text as a paragraph lead
      .replace(/^=+\s*(.*?)\s*=+\s*$/gm, "\n$1:\n")
      // list markers
      .replace(/^\*+\s*/gm, "• ")
      .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

async function findStaySafeSection(
  page: string
): Promise<{ title: string; index: string } | null> {
  const url =
    `https://en.wikivoyage.org/w/api.php?action=parse&redirects=1` +
    `&page=${encodeURIComponent(page)}&prop=sections&format=json&formatversion=2`
  const data = (await fetchJson(url, WV_TIMEOUT_MS)) as WvParseSections
  const sections = data.parse?.sections
  if (!data.parse?.title || !Array.isArray(sections)) return null
  const hit = sections.find((s) => /stay safe/i.test(s.line))
  if (!hit) return null
  return { title: data.parse.title, index: hit.index }
}

/**
 * Fetch the "Stay safe" section for a city (falling back to the country
 * article when the city has no guide). Returns null when neither exists —
 * plenty of smaller places have no Wikivoyage page.
 */
export async function getWikivoyageSafety(
  geo: GeoPoint
): Promise<WikivoyageSafety | null> {
  const candidates = [geo.city, `${geo.city} (${geo.country})`, geo.country]

  // All three candidates in parallel. Walking them in series cost up to 54s
  // (3 pages × 2 chained 9s fetches) on the report's critical path, and the
  // city page — the one we want — is usually the first to answer anyway.
  const resolved = await Promise.all(
    candidates.map(async (page): Promise<WikivoyageSafety | null> => {
      try {
        const section = await findStaySafeSection(page)
        if (!section) return null
        const url =
          `https://en.wikivoyage.org/w/api.php?action=parse&redirects=1` +
          `&page=${encodeURIComponent(section.title)}&section=${section.index}` +
          `&prop=wikitext&format=json&formatversion=2`
        const data = (await fetchJson(url, WV_TIMEOUT_MS)) as WvParseWikitext
        const raw = data.parse?.wikitext
        if (!raw) return null
        const text = cleanWikitext(raw)
        if (text.length < 80) return null // stub sections aren't worth passing on
        return {
          text: text.slice(0, WV_MAX_CHARS),
          url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(section.title.replace(/ /g, "_"))}#Stay_safe`,
          pageTitle: section.title,
        }
      } catch {
        return null
      }
    })
  )

  // Candidate order still expresses preference: city, then disambiguated
  // city, then country.
  return resolved.find((r) => r != null) ?? null
}
