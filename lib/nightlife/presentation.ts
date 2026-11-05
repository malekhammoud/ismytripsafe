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
