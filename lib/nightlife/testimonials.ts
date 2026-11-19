import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { cleanWikitext } from "../data/wikivoyage"
import { fetchJson } from "./http"
import { NIGHTLIFE_DIR, safeKey, writeJson } from "./store"
import type { City, Testimonial } from "./types"

// Short, attributed excerpts from public travel writing and search snippets.
// This is deliberately not a review scraper: Reddit, TripAdvisor, Yelp and the
// booking sites are skipped because their terms and storage rights are not
// cleared for this feature. Quotes stay short, keep their link, and retain a
// machine-readable publication date when the article exposes one.
const VERSION = "nightlife-testimonials-v6"
const CACHE_DAYS = 30
const MAX_QUOTES = 6
const MAX_QUOTE_CHARS = 260
const PROMO = /(?:click here|book now|sign up|read more|affiliate|advertisement|sponsored|cookie policy|subscribe|newsletter)/i
const NIGHTLIFE = /\b(nightlife|night life|night out|nightclubs?|clubs?|bars?|pubs?|cocktails?|dance|dancing|dj|live music|drinks?|parties|party|scene|vibes?|atmosphere|beer|wine|alcohol|liquor|vodka|neighbou?rhoods?|districts?)\b/i
const OPINION = /\b(I|we|my|our|me|love|loved|like|liked|great|amazing|best|favorite|favourite|worth|fun|recommend|avoid|disappointing|overpriced|touristy|crowded|safe|unsafe|friendly|rude|vibrant|quiet|expensive|cheap)\b/i
const POSITIVE = /\b(love|loved|amazing|great|best|favorite|favourite|worth|fun|recommend|friendly|vibrant|excellent|unforgettable|safe)\b/i
const NEGATIVE = /\b(avoid|dangerous|unsafe|overpriced|touristy|disappointing|bad|worst|crowded|scam|rude|dirty|not worth|expensive)\b/i
const keyOf = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

interface WvPage { parse?: { title?: string; wikitext?: string } }
async function wikivoyageNotes(city: City): Promise<Testimonial[]> {
  const titles = [...new Set([city.city, `${city.city} City`, `${city.city} (${city.country})`, city.country])]
  for (const title of titles) {
    try {
      const data = await fetchJson<WvPage>(
        `https://en.wikivoyage.org/w/api.php?action=parse&redirects=1&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`,
        {}, { timeoutMs: 10000, retries: 0, operation: "Wikivoyage city guide" }
      )
      const raw = data.parse?.wikitext ?? "", pageTitle = data.parse?.title
      if (!raw || !pageTitle) continue
      // Fetch the whole page and slice the Drink section, including its
      // neighbourhood subsections. The section API returns only the parent
      // paragraph, which dropped the best nightlife-neighbourhood advice.
      const heading = raw.match(/^==+\s*(drink|nightlife|bars|clubs|go out|drink and nightlife|pubs and bars)\s*==+\s*$/im)
      if (!heading?.index) continue
      const marker = (heading[0].match(/^=+/) ?? ["=="])[0].length
      const rest = raw.slice(heading.index + heading[0].length)
      const next = rest.search(new RegExp(`^={1,${marker}}\\s*[^=]`, "m"))
      const section = rest.slice(0, next < 0 ? undefined : next)
      const url = `https://en.wikivoyage.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}#${heading[1].replace(/\s+/g, "_")}`
      const prose = extractTestimonials(cleanWikitext(section), "Wikivoyage", url, null, "travel guide", false)
      // Listing-only sections ("Drink" with {{drink|content=...}}) have useful
      // editor notes but no prose after templates are stripped. Read the
      // content fields too, still as short attributed excerpts.
      const listings = [...section.matchAll(/\{\{\s*drink\b([\s\S]*?)\n\}\}/gi)].flatMap(match => {
        const content = match[1].match(/\|\s*content\s*=\s*([^\n}]+)/i)?.[1]
        return content ? extractTestimonials(cleanWikitext(content), "Wikivoyage", url, null, "travel guide", false) : []
      })
      const notes = [...prose, ...listings]
      if (notes.length) return notes.slice(0, 40)
    } catch { /* Try the next title. */ }
  }
  return []
}

export function testimonialSentiment(text: string): Testimonial["sentiment"] {
  const positive = POSITIVE.test(text), negative = NEGATIVE.test(text)
  return positive && negative ? "mixed" : positive ? "positive" : negative ? "negative" : "mixed"
}

