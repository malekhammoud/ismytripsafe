"use client"

import { useEffect, useRef, useState } from "react"
import { PlateCard } from "@/components/beach/PlateCard"
import type { ReportMeta } from "@/lib/reports"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function PostcardScroller({ cards }: { cards: ReportMeta[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  if (!cards || cards.length === 0) return null

  // Repeat cards 4 times to ensure seamless infinite looping without gaps
  const cardList = [...cards, ...cards, ...cards, ...cards]

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    let animId: number
    const speed = 1.5 // Speed of auto-scroll (pixels per frame)

    const scrollStep = () => {
      if (el && !isHovered) {
        el.scrollLeft += speed

        // Seamless loop reset when scrolling past half of the content
        const singleSetWidth = el.scrollWidth / 4
        if (el.scrollLeft >= singleSetWidth * 2) {
          el.scrollLeft -= singleSetWidth
        }
      }
      animId = requestAnimationFrame(scrollStep)
    }

    animId = requestAnimationFrame(scrollStep)
    return () => cancelAnimationFrame(animId)
  }, [isHovered])

  const handleManualScroll = (direction: "left" | "right") => {
    if (!scrollerRef.current) return
    const offset = direction === "left" ? -350 : 350
    scrollerRef.current.scrollBy({ left: offset, behavior: "smooth" })
  }

  return (
    <div className="relative w-full py-4 my-2">
      {/* Edge Gradient Fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-r from-[var(--paper)] to-transparent hidden md:block" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-l from-[var(--paper)] to-transparent hidden md:block" />

      {/* Navigation Arrows for Desktop */}
      <button
        onClick={() => handleManualScroll("left")}
        aria-label="Previous postcards"
        className="hidden md:flex absolute left-2 top-1/2 z-30 -translate-y-1/2 items-center justify-center w-11 h-11 rounded-full bg-[#fffdf6] border border-[var(--hairline)] shadow-lg text-[var(--navy)] hover:scale-110 active:scale-95 transition-all"
      >
        <ChevronLeft size={22} />
      </button>

      <button
        onClick={() => handleManualScroll("right")}
        aria-label="Next postcards"
        className="hidden md:flex absolute right-2 top-1/2 z-30 -translate-y-1/2 items-center justify-center w-11 h-11 rounded-full bg-[#fffdf6] border border-[var(--hairline)] shadow-lg text-[var(--navy)] hover:scale-110 active:scale-95 transition-all"
      >
        <ChevronRight size={22} />
      </button>

      {/* Desktop Auto-Scrolling Container */}
      <div
        ref={scrollerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="hidden md:flex overflow-x-auto select-none py-4 scrollbar-none items-start"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex gap-6 items-start shrink-0 px-6">
          {cardList.map((m, idx) => (
            <div key={`${m.path}-${idx}`} className="w-[220px] lg:w-[240px] shrink-0 transition-transform duration-300">
              <PlateCard meta={m} priority={idx < 4} />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Touch-Scroll Strip */}
      <div className="md:hidden pc-strip pc-strip--light mt-2">
        {cards.slice(0, 12).map((m, i) => (
          <div key={m.path} className="w-[190px] shrink-0">
            <PlateCard meta={m} priority={i < 2} />
          </div>
        ))}
      </div>
    </div>
  )
}
