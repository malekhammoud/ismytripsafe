import type { City } from "./types"
import { distance } from "./venues"

export const RESOLUTION_VERSION = 2
export interface Claim {
  rank?: string
  mainsnak: { datavalue?: { value: unknown } }
  qualifiers?: Record<string, { datavalue?: { value: { time?: string; precision?: number } } }[]>
}
export interface Entity {
  id: string
  labels?: Record<string, { value: string }>
  aliases?: Record<string, { value: string }[]>
  claims: Record<string, Claim[]>
}
export const activeClaims = (e: Entity, property: string) => (e.claims?.[property] ?? []).filter(c => c.rank !== "deprecated")
export const claimValue = (c: Claim) => c.mainsnak.datavalue?.value
export const entityIds = (e: Entity, property: string) => activeClaims(e, property).map(c => (claimValue(c) as { id?: string })?.id).filter((id): id is string => !!id && /^Q\d+$/.test(id))
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

// Wikidata dates can deliberately use 00 for an unknown month/day. Preserve
// their actual precision instead of rejecting year-only population observations.
export function populationDate(time: string | undefined, precision?: number): string | null {
  const match = time?.match(/^\+?(\d{4})-(\d{2})-(\d{2})T/)
  if (!match) return null
  const [, year, month, day] = match
  if (Number(year) < 1000 || (precision != null && precision < 9)) return null
  if (precision === 9 || month === "00") return year
  if (+month < 1 || +month > 12) return null
  if (precision === 10 || day === "00") return `${year}-${month}`
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null
}
export function latestPopulation(claims: Claim[]): { population: number; date: string } | null {
  const dated = claims.filter(c => c.rank !== "deprecated" && !c.qualifiers?.P518?.length).map(claim => {
    const when = claim.qualifiers?.P585?.[0]?.datavalue?.value
    return { claim, date: populationDate(when?.time, when?.precision) }
  }).filter((c): c is { claim: Claim; date: string } => !!c.date && Date.parse(c.date) <= Date.now())
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || Number(b.claim.rank === "preferred") - Number(a.claim.rank === "preferred"))
  for (const c of dated) {
    const n = Number((claimValue(c.claim) as { amount?: string })?.amount)
    if (n > 0 && Number.isFinite(n)) return { population: n, date: c.date }
  }
  return null
}
// Entity type must be a settlement or administrative area. A nearby station,
// airport or football club can have exactly the same alias as the city.
const SETTLEMENTS = new Set(["Q515", "Q3957", "Q532", "Q486972", "Q5119", "Q1549591", "Q200250", "Q1093829"])
const ADMIN = new Set(["Q56061", "Q15284"])
export function placeKind(id: string, classes: Record<string, Entity>, seen = new Set<string>()): number {
  if (SETTLEMENTS.has(id)) return 2
  if (ADMIN.has(id)) return 1
  if (seen.has(id) || seen.size > 100) return 0
  seen.add(id)
  return Math.max(0, ...(classes[id] ? entityIds(classes[id], "P279").map(parent => placeKind(parent, classes, new Set(seen))) : []))
}
export function selectCity(seed: City, candidates: Entity[], countries: Record<string, Entity>, classes: Record<string, Entity>): City | null {
  if (!Number.isFinite(seed.lat) || !Number.isFinite(seed.lon) || Math.abs(seed.lat) > 90 || Math.abs(seed.lon) > 180) return null
  const name = normalize(seed.city)
  const matches = candidates.flatMap((e, order) => {
    const kind = Math.max(0, ...entityIds(e, "P31").map(id => placeKind(id, classes)))
    const label = e.labels?.en?.value
    const exact = !!label && normalize(label) === name
    const alias = (e.aliases?.en ?? []).some(a => normalize(a.value) === name)
    const countryOk = entityIds(e, "P17").some(id => countries[id] && activeClaims(countries[id], "P297").some(c => claimValue(c) === seed.countryCode.toUpperCase()))
    const coords = activeClaims(e, "P625").sort((a, b) => Number(b.rank === "preferred") - Number(a.rank === "preferred")).map(claimValue)
      .find(v => { const c = v as { latitude?: number; longitude?: number; globe?: string }; return Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude) && Math.abs(c.latitude!) <= 90 && Math.abs(c.longitude!) <= 180 && (!c.globe || c.globe.endsWith("/Q2")) }) as { latitude: number; longitude: number } | undefined
    if (!kind || (!exact && !alias) || !countryOk || !coords || distance(seed, { lat: coords.latitude, lon: coords.longitude }) > 25000) return []
    const pop = latestPopulation(e.claims.P1082 ?? [])
    const relation = activeClaims(e, "P402").sort((a, b) => Number(b.rank === "preferred") - Number(a.rank === "preferred")).map(c => Number(claimValue(c))).find(n => Number.isSafeInteger(n) && n > 0)
    return [{ e, coords, pop, relation, exact, kind, order }]
  }).sort((a, b) => Number(b.exact) - Number(a.exact) || b.kind - a.kind || Number(!!b.relation) - Number(!!a.relation) || Number(!!b.pop) - Number(!!a.pop) || a.order - b.order)
  const match = matches[0]
  if (!match) return null
  return { ...seed, wikidataId: match.e.id, population: match.pop?.population ?? null, populationDate: match.pop?.date ?? null, relationId: match.relation ?? null, lat: match.coords.latitude, lon: match.coords.longitude, boundaryVerified: false, resolutionVersion: RESOLUTION_VERSION }
}
