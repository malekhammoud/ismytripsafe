import Link from "next/link"
import { ScoreRing } from "@/components/beach/ScoreRing"
import { CATEGORY_ICON } from "@/components/report/category-icons"
import type { HomeDemo } from "@/lib/home-demo"

/**
 * The report, in a hand.
 *
 * Drawn in CSS rather than shipped as a screenshot, for three reasons: it
 * stays sharp on any screen, its numbers come from the same live report as
 * everything else on the page, and the button at the bottom is a real link to
 * that report. A painted button under a painted score is set dressing; this is
 * the actual thing, at a quarter size.
 */
export function PhoneMock({ demo }: { demo: HomeDemo }) {
  return (
    <div
      className="relative w-[210px] shrink-0 rounded-[30px] border-[7px] border-[#12202a] bg-[#fffdf6] p-3 pt-4"
      style={{
        boxShadow:
          "0 2px 6px rgba(9,32,44,0.24), 0 22px 44px -14px rgba(9,32,44,0.44), 0 48px 90px -40px rgba(9,32,44,0.5)",
      }}
    >
      {/* speaker slot */}
      <span
        className="absolute left-1/2 top-[7px] h-[4px] w-[52px] -translate-x-1/2 rounded-full bg-[#12202a]/70"
        aria-hidden
      />

      <p className="text-center">
        <span className="font-display text-[1.02rem] font-medium leading-none text-[var(--navy)]">
          {demo.city}
        </span>{" "}
        <span className="text-[0.9rem] leading-none">{demo.flag}</span>
      </p>
      <p className="mt-0.5 text-center text-[0.62rem] text-[var(--ink-faint)]">{demo.country}</p>

      <div className="mt-2 flex justify-center">
        <ScoreRing score={demo.score} color={demo.levelColor} size={84} stroke={7} />
      </div>

      <p
        className="mt-1.5 text-center text-[0.62rem] font-semibold"
        style={{ color: demo.levelColor }}
      >
        {demo.answer}
      </p>

      <ul className="mt-2.5 space-y-[3px] border-t border-[var(--hairline)] pt-2">
        {demo.cats.map((c) => {
          const Icon = CATEGORY_ICON[c.key]
          return (
            <li key={c.key} className="flex items-center gap-1.5 text-[0.58rem]">
              <Icon size={9} strokeWidth={2.3} className="shrink-0" style={{ color: c.color }} />
              <span className="flex-1 truncate text-[var(--ink-soft)]">{c.short}</span>
              <span className="tnum font-bold" style={{ color: c.color }}>
                {c.score}
              </span>
              <span className="tnum text-[0.5rem] text-[var(--ink-faint)]">/100</span>
            </li>
          )
        })}
      </ul>

      <Link
        href={demo.path}
        className="mt-3 block rounded-[9px] py-2 text-center text-[0.68rem] font-bold tracking-[0.01em] text-[#fff8ec]"
        style={{ background: "var(--orange-deep)" }}
      >
        View full report
      </Link>
    </div>
  )
}
