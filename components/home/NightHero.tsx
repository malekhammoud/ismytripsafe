"use client"

import type { ReactNode } from "react"
import { SearchBar } from "@/components/SearchBar"
import type { SafetyQuery } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────
// The first screen: a dark table, a lamp, and somebody's postcards.
//
//     []      []
//   []   ____   []
//     []      []
//
// Dark, which for a travel site is the unexpected move — but every one of
// these pictures is golden hour, and they only really glow against
// something. Warm-dark, not cool-dark: this is an evening spent planning a
// trip, not a control room.
//
// The discipline here is subtraction. There is one question, one box, and
// six pictures. No badges on the art, no step numbers, no phone mock-up, no
// second call to action — everything that was competing for the same second
// of attention has been taken out, and what is left is arranged around a
// single pool of light.
//
// What the pictures are, and where the numbers come from, are both said on
// /credits and /methodology, linked from the footer of every page. They were
// briefly said here too and it was one line too many under an arrangement
// whose whole argument is that it has nothing spare on it.
// ─────────────────────────────────────────────────────────────────────

/** Grid seat per card, in order. Two along the top, one out to each side,
 *  two along the bottom — the middle two cells of the centre row are the box. */
const SEATS = [
  "lg:col-start-2 lg:row-start-1",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-1 lg:row-start-2",
  "lg:col-start-4 lg:row-start-2",
  "lg:col-start-2 lg:row-start-3",
  "lg:col-start-3 lg:row-start-3",
]

export function NightHero({
  cards,
  onSearch,
  loading,
}: {
  /** Server-rendered postcards, in seat order. Six at most are dealt. */
  cards: ReactNode[]
  onSearch: (q: SafetyQuery) => void
  loading: boolean
}) {
  const dealt = cards.slice(0, SEATS.length)

  return (
    <section className="night">
      <div className="night-sky" aria-hidden />
      <div className="night-grain" aria-hidden />
      <div className="night-glow" aria-hidden />

      <div className="mx-auto w-full max-w-[78rem] px-5 py-14 sm:px-7 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-y-10 sm:grid-cols-2 sm:gap-x-7 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12">
          {/* ── The question, and the box ───────────────────── */}
          <div className="night-box order-first sm:col-span-2 lg:order-none lg:col-start-2 lg:col-span-2 lg:row-start-2">
            <h1
              className="display-lg deal text-balance text-center"
              style={{ color: "var(--lamp)", animationDelay: "0.44s" }}
            >
              Is it{" "}
              <em className="not-italic" style={{ fontStyle: "italic", color: "var(--sun)" }}>
                safe
              </em>{" "}
              to go there?
            </h1>

            {/* z-30: the suggestions fall over the cards below */}
            <div
              className="deal relative z-30 mt-7"
              style={{ animationDelay: "0.6s" }}
            >
              <SearchBar onSubmit={onSearch} loading={loading} />
            </div>

            {/* River's line. Three words for the three things that happen, and
                the only thing under the box. */}
            <p
              className="deal meta mt-5 text-center"
              style={{ color: "var(--lamp-faint)", animationDelay: "0.72s" }}
            >
              One place <span className="mx-1.5 opacity-55">·</span> One click{" "}
              <span className="mx-1.5 opacity-55">·</span> One report
            </p>
          </div>

          {/* ── The postcards around it ─────────────────────── */}
          {dealt.map((card, i) => (
            <div
              key={i}
              className={`deal pc-seat-${i + 1} mx-auto w-full max-w-[22rem] lg:max-w-none ${SEATS[i]}`}
              style={{ animationDelay: `${0.06 * i}s` }}
            >
              {card}
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

/** River's line, in his words. The seam between the night and the day. */
export function PromiseBand() {
  return (
    <div style={{ background: "var(--orange)" }}>
      <div className="mx-auto flex max-w-[78rem] flex-col items-center justify-between gap-0.5 px-6 py-3 text-center sm:flex-row sm:gap-6 sm:py-4 sm:text-left">
        <p
          className="font-display text-[clamp(1.5rem,3.4vw,2.4rem)] leading-none"
          style={{ color: "#fff8ec" }}
        >
          Fast. Reliable. Free.
        </p>
        <p className="meta" style={{ color: "#6d2610" }}>
          Made for travellers, by travellers
        </p>
      </div>
    </div>
  )
}
