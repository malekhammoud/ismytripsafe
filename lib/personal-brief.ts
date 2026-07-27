import type { SafetyBundle, SafetyEnrichment, SafetySignal } from "./types"
import type { TravelerProfile } from "./profile"

// ─── The personalised briefing ──────────────────────────────────────
//
// The score personalisation (lib/profile.ts) answers "how much does this
// place's risk matter to you". This answers the other half: "which of these
// findings are about *your* trip". Both are pure functions of the profile and
// the report's own data — no AI, no second model call, so the same answers for
// the same destination always produce the same words.
//
// Every note here must be traceable to something already on the page: a signal
// value, a CDC notice, a live hazard alert, or a field-research rating. When
// the underlying data is missing the note is dropped rather than padded.

export interface PersonalNote {
  /** Which answer earned this note — drives the icon on the panel. */
  key: "gender" | "party" | "age" | "style"
  title: string
  body: string
}

export interface PersonalBrief {
  /** One sentence naming who this report was built for. */
  intro: string
  notes: PersonalNote[]
}

// ─── Sentence fragments ─────────────────────────────────────────────

const PARTY_PHRASE: Record<TravelerProfile["party"], string> = {
  solo: "a solo traveller",
  couple: "a couple",
  family: "a family with children",
  group: "a group",
}

const AGE_PHRASE: Record<TravelerProfile["age"], string> = {
  under30: "everyone under 30",
  "30to49": "aged 30–49",
  "50to64": "aged 50–64",
  "65plus": "with a traveller 65 or older",
}

const STYLE_PHRASE: Record<TravelerProfile["style"], string> = {
  sightseeing: "sightseeing",
  nightlife: "nights out",
  business: "business",
  outdoors: "the outdoors",
}

/** "a solo female traveller" / "a family with children, women in the party" */
function whoPhrase(p: TravelerProfile): string {
  const base = PARTY_PHRASE[p.party]
  if (p.gender === "unspecified") return base
  if (p.party === "solo") {
    if (p.gender === "female") return "a solo female traveller"
    if (p.gender === "male") return "a solo male traveller"
    return base
  }
  const clause =
    p.gender === "female"
      ? "women in the party"
      : p.gender === "male"
        ? "men in the party"
        : "women and men in the party"
  return `${base}, ${clause}`
}

// ─── Data lookups ───────────────────────────────────────────────────

const pct = (n: number) => `${Math.round(n)}%`

