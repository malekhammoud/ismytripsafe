"use client"

import Image from "next/image"
import { SearchBar } from "@/components/SearchBar"
import { ScoreRing } from "@/components/beach/ScoreRing"
import { PhoneMock } from "@/components/home/PhoneMock"
import { CATEGORY_ICON } from "@/components/report/category-icons"
import { HERO_PLATE } from "@/lib/photos"
import type { HomeDemo } from "@/lib/home-demo"
import type { SafetyQuery } from "@/lib/types"
import plate from "@/public/photos/hero/barcelona-park-guell.jpg"

// ─────────────────────────────────────────────────────────────────────
// The header band.
//
// A photograph, and on top of it the three beats of the product in the
// order they happen: type a place, get a score, know before you go. The
// search in it is the real search — this is the top of the page, so the
// first thing on it should be the thing the page is for.
//
// Two rules held throughout.
//
//  · **Dark type on a warm wash, never white type with a glow.** Glowing
//    white sans over a sunset is the house style of every site this one is
//    trying not to be mistaken for.
//  · **Every number is read from the report store.** The panel shows a real
//    city's real, current scores, and names the city so it can be checked.
//    Nothing here is a mock-up of what the product would say.
//
// The composition leaves the left of the plate clear. Two people are sitting
// there looking out over a city, and the reason the photograph is here at all
// is so the page opens on the feeling of arriving somewhere rather than the
// feeling of filling in a form.
//
// Below `lg` the panel comes off the plate entirely. A phone screen cannot
// hold a search field, a ring and five scores over a photograph without
// looking like exactly the sort of page we are at pains not to resemble.
// ─────────────────────────────────────────────────────────────────────

const STEPS = ["Enter a location", "Get instant scores", "Know before you go"]

/** How tall the photograph is where it stands alone, under `lg`. */
const PLATE_H = "clamp(11rem,32vw,15rem)"

export function HeroBand({
  demo,
  onSearch,
  loading,
}: {
  demo: HomeDemo | null
  onSearch: (q: SafetyQuery) => void
  loading: boolean
}) {
  return (
    <>
      <section className="relative isolate">
        {/* The plate. Full-bleed behind the panel at lg; a band across the top
            below it. Clipped on this wrapper and not on the section, because
            the search suggestions must be free to drop out of the band. */}
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[var(--plate-h)] overflow-hidden lg:h-full"
          style={{ "--plate-h": PLATE_H } as React.CSSProperties}
        >
          <Image
            src={plate}
            alt={HERO_PLATE.alt}
            fill
            priority
            sizes="100vw"
            placeholder="blur"
            className="object-cover object-[38%_52%] lg:object-[52%_58%]"
          />
          {/* A light warm veil, and only that. An earlier version washed the
              right half almost to cream so small type could sit straight on
              the photograph; it made the band stop being a photograph. The
              type sits on a card instead, and the plate keeps its light. */}
          <div
            className="absolute inset-0 hidden lg:block"
            style={{
              background:
                "linear-gradient(94deg, rgba(255,247,233,0) 26%, rgba(255,247,233,0.34) 62%, rgba(255,247,233,0.46) 100%)",
            }}
          />
          {/* A breath of the page's own paper at the top edge, so the band is
              seated in the page rather than pasted onto it. */}
          <div
            className="absolute inset-x-0 top-0 hidden h-16 lg:block"
            style={{ background: "linear-gradient(180deg, rgba(251,244,230,0.62), transparent)" }}
          />
        </div>

        {/* One panel, moved rather than duplicated: below lg it sits on paper
            under the photograph, and from lg it floats on the plate. Rendering
            a second copy and hiding it would put two search forms and two sets
            of scores in the markup for one page. */}
        <div
          className="mx-auto grid max-w-[80rem] items-center gap-7 px-4 pb-2 pt-[calc(var(--plate-h)+1.75rem)] sm:px-6 lg:min-h-[clamp(29rem,40vw,36rem)] lg:grid-cols-[1fr_minmax(27rem,34rem)] lg:px-6 lg:py-14 lg:pt-14 xl:grid-cols-[0.5fr_minmax(33rem,41rem)_auto]"
          style={{ "--plate-h": PLATE_H } as React.CSSProperties}
        >
          <div className="hidden lg:block" aria-hidden />
          {/* A card, not a wash. It gives small type a clean ground of its own
              and leaves the photograph alone, which is the difference between
              a magazine cover and a banner with words typed over it. */}
          <div className="mx-auto w-full max-w-2xl rounded-[20px] lg:mx-0 lg:max-w-none lg:p-5 lg:shadow-[0_1px_2px_rgba(29,47,56,0.06),0_18px_40px_-16px_rgba(29,47,56,0.3),0_44px_90px_-46px_rgba(29,47,56,0.42)] lg:[background:rgba(255,251,241,0.93)] lg:[border:1px_solid_rgba(255,255,255,0.8)] xl:p-6">
            <Panel demo={demo} onSearch={onSearch} loading={loading} />
          </div>
          {demo && (
            <div className="hidden xl:block">
              <PhoneMock demo={demo} />
            </div>
          )}
        </div>
      </section>

      <PromiseBand />
    </>
  )
}

