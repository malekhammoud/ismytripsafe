import { fetchJson, researchSignal } from "./http"
import { SourceHttpError, SourceOperationError, SourceUnavailable } from "./source-errors"
import type { City } from "./types"

export interface OsmElement {
  type: "node" | "way" | "relation" | "area" | "count"; id: number
  lat?: number; lon?: number; center?: { lat: number; lon: number }
  tags?: Record<string, string>
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[]
}
export interface OsmResponse { elements: OsmElement[]; remark?: string; osm3s?: { timestamp_osm_base?: string; timestamp_areas_base?: string } }
export interface OsmCollection {
  boundary: OsmResponse; venues: OsmResponse; geometry?: OsmResponse
  geometryNote?: string
  requests: { operation: string; provider: string; fetchedAt: string; elapsedMs: number }[]
}
export const DEFAULT_OVERPASS = "https://overpass.private.coffee/api/interpreter"
export const PILOT_FALLBACK = "https://overpass-api.de/api/interpreter"
export function overpassEndpoints(primary = process.env.OVERPASS_URL || DEFAULT_OVERPASS, fallback = process.env.OVERPASS_FALLBACK_URL ?? (primary === DEFAULT_OVERPASS ? PILOT_FALLBACK : "")) {
  return [...new Set([primary, fallback].filter(Boolean))]
}
export function usesPublicOverpass() {
  return overpassEndpoints().some(endpoint => {
    try { return /(^|\.)(overpass-api\.de|overpass\.private\.coffee|overpass\.kumi\.systems)$/.test(new URL(endpoint).hostname) }
    catch { return true }
  })
}

