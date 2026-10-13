"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

/**
 * The sticky "On this report" section nav.
 *
 * Built from scratch around one rule: every section button is ALWAYS visible.
 * The old pill strip scrolled horizontally, which hid half the buttons behind
 * a thumb — a nav you have to fight is worse than no nav. This one:
 *
 *  · wraps into tidy rows on any width (flex-wrap, no scrollbar ever),
 *  · highlights the section you are reading as you scroll (scroll spy),
 *  · draws a thin progress line so the bar doubles as "how far through",
 *  · stays anchored with native <a href="#…"> links — no JS required to work.
 */

export interface SectionItem {
  label: string
  href: string // "#sec-crime" etc.
}

export function SectionNav({ items }: { items: SectionItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.href ?? "")

  useEffect(() => {
    if (!items.length) return
    const progress = document.getElementById("report-progress-line")

    const onScroll = () => {
      // How far through the document we are, as a 0..1 for the progress line.
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      progress?.style.setProperty("--p", String(p))

      // The active section: the last one whose top has passed the sticky bar.
      let current = items[0]?.href ?? ""
      for (const it of items) {
        const sec = document.getElementById(it.href.slice(1))
        if (sec && sec.getBoundingClientRect().top <= 150) current = it.href
      }
      // Reached the bottom — the last section owns the page.
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 40) {
        current = items[items.length - 1]?.href ?? current
      }
      setActive(current)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [items])

  return (
    <nav
      aria-label="Report sections"
      className="report-nav"
    >
      <div className="report-nav-inner">
        {items.map((it) => {
          const on = active === it.href
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? "true" : undefined}
              className={`report-nav-chip${on ? " report-nav-chip--active" : ""}`}
            >
              {it.label}
            </Link>
          )
        })}
      </div>
      <span id="report-progress-line" className="report-nav-progress" aria-hidden />
    </nav>
  )
}

/** The little "scroll to start" affordance used at the end of the document. */
export function BackToTopPill({ href = "#report-hero" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-4 py-2 text-[0.78rem] font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
    >
      Back to the top
      <ChevronDown size={13} className="-rotate-180" aria-hidden />
    </Link>
  )
}