/**
 * The three beats, down the page rather than across it. A search field in a
 * third of a column is a search field nobody can read what they typed into,
 * and top-to-bottom says the same thing left-to-right was saying.
 */
function Panel({
  demo,
  onSearch,
  loading,
}: {
  demo: HomeDemo | null
  onSearch: (q: SafetyQuery) => void
  loading: boolean
}) {
  return (
    <div className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className="tnum flex h-[1.4rem] w-[1.4rem] shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold text-[var(--paper)]"
              style={{ background: "var(--orange-deep)" }}
            >
              {i + 1}
            </span>
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--navy)]">
              {s}
            </span>
          </li>
        ))}
      </ol>

      {/* z-20: the autocomplete has to drop over the strip beneath it */}
      <div className="relative z-20 mt-3.5">
        <SearchBar onSubmit={onSearch} loading={loading} />
      </div>

      {demo ? (
        <ResultStrip demo={demo} />
      ) : (
        <p className="mt-4 text-[0.8rem] leading-relaxed text-[var(--ink-soft)]">
          One rating out of 100, and the five scores behind it — crime, traveller sentiment,
          official advisories, stability and health.
        </p>
      )}
    </div>
  )
}

/**
 * What comes back, with a real city as the worked example.
 *
 * The answer is given in words as well as a number, because "79" is only
 * meaningful to someone who already knows the scale — and the label names the
 * city, so nobody has to take it on trust that these are real ones.
 */
function ResultStrip({ demo }: { demo: HomeDemo }) {
  return (
    <div className="mt-4 border-t border-[var(--hairline)] pt-3.5">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        For example — {demo.city} today
      </p>
      <div className="mt-2 flex items-center gap-4">
        <ScoreRing score={demo.score} color={demo.levelColor} size={78} stroke={7} />
        <div className="min-w-0">
          <p
            className="font-display text-[1.15rem] font-medium leading-tight"
            style={{ color: demo.levelColor }}
          >
            {demo.answer}
          </p>
          <p className="mt-0.5 text-[0.74rem] leading-snug text-[var(--ink-soft)]">
            Re-weighted for who&apos;s travelling, every time you run it.
          </p>
        </div>
      </div>
      {/* Five even columns rather than a wrapping row: an odd item left alone
          on a second line reads as one score having gone missing. */}
      <ul className="mt-3 grid grid-cols-5 gap-1">
        {demo.cats.map((c) => {
          const Icon = CATEGORY_ICON[c.key]
          return (
            <li key={c.key} className="min-w-0 text-center">
              <Icon
                size={13}
                strokeWidth={2.2}
                className="mx-auto"
                style={{ color: c.color }}
                aria-hidden
              />
              <span className="mt-0.5 block truncate text-[0.6rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                {c.short}
              </span>
              <span className="tnum block text-[0.9rem] font-bold leading-tight" style={{ color: c.color }}>
                {c.score}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** River's line, in his words. The one place on the page that says the site is
 *  free — anywhere else it would be repeating this. */
function PromiseBand() {
  return (
    <div style={{ background: "var(--orange)" }}>
      <div className="mx-auto flex max-w-[80rem] flex-col items-center justify-between gap-0.5 px-6 py-3 text-center sm:flex-row sm:gap-6 sm:py-3.5 sm:text-left">
        <p
          className="font-display text-[clamp(1.35rem,3.2vw,2.2rem)] font-medium leading-none tracking-tight"
          style={{ color: "#fff8ec" }}
        >
          Fast. Reliable. Free.
        </p>
        <p
          className="font-display text-[clamp(0.92rem,1.6vw,1.3rem)] font-semibold leading-tight"
          style={{ color: "#6d2610" }}
        >
          Made for travellers, by travellers.
        </p>
      </div>
    </div>
  )
}
