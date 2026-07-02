"use client"

import { ExternalLink, Landmark } from "lucide-react"
import type { OfficialAdvisory } from "@/lib/types"

const LEVEL_COLOR: Record<number, string> = {
  1: "#1f9d5a",
  2: "#c8973f",
  3: "#e0773b",
  4: "#d4503a",
}

function levelColor(level: number | null): string {
  return level != null ? LEVEL_COLOR[level] ?? "#6b7686" : "#6b7686"
}

export function OfficialAdvisories({
  advisories,
}: {
  advisories: OfficialAdvisory[]
}) {
  if (!advisories.length) {
    return (
      <div className="card p-6 rise-in">
        <p className="text-sm text-[var(--ink-soft)]">
          No government has published a standing travel advisory for this country.
          That usually indicates no elevated, country-wide concern — but always check
          your own government&apos;s latest guidance before travelling.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {advisories.map((a, i) => {
        const color = levelColor(a.level)
        return (
          <a
            key={a.sourceShort}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card group block overflow-hidden rise-in transition-shadow hover:shadow-md"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div style={{ height: 3, background: color }} />
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-[var(--ink)]">
                  <Landmark size={13} style={{ color: "var(--ink-faint)" }} />
                  {a.source}
                </span>
                <ExternalLink
                  size={13}
                  className="text-[var(--ink-faint)] transition-colors group-hover:text-[var(--accent)]"
                />
              </div>

              <div className="mt-3 flex items-center gap-2.5">
                {a.level != null && (
                  <span
                    className="tnum flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base font-bold"
                    style={{
                      background: `color-mix(in srgb, ${color} 15%, transparent)`,
                      color,
                    }}
                  >
                    {a.level}
                  </span>
                )}
                <span
                  className="text-[0.92rem] font-semibold leading-tight"
                  style={{ color }}
                >
                  {a.levelLabel}
                </span>
              </div>

              {a.summary && (
                <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--ink-soft)] line-clamp-3">
                  {a.summary}
                </p>
              )}

              <p className="mt-3 text-[0.68rem] text-[var(--ink-faint)]">
                Direct from source{a.updated ? ` · updated ${a.updated}` : ""}
              </p>
            </div>
          </a>
        )
      })}
    </div>
  )
}
