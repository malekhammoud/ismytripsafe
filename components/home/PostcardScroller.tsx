"use client"

import { useState } from "react"
import { PlateCard } from "@/components/beach/PlateCard"
import type { ReportMeta } from "@/lib/reports"

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  const [paused, setPaused] = useState(false)

  if (!cards || cards.length === 0) return null

  // Duplicate cards for seamless CSS marquee
  const looped = [...cards, ...cards]

  return (
    <div className="pc-scroller-root">
      {/* ── Desktop infinite marquee (md+) ─────────────────────────── */}
      <div className="pc-scroller-outer hidden md:block">
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
          >
            {looped.map((m, idx) => (
              <div key={`${m.path}-${idx}`} className="pc-scroller-card">
                <PlateCard meta={m} priority={idx < 4} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile touch-scroll strip (below md) ───────────────────── */}
      <div className="pc-strip pc-strip--light mt-2 md:hidden">
        {cards.slice(0, 12).map((m, i) => (
          <div key={m.path} className="w-[190px] shrink-0">
            <PlateCard meta={m} priority={i < 2} />
          </div>
        ))}
      </div>
    </div>
  )
}
