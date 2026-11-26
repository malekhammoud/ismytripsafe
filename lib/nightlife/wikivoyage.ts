import { createHash } from "node:crypto"
import { cleanWikitext } from "../data/wikivoyage"
import { withinBoundary, type Boundary } from "./boundary"
import { fetchJson } from "./http"
import { cached } from "./sources"
import { SourceHttpError } from "./source-errors"
import { distance, normalizeName, venueType } from "./venues"
import type { City, GuidePick, Venue, VenueType } from "./types"

// Wikivoyage is keyless, globally readable and explicitly travel-focused. The
// city guide's Drink/Nightlife section is often the only curated, attributed
// list of bars and clubs for a smaller destination. We keep a short excerpt
// and a link, never the full article, and treat the listing as context rather
// than a rating or a verified review.
const VERSION = "wikivoyage-listings-v1"
const CACHE_DAYS = 30
const MAX_PICKS = 30
const MAX_DESCRIPTION = 360

interface WvPage { parse?: { title?: string; wikitext?: string } }
interface RawListing { kind: string; body: string; start: number }

const NIGHTLIFE_HEADING = /^(drink|nightlife|bars?|clubs?|go out|pubs?|drink and nightlife|nightlife and bars|pubs and bars|bars? (?:and|&) clubs?|nightlife districts?|music venues?|live music)$/i
const STRONG_NIGHTLIFE = /\b(night ?club|cocktail bar|wine bar|sports bar|dive bar|live music|jazz club|karaoke|irish pub|beer garden|taproom|brewery|dance club|disco|casino|hookah|shisha|strip club)\b/i
const EXCLUDE = /\b(hotel|hostel|guest ?house|airport|railway station|train station|bus station|tourist information|visitor cent(?:er|re)|travel agency|car rental|taxi|museum|gallery|church|cathedral|temple|mosque|hospital|pharmacy|bank|atm|police station)\b/i

