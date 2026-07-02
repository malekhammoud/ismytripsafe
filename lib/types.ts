export type SafetyLevel =
  | "VERY_SAFE"
  | "SAFE"
  | "MODERATE"
  | "CAUTION"
  | "HIGH_RISK"

// ─── Geo / place ────────────────────────────────────────────────────

export interface GeoPoint {
  city: string
  lat: number
  lon: number
  countryCode: string // ISO2
  country: string
  timezone: string
  population: number | null
}

export interface CountryFacts {
  currency: string
  currencySymbol: string
  languages: string[]
  region: string
  flag: string // emoji
  capital: string | null
}

export interface DestinationImages {
  hero: string | null
  blurb: string | null
  gallery: string[]
}

// ─── Safety signals (the core product) ──────────────────────────────

export type SignalGroup =
  | "Violent crime"
  | "Conflict & terrorism"
  | "Institutions & rule of law"
  | "Everyday hazards"
  | "Health & environment"
  | "Official guidance"

export interface SafetySignal {
  key: string
  label: string
  group: SignalGroup
  source: string // database name
  value: number | null // raw value (null = no data)
  display: string // human-formatted value
  year: string | null
  score: number | null // normalized 0–100 (100 = safest); null if no data
  lowerIsBetter: boolean
  note: string // plain-language meaning
}

export interface ComparisonEntry {
  name: string
  value: number
  isTarget?: boolean
  isWorld?: boolean
}

export interface Comparison {
  metric: string
  unit: string
  lowerIsBetter: boolean
  entries: ComparisonEntry[]
}

export interface SafetySource {
  name: string
  detail: string
}

/** An official government travel advisory, pulled directly from the issuing
 *  government's data feed (no AI / web search). */
export interface OfficialAdvisory {
  source: string // e.g. "U.S. Department of State"
  sourceShort: string // "US" | "UK"
  level: number | null // 1 (safest) – 4 (do not travel); null if not graded
  levelLabel: string // "Exercise Increased Caution"
  headline: string // short one-line summary of the rating
  summary: string // a sentence or two of official text
  url: string // link to the full official advisory
  updated: string | null // last-updated date string from the source
}

/** A CDC Travelers' Health notice, pulled directly from the CDC feed. */
export interface HealthNotice {
  level: number // 1 (Watch) – 3 (Warning)
  levelLabel: string // "Watch" | "Alert" | "Warning"
  title: string // e.g. "Yellow Fever in Colombia"
  description: string
  url: string
  updated: string | null
  scope: "country" | "global"
}

export interface SafetyReport {
  index: number // 0–100 composite (100 = safest)
  level: SafetyLevel
  saferThanPct: number | null // "safer than X% of countries"
  signals: SafetySignal[]
  comparisons: Comparison[]
  advisories: OfficialAdvisory[] // official govt advisories (direct from source)
  health: HealthNotice[] // CDC travel health notices (direct from source)
  sources: SafetySource[]
}

// ─── AI enrichment (safety-only) ────────────────────────────────────

export interface SafetyEnrichment {
  verdict: string // direct answer, e.g. "Yes — generally safe for visitors"
  summary: string // 2–3 sentences interpreting the real data
  safeAreas: string[]
  avoidAreas: string[]
  scams: string[] // common scams targeting visitors
  tips: string[] // practical safety tips
}

// ─── Bundle / inputs / stream ───────────────────────────────────────

export interface SafetyBundle {
  geo: GeoPoint
  country: CountryFacts | null
  images: DestinationImages
  safety: SafetyReport
}

export interface SafetyQuery {
  place: string
  placeGeo?: GeoPoint | null
}

export type StreamEvent =
  | { type: "geo"; place: GeoPoint }
  | { type: "image"; images: DestinationImages }
  | { type: "safety"; bundle: SafetyBundle }
  | { type: "enrichment"; data: SafetyEnrichment }
  | { type: "text"; content: string }
  | { type: "searching"; query: string }
  | { type: "done" }
  | { type: "error"; message: string }
