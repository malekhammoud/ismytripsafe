"use client"

import { Check, Loader2, Search, MapPin } from "lucide-react"
import type { GeoPoint } from "@/lib/types"

type StepState = "done" | "active" | "pending"

interface AssessmentProgressProps {
  geo: GeoPoint | null
  hasData: boolean // safety bundle (databases + advisories) resolved
  hasIntel: boolean // AI enrichment resolved
  proseLength: number
  searchQueries: string[]
  flag?: string
}

export function AssessmentProgress({
  geo,
  hasData,
  hasIntel,
  proseLength,
  searchQueries,
  flag,
}: AssessmentProgressProps) {
  const steps: { key: string; label: string; detail: string; state: StepState }[] = [
    {
      key: "locate",
      label: "Locating destination",
      detail: geo ? `${flag ? flag + " " : ""}${geo.city}, ${geo.country}` : "Geocoding…",
      state: geo ? "done" : "active",
    },
    {
      key: "data",
      label: "Querying safety databases",
      detail: "World Bank · Governance · Hospitals · Air quality · Weather · CDC",
      state: hasData ? "done" : geo ? "active" : "pending",
    },
    {
      key: "advisories",
      label: "Pulling official government advisories",
      detail: "U.S. State Department · UK FCDO",
      state: hasData ? "done" : geo ? "active" : "pending",
    },
    {
      key: "research",
      label: "Researching local conditions",
      detail: "Live news, incidents, neighbourhoods & scams",
      state: hasIntel ? "done" : hasData ? "active" : "pending",
    },
    {
      key: "brief",
      label: "Writing the safety briefing",
      detail: "Plain-language verdict from the evidence",
      state: proseLength > 0 ? "active" : hasIntel ? "active" : "pending",
    },
  ]

  const recent = searchQueries.slice(-3)

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white/60 px-3.5 py-1.5 text-xs font-medium text-[var(--ink-soft)]">
          <MapPin size={12} style={{ color: "var(--accent)" }} />
          {geo ? `${geo.city}, ${geo.country}` : "Preparing assessment"}
        </div>
        <h2 className="font-display text-2xl font-medium text-[var(--ink)]">
          Building your safety assessment
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Pulling every source before we show a verdict — no half-answers.
        </p>
      </div>

      <div className="card p-6">
        <ol className="space-y-1">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-3 py-2.5">
              <StepIcon state={s.state} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium transition-colors ${
                    s.state === "pending" ? "text-[var(--ink-faint)]" : "text-[var(--ink)]"
                  }`}
                >
                  {s.label}
                </p>
                <p className="truncate text-[0.76rem] text-[var(--ink-faint)]">{s.detail}</p>

                {/* live search queries under the research step */}
                {s.key === "research" && s.state === "active" && recent.length > 0 && (
                  <div className="mt-2 space-y-1 border-l-2 border-[var(--hairline)] pl-3">
                    {recent.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[0.72rem] text-[var(--ink-faint)]"
                      >
                        <Search size={9} className="flex-shrink-0" />
                        <span className="truncate">{q}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-center text-[0.72rem] text-[var(--ink-faint)]">
        This usually takes 30–60 seconds. The full report appears once every source is in.
      </p>
    </div>
  )
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--safe)" }}
      >
        <Check size={12} className="text-white" strokeWidth={3} />
      </span>
    )
  }
  if (state === "active") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
        <Loader2 size={16} className="spin" style={{ color: "var(--accent)" }} />
      </span>
    )
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-[var(--hairline)]" />
    </span>
  )
}
