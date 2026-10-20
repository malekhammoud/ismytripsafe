import { fetchJson, researchSignal } from "./http"
import { SourceHttpError, SourceUnavailable } from "./source-errors"
import { entityIds, placeKind, selectCity, type Entity } from "./city-resolution"
import { distance } from "./venues"
import type { City } from "./types"

type LoadEntities = (ids: string[]) => Promise<Record<string, Entity>>
const validIds = (ids: string[]) => [...new Set(ids.filter(id => /^Q\d+$/.test(id)))]
function parameters(values: Record<string, string>, interactive: boolean) {
  // Wikimedia explicitly permits interactive reads to omit maxlag. Keep it
  // for scheduled/batch research, where nobody is waiting for the result.
  return new URLSearchParams({ ...values, format: "json", ...(interactive ? {} : { maxlag: "5" }) })
}
async function entities(ids: string[], interactive: boolean): Promise<Record<string, Entity>> {
  const unique = validIds(ids), result: Record<string, Entity> = {}
  for (let i = 0; i < unique.length; i += 50) {
    const params = parameters({ action: "wbgetentities", ids: unique.slice(i, i + 50).join("|"), props: "claims|labels|aliases", languages: "en" }, interactive)
    const raw = await fetchJson<{ entities: Record<string, Entity> }>(`https://www.wikidata.org/w/api.php?${params}`, {}, { operation: "Wikidata entities" })
    if (!raw.entities) throw new Error("Wikidata returned no entities")
    Object.assign(result, raw.entities)
  }
  return result
}
async function matchCity(seed: City, ids: string[], load: LoadEntities): Promise<City> {
  const candidates = await load(validIds(ids))
  const countries = await load(validIds(Object.values(candidates).flatMap(e => entityIds(e, "P17"))))
  const classes: Record<string, Entity> = {}
  const ordered = ids.flatMap(id => candidates[id] ? [candidates[id]] : [])
  const direct = selectCity(seed, ordered, countries, classes)
  if (direct && (ids.length === 1 || (direct.relationId && candidates[direct.wikidataId!]?.labels?.en?.value.localeCompare(seed.city, "en", { sensitivity: "base" }) === 0))) return direct
  let frontier = validIds(Object.values(candidates).flatMap(e => entityIds(e, "P31")))
  for (let depth = 0; depth < 4 && frontier.length; depth++) {
    const unknown = frontier.filter(id => !classes[id] && !placeKind(id, classes)).slice(0, 50)
    if (!unknown.length) break
    const next = await load(unknown)
    Object.assign(classes, next)
    frontier = validIds(Object.values(next).flatMap(e => entityIds(e, "P279")))
  }
  const city = selectCity(seed, ordered, countries, classes)
  if (!city) throw new SourceUnavailable("No city entity matches the name, country, location and settlement type.")
  return city
}
function canUseLinkedData(error: unknown) {
  if (researchSignal()?.aborted) return false
  // Alternate read interfaces are for service/transport failures, never for
  // circumventing rate limits, denied access, or a request to wait.
  if (error instanceof SourceHttpError) return [500, 502, 503, 504].includes(error.status)
    && !["maxlag", "ratelimited", "readonly"].includes(error.code ?? "") && !error.retryAfter
  return !(error instanceof Error && error.name === "AbortError")
}
async function linkedCity(seed: City): Promise<City> {
  const seen: Record<string, Entity> = {}
  let count = 0
  const load: LoadEntities = async ids => {
    for (const id of validIds(ids)) {
      if (seen[id]) continue
      if (++count > 12) throw new SourceUnavailable("The linked city needs additional classification evidence.")
      const raw = await fetchJson<{ entities: Record<string, Entity> }>(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, {}, { timeoutMs: 12000, operation: "Wikidata linked entity" })
      const entity = raw.entities?.[id]
      if (!entity?.claims || entity.id !== id) throw new SourceUnavailable("Wikidata returned no matching linked entity.")
      seen[id] = entity
    }
    return Object.fromEntries(validIds(ids).flatMap(id => seen[id] ? [[id, seen[id]]] : []))
  }
  for (const title of [...new Set([seed.city, `${seed.city}, ${seed.country}`])]) {
    let page: { type?: string; wikibase_item?: string; coordinates?: { lat: number; lon: number } }
    try {
      page = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`, {}, { timeoutMs: 12000, operation: "Wikipedia city link" })
    } catch (error) {
      if (error instanceof SourceHttpError && error.status === 404) continue
      throw error
    }
    // Wikipedia only supplies a candidate ID. Its prose, population and
    // description never enter the score or replace Wikidata validation.
    if (page.type !== "standard" || !page.wikibase_item || !/^Q\d+$/.test(page.wikibase_item)) continue
    if (page.coordinates && (!Number.isFinite(page.coordinates.lat) || !Number.isFinite(page.coordinates.lon) || distance(seed, page.coordinates) > 25000)) continue
    try {
      const city = await matchCity(seed, [page.wikibase_item], load)
      return { ...city, resolutionMethod: "linked-data" }
    } catch (error) { if (!(error instanceof SourceUnavailable)) throw error }
  }
  throw new SourceUnavailable("No verified city match is available through the linked-data lookup.")
}
export async function lookupCity(seed: City, interactive = false): Promise<City> {
  try {
    const params = parameters({ action: "wbsearchentities", search: seed.city, language: "en", type: "item", limit: "12" }, interactive)
    const search = await fetchJson<{ search: { id: string }[] }>(`https://www.wikidata.org/w/api.php?${params}`, {}, { operation: "Wikidata search" })
    if (!Array.isArray(search.search)) throw new Error("Wikidata returned an invalid search response")
    if (!search.search.length) throw new SourceUnavailable("No verified city match is available in Wikidata.")
    return { ...await matchCity(seed, validIds(search.search.map(s => s.id)), ids => entities(ids, interactive)), resolutionMethod: "search" }
  } catch (error) {
    if (!canUseLinkedData(error)) throw error
    try {
      const city = await linkedCity(seed)
      console.info(`[nightlife] ${seed.key}: city verified through linked data after ${error instanceof Error ? error.message : "search failure"}`)
      return city
    } catch (fallbackError) {
      console.warn(`[nightlife] ${seed.key}: linked city lookup: ${fallbackError instanceof Error ? fallbackError.message : "failed"}`)
      if (fallbackError instanceof SourceHttpError && !canUseLinkedData(fallbackError)) throw fallbackError
      throw error
    }
  }
}