export function extractTestimonials(text: string, source: string, url: string, publishedAt: string | null, kind: Testimonial["kind"], requireOpinion = true): Testimonial[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
  const out: Testimonial[] = []
  const seen = new Set<string>()
  for (const raw of sentences) {
    let sentence = raw.trim().replace(/^["“”'']+|["“”'']+$/g, "")
      .replace(/•/g, " ")
      .replace(/\bthumb\b\s*\|\s*\d+px\s*\|?/gi, " ")
      .replace(/\b(?:File|Image|Category):[^\s]+/gi, " ")
      .replace(/^(?:(?:drink|nightlife|bars?|clubs?|go out|coffee\/tea|alcohol|beer|vodka|liqueurs?)\s*:\s*)+/i, "")
      .replace(/^[A-Z][A-Za-z0-9 /&'()-]{2,60}:\s*/, "")
      .replace(/\s+/g, " ").trim()
    const label = sentence.match(/\b(?:beer|wine|vodka|alcohol|liquor|drinks?|nightlife|bars?|clubs?):\s*/i)
    if (label?.index != null) sentence = sentence.slice(label.index + label[0].length).trim()
    if (sentence.length < (kind === "travel guide" ? 35 : 55) || sentence.length > 700) continue
    if (kind === "travel guide" && /^other\b/i.test(sentence)) continue
    if (!NIGHTLIFE.test(sentence) || (requireOpinion && !OPINION.test(sentence)) || PROMO.test(sentence)) continue
    if (/https?:\/\/|@\w+\.\w+|\bthumb\b|\bFile:/i.test(sentence)) continue
    if (sentence.length > MAX_QUOTE_CHARS) {
      const cut = sentence.slice(0, MAX_QUOTE_CHARS)
      sentence = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 120)).trim()}…`
    }
    const dedupe = keyOf(sentence)
    if (!dedupe || seen.has(dedupe)) continue
    seen.add(dedupe)
    out.push({
      id: `testimonial-${createHash("sha256").update(`${url}\n${sentence}`).digest("hex").slice(0, 20)}`,
      quote: sentence,
      source,
      url,
      publishedAt,
      sentiment: testimonialSentiment(sentence),
      kind,
    })
  }
  return out
}

function rank(testimonial: Testimonial) {
  return (/\b(I|we|my|our|me)\b/i.test(testimonial.quote) ? 3 : 0)
    + (/\b(love|loved|best|worth|recommend|avoid|overpriced|touristy|fun|favorite|favourite|famous|iconic|fabulous)\b/i.test(testimonial.quote) ? 2 : 0)
    + (testimonial.kind === "article" ? 2 : testimonial.kind === "travel guide" ? 1 : 0)
    + (testimonial.publishedAt ? 1 : 0)
}

export async function collectTestimonials(city: City, force = false): Promise<{ testimonials: Testimonial[]; fetchedAt: string | null; errors: string[] }> {
  const file = path.join(NIGHTLIFE_DIR, "raw", safeKey(city.key), "testimonials.json")
  try {
    const old = JSON.parse(await fs.readFile(file, "utf8"))
    if (!force && old.version === VERSION && !old.errors?.length && Number.isFinite(Date.parse(old.fetchedAt)) && Date.now() - Date.parse(old.fetchedAt) < CACHE_DAYS * 86400000) return old
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error }

  const quotes: Testimonial[] = await wikivoyageNotes(city)
  const errors: string[] = []

  // Keep the best six, at most two per publication, so one article cannot
  // become the whole testimonial section.
  const perSource = new Map<string, number>()
  const testimonials = [...quotes].sort((a, b) => rank(b) - rank(a)).filter(item => {
    const limit = item.source === "Wikivoyage" ? 4 : 2
    const count = perSource.get(item.source) ?? 0
    if (count >= limit) return false
    perSource.set(item.source, count + 1)
    return true
  }).slice(0, MAX_QUOTES)

  const fetchedAt = testimonials.length ? new Date().toISOString() : null
  if (testimonials.length) await writeJson(file, { version: VERSION, fetchedAt, testimonials, errors })
  return { testimonials, fetchedAt, errors: testimonials.length ? [] : [...errors, "No suitable public testimonials found"] }
}
