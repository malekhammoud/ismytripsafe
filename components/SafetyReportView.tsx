"use client"

import { IndexCard } from "./cards/IndexCard"
import { SignalGrid } from "./SignalGrid"
import { ComparisonChart } from "./ComparisonChart"
import { IntelCard } from "./cards/IntelCard"
import { OfficialAdvisories } from "./OfficialAdvisories"
import { HealthNotices } from "./HealthNotices"
import { SectionHeader } from "./SectionHeader"
import { Methodology } from "./Methodology"
import { Search } from "lucide-react"
import type { SafetyBundle, SafetyEnrichment } from "@/lib/types"

interface SafetyReportViewProps {
  bundle: SafetyBundle
  intel: SafetyEnrichment | null
  prose: string
  searchQueries: string[]
  loading: boolean
}

export function SafetyReportView({
  bundle,
  intel,
  prose,
  searchQueries,
  loading,
}: SafetyReportViewProps) {
  const safety = bundle.safety
  const streaming = loading && prose.length > 0
  const indicatorNote = `${safety.signals.filter((s) => s.score != null).length} indicators`
  const advisoryNote =
    safety.advisories.length > 0
      ? `${safety.advisories.length} government${safety.advisories.length > 1 ? "s" : ""}`
      : "none published"
  const healthNote =
    safety.health.length > 0
      ? `${safety.health.length} active`
      : "none active"

  return (
    <div className="space-y-9">
      {/* 01 — Verdict */}
      <section className="space-y-3">
        <SectionHeader num="01" title="The Verdict" note={safety.level.replace("_", " ")} />
        <IndexCard safety={safety} summary={intel?.summary} />
      </section>

      {/* 02 — Official advisories (direct from governments, no AI) */}
      <section className="space-y-3">
        <SectionHeader
          num="02"
          title="Official Advisories"
          note={advisoryNote}
        />
        <OfficialAdvisories advisories={safety.advisories} />
      </section>

      {/* 03 — Health notices (direct from CDC, no AI) */}
      <section className="space-y-3">
        <SectionHeader num="03" title="Health Notices" note={healthNote} />
        <HealthNotices notices={safety.health} />
      </section>

      {/* 04 — Evidence (always present — real data) */}
      <section className="space-y-3">
        <SectionHeader num="04" title="The Evidence" note={indicatorNote} />
        <SignalGrid signals={safety.signals} />
      </section>

      {/* 05 — Comparison */}
      {safety.comparisons.length > 0 && (
        <section className="space-y-3">
          <SectionHeader num="05" title="How It Compares" note="vs. world" />
          <ComparisonChart comparisons={safety.comparisons} />
        </section>
      )}

      {/* 06 — Local intelligence */}
      <section className="space-y-3">
        <SectionHeader num="06" title="Local Intelligence" note={intel ? "from live research" : "researching…"} />
        {intel ? (
          <IntelCard intel={intel} />
        ) : (
          <PendingPanel
            title="Gathering on-the-ground intelligence"
            subtitle="Cross-referencing current news, incident reports and neighbourhood data"
            queries={searchQueries}
          />
        )}
      </section>

      {/* 07 — Briefing */}
      <section className="space-y-3">
        <SectionHeader num="07" title="Safety Briefing" />
        {prose ? (
          <div className="card p-6 sm:p-8 rise-in">
            <div
              className={`prose-brief ${streaming ? "typing" : ""}`}
              dangerouslySetInnerHTML={{ __html: formatProse(prose) }}
            />
          </div>
        ) : (
          <PendingPanel
            title="Writing the safety briefing"
            subtitle="A plain-language read on what the data means for your trip"
          />
        )}
      </section>

      {/* Methodology & sources */}
      <Methodology safety={safety} />
    </div>
  )
}

function PendingPanel({
  title,
  subtitle,
  queries,
}: {
  title: string
  subtitle: string
  queries?: string[]
}) {
  const recent = (queries ?? []).slice(-3)
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <span className="spin inline-block h-4 w-4 flex-shrink-0 rounded-full border-2 border-[var(--hairline)] border-t-[var(--accent)]" />
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
          <p className="text-[0.78rem] text-[var(--ink-faint)]">{subtitle}</p>
        </div>
      </div>
      {recent.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-[var(--hairline)] pt-3">
          {recent.map((q, i) => (
            <div key={i} className="flex items-center gap-2 text-[0.76rem] text-[var(--ink-faint)]">
              <Search size={10} className="flex-shrink-0" />
              <span className="truncate">{q}</span>
            </div>
          ))}
        </div>
      )}
      {/* keep a stable minimum height so the fill-in doesn't jump */}
      {!recent.length && <div style={{ height: 8 }} />}
    </div>
  )
}

function formatProse(text: string): string {
  const cleaned = text
    .replace(/START_SAFETY[\s\S]*?END_SAFETY/g, "")
    .replace(/```(?:json)?[\s\S]*?```/g, "")
    .trim()

  return cleaned
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) => {
      const t = block.trim()
      if (!t) return ""
      if (/^###?\s+/.test(t)) return `<h3>${t.replace(/^###?\s+/, "")}</h3>`
      if (/^[-*]\s+/m.test(t) && t.split("\n").every((l) => /^[-*]\s+/.test(l.trim()) || !l.trim())) {
        const items = t.split("\n").filter((l) => l.trim()).map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")
        return `<ul>${items}</ul>`
      }
      if (/^---+$/.test(t)) return "<hr/>"
      return `<p>${inline(t)}</p>`
    })
    .join("")
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}
