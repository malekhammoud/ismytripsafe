export const VENUE_TYPES = ["Cocktail bar", "Pub", "Dive / casual bar", "Wine bar", "Beer bar / brewery", "Sports bar", "Nightclub", "Live music", "Karaoke", "LGBTQ+ bar", "Beer garden", "Other"] as const
export type VenueType = typeof VENUE_TYPES[number]
export type ScoreKey = "density" | "quality" | "variety" | "vibe" | "safety"
export type SourceId = "osm" | "foursquare" | "wikidata" | "ticketmaster" | "numbeo" | "reddit" | "blogs" | "safety"
export interface Source {
  id: SourceId; name: string; url: string; fetchedAt: string | null
  status: "ok" | "unavailable" | "error"; note: string; licence: string
  failure?: import("./source-errors").SourceFailure
}
export interface Venue {
  id: string; name: string; lat: number; lon: number; type: VenueType
  sources: { id: SourceId; url: string }[]; hours?: string; neighborhood?: string
  rating?: number; votes?: number; popularity?: number; price?: number; closed?: boolean
  tags?: Record<string, string>
}
export interface Mention {
  id: string; group: string; source: "reddit" | "blogs" | "foursquare"
  url: string; publishedAt: string; sentiment: "positive" | "mixed" | "negative"
  themes: string[]; relevant: boolean
}
export interface City {
  key: string; city: string; country: string; countrySlug: string; citySlug: string
  safetyPath: string; lat: number; lon: number; countryCode: string
  wikidataId: string | null; population: number | null; populationDate: string | null
  relationId: number | null; boundaryVerified: boolean
  resolutionVersion?: number
  resolutionMethod?: "search" | "linked-data"
}
export interface Score {
  key: ScoreKey; label: string; value: number | null; bullets: string[]
  inputs: Record<string, string | number | null>; sourceIds: SourceId[]
}
export interface SafetyInput {
  index: number; baseIndex: number; nightIndex: number | null; sentiment: number | null
  updatedAt: string; summary: string; signals: { label: string; value: string; source: string; year: string | null }[]
  zones: { name: string; level: "safe" | "caution" | "avoid"; note: string; lat?: number; lon?: number; geojson?: unknown }[]
}
export interface NightEvent { id: string; name: string; date: string; venue: string; url: string }
export interface BeerPrices { currency: string; domestic: number | null; imported: number | null; domesticUsd: number | null; importedUsd: number | null; updatedAt: string }
export interface Lateness { known: number; total: number; afterMidnight: number; after2: number; after4: number; note: string }
export interface NightlifeReport {
  version: 1; formulaVersion: string; pipelineVersion?: string; city: City; updatedAt: string
  outcome: "full" | "limited" | "withheld"; reasons: string[]; overall: number | null
  scores: Score[]; venues: Venue[]; mentions: Mention[]; events: NightEvent[]
  beer: BeerPrices | null; safety: SafetyInput | null; lateness: Lateness; sources: Source[]
  refresh: { venues: string; events: string; population: string; beer: string }
}
