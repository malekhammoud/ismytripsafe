"use client"

import { useState } from "react"
import Link from "next/link"
import type { ReportMeta } from "@/lib/reports"
import { stampInk } from "@/components/beach/PlateCard"

/**
 * The 15 WhatsApp postcard photos sent by River — each has a beautiful
 * hand-crafted deckled/torn-paper border baked into the image itself.
 * We cycle through them in order and loop back to the start.
 */
const POSTCARD_PHOTOS = [
  "/photos/postcards/00000110-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000111-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000112-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000113-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000114-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000115-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000116-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000117-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000118-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000119-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000120-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000121-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000122-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000123-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000124-PHOTO-2026-08-04-23-38-20.jpg",
]

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  const [paused, setPaused] = useState(false)

  if (!cards || cards.length === 0) return null

  // Pair each card with a photo, cycling through the 15 photos
  const paired = cards.map((card, i) => ({
    card,
    photo: POSTCARD_PHOTOS[i % POSTCARD_PHOTOS.length],
  }))

  // Duplicate for seamless CSS marquee loop
  const looped = [...paired, ...paired]

  return (
    <div className="pc-scroller-root">
      {/* ── Desktop infinite marquee (md+) ─────────────────────────── */}
      <div className="pc-scroller-outer hidden md:block">
        <div className="pc-scroller-fade-left" />
        <div className="pc-scroller-fade-right" />

        <div className="pc-scroller-viewport">
          <div
            className="pc-scroller-track"
            style={{ animationPlayState: paused ? "paused" : "running" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {looped.map(({ card, photo }, idx) => (
              <div key={`${card.path}-${idx}`} className="pc-scroller-card">
                <Link
                  href={card.path}
                  className="group block"
                  aria-label={`${card.city}, ${card.country} — safety score ${card.score}/100`}
                  tabIndex={idx >= cards.length ? -1 : undefined}
                >
                  {/* Score badge */}
                  <div className="relative">
                    <span
                      className="absolute top-[14%] left-[8%] z-10 font-mono font-bold text-white text-lg leading-none px-2 py-1 rounded"
                      style={{
                        background: stampInk(card.score),
                        fontSize: "clamp(0.75rem, 1.2vw, 1rem)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                      }}
                    >
                      {card.score}
                    </span>
                    {/* Full image — deckled border is baked in */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={`${card.city}, ${card.country}`}
                      className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]"
                      loading={idx < 6 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </div>
                  {/* Caption */}
                  <div className="mt-1.5 px-1 flex items-baseline justify-between gap-2">
                    <span className="pc-city pc-strip--light truncate">{card.city}</span>
                    <span className="pc-country pc-strip--light shrink-0">{card.country}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile touch-scroll strip (below md) ───────────────────── */}
      <div className="md:hidden flex gap-4 overflow-x-auto pb-2 px-2 scrollbar-none"
        style={{ scrollbarWidth: "none" }}>
        {paired.slice(0, 10).map(({ card, photo }, i) => (
          <Link
            key={card.path}
            href={card.path}
            className="shrink-0 w-[200px] block"
            aria-label={`${card.city}, ${card.country} — safety score ${card.score}/100`}
          >
            <div className="relative">
              <span
                className="absolute top-[14%] left-[8%] z-10 font-mono font-bold text-white text-sm leading-none px-1.5 py-0.5 rounded"
                style={{ background: stampInk(card.score), boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}
              >
                {card.score}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt={`${card.city}, ${card.country}`}
                className="w-full h-auto block"
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>
            <div className="mt-1 px-1 flex items-baseline justify-between gap-1">
              <span className="font-display text-[0.9rem] text-[var(--navy)] truncate">{card.city}</span>
              <span className="font-mono text-[0.52rem] uppercase tracking-wider text-[var(--ink-faint)] shrink-0">{card.country}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