function mayFailOver(error: unknown) {
  if (researchSignal()?.aborted) return false
  if (error instanceof SourceHttpError) return [500, 502, 503].includes(error.status) && !error.retryAfter
  // 429, 504 admission refusals, partial results and query errors never switch
  // providers. Only transport failures and generic service outages do.
  return error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError")
}
export function createOverpassClient(options: { primary?: string; fallback?: string; request?: typeof fetchJson } = {}) {
  const primary = options.primary ?? process.env.OVERPASS_URL ?? DEFAULT_OVERPASS
  // An explicitly configured provider is never silently sent to a public one.
  const fallback = options.fallback ?? process.env.OVERPASS_FALLBACK_URL ?? (primary === DEFAULT_OVERPASS ? PILOT_FALLBACK : "")
  const endpoints = overpassEndpoints(primary, fallback)
  const request = options.request ?? fetchJson
  const requests: OsmCollection["requests"] = []
  let selected = 0
  async function query(body: string, operation: string, timeoutMs: number, signal?: AbortSignal): Promise<OsmResponse> {
    for (;;) {
      const endpoint = endpoints[selected], provider = new URL(endpoint).hostname, start = Date.now()
      try {
        const raw = await request<OsmResponse>(endpoint, { method: "POST", body: new URLSearchParams({ data: body }), cache: "no-store", signal }, { timeoutMs, retries: 0, operation })
        if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass query did not complete; partial results rejected", { cause: { code: /timed?\s*out/i.test(raw.remark ?? "") ? "OVERPASS_QUERY_TIMEOUT" : "OVERPASS_INCOMPLETE" } })
        const entry = { operation, provider, fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - start }
        requests.push(entry)
        console.info(`[nightlife] ${operation}: ${raw.elements.length} elements in ${entry.elapsedMs}ms via ${provider}`)
        return raw
      } catch (error) {
        const detailed = new SourceOperationError(error, operation, provider, Date.now() - start)
        console.warn(`[nightlife] ${detailed.message}`)
        if (signal?.aborted || selected + 1 >= endpoints.length || !mayFailOver(error)) throw detailed
        selected++ // Sticky for the rest of this city; never return to a failing host.
      }
    }
  }
  return { query, requests }
}
const header = (seconds: number) => `[out:json][timeout:${seconds}][maxsize:67108864];`
export function boundaryQuery(city: City) {
  if (!city.wikidataId || !/^Q\d+$/.test(city.wikidataId)) throw new SourceUnavailable("A verified city identity is needed before mapping venues.")
  if (city.relationId != null && (!Number.isSafeInteger(city.relationId) || city.relationId <= 0)) throw new SourceUnavailable("Invalid city boundary identifier.")
  const selection = city.relationId ? `rel(${city.relationId});` : `rel[wikidata="${city.wikidataId}"][boundary=administrative];`
  return `${header(15)}${selection}out tags;map_to_area;out tags;`
}
export function verifiedArea(city: City, raw: OsmResponse) {
  if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass returned an incomplete boundary lookup")
  const boundaries = raw.elements.filter(e => e.type === "relation" && e.tags?.boundary === "administrative" && e.tags.wikidata === city.wikidataId && (!city.relationId || city.relationId === e.id))
  if (boundaries.length !== 1) throw new SourceUnavailable("A single matching city boundary is not available in OpenStreetMap.")
  const boundary = boundaries[0]
  const areas = raw.elements.filter(e => e.type === "area" && e.id === 3600000000 + boundary.id && e.tags?.wikidata === city.wikidataId)
  if (areas.length !== 1) throw new SourceUnavailable("OpenStreetMap has the city boundary but its searchable area is not available yet.")
  return { boundary, areaId: areas[0].id }
}
export function venueQuery(areaId: number) {
  if (!Number.isSafeInteger(areaId) || areaId <= 3600000000) throw new Error("Invalid Overpass area identifier")
  const amenities = ["bar", "pub", "nightclub", "biergarten", "music_venue"]
  const filters = amenities.map(a => `nwr(area.city)[amenity=${a}];`).join("")
  // Print the area to distinguish unavailable area data from a genuine zero.
  // A final count proves the entire union was returned, including ways/relations.
  return `${header(25)}area(${areaId})->.city;.city out ids;(${filters}nwr(area.city)[amenity=restaurant][bar=yes];);out body center qt;out count;`
}
export function verifiedVenues(raw: OsmResponse, areaId: number): OsmElement[] {
  if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass returned an incomplete venue query")
  if (raw.elements.filter(e => e.type === "area" && e.id === areaId).length !== 1) throw new SourceUnavailable("The verified city area was not available during the venue query.")
  const counts = raw.elements.filter(e => e.type === "count")
  const venues = raw.elements.filter(e => ["node", "way", "relation"].includes(e.type))
  const countsOk = counts.length === 1 && raw.elements.at(-1) === counts[0] && /^\d+$/.test(counts[0].tags?.total ?? "") && Number(counts[0].tags!.total) === venues.length
    && ["node", "way", "relation"].every(type => /^\d+$/.test(counts[0].tags?.[`${type}s`] ?? "") && Number(counts[0].tags![`${type}s`]) === venues.filter(e => e.type === type).length)
  if (!countsOk || new Set(venues.map(e => `${e.type}/${e.id}`)).size !== venues.length) throw new Error("Overpass venue response failed completeness checks")
  return venues
}
export async function collectOsm(city: City, geometry = false): Promise<OsmCollection> {
  const client = createOverpassClient()
  const boundary = await client.query(boundaryQuery(city), "OpenStreetMap boundary lookup", 35000)
  const { boundary: relation, areaId } = verifiedArea(city, boundary)
  const venues = await client.query(venueQuery(areaId), "OpenStreetMap venue lookup", 45000)
  verifiedVenues(venues, areaId)
  const result: OsmCollection = { boundary, venues, requests: client.requests }
  // Detailed geometry only helps clip unmatched Foursquare venues. Its failure
  // must not discard a complete, boundary-scoped OSM venue list.
  if (geometry) {
    try {
      const raw = await client.query(`${header(10)}rel(${relation.id});out geom;`, "OpenStreetMap optional geometry", 25000, AbortSignal.timeout(25000))
      if (!raw.elements.some(e => e.type === "relation" && e.id === relation.id && e.tags?.wikidata === city.wikidataId)) throw new Error("Geometry belongs to a different city")
      result.geometry = raw
    } catch { result.geometryNote = "Boundary geometry unavailable; only matched Foursquare venues can join the OSM count." }
  }
  return result
}
