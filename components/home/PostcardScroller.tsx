"use client"

import { useRef, useState } from "react"
import { PlateCard } from "@/components/beach/PlateCard"
import type { ReportMeta } from "@/lib/reports"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  const [paused, setPaused] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  if (!cards || cards.length === 0) return null

  // Duplicate cards twice for seamless CSS marquee
  const looped = [...cards, ...cards]

  const nudge = (dir: "left" | "right") => {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" })
  }

  return (
    <div className="pc-scroller-root">
      {/* ── Desktop infinite marquee (md+) ─────────────────────────── */}
      <div className="pc-scroller-outer hidden md:block">
        {/* Edge fade overlays */}
        <div className="pc-scroller-fade-left" />
        <div className="pc-scroller-fade-right" />

        {/* Manual nav arrows */}
        <button
          onClick={() => nudge("left")}
          aria-label="Previous postcards"
          className="pc-scroller-btn pc-scroller-btn--left"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => nudge("right")}
          aria-label="Next postcards"
          className="pc-scroller-btn pc-scroller-btn--right"
        >
          <ChevronRight size={20} />
        </button>

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
      <div
        ref={scrollerRef}
        className="pc-strip pc-strip--light mt-2 md:hidden"
      >
        {cards.slice(0, 12).map((m, i) => (
          <div key={m.path} className="w-[190px] shrink-0">
            <PlateCard meta={m} priority={i < 2} />
          </div>
        ))}
      </div>
    </div>
  )
}
