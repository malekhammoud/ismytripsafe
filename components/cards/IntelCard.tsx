"use client"

import { MapPin, Shield, Lightbulb } from "lucide-react"
import type { SafetyEnrichment } from "@/lib/types"

export function IntelCard({ intel }: { intel: SafetyEnrichment }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Neighborhoods */}
      {(intel.safeAreas?.length || intel.avoidAreas?.length) > 0 && (
        <div className="card p-6 rise-in">
          <p className="eyebrow mb-4">Neighborhoods</p>
          <div className="space-y-4">
            {intel.safeAreas?.length > 0 && (
              <AreaList title="Safe areas" color="var(--safe)" items={intel.safeAreas} />
            )}
            {intel.avoidAreas?.length > 0 && (
              <AreaList title="Take care in" color="var(--risky)" items={intel.avoidAreas} />
            )}
          </div>
        </div>
      )}

      {/* Scams targeting visitors */}
      {intel.scams?.length > 0 && (
        <div className="card p-6 rise-in" style={{ animationDelay: "0.05s" }}>
          <p className="eyebrow mb-4">What to Watch</p>
          <IconList
            icon={<Shield size={12} style={{ color: "var(--accent)" }} />}
            title="Common scams"
            items={intel.scams}
          />
        </div>
      )}

      {/* Tips — full width */}
      {intel.tips?.length > 0 && (
        <div className="card p-6 rise-in lg:col-span-2" style={{ animationDelay: "0.1s" }}>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb size={14} style={{ color: "var(--gold)" }} />
            <p className="eyebrow">Stay Safe — Practical Tips</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {intel.tips.map((t, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl bg-[var(--paper)]/50 px-3.5 py-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-[0.62rem] font-bold text-[#9a7426]">
                  {i + 1}
                </span>
                <span className="text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AreaList({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div>
      <p className="label mb-2 flex items-center gap-1.5">
        <span style={{ color }}>●</span> {title}
      </p>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-[0.84rem] text-[var(--ink-soft)]">
            <MapPin size={11} style={{ color, marginTop: 3, flexShrink: 0 }} />
            {a}
          </li>
        ))}
      </ul>
    </div>
  )
}

function IconList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
}) {
  return (
    <div>
      <p className="label mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[0.84rem] text-[var(--ink-soft)]">
            <span className="mt-0.5 flex-shrink-0">{icon}</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}
