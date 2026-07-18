import type { SafetyLevel } from "./types"
import { levelFromIndex, type FinalScore, type CategoryScore, type CategoryKey } from "./safety-display"

// ─── Traveler profile (deterministic personalisation) ───────────────
//
// Who's travelling changes which risks matter: a family cares more about
// health care and street crime than a business traveller does. The profile
// re-weights the already-computed category scores — pure arithmetic, no AI —
// so the same answers for the same destination always give the same number.

export type PartyType = "solo" | "couple" | "family" | "group"
export type AgeBand = "under30" | "30to49" | "50to64" | "65plus"
export type TripStyle = "sightseeing" | "nightlife" | "business" | "outdoors"

export interface TravelerProfile {
  party: PartyType
  age: AgeBand
  style: TripStyle
}

export interface ProfileOption<T extends string> {
  value: T
  label: string
  hint: string
}

export const PARTY_OPTIONS: ProfileOption<PartyType>[] = [
  { value: "solo", label: "Solo", hint: "Travelling alone" },
  { value: "couple", label: "Couple", hint: "Two adults" },
  { value: "family", label: "Family with kids", hint: "Children coming along" },
  { value: "group", label: "Group", hint: "Friends or a tour group" },
]

export const AGE_OPTIONS: ProfileOption<AgeBand>[] = [
  { value: "under30", label: "Under 30", hint: "" },
  { value: "30to49", label: "30–49", hint: "" },
  { value: "50to64", label: "50–64", hint: "" },
  { value: "65plus", label: "65+", hint: "" },
]

export const STYLE_OPTIONS: ProfileOption<TripStyle>[] = [
  { value: "sightseeing", label: "Sightseeing", hint: "Landmarks, museums, city walking" },
  { value: "nightlife", label: "Nightlife", hint: "Bars, clubs, late nights out" },
  { value: "business", label: "Business", hint: "Meetings, hotels, transfers" },
  { value: "outdoors", label: "Outdoors", hint: "Hiking, beaches, remote areas" },
]

const partyLabel = (v: PartyType) => PARTY_OPTIONS.find((o) => o.value === v)?.label ?? v
const ageLabel = (v: AgeBand) => AGE_OPTIONS.find((o) => o.value === v)?.label ?? v
const styleLabel = (v: TripStyle) => STYLE_OPTIONS.find((o) => o.value === v)?.label ?? v

/** "Family with kids · 30–49 · Sightseeing" — shown beside the score. */
export function profileSummary(p: TravelerProfile): string {
  return `${partyLabel(p.party)} · ${ageLabel(p.age)} · ${styleLabel(p.style)}`
}

// ─── URL round-trip (the profile lives in ?party=&age=&style=) ──────

export function profileToParams(p: TravelerProfile, params: URLSearchParams): void {
  params.set("party", p.party)
  params.set("age", p.age)
  params.set("style", p.style)
}

export function profileFromParams(params: URLSearchParams): TravelerProfile | null {
  const party = params.get("party") as PartyType | null
  const age = params.get("age") as AgeBand | null
  const style = params.get("style") as TripStyle | null
  if (!party || !age || !style) return null
  if (!PARTY_OPTIONS.some((o) => o.value === party)) return null
  if (!AGE_OPTIONS.some((o) => o.value === age)) return null
  if (!STYLE_OPTIONS.some((o) => o.value === style)) return null
  return { party, age, style }
}

// ─── Deterministic score adjustment ─────────────────────────────────
//
// Each answer adds extra weight to the categories it makes more important.
// The personalised index is a weighted mean: the general final score keeps
// (1 − Σw) of the weight, and each emphasised category contributes w × its
// own 0–100 score. Categories with no data are skipped. Total extra weight
// is capped so the general score always remains the backbone.

type Emphasis = Partial<Record<Exclude<CategoryKey, "advisories">, number>>

const PARTY_EMPHASIS: Record<PartyType, Emphasis> = {
  solo: { crime: 0.14 },
  couple: { crime: 0.04 },
  family: { crime: 0.1, health: 0.12 },
  group: { crime: 0.06 },
}

const AGE_EMPHASIS: Record<AgeBand, Emphasis> = {
  under30: { crime: 0.04 },
  "30to49": {},
  "50to64": { health: 0.08 },
  "65plus": { health: 0.16, stability: 0.04 },
}

const STYLE_EMPHASIS: Record<TripStyle, Emphasis> = {
  sightseeing: { crime: 0.05 },
  nightlife: { crime: 0.14 },
  business: { stability: 0.06 },
  outdoors: { health: 0.1 },
}

const MAX_EXTRA_WEIGHT = 0.4

const CATEGORY_LABEL: Record<Exclude<CategoryKey, "advisories">, string> = {
  crime: "Crime",
  health: "Health & Air",
  stability: "Stability",
}

export interface PersonalScore {
  index: number
  level: SafetyLevel
  personalized: boolean
  /** general (non-personalised) index, for "general score: N" context */
  baseIndex: number
  /** human-readable reweighting, e.g. "Crime ×1.9 weight" */
  drivers: string[]
}

export function personalizeScore(
  base: FinalScore,
  categories: CategoryScore[],
  profile: TravelerProfile | null
): PersonalScore {
  if (!profile) {
    return {
      index: base.index,
      level: base.level,
      personalized: false,
      baseIndex: base.index,
      drivers: [],
    }
  }

  // Sum the emphasis each answer places on each category.
  const emphasis: Record<string, number> = {}
  for (const e of [
    PARTY_EMPHASIS[profile.party],
    AGE_EMPHASIS[profile.age],
    STYLE_EMPHASIS[profile.style],
  ]) {
    for (const [cat, w] of Object.entries(e ?? {})) {
      emphasis[cat] = (emphasis[cat] ?? 0) + (w ?? 0)
    }
  }

  // Cap the total extra weight, scaling proportionally if exceeded.
  let total = Object.values(emphasis).reduce((a, b) => a + b, 0)
  if (total > MAX_EXTRA_WEIGHT) {
    const scale = MAX_EXTRA_WEIGHT / total
    for (const k of Object.keys(emphasis)) emphasis[k] *= scale
    total = MAX_EXTRA_WEIGHT
  }

  const catScore = (k: string) => categories.find((c) => c.key === k)?.score ?? null

  let sum = base.index * (1 - total)
  let used = 1 - total
  const drivers: string[] = []
  for (const [cat, w] of Object.entries(emphasis)) {
    const s = catScore(cat)
    if (s == null || w <= 0) continue
    sum += s * w
    used += w
    drivers.push(`${CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat} +${Math.round(w * 100)}% weight`)
  }

  const index = Math.round(Math.max(0, Math.min(100, sum / used)))
  return {
    index,
    level: levelFromIndex(index),
    personalized: drivers.length > 0,
    baseIndex: base.index,
    drivers,
  }
}
