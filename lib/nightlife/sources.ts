import { promises as fs } from "node:fs"
import path from "node:path"
import { distance, venueType } from "./venues"
import { boundaryFromMembers } from "./boundary"
import { NIGHTLIFE_DIR, safeKey, writeJson } from "./store"
import type { BeerPrices, City, Mention, NightEvent, Source, SourceId, Venue } from "./types"
const USER_AGENT = "IsMyTripSafe-nightlife/1.0 (+https://ismytripsafe.com/about)"
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
export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...options.headers }, signal: AbortSignal.timeout(65000) })
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`)
  return response.json() as Promise<T>
}
export async function cached<T>(key: string, id: SourceId, days: number, get: () => Promise<T>, force = false): Promise<{ data: T; source: Source }> {
  const file = path.join(NIGHTLIFE_DIR, "raw", safeKey(key), `${id}.json`)
  let previous: { fetchedAt: string; data: T } | null = null
  try { previous = JSON.parse(await fs.readFile(file, "utf8")) } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e }
  if (previous && !force && Date.now() - Date.parse(previous.fetchedAt) < days * DAY) return { data: previous.data, source: { id, ...SOURCE_INFO[id], fetchedAt: previous.fetchedAt, status: "ok", note: "Stored source response." } }
  try {
    const data = await get(), fetchedAt = new Date().toISOString()
    // Never save URLs containing API keys or authentication headers.
    await writeJson(file, { fetchedAt, data })
    return { data, source: { id, ...SOURCE_INFO[id], fetchedAt, status: "ok", note: "Fetched successfully." } }
  } catch (e) {
    if (previous) return { data: previous.data, source: { id, ...SOURCE_INFO[id], fetchedAt: previous.fetchedAt, status: "error", note: "Refresh failed; retained the last successful response and its original date." } }
    throw e
  }
}
interface Claim { rank: string; mainsnak: { datavalue?: { value: unknown } }; qualifiers?: Record<string, { datavalue?: { value: { time?: string } } }[]> }
interface Entity { id: string; labels?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]>; claims: Record<string, Claim[]> }
const value = (c: Claim) => c.mainsnak.datavalue?.value
export function latestPopulation(claims: Claim[]): { population: number; date: string } | null {
  const dated = claims.filter(c => c.rank !== "deprecated").map(c => ({ claim: c, date: c.qualifiers?.P585?.[0]?.datavalue?.value.time?.replace(/^\+/, "") ?? "" }))
    .filter(c => c.date && Number.isFinite(Date.parse(c.date)) && Date.parse(c.date) <= Date.now()).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  for (const c of dated) { const n = Number((value(c.claim) as { amount?: string })?.amount); if (n > 0 && Number.isFinite(n)) return { population: n, date: c.date } }
  return null
}
async function entities(ids: string[]) {
  const params = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels|aliases", languages: "en", format: "json" })
  return (await fetchJson<{ entities: Record<string, Entity> }>(`https://www.wikidata.org/w/api.php?${params}`)).entities
}
export async function resolveCity(seed: City, force = false) {
  return cached(seed.key, "wikidata", 180, async () => {
    const params = new URLSearchParams({ action: "wbsearchentities", search: seed.city, language: "en", type: "item", limit: "8", format: "json" })
    const search = await fetchJson<{ search: { id: string }[] }>(`https://www.wikidata.org/w/api.php?${params}`)
    if (!search.search?.length) throw new Error("No Wikidata city match")
    const candidates = await entities(search.search.map(s => s.id))
    const countryIds = [...new Set(Object.values(candidates).flatMap(e => (e.claims.P17 ?? []).map(c => (value(c) as { id: string })?.id).filter(Boolean)))]
    const countries = countryIds.length ? await entities(countryIds) : {}
    const matched = Object.values(candidates).map(e => {
      const coords = (e.claims.P625 ?? []).filter(c => c.rank !== "deprecated").map(value)[0] as { latitude: number; longitude: number } | undefined
      const countryOk = (e.claims.P17 ?? []).some(c => (countries[(value(c) as { id: string })?.id]?.claims.P297 ?? []).some(p => value(p) === seed.countryCode.toUpperCase()))
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      const nameOk = [e.labels?.en?.value, ...(e.aliases?.en ?? []).map(a => a.value)].some(n => n && normalize(n) === normalize(seed.city))
      return { e, coords, countryOk, nameOk, distance: coords ? distance(seed, { lat: coords.latitude, lon: coords.longitude }) : Infinity }
    }).filter(c => c.countryOk && c.nameOk && c.distance < 20000).sort((a, b) => a.distance - b.distance)
    const match = matched[0]
    if (!match?.coords) throw new Error("No unambiguous city match with matching country and coordinates")
    const pop = latestPopulation(match.e.claims.P1082 ?? [])
    const relation = (match.e.claims.P402 ?? []).filter(c => c.rank !== "deprecated").map(c => Number(value(c))).find(n => Number.isSafeInteger(n) && n > 0)
    return { ...seed, wikidataId: match.e.id, population: pop?.population ?? null, populationDate: pop?.date ?? null, relationId: relation ?? null, lat: match.coords.latitude, lon: match.coords.longitude, boundaryVerified: false }
  }, force)
}
interface OsmElement { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] }
export async function fetchOsm(city: City, force = false) {
  if (!city.relationId || !city.wikidataId) throw new Error("A Wikidata-linked OSM administrative boundary is required")
  const endpoint = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter"
  const area = 3600000000 + city.relationId
  const query = `[out:json][timeout:55];rel(${city.relationId});out geom;area(${area})->.city;(nwr(area.city)[amenity~"^(bar|pub|nightclub|biergarten|music_venue)$"];nwr(area.city)[amenity=restaurant][bar=yes];);out center tags;`
  const result = await cached(city.key, "osm", 30, async () => {
    const raw = await fetchJson<{ elements: OsmElement[]; remark?: string }>(endpoint, { method: "POST", body: new URLSearchParams({ data: query }) })
    if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass returned an incomplete query")
    const boundary = raw.elements.find(e => e.type === "relation" && e.id === city.relationId)
    if (boundary?.tags?.wikidata !== city.wikidataId || boundary.tags.boundary !== "administrative") throw new Error("OSM boundary does not match the resolved city")
    return raw
  }, force)
  if (result.data.remark) throw new Error("Overpass returned an incomplete query; not used for scoring")
  const boundary = result.data.elements.find(e => e.type === "relation" && e.id === city.relationId)
  if (boundary?.tags?.wikidata !== city.wikidataId || boundary.tags.boundary !== "administrative") throw new Error("OSM boundary does not match the resolved Wikidata city")
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
  return { venues, boundary: boundaryFromMembers(boundary.members), source: { ...result.source, url: `https://www.openstreetmap.org/relation/${city.relationId}`, note: "Complete administrative-boundary query. Mapped venues are a lower bound, not a census." } }
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