function text(value: string | undefined) {
  if (!value) return ""
  return cleanWikitext(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 90)).trim()}…`
}

function safeUrl(value: string | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value.trim())
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined
  } catch {
    return undefined
  }
}

function coordinate(value: string | undefined) {
  if (!value) return undefined
  const n = Number(value.replace(/[^\d.+-]/g, ""))
  return Number.isFinite(n) && Math.abs(n) <= 180 ? n : undefined
}

// Split a template body on top-level pipes, respecting nested [[links]] and
// {{templates}}. Wikivoyage listing fields occasionally contain both.
export function splitTemplateParams(body: string): string[] {
  const out: string[] = []
  let current = "", square = 0, curly = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i], next = body[i + 1]
    if (ch === "[" && next === "[") { square++; current += "[["; i++; continue }
    if (ch === "]" && next === "]") { square = Math.max(0, square - 1); current += "]]"; i++; continue }
    if (ch === "{" && next === "{") { curly++; current += "{{"; i++; continue }
    if (ch === "}" && next === "}") { curly = Math.max(0, curly - 1); current += "}}"; i++; continue }
    if (ch === "|" && square === 0 && curly === 0) { out.push(current); current = ""; continue }
    current += ch
  }
  if (current.trim()) out.push(current)
  return out
}

export function templateParams(body: string): Map<string, string> {
  const params = new Map<string, string>()
  for (const part of splitTemplateParams(body)) {
    const eq = part.indexOf("=")
    if (eq < 0) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    const value = part.slice(eq + 1).replace(/\n+/g, " ").trim()
    if (key && value) params.set(key, value)
  }
  return params
}

function templates(raw: string): RawListing[] {
  const out: RawListing[] = []
  for (let i = 0; i < raw.length - 1; i++) {
    if (raw[i] !== "{" || raw[i + 1] !== "{") continue
    const head = raw.slice(i + 2, i + 24).match(/^\s*(drink|listing)\b/i)
    if (!head) continue
    let depth = 0, j = i
    for (; j < raw.length - 1; j++) {
      if (raw[j] === "{" && raw[j + 1] === "{") { depth++; j++; continue }
      if (raw[j] === "}" && raw[j + 1] === "}") { depth--; j++; if (depth === 0) break; continue }
    }
    if (depth !== 0) continue
    const block = raw.slice(i, j + 1)
    const body = block.replace(/^\{\{\s*(?:drink|listing)\b/i, "").replace(/\}\}$/, "")
    out.push({ kind: head[1].toLowerCase(), body, start: i })
    i = j
  }
  return out
}

function headingPathAt(raw: string, index: number): string[] {
  const stack: { level: number; title: string }[] = []
  for (const match of raw.slice(0, index).matchAll(/^(={1,6})\s*(.+?)\s*\1\s*$/gm)) {
    const level = match[1].length
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    stack.push({ level, title: match[2] })
  }
  return stack.map(item => item.title)
}

function nightlifeSection(raw: string, index: number): string | null {
  const path = headingPathAt(raw, index)
  for (let i = path.length - 1; i >= 0; i--) if (NIGHTLIFE_HEADING.test(path[i])) return path[i]
  return null
}

function pickType(name: string, description: string, section: string | null, declared: string | undefined): VenueType {
  // A venue's own name is the strongest signal: "Jazz Club" should not become
  // a cocktail bar just because its description mentions cocktails.
  const named = venueType(name)
  if (named !== "Other") return named
  const mapped = venueType(description)
  if (mapped !== "Other") return mapped
  if (declared && /drink|bar|pub|club|music/i.test(declared)) {
    const fromType = venueType(declared)
    if (fromType !== "Other") return fromType
  }
  if (/club/i.test(section ?? "")) return "Nightclub"
  if (/music/i.test(section ?? "")) return "Live music"
  if (/bar|pub|drink/i.test(section ?? "")) return "Dive / casual bar"
  return "Other"
}

/**
 * Parse nightlife listings from a Wikivoyage city guide. Exported for
 * fixture tests; the network path is `fetchWikivoyage`.
 */
export function parseWikivoyageListings(raw: string, pageTitle: string): GuidePick[] {
  const pageUrl = `https://en.wikivoyage.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`
  const picks: GuidePick[] = []
  const seen = new Set<string>()
  for (const item of templates(raw)) {
    const p = templateParams(item.body)
    const name = text(p.get("name"))
    if (name.length < 2 || name.length > 120) continue
    const section = nightlifeSection(raw, item.start)
    const description = truncate(text(p.get("content")), MAX_DESCRIPTION)
    const address = truncate(text(p.get("address")), 160)
    const combined = `${name} ${description} ${address}`
    // A {{drink}} template is explicit. A generic {{listing}} must sit in a
    // nightlife section or carry a strong nightlife signal in its own text.
    if (item.kind !== "drink" && !section && !STRONG_NIGHTLIFE.test(combined)) continue
    if (EXCLUDE.test(combined)) continue
    if (!description && !address && !p.get("hours") && !p.get("url")) continue
    const lat = coordinate(p.get("lat") ?? p.get("latitude"))
    const lon = coordinate(p.get("long") ?? p.get("lon") ?? p.get("longitude"))
    const key = `${normalizeName(name)}|${lat?.toFixed(3) ?? ""}|${lon?.toFixed(3) ?? ""}|${normalizeName(address)}`
    if (seen.has(key)) continue
    seen.add(key)
    const anchor = (section ?? "Drink").replace(/\s+/g, "_")
    picks.push({
      id: `wv-${createHash("sha256").update(`${pageUrl}#${anchor}\n${name}\n${address}`).digest("hex").slice(0, 20)}`,
      name,
      type: pickType(name, `${description} ${address}`, section, p.get("type")),
      description,
      ...(address ? { address } : {}),
      ...(text(p.get("hours")) ? { hours: truncate(text(p.get("hours")), 100) } : {}),
      ...(text(p.get("price")) ? { price: truncate(text(p.get("price")), 80) } : {}),
      ...(text(p.get("phone")) ? { phone: truncate(text(p.get("phone")), 60) } : {}),
      ...(safeUrl(p.get("url")) ? { url: safeUrl(p.get("url")) } : {}),
      ...(lat != null && lon != null ? { lat, lon } : {}),
      sourceUrl: `${pageUrl}#${anchor}`,
    })
  }
  return picks
    .sort((a, b) => Number(b.lat != null) - Number(a.lat != null) || b.description.length - a.description.length || a.name.localeCompare(b.name))
    .slice(0, MAX_PICKS)
}

