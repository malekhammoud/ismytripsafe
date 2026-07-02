"use client"

import { BarChart3 } from "lucide-react"
import type { Comparison } from "@/lib/types"

export function ComparisonChart({ comparisons }: { comparisons: Comparison[] }) {
  if (comparisons.length === 0) return null

  return (
    <div className="card p-6 rise-in">
      <div className="mb-1 flex items-center gap-2">
        <BarChart3 size={15} style={{ color: "var(--accent)" }} />
        <p className="eyebrow">How It Compares</p>
      </div>
      <p className="mb-5 text-sm text-[var(--ink-soft)]">
        This destination measured against benchmark countries and the world average.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {comparisons.map((c) => (
          <ComparisonBars key={c.metric} c={c} />
        ))}
      </div>
    </div>
  )
}

function ComparisonBars({ c }: { c: Comparison }) {
  const max = Math.max(...c.entries.map((e) => e.value), 0.001)

  return (
    <div>
      <p className="label mb-3">
        {c.metric} <span className="lowercase tracking-normal">({c.unit}, lower is safer)</span>
      </p>
      <div className="space-y-2">
        {c.entries.map((e) => {
          const pct = (e.value / max) * 100
          const color = e.isTarget
            ? "var(--accent)"
            : e.isWorld
            ? "var(--ink-faint)"
            : "rgba(20,30,48,0.22)"
          return (
            <div key={e.name} className="flex items-center gap-2.5">
              <span
                className={`w-24 flex-shrink-0 truncate text-right text-[0.74rem] ${
                  e.isTarget ? "font-bold text-[var(--accent-deep)]" : "text-[var(--ink-soft)]"
                }`}
              >
                {e.name}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md" style={{ background: "rgba(20,30,48,0.05)" }}>
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: color,
                    transition: "width 1s cubic-bezier(0.2,0.8,0.2,1)",
                  }}
                />
              </div>
              <span
                className={`w-10 flex-shrink-0 text-[0.74rem] tabular-nums ${
                  e.isTarget ? "font-bold text-[var(--accent-deep)]" : "text-[var(--ink-soft)]"
                }`}
              >
                {e.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
