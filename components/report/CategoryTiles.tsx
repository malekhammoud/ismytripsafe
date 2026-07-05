"use client"

import { Globe, Siren, HeartPulse, Landmark } from "lucide-react"
import type { CategoryScore, CategoryKey } from "@/lib/safety-display"
import { InfoTip } from "./InfoTip"

const ICONS: Record<CategoryKey, React.ReactNode> = {
  advisories: <Globe size={14} strokeWidth={2.2} />,
  crime: <Siren size={14} strokeWidth={2.2} />,
  health: <HeartPulse size={14} strokeWidth={2.2} />,
  stability: <Landmark size={14} strokeWidth={2.2} />,
}

const EXPLAIN: Record<CategoryKey, string> = {
  advisories:
    "Official government travel advisories (U.S. State Dept & UK FCDO). A higher score means fewer or lower-level warnings.",
  crime:
    "Violent & street-crime risk, led by the intentional-homicide rate and road-safety data. Higher = safer.",
  health:
    "Air quality, active disease notices, nearby hospitals and the seasonal weather outlook, combined. Higher = healthier & safer.",
  stability:
    "World Bank governance basket — political stability, rule of law, control of corruption, government effectiveness, regulatory quality and voice. Higher = stronger institutions.",
}

/**
 * The four headline scores at the top of the report. Clicking a tile smooth-
 * scrolls to that category's detail section (id `sec-<key>`).
 */
export function CategoryTiles({ categories }: { categories: CategoryScore[] }) {
  const jump = (key: CategoryKey) => {
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: "rgba(20,25,34,0.08)" }}>
      {categories.map((c) => (
        <div
          key={c.key}
          role="button"
          tabIndex={0}
          onClick={() => jump(c.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              jump(c.key)
            }
          }}
          className="group relative flex cursor-pointer flex-col items-start gap-1 px-4 py-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.55)]"
          style={{ background: "rgba(255,255,255,0.35)" }}
        >
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: c.color }} />
          <div className="flex w-full items-center justify-between gap-2">
            <span
              className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--ink-soft)" }}
            >
              <span style={{ color: c.color }}>{ICONS[c.key]}</span>
              {c.label}
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <InfoTip text={EXPLAIN[c.key]} align="right" color="var(--ink-faint)" />
            </span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="tnum font-display text-[1.9rem] font-medium leading-none" style={{ color: "var(--ink)" }}>
              {c.score ?? "—"}
            </span>
            {c.score != null && (
              <span className="mb-1 text-[0.62rem] font-normal" style={{ color: "var(--ink-faint)" }}>
                /100
              </span>
            )}
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em]"
            style={{ color: c.color, background: `color-mix(in oklab, ${c.color} 16%, transparent)` }}
          >
            {c.levelName}
          </span>
          <span className="mt-0.5 line-clamp-1 text-[0.66rem]" style={{ color: "var(--ink-faint)" }}>
            {c.note}
          </span>
        </div>
      ))}
    </div>
  )
}
