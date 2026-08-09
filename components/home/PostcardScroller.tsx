"use client"

import { useState } from "react"
import Link from "next/link"
import type { ReportMeta } from "@/lib/reports"
import { stampInk } from "@/components/beach/PlateCard"

/**
 * The 10 WhatsApp postcard photos sent by River.
 * Every photo has the authentic torn-paper deckled border baked into the image.
 */
const WHATSAPP_POSTCARDS = [
  "/photos/postcards/00000110-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000111-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000113-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000114-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000115-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000116-PHOTO-2026-08-04-23-38-18.jpg",
  "/photos/postcards/00000117-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000119-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000121-PHOTO-2026-08-04-23-38-19.jpg",
  "/photos/postcards/00000122-PHOTO-2026-08-04-23-38-19.jpg",
]

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  const [paused, setPaused] = useState(false)

  if (!cards || cards.length === 0) return null

  // Pair each destination report with one of the 10 WhatsApp deckled photos
  const items = cards.map((card, i) => ({
    card,
    photo: WHATSAPP_POSTCARDS[i % WHATSAPP_POSTCARDS.length],
  }))

  // Duplicate items array for continuous, seamless 100% infinite marquee loop
  const looped = [...items, ...items]

  return (
    <div className="pc-scroller-root">
      {/* ── Continuous Infinite Marquee across ALL viewports (Mobile & Desktop) ── */}
      <div className="pc-scroller-outer">
        {/* Edge fade overlays */}
        <div className="pc-scroller-fade-left" />
        <div className="pc-scroller-fade-right" />

        {/* Marquee viewport */}
        <div className="pc-scroller-viewport">
          <div
            className="pc-scroller-track"
            style={{ animationPlayState: paused ? "paused" : "running" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {looped.map(({ card, photo }, idx) => (
              <div key={`${card.path}-${idx}`} className="pc-scroller-card pc-strip--light">
                <Link
                  href={card.path}
                  className="pc block text-left"
                  aria-label={`${card.city}, ${card.country} — safety score ${card.score} out of 100`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`${card.city}, ${card.country}`}
                    className="pc-shot"
                    width={1440}
                    height={960}
                    loading={idx < 6 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span className="pc-cap">
                    <span className="pc-city">{card.city}</span>
                    <span className="pc-lead" aria-hidden />
                    <span className="pc-score" style={{ "--pc-ink": stampInk(card.score) } as React.CSSProperties}>
                      {card.score}
                    </span>
                    <span className="pc-country">{card.country}</span>
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