/** Clips the report's own wording to note length, on a word boundary. */
function trimNote(s: string | undefined, max = 180): string {
  if (!s) return ""
  const t = s.trim().replace(/\s+/g, " ")
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/[\s,;:]+\S*$/, "")}…`
}

/** Field-research notes rarely end in punctuation — close them so quoted
 *  fragments don't run into the sentence that follows. */
function sentence(s: string): string {
  const t = trimNote(s)
  if (!t) return ""
  return /[.!?…]$/.test(t) ? `${t} ` : `${t}. `
}

/**
 * Build the personalised briefing for a report.
 *
 * Notes are ordered by how directly the answer bears on personal risk —
 * who's in the party first, then the party shape, then age, then trip style —
 * and capped at four so the panel stays a briefing, not a second report.
 */
export function buildPersonalBrief(
  profile: TravelerProfile,
  bundle: SafetyBundle,
  intel: SafetyEnrichment | null
): PersonalBrief {
  const { geo, safety } = bundle
  const sig = (key: string): SafetySignal | undefined =>
    safety.signals.find((s) => s.key === key && s.value != null)

  const walkDark = sig("safe_walking_dark")
  const sexualViolence = sig("sexual_violence")
  const hospitals = sig("hospitals")
  const roadDeaths = sig("road_deaths")
  const air = sig("air_quality")
  const weather = sig("weather")
  const hazards = sig("natural_hazards")
  const bribery = sig("bribery_contact_rate")
  const ruleOfLaw = sig("rule_of_law")
  const localNotices = safety.health.filter((n) => n.scope !== "global")
  const liveHazards = safety.hazardEvents ?? []
  const nightZones = (intel?.mapZones ?? []).filter((z) => z.level !== "safe")

  const intro =
    `This report was built for ${whoPhrase(profile)}, ${AGE_PHRASE[profile.age]}, ` +
    `travelling to ${geo.city} for ${STYLE_PHRASE[profile.style]}.`

  const notes: PersonalNote[] = []
  // Pickpocketing is relevant to several answers — say it once, in the most
  // specific note that applies.
  let usedPickpocket = false

  // ── Who's in the party ──
  if (profile.gender === "female") {
    const bits: string[] = []
    if (walkDark?.value != null) {
      bits.push(
        `${pct(walkDark.value)} of people in ${geo.country} say they feel safe walking alone after dark` +
          `${walkDark.year ? ` (UN SDG, ${walkDark.year})` : ""}`
      )
    }
    if (sexualViolence?.value != null) {
      bits.push(`sexual-violence victimisation runs at ${sexualViolence.display}`)
    }
    if (intel?.robbery) {
      bits.push(`street robbery is rated ${intel.robbery.level.toLowerCase()} risk here`)
    }
    if (bits.length) {
      notes.push({
        key: "gender",
        title: profile.party === "solo" ? "Travelling here as a woman, alone" : "Women in your party",
        body:
          `${bits.join("; ")}. ` +
          (nightZones.length
            ? `The districts our field research flags for caution after dark are ${nightZones.slice(0, 3).map((z) => z.name).join(", ")} — worth avoiding on foot late.`
            : `No specific districts were flagged as no-go after dark, but the crime weighting below leans on these indicators for you.`),
      })
    }
  }

  // ── Party shape ──
  if (profile.party === "family") {
    const bits: string[] = []
    if (hospitals?.value != null) bits.push(`hospitals — ${hospitals.display}`)
    if (roadDeaths?.value != null) bits.push(`road deaths at ${roadDeaths.display}`)
    if (air?.value != null) bits.push(`air quality ${air.display}`)
    notes.push({
      key: "party",
      title: "Travelling with children",
      body:
        (bits.length ? `What matters most with kids: ${bits.join(", ")}. ` : "") +
        (localNotices.length
          ? `The CDC has ${localNotices.length} active health notice${localNotices.length === 1 ? "" : "s"} for this destination — check it before you book vaccinations.`
          : `The CDC has no destination-specific health notice open right now.`) +
        ` Health care and street crime both carry extra weight in your score.`,
    })
  } else if (profile.party === "solo" && profile.gender !== "female") {
    const bits: string[] = []
    if (walkDark?.value != null) bits.push(`${pct(walkDark.value)} of locals feel safe walking alone after dark`)
    if (intel?.pickpocket) {
      bits.push(`pickpocketing is ${intel.pickpocket.level.toLowerCase()} risk`)
      usedPickpocket = true
    }
    if (bits.length) {
      notes.push({
        key: "party",
        title: "On your own",
        body: `${bits.join("; ")}. With nobody to watch your bag or call for help, street crime carries more weight in your score than it would for a group.`,
      })
    }
  } else if (profile.party === "couple" || profile.party === "group") {
    const scam = intel?.scams?.[0]
    if (intel?.pickpocket || scam) {
      usedPickpocket = usedPickpocket || !!intel?.pickpocket
      notes.push({
        key: "party",
        title: profile.party === "couple" ? "Travelling as a couple" : "Travelling as a group",
        body:
          `Distraction works on people whose attention is on each other rather than their bags` +
          (intel?.pickpocket
            ? `, and pickpocketing here is rated ${intel.pickpocket.level.toLowerCase()} risk`
            : "") +
          `. ` +
          (scam ? `The one to know: ${sentence(scam)}` : "") +
          (profile.style === "nightlife"
            ? `Agree a meeting point before you go out — splitting up is what turns a lost phone into a lost person.`
            : `Street crime still carries less weight in your score than it would for someone travelling alone.`),
      })
    }
  }

  // ── Age ──
  if (profile.age === "65plus") {
    const bits: string[] = []
    if (hospitals?.value != null) bits.push(`hospital access — ${hospitals.display}`)
    if (air?.value != null) bits.push(`air quality is ${air.display}`)
    if (weather?.display) bits.push(`the 16-day outlook is ${weather.display}`)
    notes.push({
      key: "age",
      title: "Travelling with someone 65 or older",
      body:
        (bits.length ? `${bits.join("; ")}. ` : "") +
        `Access to care and heat/air exposure carry more weight in your score than they would for a younger party — check that your travel insurance covers pre-existing conditions.`,
    })
  } else if (profile.age === "under30" && profile.style === "nightlife") {
    const scams = intel?.scams ?? []
    notes.push({
      key: "age",
      title: "Young party, nights out",
      body:
        sentence(intel?.robbery?.note ?? "") +
        (scams.length
          ? `The scams that catch visitors here: ${scams.slice(0, 2).map((s) => trimNote(s, 90)).join("; ")}.`
          : `Late-night street crime is the risk that most often meets visitors your age — keep phones out of sight and use licensed taxis or ride-hail after dark.`),
    })
  }

  // ── Trip style ──
  if (profile.style === "nightlife" && !notes.some((n) => n.key === "age")) {
    notes.push({
      key: "style",
      title: "Nights out",
      body:
        sentence(intel?.robbery?.note ?? "") +
        (nightZones.length
          ? `Field research rates ${nightZones.slice(0, 3).map((z) => z.name).join(", ")} as caution-or-worse after dark.`
          : `Robbery and pickpocketing risk carry the extra weight in your score.`),
    })
  } else if (profile.style === "outdoors") {
    const bits: string[] = []
    if (hazards?.display) bits.push(`natural-hazard exposure: ${hazards.display}`)
    if (weather?.display) bits.push(`16-day outlook: ${weather.display}`)
    if (liveHazards.length) {
      bits.push(
        `${liveHazards.length} live disaster alert${liveHazards.length === 1 ? "" : "s"} within 500 km (${liveHazards[0].kind}, ~${liveHazards[0].distanceKm} km away)`
      )
    }
    if (bits.length) {
      notes.push({
        key: "style",
        title: "Heading outdoors",
        body: `${bits.join("; ")}. Away from town, weather and terrain become the real risk — check the hazard feed again the morning you set out.`,
      })
    }
  } else if (profile.style === "business") {
    const bits: string[] = []
    if (ruleOfLaw?.value != null) bits.push(`rule of law sits at ${ruleOfLaw.display}`)
    if (bribery?.value != null) bits.push(`${bribery.display} report paying a bribe for a public service`)
    if (bits.length) {
      notes.push({
        key: "style",
        title: "On business",
        body: `${bits.join("; ")}. Institutional quality decides how a bad night ends — whether police, hospitals and your embassy can actually help — so it carries extra weight for your trip.`,
      })
    }
  } else if (profile.style === "sightseeing" && intel?.pickpocket && !usedPickpocket) {
    notes.push({
      key: "style",
      title: "Out sightseeing",
      body:
        `Pickpocketing is rated ${intel.pickpocket.level.toLowerCase()} risk here. ` +
        sentence(intel.pickpocket.note).trimEnd(),
    })
  }

  return { intro, notes: notes.slice(0, 4) }
}
