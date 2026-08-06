"use client"

import { PYRAMID, type CategoryScore, type CategoryKey } from "@/lib/safety-display"
import { CATEGORY_ICON } from "./category-icons"
import { InfoTip } from "./InfoTip"

const ICONS: Record<CategoryKey, React.ReactNode> = Object.fromEntries(
  (Object.keys(CATEGORY_ICON) as CategoryKey[]).map((k) => {
    const Icon = CATEGORY_ICON[k]
    return [k, <Icon key={k} size={12} strokeWidth={2.3} />]
  }),
) as Record<CategoryKey, React.ReactNode>

const EXPLAIN: Record<CategoryKey, string> = {
  crime:
    "Violent & street-crime risk from homicide, night-safety and victimisation surveys, trafficking and bribery indicators, plus the Numbeo crowdsourced crime index where available. Discounted where weak institutions make the official figures unreliable. Higher = safer.",
  sentiment:
    "The field-research score — how safe travellers report actually feeling day to day, weighted with current robbery and pickpocketing risk. This is the 18% of the headline score the databases cannot see. Higher = safer.",
  advisories:
    "Official government travel advisories (U.S. State Dept & UK FCDO). A Level 3 or 4 warning also caps the headline score outright. Higher = fewer, milder warnings.",
  stability:
    "Conflict and governance — political stability, terrorism deaths per million, rule of law, control of corruption, government effectiveness, regulatory quality and voice. Higher = stronger institutions, less conflict.",
  health:
    "Road-traffic deaths, natural-hazard exposure, air quality, disease notices, nearby hospitals and the seasonal weather outlook. Higher = healthier and safer.",
}

/** The "i" bubble, stopping the click from also jumping to the section. */
function Info({ explain }: { explain: string }) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
      <InfoTip text={explain} color="rgba(238,242,248,0.5)" />
    </span>
  )
}

/** Compact 0–100 tile. Larger on the upper tier — the scores felt most directly. */
function Tile({
  cat,
  lead,
  onJump,
}: {
  cat: CategoryScore
  lead: boolean
  onJump: (section: string) => void
}) {
  const has = cat.score != null
  const pct = has ? Math.max(0, Math.min(100, cat.score as number)) : 0
  return (
    // a div, not a button: the tile carries an InfoTip button of its own, and
    // a button inside a button is invalid HTML (the parser unnests it, which
    // breaks hydration)
    <div
      role="button"
      tabIndex={0}
      onClick={() => onJump(cat.section)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onJump(cat.section)
        }
      }}
      title={`${cat.label} — ${has ? `${cat.score}/100` : "no data"}. Jump to details.`}
      className="group relative flex flex-1 cursor-pointer flex-col gap-1 overflow-hidden rounded-[10px] px-2.5 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.1)] sm:px-3"
      style={{
        // dark enough to stay legible over any destination photo
        background: "rgba(14,19,27,0.62)",
        border: "1px solid rgba(238,242,248,0.14)",
        // a hairline of the tile's own verdict colour, subtle so the ring
        // stays the focal point
        boxShadow: has ? `inset 0 0 0 1px ${cat.color}30` : "none",
      }}
    >
      {/* Three tiles across a phone leaves very little width, so the lower
          tier drops a size and hands its info bubble to the value row —
          otherwise "Advisories" and "Stability" truncate to "ADVIS…". */}
      <span className="flex items-center justify-between gap-0.5">
        <span
          className={`flex min-w-0 items-center font-semibold uppercase ${
            lead ? "gap-1.5 text-[0.58rem] tracking-[0.1em]" : "gap-1 text-[0.52rem] tracking-[0.05em]"
          }`}
          style={{ color: "rgba(238,242,248,0.72)" }}
        >
          <span className="shrink-0" style={{ color: cat.color }}>{ICONS[cat.key]}</span>
          <span className="truncate">{cat.short}</span>
        </span>
        {lead && <Info explain={EXPLAIN[cat.key]} />}
      </span>

      <span className="flex items-baseline gap-1">
        <span
          className="tnum font-display leading-none text-white"
          style={{ fontSize: lead ? "1.7rem" : "1.35rem", fontWeight: 540 }}
        >
          {has ? cat.score : "—"}
        </span>
        {has && lead && (
          <span className="text-[0.58rem]" style={{ color: "rgba(238,242,248,0.45)" }}>
            /100
          </span>
        )}
        <span
          className="ml-auto shrink-0 self-center truncate text-[0.55rem] font-bold uppercase tracking-[0.09em]"
          style={{ color: cat.color }}
        >
          {cat.levelName}
        </span>
        {!lead && (
          <span className="self-center">
            <Info explain={EXPLAIN[cat.key]} />
          </span>
        )}
      </span>

      <span
        className="block h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: "rgba(238,242,248,0.14)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: cat.color }}
        />
      </span>

      {lead && (
        <span className="truncate text-[0.62rem]" style={{ color: "rgba(238,242,248,0.5)" }}>
          {cat.note}
        </span>
      )}
    </div>
  )
}

/**
 * The score pyramid: the headline sits above, then the two scores a traveller
 * feels most directly (crime, and what people on the ground report), then the
 * three that set the context. It lives inside the hero, so it is captured in
 * the shared image along with the ring.
 */
export function ScorePyramid({ categories }: { categories: CategoryScore[] }) {
  const jump = (section: string) =>
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" })

  const byKey = new Map(categories.map((c) => [c.key, c]))

  return (
    <div className="mt-6">
      <p
        className="mb-2 text-center text-[0.58rem] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "rgba(238,242,248,0.45)" }}
      >
        What drives this score
      </p>
      <div className="space-y-1.5">
        {PYRAMID.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.map((key) => {
              const cat = byKey.get(key)
              return cat ? <Tile key={key} cat={cat} lead={i === 0} onJump={jump} /> : null
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
