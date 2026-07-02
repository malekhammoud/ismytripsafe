"use client"

import { Database, CheckCircle2 } from "lucide-react"
import type { SafetyReport } from "@/lib/types"
import { LEVELS } from "@/lib/safety-display"

export function IndexCard({
  safety,
  summary,
}: {
  safety: SafetyReport
  summary?: string
}) {
  const cfg = LEVELS[safety.level]
  const pct = safety.index / 100
  const r = 52
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75 // 270°
  const dash = arc * pct

  const withData = safety.signals.filter((s) => s.score != null)
  const years = withData.map((s) => s.year).filter(Boolean) as string[]
  const yearRange = years.length
    ? `${Math.min(...years.map(Number))}–${Math.max(...years.map(Number))}`
    : null
  const sourceCount = new Set(withData.map((s) => s.source)).size

  return (
    <div className="card overflow-hidden rise-in">
      {/* accent top rule */}
      <div style={{ height: 3, background: cfg.color }} />

      <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[auto_1fr]">
        {/* Gauge */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative" style={{ width: 150, height: 150 }}>
            <svg width="150" height="150" viewBox="0 0 130 130" style={{ transform: "rotate(135deg)" }}>
              <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(20,30,48,0.08)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} ${circ}`} />
              <circle
                cx="65" cy="65" r={r} fill="none"
                stroke={cfg.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.2,0.8,0.2,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="tnum font-display text-[2.6rem] font-medium leading-none" style={{ color: cfg.color }}>
                {safety.index}
              </span>
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                / 100
              </span>
            </div>
          </div>
          <div
            className="mt-3 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ background: `color-mix(in srgb, ${cfg.color} 13%, transparent)`, color: cfg.color }}
          >
            {cfg.label}
          </div>
        </div>

        {/* Summary */}
        <div className="min-w-0">
          <p className="eyebrow mb-2">Assessment</p>
          {summary ? (
            <p className="text-[0.98rem] leading-relaxed text-[var(--ink-soft)]">{summary}</p>
          ) : (
            <div className="space-y-2" aria-label="Generating assessment">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          )}

          {safety.saferThanPct != null && (
            <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--paper)]/60 px-3.5 py-2.5">
              <span className="tnum font-display text-2xl font-medium leading-none" style={{ color: cfg.color }}>
                {safety.saferThanPct}%
              </span>
              <span className="text-xs leading-tight text-[var(--ink-soft)]">
                of countries rank<br />less safe than here
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Data-coverage footer (provenance / confidence) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[var(--hairline)] bg-[var(--paper)]/40 px-6 py-3">
        <span className="flex items-center gap-1.5 text-[0.72rem] font-medium text-[var(--ink-soft)]">
          <CheckCircle2 size={12} style={{ color: "var(--safe)" }} />
          <span className="tnum">{withData.length}</span> live indicators
        </span>
        <span className="flex items-center gap-1.5 text-[0.72rem] text-[var(--ink-faint)]">
          <Database size={11} />
          <span className="tnum">{sourceCount}</span> independent databases
        </span>
        {yearRange && (
          <span className="text-[0.72rem] text-[var(--ink-faint)]">
            Source data <span className="tnum">{yearRange}</span>
          </span>
        )}
      </div>
    </div>
  )
}
