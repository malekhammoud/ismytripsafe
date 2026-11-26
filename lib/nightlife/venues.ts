import type { Venue, VenueType } from "./types"
// Shared, ordered mapping: explicit specialty wins over a generic bar category.
export const TYPE_RULES: [RegExp, VenueType][] = [
  [/lgbt|gay bar|lesbian/, "LGBTQ+ bar"], [/karaoke/, "Karaoke"], [/cocktail/, "Cocktail bar"],
  [/wine bar/, "Wine bar"], [/sports bar/, "Sports bar"], [/beer garden|biergarten/, "Beer garden"],
  [/brewery|beer bar|taproom|brewpub/, "Beer bar / brewery"], [/nightclub|night club|dance club|disco/, "Nightclub"],
  [/dance hall|dancehall/, "Dance hall"], [/live music|music venue|jazz|rock club/, "Live music"],
  [/casino/, "Casino"], [/hookah|shisha/, "Hookah lounge"], [/strip ?club|adult entertainment/, "Adult entertainment"],
  [/\bpub\b|irish pub/, "Pub"], [/restaurant bar|restaurant/, "Restaurant bar"], [/dive|casual|\bbar\b/, "Dive / casual bar"],
]
export function venueType(text: string): VenueType { return TYPE_RULES.find(([r]) => r.test(text.toLowerCase().replace(/_/g, " ")))?.[1] ?? "Other" }
export function normalizeName(s: string) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(the|bar)\b/g, "").replace(/[^\p{L}\p{N}]/gu, "") }
export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6371000
}
function similar(a: string, b: string) {
  const x = normalizeName(a), y = normalizeName(b)
  if (!x || !y) return false
  if (x === y) return true
  if (Math.min(x.length, y.length) < 5) return false
  const grams = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)))
  const p = grams(x), q = grams(y)
  return 2 * [...p].filter(g => q.has(g)).length / (p.size + q.size) >= 0.8
}
export function mergeVenues(osm: Venue[], fsq: Venue[]): Venue[] {
  const out = osm.filter(v => !v.closed).map(v => ({ ...v }))
  const matched = new Set<string>()
  for (const v of fsq) {
    const match = out.filter(o => !matched.has(o.id) && distance(o, v) <= 50 && similar(o.name, v.name)).sort((a, b) => distance(a, v) - distance(b, v))[0]
    if (match) {
      matched.add(match.id)
      if (v.closed) { match.closed = true; continue }
      // Enrich only with fields the second source actually publishes. A guide
      // listing has no rating or popularity, so assigning those wholesale
      // would erase what OSM already knew (and vice versa).
      // A matched guide listing may add its source marker, but it must not
      // replace OSM hours or taxonomy: those fields are also republished in
      // the ODbL export.
      const guide = v.tags?.["wv:guide"] === "yes"
      if (v.rating !== undefined) match.rating = v.rating
      if (v.votes !== undefined) match.votes = v.votes
      if (v.popularity !== undefined) match.popularity = v.popularity
      if (v.price !== undefined) match.price = v.price
      if (!guide && v.hours !== undefined) match.hours = v.hours
      if (v.neighborhood) match.neighborhood = v.neighborhood
      if (!guide && v.type !== "Other") match.type = v.type
      if (v.tags) match.tags = { ...match.tags, ...v.tags }
      match.sources = [...match.sources, ...v.sources]
    } else if (!v.closed) out.push(v)
  }
  // Also deduplicate OSM node/way representations; retain distinct branches.
  return out.filter((v, i) => !v.closed && !out.slice(0, i).some(p => !p.closed && distance(p, v) < 20 && normalizeName(p.name) === normalizeName(v.name)))
}
