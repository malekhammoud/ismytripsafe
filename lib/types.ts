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

/** An active natural-disaster alert near the destination (GDACS). */
export interface HazardEvent {
  kind: string // "Earthquake" | "Tropical cyclone" | "Flood" | …
  severity: "green" | "orange" | "red"
  title: string
  distanceKm: number
  url: string
  date: string | null
}

/** One hazard family's roll-up. See lib/scoring.ts for how they combine. */
export interface PillarScore {
  key: string
  label: string
  score: number | null // 0–100 (100 = safest); null when nothing resolved
  coverage: number // share of the pillar's indicators that resolved, 0–1
  imputed: boolean // true when this is a prior, not measured data
}

/** A ceiling the score cannot exceed while the stated condition holds. */
export interface ScoreCap {
  max: number
  reason: string
}

export interface SafetyReport {
  index: number // 0–100 composite (100 = safest)
  level: SafetyLevel
  saferThanPct: number | null // "safer than X% of countries"
  pillars?: PillarScore[] // hazard-family roll-ups behind the index
  confidence?: number // share of pillar weight backed by real data, 0–1
  caps?: ScoreCap[] // non-compensatory ceilings that bound the index
  signals: SafetySignal[]
  comparisons: Comparison[]
  advisories: OfficialAdvisory[] // official govt advisories (direct from source)
  health: HealthNotice[] // CDC travel health notices (direct from source)
  sources: SafetySource[]
  hazardEvents?: HazardEvent[] // active nearby GDACS disaster alerts
  quakeSummary?: string | null // one-line USGS seismic-history summary
}

// ─── AI enrichment (safety-only) ────────────────────────────────────

export type RiskLevel = "Low" | "Moderate" | "High" | "Severe"

/** A qualitative, AI-assessed risk for a specific threat (robbery, pickpocketing). */
export interface RiskRating {
  level: RiskLevel
  note: string // one-line, city-specific explanation
}

/** How visitors/locals actually feel about day-to-day safety (map page). */
export interface ConsumerSentiment {
  score: number // 0–100 (100 = travellers feel very safe & positive)
  label: string // e.g. "Mostly positive"
  summary: string // 1–2 sentences
}

export type ZoneLevel = "safe" | "caution" | "avoid"

/** A dated, recent development relevant to visitor safety (report page). */
export interface RecentIncident {
  when: string // e.g. "Jun 2026"
  what: string // one line: the incident / trend and why a visitor should care
  source?: string // publication or site name
}

/** A named district plotted as a colour-coded zone on the map. */
export interface MapZone {
  name: string // district / neighbourhood name (geocodable)
  level: ZoneLevel // safe (green) · caution (yellow) · avoid (red)
  note: string // one line: why it's rated this way
}

export interface SafetyEnrichment {
  verdict: string // direct answer, e.g. "Yes — generally safe for visitors"
  summary: string // 2–3 sentences interpreting the real data
  scams: string[] // common scams targeting visitors
  tips: string[] // practical safety tips
  // ── added: qualitative, AI-assessed detail (optional; may be absent) ──
  robbery?: RiskRating // mugging / armed robbery risk to visitors
  pickpocket?: RiskRating // pickpocketing / bag-snatching risk
  consumerSentiment?: ConsumerSentiment // how safe visitors feel (map page)
  recentIncidents?: RecentIncident[] // dated recent developments (report page)
  // ── map-page only, produced by a second model pass AFTER the report is
  //    delivered (see generateMapZones) — absent until that pass lands ──
  safeAreas?: string[]
  avoidAreas?: string[]
  watchOuts?: string[] // current things to watch out for (map page)
  mapZones?: MapZone[] // districts to plot as coloured zones on the map
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
  refresh?: boolean // bypass the cache and regenerate
  /** Preferred LLM provider e.g. "antigravity" | "gemini" | "openrouter". */
  provider?: string
  /**
   * Suppress the local Claude fallback (see lib/agent.ts). A person waiting on
   * an answer gets it whatever the cost; bulk pregeneration does not — a batch
   * that fell back for every one of ~800 remaining destinations would be an
   * expensive way to do work that free models will happily do tomorrow.
   */
  noFallback?: boolean
  /**
   * Re-gather the databases and recompute the score, keeping the existing
   * field research and briefing. Used after a scoring change: the narrative is
   * still accurate, only the numbers behind it moved, so there is no reason to
   * pay a model to write it again. Costs zero model calls.
   */
  rescore?: boolean
}

export type StreamEvent =
  | { type: "geo"; place: GeoPoint }
  | { type: "image"; images: DestinationImages }
  | { type: "safety"; bundle: SafetyBundle }
  | { type: "enrichment"; data: SafetyEnrichment }
  | { type: "text"; content: string }
  | { type: "searching"; query: string }
  | { type: "done"; cached?: boolean; cachedAt?: string; path?: string }
  | { type: "error"; message: string }
