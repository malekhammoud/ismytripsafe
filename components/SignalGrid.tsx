"use client"

import { useState } from "react"
import { Info, Database } from "lucide-react"
import type { SafetySignal, SignalGroup } from "@/lib/types"
import { scoreColor } from "@/lib/safety-display"

const GROUP_ORDER: SignalGroup[] = [
  "Violent crime",
  "Conflict & terrorism",
  "Institutions & rule of law",
  "Everyday hazards",
  "Health & environment",
  "Official guidance",
]

export function SignalGrid({ signals }: { signals: SafetySignal[] }) {
  const withData = signals.filter((s) => s.score != null).length
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: signals.filter((s) => s.group === g),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="card p-6 rise-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">The Evidence</p>
          <p className="font-display text-xl font-medium text-[var(--ink)]">
            {withData} live indicators across {countSources(signals)} databases
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <p className="label mb-2.5">{group}</p>
            <div className="space-y-2.5">
              {items.map((s) => (
                <SignalRow key={s.key} signal={s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function countSources(signals: SafetySignal[]): number {
  return new Set(signals.filter((s) => s.score != null).map((s) => s.source)).size
}

function SignalRow({ signal }: { signal: SafetySignal }) {
  const [open, setOpen] = useState(false)
  const hasData = signal.score != null
  const color = hasData ? scoreColor(signal.score!) : "var(--ink-faint)"

  return (
    <div
      className="rounded-2xl border border-[var(--hairline)] bg-[var(--paper)]/40 px-4 py-3 transition-colors hover:bg-[var(--paper)]/70"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-[var(--ink)]">
              {signal.label}
            </span>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex-shrink-0 text-[var(--ink-faint)] transition-colors hover:text-[var(--accent)]"
              aria-label="What this means"
            >
              <Info size={12} />
            </button>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[0.68rem] text-[var(--ink-faint)]">
            <Database size={9} />
            <span className="truncate">
              {signal.source}
              {signal.year ? ` · ${signal.year}` : ""}
            </span>
          </div>
        </div>

        {/* Value + score bar */}
        <div className="flex w-[44%] flex-shrink-0 items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-soft)]">
                {signal.display}
              </span>
              {hasData && (
                <span className="text-xs font-bold" style={{ color }}>
                  {signal.score}
                </span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(20,30,48,0.08)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: hasData ? `${signal.score}%` : "0%",
                  background: color,
                  transition: "width 1s cubic-bezier(0.2,0.8,0.2,1)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {open && (
        <p className="mt-2.5 border-t border-[var(--hairline)] pt-2.5 text-[0.78rem] leading-relaxed text-[var(--ink-soft)]">
          {signal.note}
        </p>
      )}
    </div>
  )
}
