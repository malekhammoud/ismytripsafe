import { VENUE_TYPES, type City, type Lateness, type Mention, type NightlifeReport, type SafetyInput, type Score, type Venue } from "./types"
export const FORMULA_VERSION = "nightlife-v1.1-editorial"
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
export function interpolate(n: number, points: [number, number][]): number {
  if (n <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) if (n <= points[i][0]) {
    const [a, b] = points[i - 1], [c, d] = points[i]
    return b + (n - a) / (c - a) * (d - b)
  }
  return points[points.length - 1][1]
}
export function populationBand(n: number) { return n < 100000 ? "under100k" : n < 500000 ? "100k–500k" : n < 2000000 ? "500k–2m" : "over2m" }
// Provisional and explicitly labelled, not represented as a measured percentile.
export const DENSITY_CUTOFFS: [number, number][] = [[0, 1], [5, 1.5], [15, 2], [30, 3], [60, 4], [100, 5]]
const median = (ns: number[]) => { const s = [...ns].sort((a, b) => a - b); return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2 }
export function vibeWeights(mentions: Mention[], now: Date) {
  const cutoff = now.getTime() - 3 * 365.25 * 86400000
  const eligible = mentions.filter(m => m.relevant && Number.isFinite(Date.parse(m.publishedAt)) && Date.parse(m.publishedAt) >= cutoff && Date.parse(m.publishedAt) <= now.getTime())
  const weights = eligible.map(m => now.getTime() - Date.parse(m.publishedAt) <= 365.25 * 86400000 ? 1 : 0.5)
  const groups = new Map<string, number>()
  eligible.forEach((m, i) => groups.set(m.group, (groups.get(m.group) ?? 0) + weights[i]))
  // No feasible positive weights can meet a 25% cap with fewer than four groups.
  if (groups.size < 4) return { eligible, weights: weights.map(() => 0), groups: groups.size }
  // Water filling: find the largest cap T where sum(min(groupWeight,T)) = 4T.
  let lo = 0, hi = Math.max(...groups.values())
  for (let i = 0; i < 80; i++) { const t = (lo + hi) / 2; if ([...groups.values()].reduce((s, w) => s + Math.min(w, t), 0) >= 4 * t - 1e-10) lo = t; else hi = t }
  return { eligible, weights: eligible.map((m, i) => weights[i] * Math.min(1, lo / groups.get(m.group)!)), groups: groups.size }
}
export function scoreReport(city: City, venues: Venue[], mentions: Mention[], safety: SafetyInput | null, now = new Date(), peers: { population: number; density: number; key?: string }[] = [], lateness?: Lateness) {
  if (safety && !Number.isFinite(safety.index)) safety = null
  const active = venues.filter(v => !v.closed)
  const density = city.population && Number.isFinite(city.population) && city.population > 0 && city.boundaryVerified ? active.length / city.population * 100000 : null
  const band = city.population ? populationBand(city.population) : null
  const cohort = peers.filter(p => p.key !== city.key && populationBand(p.population) === band)
  const percentile = density == null || cohort.length < 20 ? null : cohort.reduce((s, p) => s + (p.density < density ? 1 : p.density === density ? 0.5 : 0), 0) / cohort.length
  const rated = active.filter(v => v.rating != null && Number.isFinite(v.rating) && v.rating >= 0 && v.rating <= 10)
  const usable = rated.filter(v => v.popularity != null && Number.isFinite(v.popularity) && v.popularity >= 0 && v.popularity <= 1 && v.votes != null && Number.isFinite(v.votes) && v.votes > 0)
  const average = rated.length ? rated.reduce((s, v) => s + v.rating!, 0) / rated.length : 0
  const popular = [...usable].sort((a, b) => b.popularity! - a.popularity!).slice(0, 20)
  const ratedQuality = popular.length >= 8 ? median(popular.map(v => (v.votes! * v.rating! + 20 * average) / (v.votes! + 20))) : null
  const counts = VENUE_TYPES.filter(t => t !== "Other").map(t => active.filter(v => v.type === t).length)
  const classified = counts.reduce((a, b) => a + b, 0)
  const effective = classified ? Math.exp(-counts.reduce((sum, n) => n ? sum + n / classified * Math.log(n / classified) : sum, 0)) : 0
  const vibe = vibeWeights(mentions, now)
  const total = vibe.weights.reduce((a, b) => a + b, 0)
  const mentionShare = vibe.eligible.length >= 10 && total > 0 ? vibe.eligible.reduce((s, m, i) => s + vibe.weights[i] * (m.sentiment === "positive" ? 1 : m.sentiment === "mixed" ? 0.5 : 0), 0) / total : null
  const themeCounts = new Map<string, number>()
  vibe.eligible.forEach((m, i) => m.themes.forEach(t => themeCounts.set(t, (themeCounts.get(t) ?? 0) + vibe.weights[i])))
  const themes = [...themeCounts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t)

  // Editorial fallbacks. Licensed ratings and traveler mentions are better
  // when they exist, but a city must not print "not enough data" when its
  // mapped scene already contains hundreds of documented venues. These
  // indices are deterministic, transparent and never passed off as customer
  // ratings or review sentiment.
  const share = (test: (venue: Venue) => boolean) => active.length ? active.filter(test).length / active.length : 0
  const hoursShare = share(v => !!v.hours)
  const websiteShare = share(v => !!(v.tags?.website ?? v.tags?.["contact:website"]))
  const phoneShare = share(v => !!(v.tags?.phone ?? v.tags?.["contact:phone"]))
  const neighbourhoodShare = share(v => !!v.neighborhood)
  const lateKnown = lateness?.known ?? 0
  const late2Share = lateKnown ? lateness!.after2 / lateKnown : 0
  const late4Share = lateKnown ? lateness!.after4 / lateKnown : 0
  const nightlifeShare = share(v => ["Cocktail bar", "Pub", "Dive / casual bar", "Wine bar", "Beer bar / brewery", "Sports bar", "Nightclub", "Live music", "Karaoke", "LGBTQ+ bar", "Beer garden"].includes(v.type))
  const densityScore = density == null ? 0 : clamp(density / 60, 0, 1)
  const documentation = 0.4 * hoursShare + 0.25 * websiteShare + 0.15 * phoneShare + 0.2 * neighbourhoodShare
  const typeScore = Math.min(1, effective / 6)
  const lateVolume = clamp(Math.log10((lateness?.after2 ?? 0) + 1) / 3, 0, 1)
  const editorialQualityRaw = clamp(0.25 * typeScore + 0.18 * late2Share + 0.18 * nightlifeShare + 0.15 * densityScore + 0.24 * documentation, 0, 1)
  const editorialVibeRaw = clamp(0.3 * late2Share + 0.1 * late4Share + 0.2 * nightlifeShare + 0.2 * densityScore + 0.2 * lateVolume, 0, 1)
  // A broad mapped scene should read as a good night out, not as a fraction
  // of an academic checklist. The curve is monotonic, transparent, and still
  // leaves thin scenes in the 2s. It is never used for licensed ratings.
  const editorialScore = (raw: number) => 1 + 4 * Math.pow(clamp(raw, 0, 1), 0.6)
  const qualityValue = ratedQuality == null ? editorialScore(editorialQualityRaw) : interpolate(ratedQuality, [[6.5, 1], [7, 2], [7.5, 3], [8, 4], [8.5, 5]])
  const vibeValue = mentionShare == null ? editorialScore(editorialVibeRaw) : 1 + 4 * mentionShare

  const scores: Score[] = [
    { key: "density", label: "Density", value: density == null ? null : percentile == null ? interpolate(density, DENSITY_CUTOFFS) : 1 + 4 * percentile,
      bullets: density == null ? ["A verified city population and matching boundary are needed."] : [`${density.toFixed(1)} mapped venues per 100,000 residents.`, percentile == null ? "Provisional fixed scale; city-size comparisons need 20 peers." : `Ahead of ${Math.round(percentile * 100)}% of processed cities in its population band.`],
      inputs: { venues: active.length, population: city.population, populationDate: city.populationDate, density, band, percentile, peers: cohort.length, method: percentile == null ? "provisional fixed cut-offs" : "population-band percentile" }, sourceIds: ["osm", "foursquare", "wikidata"] },
    { key: "quality", label: "Quality", value: qualityValue,
      bullets: ratedQuality == null
        ? [`${active.length} active venues; ${effective.toFixed(1)} effective venue types.`, `${Math.round(late2Share * 100)}% of interpretable hours stay open past 2am.`, "Editorial scene index from venue mix, late hours, mapped density and published details; not a customer-rating average."]
        : [`${ratedQuality.toFixed(2)}/10 median adjusted rating among ${popular.length} popular venues.`, "Small samples shrink toward the city average (20-vote prior)."],
      inputs: ratedQuality == null
        ? { method: "editorial-scene-index", rawIndex: editorialQualityRaw, venues: active.length, effectiveTypes: effective, lateAfter2: late2Share, nightlifeShare, densityScore, documentation, hoursShare, websiteShare, phoneShare, neighbourhoodShare }
        : { method: "licensed-ratings", rated: rated.length, usable: usable.length, selected: popular.length, cityMean: rated.length ? average : null, priorVotes: 20, median: ratedQuality },
      sourceIds: ratedQuality == null ? ["osm", "wikidata"] : ["foursquare"] },
    { key: "variety", label: "Variety", value: active.length < 10 || classified < 10 ? null : (effective < 2 ? 1 : effective < 3 ? 2 : effective < 4.5 ? 3 : effective < 6 ? 4 : 5),
      bullets: [`${classified < 10 ? `Only ${classified} classified venues; at least 10 are needed. ` : ""}${counts.filter(n => n > 0).length} venue types; ${effective.toFixed(1)} effective types after balancing their shares.`, `${active.length - classified} unclassified venues excluded from the mix.`], inputs: { classified, effectiveTypes: effective, distinctTypes: counts.filter(n => n > 0).length }, sourceIds: ["osm", "foursquare"] },
    { key: "vibe", label: "Vibe", value: vibeValue,
      bullets: mentionShare == null
        ? [`${Math.round(late2Share * 100)}% of interpretable hours stay open past 2am; ${Math.round(late4Share * 100)}% past 4am.`, `${Math.round(nightlifeShare * 100)}% are bars, pubs, clubs or live-music venues.`, "Editorial night-energy index from mapped hours and venue mix; traveler mentions replace it when enough are available."]
        : [`${Math.round(mentionShare * 100)}% positive-equivalent sentiment, weighted by recency.`, ...themes.slice(0, 1)],
      inputs: mentionShare == null
        ? { method: "editorial-night-energy", rawIndex: editorialVibeRaw, lateAfter2: late2Share, lateAfter4: late4Share, nightlifeShare, densityScore, lateVolume }
        : { method: "traveler-mentions", relevantMentions: vibe.eligible.length, groups: vibe.groups, weightedTotal: total, positiveShare: mentionShare },
      sourceIds: mentionShare == null ? ["osm"] : ["reddit", "blogs", "foursquare"] },
    { key: "safety", label: "Safety", value: safety == null ? null : clamp(Math.ceil(safety.index / 20), 1, 5),
      bullets: safety == null ? ["No existing city safety report."] : [`${Math.round(safety.index)}/100, weighted toward walking after dark and traveler safety sentiment.`, "City-level estimate; district guidance below is shown separately."], inputs: { index: safety?.index ?? null, baseIndex: safety?.baseIndex ?? null, walkingAfterDark: safety?.nightIndex ?? null, travelerSafetySentiment: safety?.sentiment ?? null }, sourceIds: ["safety"] },
  ]
  const available = scores.filter(s => s.value != null)
  const reasons = scores.filter(s => s.value == null).map(s => `${s.label}: ${s.bullets[0]}`)
  if (active.length < 10) reasons.unshift(`Only ${active.length} venues; at least 10 are required.`)
  const outcome: NightlifeReport["outcome"] = active.length < 10 || available.length < 3 ? "withheld" : available.length < 5 ? "limited" : "full"
  return { scores, outcome, reasons, overall: outcome === "withheld" ? null : available.reduce((sum, s) => sum + s.value!, 0) / available.length }
}
