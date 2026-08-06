"use client"

import type { ReactNode } from "react"
import { SearchBar } from "@/components/SearchBar"
import type { SafetyQuery } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────
// The search, with the postcards laid out around it.
//
//     []      []
//   []   ____   []
//     []      []
//
// The point of the arrangement is that the first thing on the page isn't a
// form — it's a table with somebody's postcards on it, and the question in
// the middle of them. Everything the visitor might type is already lying
// there, tilted, already answered.
//
// The cards come in as server-rendered nodes rather than as data, so the
// whole deck stays out of the client bundle even though the search that
// sits between them needs state.
// ─────────────────────────────────────────────────────────────────────

/**
 * Where each card sits, in order. Six cells of a four-column grid, with the
 * middle two of the centre row given over to the search.
 *
 * The tilt and lift are per-position rather than random so the arrangement
 * is the same on the server and in the browser, and the same on every visit
 * — a scatter that reshuffles on reload reads as a bug, not as charm.
 */
const SEATS = [
  { cell: "lg:col-start-2 lg:row-start-1", tilt: "-3.4deg", lift: "-0.6rem" },
  { cell: "lg:col-start-3 lg:row-start-1", tilt: "2.8deg", lift: "-1.4rem" },
  { cell: "lg:col-start-1 lg:row-start-2", tilt: "-2.2deg", lift: "0.4rem" },
  { cell: "lg:col-start-4 lg:row-start-2", tilt: "3.2deg", lift: "-0.2rem" },
  { cell: "lg:col-start-2 lg:row-start-3", tilt: "2.4deg", lift: "1.1rem" },
  { cell: "lg:col-start-3 lg:row-start-3", tilt: "-2.9deg", lift: "0.3rem" },
]

export function SearchConstellation({
  cards,
  onSearch,
  loading,
}: {
  /** Server-rendered postcards, in seat order. Six at most are placed. */
  cards: ReactNode[]
  onSearch: (q: SafetyQuery) => void
  loading: boolean
}) {
  const seated = cards.slice(0, SEATS.length)

  return (
    <section className="relative mx-auto w-full max-w-[76rem] px-4 py-10 sm:px-6 lg:py-14">
      {/* A pool of low sun behind the whole arrangement, so the cards look
          like they are lying on a warm surface rather than floating on one. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[36rem] -translate-y-1/2"
        style={{
          background:
            "radial-gradient(46% 52% at 50% 50%, rgba(255,200,87,0.24), rgba(255,154,92,0.1) 46%, transparent 72%)",
        }}
      />

      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-7 lg:gap-y-10">
        {/* ── The middle: the question and the box ───────────── */}
        <div className="order-first sm:col-span-2 lg:order-none lg:col-span-2 lg:col-start-2 lg:row-start-2">
          <div className="text-center">
            <p className="postcard-greeting">Wherever you&apos;re going</p>
            <h1
              className="display-lg mt-1.5 rise-in"
              style={{ color: "var(--navy)" }}
            >
              Is it
              <span style={{ color: "var(--orange)", fontStyle: "italic" }}> safe</span>{" "}
              to go there?
            </h1>
          </div>

          {/* z-30: the suggestions have to fall over the cards below */}
          <div className="relative z-30 mt-5 rise-in" style={{ animationDelay: "0.08s" }}>
            <SearchBar onSubmit={onSearch} loading={loading} />
          </div>

          {/* The one line on the page that names where any of this comes from.
              It is the difference between a claim and a citation. */}
          <p
            className="mt-4 text-center text-[0.7rem] leading-relaxed text-[var(--ink-faint)] rise-in"
            style={{ animationDelay: "0.16s" }}
          >
            World Bank · Governance Indicators · UNODC · GDACS · Open-Meteo · CDC
          </p>
        </div>

        {/* ── The cards around it ────────────────────────────── */}
        {seated.map((card, i) => (
          <div
            key={i}
            className={`plate-seat fade-in mx-auto w-full max-w-[22rem] lg:mx-0 lg:max-w-none ${SEATS[i].cell}`}
            style={
              {
                "--seat-tilt": SEATS[i].tilt,
                "--seat-lift": SEATS[i].lift,
                animationDelay: `${0.1 + i * 0.06}s`,
              } as React.CSSProperties
            }
          >
            {card}
          </div>
        ))}
      </div>
    </section>
  )
}
