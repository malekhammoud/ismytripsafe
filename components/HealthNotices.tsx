"use client"

import { ExternalLink, Activity, Globe } from "lucide-react"
import type { HealthNotice } from "@/lib/types"

const LEVEL_COLOR: Record<number, string> = {
  1: "#c8973f",
  2: "#e0773b",
  3: "#d4503a",
}

export function HealthNotices({ notices }: { notices: HealthNotice[] }) {
  if (!notices.length) {
    return (
      <div className="card p-6 rise-in">
        <p className="text-sm text-[var(--ink-soft)]">
          The U.S. CDC has no active travel health notices for this destination.
          Routine vaccinations and normal health precautions still apply — check
          CDC Travelers&apos; Health for destination-specific vaccine advice.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden rise-in">
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3">
        <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
          <Activity size={14} style={{ color: "var(--accent)" }} />
          CDC Travelers&apos; Health
        </span>
        <span className="text-[0.68rem] text-[var(--ink-faint)]">
          {notices.length} active notice{notices.length > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="divide-y divide-[var(--hairline)]">
        {notices.slice(0, 8).map((n, i) => {
          const color = LEVEL_COLOR[n.level] ?? "#6b7686"
          return (
            <li key={i}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[var(--paper)]/60"
              >
                <span
                  className="mt-0.5 flex-shrink-0 rounded-md px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide"
                  style={{
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color,
                  }}
                >
                  {n.levelLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-medium leading-snug text-[var(--ink)]">
                    {n.title}
                  </p>
                  {n.description && (
                    <p className="mt-0.5 text-[0.78rem] leading-relaxed text-[var(--ink-soft)] line-clamp-2">
                      {n.description}
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-[0.66rem] text-[var(--ink-faint)]">
                    {n.scope === "global" && (
                      <>
                        <Globe size={9} /> Worldwide notice ·{" "}
                      </>
                    )}
                    Direct from CDC{n.updated ? ` · ${formatDate(n.updated)}` : ""}
                  </p>
                </div>
                <ExternalLink
                  size={13}
                  className="mt-0.5 flex-shrink-0 text-[var(--ink-faint)] transition-colors group-hover:text-[var(--accent)]"
                />
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}
