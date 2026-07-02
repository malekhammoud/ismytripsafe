"use client"

import { ChevronDown, ExternalLink } from "lucide-react"
import type { SafetyReport } from "@/lib/types"

const PROVIDERS: { name: string; url: string; what: string }[] = [
  { name: "World Bank Open Data", url: "https://data.worldbank.org", what: "Homicide, road-traffic & armed-conflict deaths" },
  { name: "Worldwide Governance Indicators", url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators", what: "Political stability, rule of law, corruption, effectiveness" },
  { name: "USGS Earthquake Catalog", url: "https://earthquake.usgs.gov", what: "Recent seismic activity within 300 km" },
  { name: "U.S. Department of State", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html", what: "Official travel advisory level (1–4), direct from feed" },
  { name: "UK FCDO Travel Advice", url: "https://www.gov.uk/foreign-travel-advice", what: "Official UK government travel advisory, direct from feed" },
]

export function Methodology({ safety }: { safety: SafetyReport }) {
  const withData = safety.signals.filter((s) => s.score != null)
  const years = withData.map((s) => s.year).filter(Boolean) as string[]
  const yearRange = years.length
    ? `${Math.min(...years.map(Number))}–${Math.max(...years.map(Number))}`
    : "—"

  return (
    <details className="disclosure">
      <summary>
        <span>Methodology &amp; sources</span>
        <ChevronDown size={15} />
      </summary>
      <div className="disclosure-body space-y-4">
        <p>
          The <strong>Safety Index (0–100)</strong> is a weighted composite of {withData.length}{" "}
          independent indicators, normalised so 100 is safest. Lethal violence and
          armed-conflict signals carry the most weight; institutional quality,
          official advisories, road risk and seismic activity follow. Indicators
          with no published data are excluded and the remaining weights
          re-normalised — we never fill gaps with estimates.
        </p>
        <p>
          The official advisories shown above are pulled <strong>directly from each
          government&apos;s own data feed</strong> (U.S. State Department, UK FCDO) — the
          rating and wording are verbatim from the source, not generated. Figures are
          country-level baselines from official statistical sources (most recent data{" "}
          {yearRange}). On-the-ground specifics — neighbourhoods, current incidents,
          scams — are researched separately against live news at assessment time and
          are labelled as such. This is decision-support, not a guarantee; always check
          your government&apos;s official advisory before you travel.
        </p>

        <div>
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
            Underlying databases
          </p>
          <ul className="space-y-1.5">
            {PROVIDERS.map((p) => (
              <li key={p.name} className="flex items-start justify-between gap-3">
                <span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--accent-deep)] hover:underline"
                  >
                    {p.name}
                    <ExternalLink size={10} />
                  </a>
                  <span className="block text-[0.74rem] text-[var(--ink-faint)]">{p.what}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}
