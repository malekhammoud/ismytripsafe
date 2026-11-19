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
  /** Used when Wikidata has no single city boundary but a containing area exists. */
  fallbackArea?: {
    areaId: number; relationId: number; name: string; adminLevel: string
    boundaryKind: string; population: number | null; wikidataId: string | null
    note: string
  }
  requests: { operation: string; provider: string; fetchedAt: string; elapsedMs: number }[]
}
// The public French instance is the default because it is reachable from the
// application host and answers the boundary/venue workload in seconds. The
// previous defaults (private.coffee + overpass-api.de) both fail from here, so
// every cold report paid a 35-second timeout before giving up.
export const DEFAULT_OVERPASS = "https://overpass.openstreetmap.fr/api/interpreter"
export const PILOT_FALLBACK = "https://overpass.private.coffee/api/interpreter"
const endpoints = (value: string | undefined) => (value ?? "").split(",").map(s => s.trim()).filter(Boolean)
export function overpassEndpoints(primary = process.env.OVERPASS_URL || DEFAULT_OVERPASS, fallback = process.env.OVERPASS_FALLBACK_URL ?? (primary === DEFAULT_OVERPASS ? PILOT_FALLBACK : "")) {
  return [...new Set([...endpoints(primary), ...endpoints(fallback)])]
}
export function usesPublicOverpass() {
  return overpassEndpoints().some(endpoint => {
    try { return /(^|\.)(overpass-api\.de|overpass\.private\.coffee|overpass\.kumi\.systems|overpass\.openstreetmap\.fr|overpass\.osm\.ch)$/.test(new URL(endpoint).hostname) }
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
// Remember which endpoint worked for ten minutes so a dead primary is not
// retried (and made to time out) for every cold city.
let preferredEndpoint = 0, preferredAt = 0
export function createOverpassClient(options: { primary?: string; fallback?: string; request?: typeof fetchJson } = {}) {
  const primary = options.primary ?? process.env.OVERPASS_URL ?? DEFAULT_OVERPASS
  // An explicitly configured provider is never silently sent to a public one.
  const fallback = options.fallback ?? process.env.OVERPASS_FALLBACK_URL ?? (primary === DEFAULT_OVERPASS ? PILOT_FALLBACK : "")
  const endpoints = overpassEndpoints(primary, fallback)
  const request = options.request ?? fetchJson
  const requests: OsmCollection["requests"] = []
  const explicit = options.primary != null || options.fallback != null
  let selected = explicit ? 0 : Math.max(0, Math.min(preferredEndpoint, endpoints.length - 1))
  if (!explicit && Date.now() - preferredAt > 600000) selected = 0
  const tried = new Set<number>()
  async function query(body: string, operation: string, timeoutMs: number, signal?: AbortSignal): Promise<OsmResponse> {
    for (;;) {
      const endpoint = endpoints[selected], provider = new URL(endpoint).hostname, start = Date.now()
      try {
        const raw = await request<OsmResponse>(endpoint, { method: "POST", body: new URLSearchParams({ data: body }), cache: "no-store", signal }, { timeoutMs, retries: 0, operation })
        if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass query did not complete; partial results rejected", { cause: { code: /timed?\s*out/i.test(raw.remark ?? "") ? "OVERPASS_QUERY_TIMEOUT" : "OVERPASS_INCOMPLETE" } })
        const entry = { operation, provider, fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - start }
        requests.push(entry)
        if (!explicit) { preferredEndpoint = selected; preferredAt = Date.now() }
        console.info(`[nightlife] ${operation}: ${raw.elements.length} elements in ${entry.elapsedMs}ms via ${provider}`)
        return raw
      } catch (error) {
        const detailed = new SourceOperationError(error, operation, provider, Date.now() - start)
        console.warn(`[nightlife] ${detailed.message}`)
        tried.add(selected)
        if (signal?.aborted || tried.size >= endpoints.length || !mayFailOver(error)) throw detailed
        // Move to the next untried endpoint, wrapping so a remembered fallback
        // can still fall back to the original primary.
        do { selected = (selected + 1) % endpoints.length } while (tried.has(selected))
      }
    }
  }
  return { query, requests }
}
const header = (seconds: number) => `[out:json][timeout:${seconds}][maxsize:67108864];`
// Greater London is a ceremonial county, not an administrative boundary. The
// city-level relation is still the correct area for a nightlife count.
const BOUNDARY_KINDS = new Set(["administrative", "ceremonial", "political", "statistical", "place"])
const BOUNDARY_FILTER = `[boundary~"^(${[...BOUNDARY_KINDS].join("|")})$"]`
export function boundaryQuery(city: City) {
  if (!city.wikidataId || !/^Q\d+$/.test(city.wikidataId)) throw new SourceUnavailable("A verified city identity is needed before mapping venues.")
  if (city.relationId != null && (!Number.isSafeInteger(city.relationId) || city.relationId <= 0)) throw new SourceUnavailable("Invalid city boundary identifier.")
  const selection = city.relationId ? `rel(${city.relationId});` : `rel[wikidata="${city.wikidataId}"]${BOUNDARY_FILTER};`
  return `${header(15)}${selection}out tags;map_to_area;out tags;`
}
export function verifiedArea(city: City, raw: OsmResponse) {
  if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass returned an incomplete boundary lookup")
  // A verified Wikidata relation ID is authoritative, even when the boundary
  // belongs to the city's parent municipality (Johannesburg is the common
  // case). Without an ID, the wikidata tag must match the city itself.
  const boundaries = raw.elements.filter(e => e.type === "relation" && BOUNDARY_KINDS.has(e.tags?.boundary ?? "")
    && (city.relationId ? e.id === city.relationId : e.tags?.wikidata === city.wikidataId))
  if (boundaries.length !== 1) throw new SourceUnavailable("A single matching city boundary is not available in OpenStreetMap.")
  const boundary = boundaries[0]
  const areas = raw.elements.filter(e => e.type === "area" && e.id === 3600000000 + boundary.id && (!!city.relationId || e.tags?.wikidata === city.wikidataId))
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
// One round trip resolves the boundary, its searchable area and every venue.
// The old pipeline made two sequential Overpass calls; this returns the same
// verified data in roughly half the wall-clock time.
export function collectionQuery(city: City) {
  if (!city.wikidataId || !/^Q\d+$/.test(city.wikidataId)) throw new SourceUnavailable("A verified city identity is needed before mapping venues.")
  if (city.relationId != null && (!Number.isSafeInteger(city.relationId) || city.relationId <= 0)) throw new SourceUnavailable("Invalid city boundary identifier.")
  const selection = city.relationId ? `rel(${city.relationId})` : `rel[wikidata="${city.wikidataId}"]${BOUNDARY_FILTER}`
  const amenities = ["bar", "pub", "nightclub", "biergarten", "music_venue"]
  const filters = amenities.map(a => `nwr(area.area)[amenity=${a}];`).join("")
  return `${header(45)}${selection}->.boundary;.boundary out tags;.boundary map_to_area->.area;.area out tags;(${filters}nwr(area.area)[amenity=restaurant][bar=yes];);out tags center qt;out count;`
}
export function verifiedCollection(city: City, raw: OsmResponse) {
  if (raw.remark || !Array.isArray(raw.elements)) throw new Error("Overpass returned an incomplete city query")
  const boundaries = raw.elements.filter(e => e.type === "relation" && BOUNDARY_KINDS.has(e.tags?.boundary ?? "")
    && (city.relationId ? e.id === city.relationId : e.tags?.wikidata === city.wikidataId))
  if (boundaries.length !== 1) throw new SourceUnavailable("A single matching city boundary is not available in OpenStreetMap.")
  const boundary = boundaries[0], areaId = 3600000000 + boundary.id
  const areas = raw.elements.filter(e => e.type === "area" && e.id === areaId && (!!city.relationId || e.tags?.wikidata === city.wikidataId))
  if (areas.length !== 1) throw new SourceUnavailable("OpenStreetMap has the city boundary but its searchable area is not available yet.")
  const counts = raw.elements.filter(e => e.type === "count")
  // The boundary relation is part of the response and must never be counted as
  // a venue. The area element is also excluded from the venue count.
  const venues = raw.elements.filter(e => ["node", "way", "relation"].includes(e.type) && e.id !== boundary.id)
  const countsOk = counts.length === 1 && raw.elements.at(-1) === counts[0] && /^\d+$/.test(counts[0].tags?.total ?? "") && Number(counts[0].tags!.total) === venues.length
    && ["node", "way", "relation"].every(type => /^\d+$/.test(counts[0].tags?.[`${type}s`] ?? "") && Number(counts[0].tags![`${type}s`]) === venues.filter(e => e.type === type).length)
  if (!countsOk || new Set(venues.map(e => `${e.type}/${e.id}`)).size !== venues.length) throw new Error("Overpass venue response failed completeness checks")
  return { boundary, area: areas[0], areaId, venues }
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
const AREA_BOUNDARY_KINDS = new Set(["administrative", "local_authority"])
const areaName = (element: OsmElement) => [element.tags?.name, element.tags?.["name:en"]].filter(Boolean).join(" ").toLowerCase()
const plainAreaName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
export function fallbackAreaQuery(city: City) {
  return `${header(25)}is_in(${city.lat},${city.lon});out tags;`
}
export function chooseFallbackArea(city: City, raw: OsmResponse): OsmElement | null {
  if (raw.remark || !Array.isArray(raw.elements)) return null
  const target = plainAreaName(city.city)
  const levelRank: Record<string, number> = { "7": 0, "6": 1, "8": 2, "5": 3, "4": 4 }
  const candidates = raw.elements.filter(element => element.type === "area"
    && AREA_BOUNDARY_KINDS.has(element.tags?.boundary ?? "")
    && element.tags?.admin_level != null && /^[4-8]$/.test(element.tags.admin_level))
  return candidates.sort((a, b) => {
    const aName = plainAreaName(areaName(a)), bName = plainAreaName(areaName(b))
    const aMatch = aName.includes(target) ? 0 : 1, bMatch = bName.includes(target) ? 0 : 1
    return aMatch - bMatch || (levelRank[a.tags!.admin_level] ?? 9) - (levelRank[b.tags!.admin_level] ?? 9)
  })[0] ?? null
}
async function collectAreaFallback(client: ReturnType<typeof createOverpassClient>, city: City, geometry: boolean): Promise<OsmCollection | null> {
  const raw = await client.query(fallbackAreaQuery(city), "OpenStreetMap enclosing-area lookup", 30000)
  const area = chooseFallbackArea(city, raw)
  if (!area) return null
  const venues = await client.query(venueQuery(area.id), "OpenStreetMap area venue lookup", 45000)
  verifiedVenues(venues, area.id)
  const tags = area.tags ?? {}, relationId = area.id - 3600000000
  const population = Number(tags.population)
  const name = tags["name:en"] ?? tags.name ?? `${city.city} area`
  const adminLevel = tags.admin_level ?? "?"
  const boundaryNote = `No single city boundary is available; using the enclosing ${name} area (${tags.boundary}, admin ${adminLevel}). Venue counts and density are approximate against this area.`
  return {
    boundary: { elements: [{ type: "relation", id: relationId, tags }, area], osm3s: venues.osm3s },
    venues,
    requests: client.requests,
    fallbackArea: {
      areaId: area.id,
      relationId,
      name,
      adminLevel,
      boundaryKind: tags.boundary ?? "area",
      population: Number.isFinite(population) && population > 0 ? population : null,
      wikidataId: /^Q\d+$/.test(tags.wikidata ?? "") ? tags.wikidata! : null,
      note: boundaryNote,
    },
    ...(geometry ? { geometryNote: "Area fallback; boundary geometry is unavailable." } : {}),
  }
}
export async function collectOsm(city: City, geometry = false): Promise<OsmCollection> {
  const client = createOverpassClient()
  try {
    const raw = await client.query(collectionQuery(city), "OpenStreetMap city and venue lookup", 50000)
    const verified = verifiedCollection(city, raw)
    const count = raw.elements.find(e => e.type === "count")!
    // Keep the cached shape the rest of the pipeline expects: a verified
    // boundary response and a verified venue response with a trailing count.
    const boundary: OsmResponse = { elements: [verified.boundary, verified.area], osm3s: raw.osm3s }
    const venues: OsmResponse = { elements: [verified.area, ...verified.venues, count], osm3s: raw.osm3s }
    const result: OsmCollection = { boundary, venues, requests: client.requests }
    // Detailed geometry only helps clip unmatched Foursquare venues. Its failure
    // must not discard a complete, boundary-scoped OSM venue list.
    if (geometry) {
      try {
        const geom = await client.query(`${header(10)}rel(${verified.boundary.id});out geom;`, "OpenStreetMap optional geometry", 20000, AbortSignal.timeout(20000))
        if (!geom.elements.some(e => e.type === "relation" && e.id === verified.boundary.id && BOUNDARY_KINDS.has(e.tags?.boundary ?? ""))) throw new Error("Geometry belongs to a different city")
        result.geometry = geom
      } catch { result.geometryNote = "Boundary geometry unavailable; only matched Foursquare venues can join the OSM count." }
    }
    return result
  } catch (error) {
    // A missing or broken city relation is the common failure for islands,
    // city-provinces and places where Wikidata points at a road route. The
    // containing administrative area is a transparent, clearly-labelled
    // fallback; it never turns a transport outage into a fake boundary.
    if (!(error instanceof SourceUnavailable)) throw error
    console.warn(`[nightlife] ${city.key}: boundary unavailable (${error.message}); trying enclosing area`)
    const fallback = await collectAreaFallback(client, city, geometry).catch(fallbackError => {
      console.warn(`[nightlife] ${city.key}: enclosing-area fallback failed: ${fallbackError instanceof Error ? fallbackError.message : "unknown error"}`)
      return null
    })
    if (fallback) return fallback
    throw error
  }
}
