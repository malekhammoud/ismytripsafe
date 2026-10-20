import { promises as fs } from "node:fs"
import path from "node:path"
import { distance, venueType } from "./venues"
import { boundaryFromMembers } from "./boundary"
import { fetchJson } from "./http"
import { SourceUnavailable, sourceFailure } from "./source-errors"
import { RESOLUTION_VERSION } from "./city-resolution"
import { lookupCity } from "./wikidata"
export { fetchJson } from "./http"
export { latestPopulation } from "./city-resolution"
import { NIGHTLIFE_DIR, safeKey, writeJson } from "./store"
import type { BeerPrices, City, Mention, NightEvent, Source, SourceId, Venue } from "./types"
const DAY = 86400000
export const SOURCE_INFO: Record<SourceId, Pick<Source, "name" | "url" | "licence">> = {
  osm: { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", licence: "ODbL 1.0 · © OpenStreetMap contributors" },
  wikidata: { name: "Wikidata", url: "https://www.wikidata.org", licence: "CC0 structured data" },
  foursquare: { name: "Foursquare", url: "https://docs.foursquare.com/fsq-developers-places/reference/place-search", licence: "Contract required for durable storage and derived publication" },
  ticketmaster: { name: "Ticketmaster", url: "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/", licence: "Discovery API terms; linked event listings" },
  numbeo: { name: "Numbeo", url: "https://www.numbeo.com/api/doc.jsp", licence: "Licensed Data API; attribution required" },
  reddit: { name: "Reddit", url: "https://redditinc.com/policies/data-api-terms", licence: "Commercial and analysis rights required" },
  blogs: { name: "Travel blogs", url: "https://ismytripsafe.com/methodology", licence: "Original links and short derived themes only; no republished text" },
  safety: { name: "IsMyTripSafe", url: "https://ismytripsafe.com/methodology", licence: "Internal safety report" },
}
export function unavailable(id: SourceId, note: string): Source { return { id, ...SOURCE_INFO[id], fetchedAt: null, status: "unavailable", note } }
export async function cached<T>(key: string, id: SourceId, days: number, get: () => Promise<T>, force = false, identity?: string): Promise<{ data: T; source: Source }> {
  const file = path.join(NIGHTLIFE_DIR, "raw", safeKey(key), `${id}.json`)
  let previous: { fetchedAt: string; data: T; identity?: string } | null = null
  try { previous = JSON.parse(await fs.readFile(file, "utf8")) } catch (e) { if (!(e instanceof SyntaxError) && (e as NodeJS.ErrnoException).code !== "ENOENT") throw e }
  if (previous && (previous.identity !== identity || !Number.isFinite(Date.parse(previous.fetchedAt)))) previous = null
  if (previous && !force && Date.now() - Date.parse(previous.fetchedAt) < days * DAY) return { data: previous.data, source: { id, ...SOURCE_INFO[id], fetchedAt: previous.fetchedAt, status: "ok", note: "Stored source response." } }
  try {
    const data = await get(), fetchedAt = new Date().toISOString()
    // Never save URLs containing API keys or authentication headers.
    await writeJson(file, { fetchedAt, data, ...(identity ? { identity } : {}) })
    return { data, source: { id, ...SOURCE_INFO[id], fetchedAt, status: "ok", note: "Fetched successfully." } }
  } catch (e) {
    if (previous) return { data: previous.data, source: { id, ...SOURCE_INFO[id], fetchedAt: previous.fetchedAt, status: "error", note: "Refresh failed; retained the last successful response and its original date.", failure: sourceFailure(e) } }
    throw e
  }
}
export async function resolveCity(seed: City, force = false, interactive = false) {
  return cached(seed.key, "wikidata", 180, () => lookupCity(seed, interactive), force, `city-resolution-${RESOLUTION_VERSION}`)
}
interface OsmElement { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] }
export async function fetchOsm(city: City, force = false) {
  if (!city.wikidataId || !/^Q\d+$/.test(city.wikidataId)) throw new SourceUnavailable("A verified city identity is needed before mapping venues.")
  const endpoint = process.env.OVERPASS_URL || "https://overpass.private.coffee/api/interpreter"
  const selection = city.relationId ? `rel(${city.relationId});` : `rel[boundary=administrative][wikidata="${city.wikidataId}"];`
  // The boundary and the venues share one query; map_to_area avoids assuming
  // an unverified radius is equivalent to a city's population boundary.
  const query = `[out:json][timeout:55];${selection}out geom;map_to_area->.city;(nwr(area.city)[amenity~"^(bar|pub|nightclub|biergarten|music_venue)$"];nwr(area.city)[amenity=restaurant][bar=yes];);out center tags;`
  const verify = (raw: { elements: OsmElement[]; remark?: string }) => {
    if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass returned an incomplete query")
    const matches = raw.elements.filter(e => e.type === "relation" && e.tags?.boundary === "administrative" && e.tags.wikidata === city.wikidataId && (!city.relationId || e.id === city.relationId))
    if (matches.length !== 1) throw new SourceUnavailable("A single matching city boundary is not available in OpenStreetMap.")
    return matches[0]
  }
  const result = await cached(city.key, "osm", 30, async () => {
    const raw = await fetchJson<{ elements: OsmElement[]; remark?: string }>(endpoint, { method: "POST", body: new URLSearchParams({ data: query }) }, { timeoutMs: 65000, retryDelayMs: 30000 })
    verify(raw)
    return raw
  }, force, `osm-v2:${city.wikidataId}:${city.relationId ?? "discover"}`)
  const boundary = verify(result.data)
  const venues: Venue[] = result.data.elements.filter(e => e !== boundary).flatMap(e => {
    const t = e.tags ?? {}, loc = e.center ?? { lat: e.lat, lon: e.lon }
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lon) || !t.name || t.disused === "yes" || t.abandoned === "yes" || t.closed === "yes" || t.opening_hours === "closed" || t.opening_hours === "off") return []
    let hint = t.amenity
    if (t["bar:type"]) hint = t["bar:type"]
    if (t.microbrewery === "yes" || t.brewery === "yes") hint = "brewery"
    if (t.live_music === "yes" || (t.music && /live|jazz/.test(t.music))) hint = "live music"
    if (t.lgbtq === "primary" || t["gay:men"] === "primary" || t["gay:women"] === "primary") hint = "lgbtq bar"
    return [{ id: `osm-${e.type}-${e.id}`, name: t.name, lat: loc.lat!, lon: loc.lon!, type: venueType(hint ?? ""), hours: t.opening_hours, neighborhood: t["addr:suburb"] ?? t["addr:district"], tags: t, sources: [{ id: "osm" as const, url: `https://www.openstreetmap.org/${e.type}/${e.id}` }] }]
  })
  return { venues, relationId: boundary.id, boundary: boundaryFromMembers(boundary.members), source: { ...result.source, url: `https://www.openstreetmap.org/relation/${boundary.id}`, note: `${result.source.status === "error" ? "Refresh failed; showing the last successful boundary query. " : "Complete administrative-boundary query. "}Mapped venues are a lower bound, not a census.` } }
}
interface FsqPlace { fsq_place_id: string; name: string; latitude: number; longitude: number; date_closed?: string; categories?: { name: string }[]; rating?: number; popularity?: number; price?: number; stats?: { total_ratings?: number }; location?: { neighborhood?: string[] } }
export async function fetchFoursquare(city: City, force = false) {
  if (!process.env.FOURSQUARE_API_KEY || process.env.FOURSQUARE_DURABLE_STORAGE_LICENSED !== "1" || !process.env.FOURSQUARE_CATEGORY_IDS) return null
  const result = await cached(city.key, "foursquare", 30, async () => {
    const query = new URLSearchParams({ ll: `${city.lat},${city.lon}`, radius: "20000", fsq_category_ids: process.env.FOURSQUARE_CATEGORY_IDS!, fields: "fsq_place_id,name,latitude,longitude,categories,rating,popularity,price,stats,location,date_closed", sort: "POPULARITY", limit: "50" })
    return fetchJson<{ results: FsqPlace[] }>(`https://places-api.foursquare.com/places/search?${query}`, { headers: { Authorization: `Bearer ${process.env.FOURSQUARE_API_KEY}`, "X-Places-Api-Version": "2025-06-17" } })
  }, force)
  // Search is a bounded, popularity-selected sample. It cannot add unmatched
  // places to per-capita counts without a matching boundary geometry.
  const venues: Venue[] = (result.data.results ?? []).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).map(p => ({ id: `fsq-${p.fsq_place_id}`, name: p.name, lat: p.latitude, lon: p.longitude, type: venueType((p.categories ?? []).map(c => c.name).join(" ")), closed: !!p.date_closed, rating: p.rating, votes: p.stats?.total_ratings, popularity: p.popularity, price: p.price, neighborhood: p.location?.neighborhood?.join(", "), sources: [{ id: "foursquare", url: `https://foursquare.com/v/${p.fsq_place_id}` }] }))
  return { venues, source: { ...result.source, note: "Popularity-selected sample of up to 50 places near the city; results are clipped to the verified OSM boundary before counting." } }
}
function geohash(lat: number, lon: number) {
  let hash = "", bit = 0, value = 0, even = true
  const ranges = [[-180, 180], [-90, 90]], coords = [lon, lat], chars = "0123456789bcdefghjkmnpqrstuvwxyz"
  while (hash.length < 8) { const i = even ? 0 : 1, mid = (ranges[i][0] + ranges[i][1]) / 2; value = (value << 1) + Number(coords[i] >= mid); ranges[i][coords[i] >= mid ? 0 : 1] = mid; even = !even; if (++bit === 5) { hash += chars[value]; value = 0; bit = 0 } }
  return hash
}
export async function fetchEvents(city: City, force = false) {
  if (!process.env.TICKETMASTER_API_KEY) return null
  return cached(city.key, "ticketmaster", 7, async () => {
    const now = new Date(), end = new Date(now.getTime() + 45 * DAY)
    const query = new URLSearchParams({ apikey: process.env.TICKETMASTER_API_KEY!, geoPoint: geohash(city.lat, city.lon), radius: "15", unit: "km", classificationName: "music", startDateTime: now.toISOString().replace(/\.\d+Z$/, "Z"), endDateTime: end.toISOString().replace(/\.\d+Z$/, "Z"), sort: "date,asc", size: "100" })
    const raw = await fetchJson<{ _embedded?: { events?: { id: string; name: string; url: string; dates: { start: { dateTime?: string; localDate: string }; status?: { code: string } }; _embedded?: { venues?: { name: string }[] } }[] } }>(`https://app.ticketmaster.com/discovery/v2/events.json?${query}`)
    const events: NightEvent[] = (raw._embedded?.events ?? []).filter(e => e.dates.status?.code !== "cancelled").map(e => ({ id: e.id, name: e.name, date: e.dates.start.dateTime ?? e.dates.start.localDate, venue: e._embedded?.venues?.[0]?.name ?? "Venue not listed", url: e.url }))
    return { raw, events }
  }, force)
}
interface Prices { currency: string; monthLastUpdate?: number; yearLastUpdate?: number; prices: { item_id: number; average_price: number }[] }
export async function fetchBeer(city: City, force = false) {
  if (!process.env.NUMBEO_API_KEY || process.env.NUMBEO_STORAGE_LICENSED !== "1") return null
  return cached(city.key, "numbeo", 180, async () => {
    const query = new URLSearchParams({ query: `${city.city}, ${city.country}`, strict_matching: "true", use_estimated: "false" })
    const options = { headers: { "X-Api-Key": process.env.NUMBEO_API_KEY! } }
    const local = await fetchJson<Prices>(`https://www.numbeo.com/api/city_prices?${query}`, options)
    query.set("currency", "USD")
    const usd = await fetchJson<Prices>(`https://www.numbeo.com/api/city_prices?${query}`, options)
    const amount = (r: Prices, id: number) => { const n = r.prices?.find(p => p.item_id === id)?.average_price; return n != null && Number.isFinite(n) && n > 0 ? n : null }
    const beer: BeerPrices = { currency: local.currency, domestic: amount(local, 4), imported: amount(local, 5), domesticUsd: amount(usd, 4), importedUsd: amount(usd, 5), updatedAt: local.yearLastUpdate && local.monthLastUpdate ? `${local.yearLastUpdate}-${String(local.monthLastUpdate).padStart(2, "0")}-01` : new Date().toISOString() }
    return { local, usd, beer }
  }, force)
}
// Licensed mention import is deliberate: no silent Reddit scraping or unlicensed
// article collection. Only derived labels/themes are kept, never raw prose.
export async function importedMentions(key: string): Promise<Mention[]> {
  const file = process.env.NIGHTLIFE_MENTIONS_DIR
  if (!file) return []
  let raw: unknown
  try { raw = JSON.parse(await fs.readFile(path.join(file, `${safeKey(key)}.json`), "utf8")) } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e }
  if (!Array.isArray(raw)) throw new Error("Mention import must be an array")
  const ids = new Set<string>()
  return raw.flatMap((m: unknown) => {
    if (!m || typeof m !== "object") return []
    const v = m as Record<string, unknown>
    if (typeof v.id !== "string" || ids.has(v.id) || typeof v.group !== "string" || !v.group || typeof v.url !== "string" || !/^https:\/\//.test(v.url) || typeof v.publishedAt !== "string" || !Number.isFinite(Date.parse(v.publishedAt)) || !["positive", "mixed", "negative"].includes(String(v.sentiment)) || !["reddit", "blogs", "foursquare"].includes(String(v.source)) || !Array.isArray(v.themes) || v.themes.some(t => typeof t !== "string" || t.length > 100) || v.relevant !== true) return []
    if (v.source === "reddit" && process.env.REDDIT_COMMERCIAL_ANALYSIS_LICENSED !== "1") return []
    if (v.source === "foursquare" && process.env.FOURSQUARE_DURABLE_STORAGE_LICENSED !== "1") return []
    if (v.source === "blogs" && process.env.NIGHTLIFE_BLOG_ANALYSIS_LICENSED !== "1") return []
    const url = new URL(v.url), group = `${url.hostname.replace(/^www\./, "")}:${String(v.group)}`
    if (/reddit\.com$/.test(url.hostname) && v.source !== "reddit") return []
    ids.add(v.id)
    return [{ id: v.id, group, url: v.url, source: v.source, publishedAt: v.publishedAt, sentiment: v.sentiment, themes: v.themes, relevant: true } as Mention]
  })
}
