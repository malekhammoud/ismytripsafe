"use client"

import { useState } from "react"
import Link from "next/link"
import { suppliedPhotoFor, poolPhotoFor } from "@/lib/photos"
import type { ReportMeta } from "@/lib/reports"
import { stampInk } from "@/components/beach/PlateCard"

/**
 * Exact mapping for River's WhatsApp deckled postcard photos.
 * Each photo is mapped to the exact city it depicts.
 */
const CITY_POSTCARD_PHOTOS: Record<string, string> = {
  "/italy/venice": "/photos/postcards/00000110-PHOTO-2026-08-04-23-38-18.jpg",
  "/japan/tokyo": "/photos/postcards/00000111-PHOTO-2026-08-04-23-38-18.jpg",
  "/united-states/san-francisco": "/photos/postcards/00000113-PHOTO-2026-08-04-23-38-18.jpg",
  "/czechia/prague": "/photos/postcards/00000114-PHOTO-2026-08-04-23-38-18.jpg",
  "/italy/rome": "/photos/postcards/00000115-PHOTO-2026-08-04-23-38-18.jpg",
  "/italy/milan": "/photos/postcards/00000116-PHOTO-2026-08-04-23-38-18.jpg",
  "/poland/gdansk": "/photos/postcards/00000117-PHOTO-2026-08-04-23-38-19.jpg",
  "/united-kingdom/london": "/photos/postcards/00000119-PHOTO-2026-08-04-23-38-19.jpg",
  "/philippines/el-nido": "/photos/postcards/00000121-PHOTO-2026-08-04-23-38-19.jpg",
  "/hungary/budapest": "/photos/postcards/00000122-PHOTO-2026-08-04-23-38-19.jpg",
}

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  const [paused, setPaused] = useState(false)

  if (!cards || cards.length === 0) return null

  // Resolve matching photo for each place so picture and city ALWAYS match 100%
  const items = cards.map((card) => {
    const photo =
      CITY_POSTCARD_PHOTOS[card.path] ||
      suppliedPhotoFor(card.path)?.file ||
      card.image ||
      poolPhotoFor(card.path).file

    return { card, photo }
  })

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
