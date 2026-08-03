"use client"

import { CalendarDays, Compass, UserRound, UsersRound, SlidersHorizontal } from "lucide-react"
import type { SafetyBundle, SafetyEnrichment } from "@/lib/types"
import { buildPersonalBrief, type PersonalNote } from "@/lib/personal-brief"
import { profileSummary, type PersonalScore, type TravelerProfile } from "@/lib/profile"

const INK = "#141922"
const RULE = "rgba(20, 25, 34, 0.4)"

const NOTE_ICON: Record<PersonalNote["key"], React.ReactNode> = {
  gender: <UserRound size={13} strokeWidth={2.3} />,
  party: <UsersRound size={13} strokeWidth={2.3} />,
  age: <CalendarDays size={13} strokeWidth={2.3} />,
  style: <Compass size={13} strokeWidth={2.3} />,
}

/**
 * "Written for you" — the personalisation the traveller can actually read.
 *
 * The score re-weighting (lib/profile.ts) changes the number; this changes the
 * words, pulling the findings that bear on this specific party out of the five
 * sections below. Every line is derived deterministically from the report's own
 * data in lib/personal-brief.ts, so it can never contradict the sections it
 * summarises.
 */
export function PersonalBrief({
  profile,
  bundle,
  intel,
  personal,
  generatedAt,
}: {
  profile: TravelerProfile
  bundle: SafetyBundle
  intel: SafetyEnrichment | null
  personal: PersonalScore
  generatedAt: string
}) {
  const brief = buildPersonalBrief(profile, bundle, intel)

  return (
    <section
      id="sec-for-you"
      className="rise-in scroll-mt-4 px-7 py-7 sm:px-9"
      style={{
        background: "linear-gradient(180deg, #eef3fa 0%, #f6f8fc 100%)",
        borderTop: `1px solid ${RULE}`,
        animationDelay: "80ms",
      }}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="eyebrow" style={{ color: "var(--accent-deep)", opacity: 0.8, letterSpacing: "0.2em" }}>
            Written for you
          </p>
          <h2 className="font-display mt-1 text-[1.45rem] font-medium tracking-tight" style={{ color: INK }}>
            Your trip, your risks
          </h2>
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: "var(--accent-deep)",
            border: "1px solid rgba(20,83,143,0.35)",
            background: "rgba(255,255,255,0.6)",
          }}
        >
          <SlidersHorizontal size={12} strokeWidth={2.4} />
          {personal.personalized ? `${personal.index}/100 for you` : "Your profile"}
        </span>
      </header>

      <p className="font-display text-[1.02rem] leading-[1.6]" style={{ color: INK }}>
        {brief.intro}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.7rem]">
        {profileSummary(profile)
          .split(" · ")
          .map((chip) => (
            <span
              key={chip}
              className="rounded-full px-2.5 py-1 font-semibold"
              style={{ background: "rgba(15,155,171,0.1)", color: "var(--accent-deep)" }}
            >
              {chip}
            </span>
          ))}
        <span style={{ color: `${INK}88` }}>
          {personal.personalized
            ? `re-weighted from the general score of ${personal.baseIndex}/100`
            : "no re-weighting applied"}
        </span>
      </div>

      {brief.notes.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {brief.notes.map((n) => (
            <article
              key={n.title}
              className="rounded-[3px] px-4 py-3.5"
              style={{ background: "rgba(255,255,255,0.72)", borderLeft: "3px solid var(--accent)" }}
            >
              <p
                className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--accent-deep)" }}
              >
                {NOTE_ICON[n.key]}
                {n.title}
              </p>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed" style={{ color: `${INK}c8` }}>
                {n.body}
              </p>
            </article>
          ))}
        </div>
      )}

      {generatedAt && (
        <p className="mt-4 flex items-center gap-1.5 text-[0.72rem]" style={{ color: `${INK}88` }}>
          <CalendarDays size={12} strokeWidth={2} />
          Generated {generatedAt} · conditions change, so re-run it before you fly
        </p>
      )}
    </section>
  )
}
