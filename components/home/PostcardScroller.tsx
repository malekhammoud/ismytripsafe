"use client"

import { PlateCard } from "@/components/beach/PlateCard"
import type { ReportMeta } from "@/lib/reports"

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  if (!cards || cards.length === 0) return null

  // Duplicate cards for seamless continuous scrolling on desktop
  const duplicatedCards = [...cards, ...cards]

  return (
    <div className="relative w-full overflow-hidden py-2">
      {/* Desktop Edge Gradient Fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-r from-[var(--paper)] to-transparent hidden md:block" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-16 bg-gradient-to-l from-[var(--paper)] to-transparent hidden md:block" />

      {/* Desktop Infinite Scroller */}
      <div className="hidden md:flex pc-infinite-wrapper overflow-hidden select-none py-3">
        <div className="pc-infinite-track flex gap-5 items-start">
          {duplicatedCards.map((m, idx) => (
            <div key={`${m.path}-${idx}`} className="w-[210px] shrink-0">
              <PlateCard meta={m} priority={idx < 4} />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Touch-Scroll Strip */}
      <div className="md:hidden pc-strip pc-strip--light mt-4">
        {cards.slice(0, 12).map((m, i) => (
          <div key={m.path}>
            <PlateCard meta={m} priority={i < 2} />
          </div>
        ))}
      </div>
    </div>
  )
}
