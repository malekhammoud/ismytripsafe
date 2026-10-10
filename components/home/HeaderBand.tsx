"use client"

import { SearchBar } from "@/components/SearchBar"
import { ScoreRing } from "@/components/beach/ScoreRing"
import { HeaderPhone } from "@/components/home/HeaderPhone"
import { CATEGORY_ICON } from "@/components/report/category-icons"
import type { HomeDemo } from "@/lib/home-demo"
import type { SafetyQuery } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────
// The header, built from River's comp (00000105) pixel by pixel.
//
// Measured off the 2048×808 original rather than eyeballed: the translucent
// panel runs 30.1%→85.5% across and 8.0%→41.7% down, the orange strip starts
// at 83.0%, and the three colours it introduces are #f04a7a for the step
// circles, #17ba6b for the scores and #e2732e for the strip. Those numbers
// are in `app/globals.css` under `.ith-*`, which is where the geometry lives
// so this file can stay about structure.
//
// Three deliberate departures from the comp, all in the same direction:
//
//  · **The numbers are real.** The comp shows Barcelona at 84 with a row of
//    invented category scores. Barcelona is 79 today, and the five behind it
//    are whatever the report store says this minute. A landing page that
//    invents a flattering score, on a site whose entire product is not
//    inventing scores, gives the game away before anyone clicks anything.
//  · **The icons are the site's.** The comp draws a shield for Crime; the
//    report page draws a siren, and a visitor should not have to learn the
//    vocabulary twice between the header and the thing it is advertising.
//  · **There is a dark wash under the panel.** The comp sets white type on a
//    pale veil over a bright sky, which is a lovely thing to look at in
//    Figma and unreadable in sunlight. The veil is still warm and still
//    translucent; it just has enough ground under it to carry white type.
//
// Everything reflows rather than scaling: three columns at xl, the phone
// stands down at lg, the columns stack at md, and below that the panel comes
// off the photograph entirely, because a search field, a ring and five scores
// over a sunset on a 360px screen is exactly the sort of page this one is at
// pains not to resemble.
// ─────────────────────────────────────────────────────────────────────

const STEPS = ["Enter a location", "Get instant scores & report", "Know before you go"]

export function HeaderBand({
  demo,
  onSearch,
  loading,
}: {
  demo: HomeDemo | null
  onSearch: (q: SafetyQuery) => void
  loading: boolean
}) {
  const ringSize = 112

  return (
    <>
      <header className="ith">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/photos/hero/barcelona-park-guell.jpg"
          alt="Two travellers on the mosaic bench at Park Güell, looking out over Barcelona in the late afternoon"
          className="ith-photo"
          fetchPriority="high"
          decoding="async"
        />

        <div className="ith-stage">
          <div className="ith-panel">
            {/* ── ① a location ─────────────────────────────── */}
            <section className="ith-col">
              <p className="ith-step">
                <span className="ith-num">1</span>
                <span className="ith-step-label">{STEPS[0]}</span>
              </p>
              <div className="ith-search">
                <SearchBar onSubmit={onSearch} loading={loading} compact />
              </div>
            </section>

            {/* ── ② a score ────────────────────────────────── */}
            <section className="ith-col">
              <p className="ith-step">
                <span className="ith-num">2</span>
                <span className="ith-step-label">{STEPS[1]}</span>
              </p>
              <div className="ith-ring">
                {demo ? (
                  <ScoreRing
                    score={demo.score}
                    color="var(--ith-green)"
                    size={ringSize}
                    stroke={9}
                    track="#3c4a5c"
                    label="/100"
                    spin={(100 - demo.score) * 3.6}
                    onDark
                  />
                ) : (
                  <p className="ith-blurb">One rating out of 100, in a few seconds.</p>
                )}
              </div>
            </section>

            {/* ── ③ the five behind it ─────────────────────── */}
            <section className="ith-col ith-col--wide">
              <p className="ith-step">
                <span className="ith-num">3</span>
                <span className="ith-step-label">{STEPS[2]}</span>
              </p>
              {demo && (
                <ul className="ith-cats">
                  {demo.cats.map((c) => {
                    const Icon = CATEGORY_ICON[c.key]
                    return (
                      <li key={c.key}>
                        <Icon size={30} strokeWidth={1.6} aria-hidden />
                        <span className="ith-cat-label">{c.short}</span>
                        <span className="ith-cat-score">
                          <b>{c.score}</b>/100
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {demo && <HeaderPhone demo={demo} />}
        </div>

        {/* ── The strip ─────────────────────────────────────── */}
        <div className="ith-band">
          <p className="ith-band-lead">Fast. Reliable. Free.</p>
          <p className="ith-band-sub">Made for travellers, by travellers.</p>
        </div>
      </header>

      {/* ── Large Desktop Search Bar (Underneath Orange Banner, outside header image) ── */}
      <div className="hidden md:block ith-desktop-search-banner">
        <div className="mx-auto max-w-3xl px-6 py-6 text-center">
          <p className="postcard-greeting text-[0.78rem] tracking-widest text-[var(--accent-deep)] mb-1">
            Search Destinations
          </p>
          <h2 className="font-display text-2xl font-medium tracking-tight text-[var(--navy)] lg:text-3xl">
            Where are you travelling to next?
          </h2>
          <p className="mt-1.5 text-[0.72rem] uppercase tracking-wider text-[var(--ink-soft)] font-mono">
            Instant safety scores &amp; district breakdowns for 1,000+ cities
          </p>
          <div className="mt-4 text-left shadow-xl rounded-2xl">
            <SearchBar onSubmit={onSearch} loading={loading} />
          </div>
        </div>
      </div>
    </>
  )
}
