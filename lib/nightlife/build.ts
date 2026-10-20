import type { BuildPhase } from "./visit-types"
import type { CachedReport } from "../cache"
import { computeFinalScore } from "../safety-display"
import { scoreReport, FORMULA_VERSION } from "./scoring"
import { distance, mergeVenues, normalizeName } from "./venues"
import { withinBoundary } from "./boundary"
import { fetchBeer, fetchEvents, fetchFoursquare, fetchOsm, importedMentions, resolveCity, SOURCE_INFO, unavailable } from "./sources"
import { lateness } from "./hours"
import { resolveSafetyZones } from "./zones"
import { collectMentions, canonicalGroup } from "./sentiment"
import { listNightlife, readNightlife, saveNightlife } from "./store"
import { SourceUnavailable } from "./source-errors"
import { PIPELINE_VERSION } from "./version"
import type { City, NightlifeReport, SafetyInput, Source, SourceId, Venue } from "./types"
export function nightlifeSafety(report: CachedReport): SafetyInput | null {
  if (!report.bundle.safety.signals.some(s => s.score != null && Number.isFinite(s.score))) return null
  const final = computeFinalScore(report.bundle.safety, report.enrichment, report.geo.countryCode)
  const night = report.bundle.safety.signals.find(s => s.key === "numbeo_safety_night" && s.score != null) ?? report.bundle.safety.signals.find(s => s.key === "safe_walking_dark" && s.score != null)
  const items = [{ score: final.index, weight: 0.4 }, { score: night?.score ?? null, weight: 0.4 }, { score: final.sentiment.score, weight: 0.2 }].filter((x): x is { score: number; weight: number } => x.score != null && Number.isFinite(x.score))
  let index = items.reduce((s, x) => s + x.score * x.weight, 0) / items.reduce((s, x) => s + x.weight, 0)
  for (const cap of final.caps) index = Math.min(index, cap.max)
  return { index, baseIndex: final.index, nightIndex: night?.score ?? null, sentiment: final.sentiment.score, updatedAt: report.cachedAt, summary: report.enrichment.verdict, signals: night ? [{ label: night.label, value: night.display, source: night.source, year: night.year }] : [], zones: report.enrichment.mapZones ?? [] }
}
export async function buildNightlife(seed: City, safetyReport: CachedReport | null, options: { force?: boolean; rescore?: boolean; eventsOnly?: boolean; onProgress?: (phase: BuildPhase) => Promise<void> } = {}): Promise<NightlifeReport> {
  const previous = await readNightlife(seed.key)
  let safety = safetyReport ? nightlifeSafety(safetyReport) : null
  if ((options.rescore || options.eventsOnly) && !previous) throw new Error("No stored report to refresh")
  if (options.rescore && previous) {
    const peers = (await listNightlife()).flatMap(r => { const d = r.density; return r.city.population && typeof d === "number" ? [{ key: r.city.key, population: r.city.population, density: d }] : [] })
    const next = { ...previous, ...scoreReport(previous.city, previous.venues, previous.mentions, safety, new Date(), peers), safety, formulaVersion: FORMULA_VERSION }
    await saveNightlife(next); return next
  }
  if (options.eventsOnly && previous) {
    const result = await fetchEvents(previous.city, true)
    if (result) { previous.events = result.data.events; previous.sources = previous.sources.map(s => s.id === "ticketmaster" ? result.source : s); previous.refresh.events = result.source.fetchedAt!; await saveNightlife(previous) }
    return previous
  }
  const sources: Source[] = []
  const collect = async <T>(id: SourceId, run: () => Promise<T>) => {
    try { return await run() } catch (e) {
      const source = { ...unavailable(id, e instanceof Error ? e.message : "Fetch failed"), status: e instanceof SourceUnavailable ? "unavailable" as const : "error" as const }
      sources.push(source)
      console.warn(`[nightlife] ${seed.key}: ${id} ${source.status}: ${source.note}`)
      return null
    }
  }
  await options.onProgress?.("resolve")
  const resolved = await collect("wikidata", () => resolveCity(seed, options.force))
  let city: City = resolved?.data ?? { ...seed, population: null, populationDate: null, boundaryVerified: false }
  if (resolved) sources.push({ ...resolved.source, url: `https://www.wikidata.org/wiki/${city.wikidataId}`, note: `${resolved.source.status === "error" ? "Refresh failed; using the last verified city match. " : ""}Matched settlement type, name, country and coordinates. ${city.population ? "Latest dated population for this city." : "No dated population is available."}` })
  await options.onProgress?.("venues")
  const osm = await collect("osm", () => fetchOsm(city, options.force))
  if (osm) { sources.push(osm.source); city = { ...city, relationId: osm.relationId, boundaryVerified: true } }
  if (safety && city.boundaryVerified) safety = await resolveSafetyZones(city, safety).catch(() => safety!)
  await options.onProgress?.("details")
  const [fsq, tm, prices, imported] = await Promise.all([
    collect("foursquare", () => fetchFoursquare(city, options.force)), collect("ticketmaster", () => fetchEvents(city, options.force)),
    collect("numbeo", () => fetchBeer(city, options.force)), importedMentions(seed.key),
  ])
  const collected = await collect("blogs", () => collectMentions(city, fsq?.venues ?? [], options.force))
  if (collected?.errors.length && !sources.some(s => s.id === "blogs")) sources.push({ ...unavailable("blogs", collected.errors.join("; ")), status: "error" })
  const uniqueMentions = new Map([...(collected?.mentions ?? []), ...imported].map(m => [m.id, { ...m, group: canonicalGroup(m.source, m.url) }]))
  const mentions = [...uniqueMentions.values()]
  if (fsq) sources.push(fsq.source)
  else if (!sources.some(s => s.id === "foursquare")) sources.push(unavailable("foursquare", "Ratings unavailable. API access, current category IDs and durable-storage rights are required."))
  if (tm) sources.push(tm.source)
  else if (!sources.some(s => s.id === "ticketmaster")) sources.push(unavailable("ticketmaster", "Event listings are not connected for this report."))
  if (prices) sources.push(prices.source)
  else if (!sources.some(s => s.id === "numbeo")) sources.push(unavailable("numbeo", "Licensed beer-price data is not available for this report."))
  for (const id of ["reddit", "blogs"] as const) {
    const imported = mentions.filter(m => m.source === id)
    if (sources.some(s => s.id === id)) continue
    sources.push(imported.length ? { id, ...SOURCE_INFO[id], fetchedAt: collected?.fetchedAt ?? new Date().toISOString(), status: "ok", note: `${imported.length} permissioned, dated sentiment labels; original text is not republished.` } : unavailable(id, "No permissioned, dated nightlife discussions are available."))
  }
  sources.push(safety ? { id: "safety", ...SOURCE_INFO.safety, url: `https://ismytripsafe.com${seed.safetyPath}`, fetchedAt: safety.updatedAt, status: "ok", note: "Existing city report. City-level night weighting, not measured district crime rates." } : unavailable("safety", "No usable safety data"))
  // Clip radius-selected records to the real admin polygon. If geometry is
  // incomplete, only confidently matched boundary-scoped OSM venues qualify.
  const inBoundary = (fsq?.venues ?? []).filter(f => osm?.boundary ? withinBoundary(f, osm.boundary) : (osm?.venues ?? []).some(o => distance(o, f) <= 50 && normalizeName(o.name) === normalizeName(f.name)))
  const venues: Venue[] = mergeVenues(osm?.venues ?? [], inBoundary)
  const peers = (await listNightlife()).flatMap(r => { const d = r.density; return r.city.population && typeof d === "number" ? [{ key: r.city.key, population: r.city.population, density: d }] : [] })
  await options.onProgress?.("score")
  const scores = scoreReport(city, venues, mentions, safety, new Date(), peers)
  const dateFor = (id: SourceId) => sources.find(s => s.id === id)?.fetchedAt ?? ""
  const next: NightlifeReport = { version: 1, formulaVersion: FORMULA_VERSION, pipelineVersion: PIPELINE_VERSION, city, updatedAt: new Date().toISOString(), ...scores, venues, mentions, events: tm?.data.events ?? [], beer: prices?.data.beer ?? null, safety, lateness: lateness(venues, city), sources, refresh: { venues: dateFor("osm"), events: dateFor("ticketmaster"), population: dateFor("wikidata"), beer: dateFor("numbeo") } }
  // Never replace a published report with an upstream-outage artifact.
  if (previous && previous.outcome !== "withheld" && sources.some(s => s.status === "error") && (next.outcome === "withheld" || next.scores.filter(s => s.value != null).length < previous.scores.filter(s => s.value != null).length)) throw new Error("Refresh failed publication checks after a source error; kept the previous published report")
  await saveNightlife(next)
  return next
}
