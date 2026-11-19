import type { Mention, NightlifeReport, Venue } from "./types"

export const plainCopy = (text: string) => text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",")
const normalized = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
export function recentMentions(mentions: Mention[], now = Date.now()) {
  return mentions.filter(m => m.relevant && Date.parse(m.publishedAt) <= now && Date.parse(m.publishedAt) >= now - 3 * 365.25 * 86400000)
}
export function venueShortlist(report: NightlifeReport) {
  const mentions = recentMentions(report.mentions).filter(m => m.sentiment === "positive")
  return report.venues.filter(v => !v.closed).map(venue => {
    // Only explicit, source-checked recommendations count. A venue name in a
    // negative account or a general topic is not an endorsement.
    const evidence = mentions.filter(m => m.recommendedVenues?.some(name => normalized(name) === normalized(venue.name)))
    const groups = new Set(evidence.map(m => m.group)).size
    const rated = venue.rating != null && venue.votes != null && venue.votes > 0
    return { venue, evidence, groups, rated }
  }).filter(v => v.rated || v.groups > 0).sort((a, b) => b.groups - a.groups || (b.venue.rating ?? 0) - (a.venue.rating ?? 0) || (b.venue.votes ?? 0) - (a.venue.votes ?? 0) || a.venue.name.localeCompare(b.venue.name)).slice(0, 8)
}
export function venueSource(venue: Venue) { return venue.sources.find(s => s.id === "foursquare")?.url ?? venue.sources[0]?.url }
export function priceBand(usd: number | null) { return usd == null || !Number.isFinite(usd) || usd <= 0 ? null : usd < 4 ? 1 : usd < 8 ? 2 : 3 }
const areaKey = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
export function venueTraits(report: NightlifeReport) {
  const total = report.venues.length
  const count = (test: (venue: Venue) => boolean) => report.venues.filter(test).length
  const percent = (n: number) => total ? Math.round(n / total * 100) : 0
  const withHours = count(v => !!v.hours), knownHours = report.lateness.known
  const lateAfter2 = knownHours ? Math.round(report.lateness.after2 / knownHours * 100) : null
  return {
    total, withHours, knownHours, lateAfter2, percent,
    outdoor: count(v => v.tags?.outdoor_seating === "yes"),
    wheelchair: count(v => v.tags?.wheelchair === "yes"),
    smokeFree: count(v => v.tags?.smoking === "no"),
    websites: count(v => !!(v.tags?.website ?? v.tags?.["contact:website"])),
    phones: count(v => !!(v.tags?.phone ?? v.tags?.["contact:phone"])),
    reservations: count(v => v.tags?.reservation === "yes"),
  }
}
export function neighborhoodConcentration(report: NightlifeReport) {
  const counts = new Map<string, number>()
  for (const venue of report.venues) {
    const name = venue.neighborhood?.trim()
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const zones = new Map((report.safety?.zones ?? []).map(zone => [areaKey(zone.name), zone.level]))
  return [...counts].map(([name, count]) => ({ name, count, share: report.venues.length ? count / report.venues.length : 0, level: zones.get(areaKey(name)) ?? null }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
}
// Some cities have good street addresses but no neighbourhood tags. Street
// clusters still give a reader a concrete place to start without inventing a
// boundary or a district name.
export function streetConcentration(report: NightlifeReport) {
  const counts = new Map<string, number>()
  for (const venue of report.venues) {
    const name = venue.tags?.["addr:street"]?.trim()
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count, share: report.venues.length ? count / report.venues.length : 0, level: null }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
}
// The page should not ship thousands of Leaflet markers and list rows to every
// phone. Keep one venue per small grid cell so the map still shows the shape of
// the city, and leave the complete list in the ODbL data endpoint.
export function venueMapSample(venues: Venue[], cap = 600) {
  // The map only needs these fields; full OSM tag bags stay on the server.
  const lean = (venue: Venue): Venue => ({ id: venue.id, name: venue.name, type: venue.type, lat: venue.lat, lon: venue.lon, ...(venue.neighborhood ? { neighborhood: venue.neighborhood } : {}), sources: venue.sources.slice(0, 1) })
  if (venues.length <= cap) return venues.map(lean)
  const cells = new Map<string, Venue>()
  for (const venue of venues) {
    const key = `${Math.round(venue.lat / 0.004)}:${Math.round(venue.lon / 0.004)}`
    if (!cells.has(key)) cells.set(key, venue)
  }
  const sampled = [...cells.values()]
  if (sampled.length <= cap) return sampled.map(lean)
  const step = sampled.length / cap
  return Array.from({ length: cap }, (_, i) => lean(sampled[Math.floor(i * step)]))
}
export function nightlifeClusters(report: NightlifeReport) {
  const areas = neighborhoodConcentration(report)
  if (areas.length >= 3 && areas[0].count >= 5) return { kind: "neighbourhood" as const, items: areas, published: report.venues.filter(v => v.neighborhood).length }
  const streets = streetConcentration(report)
  if (streets.length >= 3 && streets[0].count >= 8) return { kind: "street" as const, items: streets, published: report.venues.filter(v => v.tags?.["addr:street"]).length }
  return { kind: null, items: [] as { name: string; count: number; share: number; level: "safe" | "caution" | "avoid" | null }[], published: 0 }
}
// Deterministic prose from published fields. No model call, so the summary
// cannot invent a venue, price or safety claim.
export function sceneSummary(report: NightlifeReport) {
  const traits = venueTraits(report), clusters = nightlifeClusters(report).items, lines: string[] = []
  if (traits.total) lines.push(`${traits.total.toLocaleString("en")} mapped bars, clubs and late-night venues sit inside the verified city boundary.`)
  if (traits.withHours) lines.push(traits.lateAfter2 == null
    ? `${traits.withHours.toLocaleString("en")} publish opening hours; their late-night schedules are not machine-readable yet, so check the venue's current hours.`
    : `${traits.withHours.toLocaleString("en")} publish opening hours; of the ${traits.knownHours.toLocaleString("en")} with interpretable schedules, ${traits.lateAfter2}% stay open past 2am on at least one night of the week.`)
  if (clusters[0] && clusters[0].share >= 0.04) lines.push(`${clusters[0].name} has the densest cluster, with ${clusters[0].count.toLocaleString("en")} mapped venues.`)
  if (traits.outdoor) lines.push(`${traits.outdoor.toLocaleString("en")} list outdoor seating (${traits.percent(traits.outdoor)}%), useful for a warm-weather start.`)
  if (report.safety) lines.push(`The after-dark safety score is ${Math.round(report.safety.index)}/100, based on the city safety report rather than district-level crime counts.`)
  return lines.slice(0, 4)
}
export function sceneNumbers(report: NightlifeReport) {
  const traits = venueTraits(report)
  const density = report.scores.find(score => score.key === "density")?.inputs.density
  const count = (n: number) => n.toLocaleString("en")
  return [
    { label: "Mapped venues", value: count(report.venues.length), note: "lower bound, not a census" },
    { label: "Venue types", value: count(new Set(report.venues.map(venue => venue.type)).size), note: "including Other" },
    { label: "Opening hours", value: `${count(traits.withHours)} (${traits.percent(traits.withHours)}%)`, note: "published on the map" },
    { label: "Past midnight", value: report.lateness.known ? `${Math.round(report.lateness.afterMidnight / report.lateness.known * 100)}%` : "n/a", note: `${count(report.lateness.known)} interpretable schedules` },
    { label: "Past 2am", value: report.lateness.known ? `${Math.round(report.lateness.after2 / report.lateness.known * 100)}%` : "n/a", note: "of interpretable schedules" },
    { label: "Past 4am", value: report.lateness.known ? `${Math.round(report.lateness.after4 / report.lateness.known * 100)}%` : "n/a", note: "of interpretable schedules" },
    { label: "Outdoor seating", value: `${traits.percent(traits.outdoor)}%`, note: `${count(traits.outdoor)} venues` },
    { label: "Step-free access", value: `${traits.percent(traits.wheelchair)}%`, note: `${count(traits.wheelchair)} venues` },
    { label: "Smoke-free policy", value: `${traits.percent(traits.smokeFree)}%`, note: `${count(traits.smokeFree)} venues` },
    { label: "Website listed", value: `${count(traits.websites)}`, note: `${traits.percent(traits.websites)}% of venues` },
    { label: "Population", value: report.city.population ? count(report.city.population) : "n/a", note: report.city.populationDate ? `dated ${report.city.populationDate}` : "city safety report" },
    { label: "Venues per 100k", value: typeof density === "number" ? density.toFixed(1) : "n/a", note: "within verified boundary" },
    { label: "After-dark safety", value: report.safety ? `${Math.round(report.safety.index)}/100` : "n/a", note: "city-level estimate" },
  ]
}
export function nightPlan(report: NightlifeReport) {
  const active = report.venues.filter(venue => !venue.closed), used = new Set<string>()
  const clusters = nightlifeClusters(report), cluster = clusters.items[0]
  const inCluster = cluster ? active.filter(venue => clusters.kind === "neighbourhood" ? venue.neighborhood === cluster.name : venue.tags?.["addr:street"] === cluster.name) : []
  const pool = inCluster.length >= 3 ? inCluster : active
  const pick = (test: (venue: Venue) => boolean) => {
    const venue = pool.find(candidate => !used.has(candidate.id) && test(candidate))
    if (venue) used.add(venue.id)
    return venue
  }
  const early = pick(venue => (venue.tags?.outdoor_seating === "yes" || ["Pub", "Beer garden", "Wine bar"].includes(venue.type)) && !!venue.hours)
    ?? pick(venue => !!venue.hours) ?? pick(() => true)
  const late = pick(venue => ["Nightclub", "Live music", "Cocktail bar"].includes(venue.type)) ?? pick(() => true)
  const after = pick(venue => venue.type === "Nightclub") ?? pick(() => true)
  return [
    early ? { time: "Early evening", venue: early, note: early.hours ? plainCopy(early.hours) : "Check current hours" } : null,
    late ? { time: "Late", venue: late, note: late.neighborhood ? plainCopy(late.neighborhood) : late.type } : null,
    after ? { time: "After hours", venue: after, note: "A nightclub for the end of the night" } : null,
  ].filter((item): item is { time: string; venue: Venue; note: string } => !!item)
}
export function goodToKnow(report: NightlifeReport) {
  const traits = venueTraits(report), notes: string[] = []
  if (traits.outdoor > 0) notes.push(`${traits.percent(traits.outdoor)}% of mapped venues list outdoor seating.`)
  if (traits.wheelchair > 0) notes.push(`${traits.percent(traits.wheelchair)}% list step-free access; check individual venues before relying on it.`)
  if (traits.smokeFree > 0) notes.push(`${traits.percent(traits.smokeFree)}% list a smoke-free policy.`)
  if (traits.reservations > 0) notes.push(`${traits.reservations.toLocaleString("en")} venues accept reservations.`)
  if (traits.websites > 0) notes.push(`${traits.websites.toLocaleString("en")} listings link to a website or contact page.`)
  const areas = nightlifeClusters(report).items
  if (areas[0]) notes.push(`${areas[0].name} has the densest cluster of mapped venues (${areas[0].count.toLocaleString("en")}).`)
  const avoid = report.safety?.zones.filter(zone => zone.level === "avoid") ?? []
  if (avoid.length) notes.push(`The safety report marks ${avoid.map(zone => zone.name).join(", ")} as areas to avoid after dark.`)
  return notes.slice(0, 6)
}
export function faqItems(report: NightlifeReport) {
  const traits = venueTraits(report), areas = nightlifeClusters(report).items
  const overall = report.overall == null ? "not yet rated" : `${report.overall.toFixed(1)}/5`
  const quality = report.scores.find(score => score.key === "quality")
  const vibe = report.scores.find(score => score.key === "vibe")
  const late = traits.lateAfter2 == null ? "Late-night opening hours are not machine-readable yet." : `${traits.lateAfter2}% of venues with interpretable hours stay open past 2am.`
  return [
    { question: `Is ${report.city.city} good for nightlife?`, answer: `${report.city.city} scores ${overall} across the available ratings. ${quality?.value != null ? `Quality is ${quality.value.toFixed(1)}/5 and ${vibe?.value != null ? `vibe is ${vibe.value.toFixed(1)}/5.` : "vibe is not yet rated."}` : "The scene is rated on mapped venue evidence."} ${traits.total.toLocaleString("en")} venues are mapped.` },
    { question: `How late does ${report.city.city} stay open?`, answer: late },
    { question: `Where is the nightlife concentrated?`, answer: areas[0] ? `${areas[0].name} has the highest concentration of mapped venues, with ${areas[0].count.toLocaleString("en")}. ${areas[1] ? `${areas[1].name} and ${areas[2]?.name ?? "nearby areas"} follow.` : ""}` : "Neighbourhood tags are sparse; use the venue map and the starting points above." },
    { question: `Is ${report.city.city} safe after dark?`, answer: report.safety ? `The city safety report scores ${Math.round(report.safety.index)}/100 after dark. ${report.safety.zones.filter(zone => zone.level === "avoid").length ? "Check the district guidance below before choosing a route." : "Keep normal precautions in crowded nightlife areas."}` : "No usable city safety data is attached." },
    { question: `How many nightlife venues are mapped?`, answer: `${traits.total.toLocaleString("en")} venues are mapped inside the verified city boundary. Counts are a lower bound because not every venue is in OpenStreetMap.` },
  ]
}
export function documentedVenues(report: NightlifeReport) {
  const completeness = (venue: Venue) => (venue.hours ? 2 : 0) + (venue.tags?.website ?? venue.tags?.["contact:website"] ? 2 : 0) + (venue.tags?.phone ?? venue.tags?.["contact:phone"] ? 1 : 0)
    + (venue.neighborhood ? 1 : 0) + (venue.type !== "Other" ? 1 : 0) + (venue.tags?.outdoor_seating === "yes" ? 1 : 0)
  return report.venues.filter(venue => !venue.closed).map(venue => ({ venue, score: completeness(venue) })).filter(item => item.score >= 4)
    .sort((a, b) => b.score - a.score || a.venue.name.localeCompare(b.venue.name)).slice(0, 6)
}
// A specific verified night photograph, never an unrelated city or AI image.
export const NIGHT_PHOTOS: Record<string, { url: string; source: string; author: string; authorUrl?: string; licence: string }> = {
  de_berlin: {
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Berlin_at_night.JPG/1280px-Berlin_at_night.JPG",
    source: "https://commons.wikimedia.org/wiki/File:Berlin_at_night.JPG", author: "Vladimir Basovskiy, www.all-around-germany.de", authorUrl: "https://www.all-around-germany.de", licence: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  ge_tbilisi: {
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Tbilisi_night_view.jpg/1280px-Tbilisi_night_view.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Tbilisi_night_view.jpg", author: "Tiia Monto", licence: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  pt_porto: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Porto_by_night_from_the_Dom_Lu%C3%ADs_bridge.jpg/1280px-Porto_by_night_from_the_Dom_Lu%C3%ADs_bridge.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Porto_by_night_from_the_Dom_Lu%C3%ADs_bridge.jpg",
    author: "Effeietsanders", licence: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
}
