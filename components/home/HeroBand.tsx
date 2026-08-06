"use client"

import Image from "next/image"
import { PhoneMock } from "@/components/home/PhoneMock"
import { HERO_PLATE } from "@/lib/photos"
import type { HomeDemo } from "@/lib/home-demo"
import plate from "@/public/photos/hero/barcelona-park-guell.jpg"

// ─────────────────────────────────────────────────────────────────────
// The header band.
//
// A photograph, and beside it the product: the three steps, and a phone
// showing a real destination's real, current scores. Nothing here is a
// mock-up of what a report would say — it is what one says, read from the
// store on every request and linked so it can be checked.
//
// No search on it. The search lives below, in the middle of the postcards,
// where it can be the loudest thing on the page instead of competing with
// a sunset. What this band is for is the two seconds before anyone reads
// anything: two people on a bench looking out over a city they got to.
//
// Dark type on a warm wash throughout, never white type with a glow —
// glowing white sans over a sunset is the house style of every site this
// one is trying not to be mistaken for.
// ─────────────────────────────────────────────────────────────────────

const STEPS = ["Enter a location", "Get instant scores", "Know before you go"]

export function HeroBand({ demo }: { demo: HomeDemo | null }) {
  return (
    <>
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src={plate}
            alt={HERO_PLATE.alt}
            fill
            priority
            sizes="100vw"
            placeholder="blur"
            className="object-cover object-[38%_52%] lg:object-[46%_58%]"
          />
          {/* A light warm veil on the right, where the type goes. Washing it
              to cream would stop the band being a photograph at all. */}
          <div
            className="absolute inset-0 hidden lg:block"
            style={{
              background:
                "linear-gradient(94deg, rgba(255,247,233,0) 34%, rgba(255,247,233,0.5) 58%, rgba(255,247,233,0.88) 74%, rgba(255,247,233,0.9) 100%)",
            }}
          />
          {/* A breath of the page's own paper at the top edge, so the band is
              seated in the page rather than pasted onto it. */}
          <div
            className="absolute inset-x-0 top-0 h-16"
            style={{ background: "linear-gradient(180deg, rgba(251,244,230,0.62), transparent)" }}
          />
        </div>

        <div className="mx-auto flex min-h-[clamp(13rem,30vw,26rem)] max-w-[80rem] items-center justify-end gap-8 px-6 py-8 lg:min-h-[clamp(22rem,32vw,30rem)] lg:py-12">
          {/* Below lg the band is only the photograph — a phone screen cannot
              hold a device mock over a sunset without looking like the sort of
              page we are at pains not to resemble. */}
          <div className="hidden lg:block">
            <ol className="space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span
                    className="tnum flex h-[1.5rem] w-[1.5rem] shrink-0 items-center justify-center rounded-full text-[0.74rem] font-bold text-[var(--paper)]"
                    style={{ background: "var(--orange-deep)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[0.76rem] font-bold uppercase tracking-[0.11em] text-[var(--navy)]">
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {demo && (
            <div className="hidden shrink-0 lg:block">
              <PhoneMock demo={demo} />
            </div>
          )}
        </div>
      </section>

      <PromiseBand />
    </>
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