/**
 * Guide listings with coordinates can enrich the mapped venue list. With a
 * boundary, any coordinate inside the city qualifies. Without full geometry
 * (the common case when Foursquare geometry is not licensed), only a listing
 * that matches an existing OSM venue by name and proximity is allowed to
 * enrich that record. Unmatched listings stay as attributed guide picks and
 * never become venue counts.
 */
export function listingVenues(picks: GuidePick[], boundary: Boundary | null, osmVenues: Venue[] = []): Venue[] {
  return picks.flatMap(pick => {
    if (pick.lat == null || pick.lon == null || !Number.isFinite(pick.lat) || !Number.isFinite(pick.lon)) return []
    const point = { lat: pick.lat, lon: pick.lon }
    const matched = boundary
      ? withinBoundary(point, boundary)
      : osmVenues.some(venue => distance(venue, point) <= 50 && normalizeName(venue.name) === normalizeName(pick.name))
    if (!matched) return []
    // Only a source marker is merged into an existing OSM record. Guide hours,
    // type and contact fields stay in the attributed guide-pick section so the
    // ODbL venue export is not silently relicensed as CC BY-SA content.
    const tags: Record<string, string> = { "wv:guide": "yes" }
    return [{
      id: `wv-${createHash("sha256").update(`${pick.sourceUrl}\n${pick.name}`).digest("hex").slice(0, 20)}`,
      name: pick.name,
      lat: pick.lat,
      lon: pick.lon,
      type: pick.type,
      hours: pick.hours,
      tags,
      sources: [{ id: "wikivoyage" as const, url: pick.sourceUrl }],
    }]
  })
}

export async function fetchWikivoyage(city: City, force = false) {
  // Do not fall back to the country guide for an ordinary city: a country
  // article can list venues in a different city. City-states such as Singapore
  // are the exception because their city and country guide are the same place.
  const titles = [...new Set([
    city.city,
    `${city.city} (${city.country})`,
    ...(city.city.toLowerCase() === city.country.toLowerCase() ? [city.country] : []),
  ])]
  const result = await cached(city.key, "wikivoyage", CACHE_DAYS, async () => {
    let lastError: unknown = null, sawPage = false
    for (const title of titles) {
      try {
        const data = await fetchJson<WvPage>(
          `https://en.wikivoyage.org/w/api.php?action=parse&redirects=1&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`,
          {},
          { timeoutMs: 10000, retries: 0, operation: "Wikivoyage listings" },
        )
        const raw = data.parse?.wikitext ?? "", pageTitle = data.parse?.title
        if (!raw || !pageTitle) continue
        sawPage = true
        const picks = parseWikivoyageListings(raw, pageTitle)
        if (picks.length) return { picks, pageTitle, url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}` }
      } catch (error) {
        // MediaWiki reports a missing page as HTTP 200 with a missingtitle
        // error document. That is a coverage answer, not an outage.
        if (error instanceof SourceHttpError && ([400, 404].includes(error.status) || ["missingtitle", "invalidtitle"].includes(error.code ?? ""))) continue
        lastError = error
      }
    }
    // A page that exists but has no structured listings is a coverage answer.
    // Only an outage with no readable page at all is a source error.
    if (!sawPage && lastError) throw lastError
    return { picks: [] as GuidePick[], pageTitle: null as string | null, url: null as string | null }
  }, force, `wikivoyage-listings-${VERSION}:${city.wikidataId ?? city.key}`)
  const count = result.data.picks.length
  return {
    ...result.data,
    source: {
      ...result.source,
      note: count
        ? `${count} curated nightlife listings from ${result.data.pageTitle ?? "the city guide"}. Short attributed excerpts, not a review average.`
        : "No structured nightlife listings were found in the available Wikivoyage guide.",
    },
  }
}
