import Link from "next/link"
import { MapPin, ShieldCheck } from "lucide-react"
import { CATEGORY_ICON } from "@/components/report/category-icons"
import type { HomeDemo } from "@/lib/home-demo"

// ─────────────────────────────────────────────────────────────────────
// The report, in a hand — the object at the right of the header comp.
//
// Drawn rather than screenshotted: it stays sharp at any size, its numbers
// come from the same live report as the rest of the band, and the button at
// the bottom is a real link to that report. A painted button under a painted
// score is set dressing; this is the actual thing at a quarter size.
// ─────────────────────────────────────────────────────────────────────

export function HeaderPhone({ demo }: { demo: HomeDemo }) {
  const R = 54
  const C = 2 * Math.PI * R
  const filled = (Math.max(0, Math.min(100, demo.score)) / 100) * C

  return (
    <div className="ith-phone" aria-hidden={false}>
      <div className="ith-phone-screen">
        <p className="ith-phone-city">
          {demo.city} <span className="ith-phone-flag">{demo.flag}</span>
        </p>
        <p className="ith-phone-country">
          <MapPin size={11} strokeWidth={2.2} />
          {demo.country}
        </p>

        <div className="ith-phone-ring">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(23,186,107,0.16)" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="var(--ith-green)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${C}`}
              transform="rotate(-64 60 60)"
            />
          </svg>
          <span className="ith-phone-score">{demo.score}</span>
          <span className="ith-phone-of">/ 100</span>
        </div>

        <p className="ith-phone-verdict">
          <ShieldCheck size={13} strokeWidth={2.2} />
          {demo.answer.replace(/^Yes — /, "").replace(/^\w/, (m) => m.toUpperCase())}
        </p>

        <ul className="ith-phone-rows">
          {demo.cats.map((c) => {
            const Icon = CATEGORY_ICON[c.key]
            return (
              <li key={c.key}>
                <Icon size={12} strokeWidth={2} className="shrink-0" />
                <span className="ith-phone-label">{c.short}</span>
                <span className="ith-phone-num">{c.score}</span>
                <span className="ith-phone-den">/100</span>
              </li>
            )
          })}
        </ul>

        <Link href={demo.path} className="ith-phone-cta">
          View full report
        </Link>
      </div>
    </div>
  )
}
