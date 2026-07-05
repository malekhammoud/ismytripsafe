"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import {
  ShieldAlert,
  Landmark,
  HeartPulse,
  Newspaper,
  Gauge,
  MapPin,
  ArrowUpRight,
  Wind,
  Building2,
  CloudSun,
  Siren,
  Eye,
  CircleCheck,
  CircleAlert,
  Search,
} from "lucide-react"
import type {
  SafetyBundle,
  SafetyEnrichment,
  SafetySignal,
  RiskLevel,
  RiskRating,
  Comparison,
} from "@/lib/types"
import { computeCategories, scoreColor, LEVELS, type CategoryKey } from "@/lib/safety-display"
import { CategoryTiles } from "./CategoryTiles"
import { InfoTip } from "./InfoTip"

const INK = "#141922"
const RULE = "rgba(20, 25, 34, 0.4)"

type Tone = "caution" | "risky" | "moderate" | "safe"

const TONES: Record<Tone, { fill: string; deep: string; strong: string; track: string }> = {
  caution: { fill: "color-mix(in oklab, #e08a3b 26%, #f7f3ec)", deep: "#8a4d14", strong: "#c06e22", track: "rgba(138,77,20,0.16)" },
  risky: { fill: "color-mix(in oklab, #d4503a 22%, #f8f1ef)", deep: "#8c2b1c", strong: "#bc4231", track: "rgba(140,43,28,0.15)" },
  moderate: { fill: "color-mix(in oklab, #c8973f 25%, #f8f4ea)", deep: "#77571a", strong: "#a97e2d", track: "rgba(119,87,26,0.16)" },
  safe: { fill: "color-mix(in oklab, #2f9e6f 20%, #eff6f1)", deep: "#1a5e41", strong: "#27835c", track: "rgba(26,94,65,0.15)" },
}

const RISK_COLOR: Record<RiskLevel, string> = {
  Low: "#2f9e6f",
  Moderate: "#c8973f",
  High: "#e08a3b",
  Severe: "#d4503a",
}

function toneForScore(score: number | null): Tone {
  if (score == null) return "moderate"
  if (score >= 70) return "safe"
  if (score >= 55) return "moderate"
  if (score >= 40) return "caution"
  return "risky"
}

// ————— primitives —————

function Block({
  tone,
  eyebrow,
  title,
  icon,
  statusWord,
  info,
  id,
  children,
  delay = 0,
}: {
  tone: Tone
  eyebrow: string
  title: string
  icon: ReactNode
  statusWord: string
  info?: string
  id?: string
  children: ReactNode
  delay?: number
}) {
  const t = TONES[tone]
  return (
    <section
      id={id}
      className="rise-in scroll-mt-4 px-7 py-8 sm:px-9"
      style={{ background: t.fill, borderTop: `1px solid ${RULE}`, animationDelay: `${delay}ms` }}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow" style={{ color: t.deep, opacity: 0.75, letterSpacing: "0.2em" }}>
            {eyebrow}
          </p>
          <h2 className="font-display mt-1 flex items-center gap-1.5 text-[1.45rem] font-medium tracking-tight" style={{ color: INK }}>
            {title}
            {info && <InfoTip text={info} color={t.deep} align="left" />}
          </h2>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]"
          style={{ color: t.deep, border: `1px solid ${t.deep}55`, background: "rgba(255,255,255,0.35)" }}
        >
          <span style={{ color: t.strong }}>{icon}</span>
          {statusWord}
        </div>
      </header>
      {children}
    </section>
  )
}

function ScoreBar({ value, color, track, style }: { value: number; color: string; track: string; style?: CSSProperties }) {
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ background: track, ...style }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

function SignalRow({ signal, extra }: { signal: SafetySignal | undefined; extra?: ReactNode }) {
  if (!signal) return null
  const has = signal.score != null
  const c = has ? scoreColor(signal.score as number) : "#8a8f98"
  return (
    <div className="py-2.5" style={{ borderTop: `1px solid rgba(20,25,34,0.1)` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1 text-[0.85rem] font-medium" style={{ color: INK }}>
          {signal.label}
          <InfoTip text={signal.note} color={INK} align="left" />
        </p>
        <p className="tnum flex shrink-0 items-center gap-1.5 text-[0.82rem]" style={{ color: "var(--ink-soft)" }}>
          {signal.display}
          {extra}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <ScoreBar value={has ? (signal.score as number) : 0} color={c} track="rgba(20,25,34,0.08)" />
        <span className="tnum w-7 shrink-0 text-right text-[0.72rem] font-semibold" style={{ color: c }}>
          {has ? signal.score : "—"}
        </span>
      </div>
      <p className="mt-1 text-[0.66rem]" style={{ color: `${INK}88` }}>
        {signal.source}
        {signal.year ? ` · ${signal.year}` : ""}
      </p>
    </div>
  )
}

/** "In context" hover: homicide comparison bars, revealed on hover/tap. */
function ContextHover({ comparison }: { comparison: Comparison | undefined }) {
  const [open, setOpen] = useState(false)
  if (!comparison || !comparison.entries.length) return null
  const max = Math.max(...comparison.entries.map((e) => e.value)) || 1
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] opacity-70 transition-opacity hover:opacity-100"
        style={{ color: "var(--accent-deep)", background: "rgba(31,116,207,0.1)" }}
      >
        <Eye size={11} strokeWidth={2.3} /> context
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute right-0 top-[calc(100%+7px)] z-30 w-[260px] rounded-[6px] p-3 shadow-[var(--shadow-float)] transition-opacity duration-150 group-hover:opacity-100 ${open ? "opacity-100" : "opacity-0"}`}
        style={{ background: "#fff", border: "1px solid var(--hairline)" }}
      >
        <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ink-faint)" }}>
          {comparison.metric} · {comparison.unit}
        </p>
        <div className="space-y-1">
          {comparison.entries.map((e) => (
            <div key={e.name} className="flex items-center gap-2">
              <span className="w-[5.6rem] shrink-0 truncate text-[0.68rem]" style={{ color: e.isTarget ? "var(--ink)" : "var(--ink-faint)", fontWeight: e.isTarget ? 700 : 400 }}>
                {e.name}
              </span>
              <div className="h-[6px] flex-1 rounded-sm" style={{ background: "rgba(20,25,34,0.06)" }}>
                <div className="h-full rounded-sm" style={{ width: `${(e.value / max) * 100}%`, background: e.isTarget ? "#d4503a" : "rgba(212,80,58,0.4)" }} />
              </div>
              <span className="tnum w-8 shrink-0 text-right text-[0.66rem]" style={{ color: e.isTarget ? "var(--ink)" : "var(--ink-faint)", fontWeight: e.isTarget ? 700 : 400 }}>
                {e.value}
              </span>
            </div>
          ))}
        </div>
      </span>
    </span>
  )
}

/** Robbery / pickpocketing qualitative risk row (AI-assessed). */
function RiskRow({ label, rating, note, loading }: { label: string; rating: RiskRating | undefined; note: string; loading: boolean }) {
  return (
    <div className="py-2.5" style={{ borderTop: `1px solid rgba(20,25,34,0.1)` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1 text-[0.85rem] font-medium" style={{ color: INK }}>
          {label}
          <InfoTip text={note} color={INK} align="left" />
        </p>
        {rating ? (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-[0.08em]" style={{ color: RISK_COLOR[rating.level], background: `color-mix(in oklab, ${RISK_COLOR[rating.level]} 16%, transparent)` }}>
            {rating.level}
          </span>
        ) : (
          <span className="text-[0.72rem] italic" style={{ color: "var(--ink-faint)" }}>
            {loading ? "analysing…" : "—"}
          </span>
        )}
      </div>
      {rating?.note && (
        <p className="mt-1 text-[0.74rem] leading-relaxed" style={{ color: `${INK}b0` }}>
          {rating.note}
        </p>
      )}
    </div>
  )
}

function StatTile({ icon, k, signal }: { icon: ReactNode; k: string; signal: SafetySignal | undefined }) {
  const deep = TONES.safe.deep
  return (
    <div className="px-3 py-3" style={{ background: TONES.safe.fill }}>
      <p className="flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.1em]" style={{ color: `${deep}bb` }}>
        {icon}
        {k}
        {signal?.note && <InfoTip text={signal.note} color={deep} align="left" />}
      </p>
      <p className="tnum mt-1.5 text-[0.98rem] font-semibold" style={{ color: INK }}>
        {signal?.display ?? "No data"}
      </p>
      <p className="mt-0.5 text-[0.62rem]" style={{ color: `${INK}88` }}>
        {signal?.source ?? ""}
      </p>
    </div>
  )
}

// ————— main —————

interface Props {
  bundle: SafetyBundle
  intel: SafetyEnrichment | null
  prose: string
  searchQueries: string[]
  loading: boolean
  generatedAt: string
}

export function TrafficReport({ bundle, intel, prose, searchQueries, loading, generatedAt }: Props) {
  const safety = bundle.safety
  const geo = bundle.geo
  const flag = bundle.country?.flag
  const sig = (key: string) => safety.signals.find((s) => s.key === key)
  const categories = computeCategories(safety.signals)
  const catScore = (k: CategoryKey) => categories.find((c) => c.key === k)?.score ?? null
  const homicideCmp = safety.comparisons.find((c) => /homicide/i.test(c.metric))
  const levelCfg = LEVELS[safety.level]
  const indexTone = toneForScore(safety.index)
  const streaming = loading && prose.length > 0

  return (
    <div className="mx-auto max-w-[640px] overflow-hidden sm:rounded-[3px]" style={{ border: `1px solid ${RULE}`, boxShadow: "var(--shadow-float)" }}>
      {/* masthead */}
      <section className="rise-in px-7 py-7 sm:px-9" style={{ background: INK }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow" style={{ color: "rgba(238,242,248,0.55)" }}>Safety Report</p>
            <h1 className="font-display mt-1.5 text-[2rem] font-medium leading-none tracking-tight text-white">
              {geo.city} {flag && <span className="align-middle text-[1.4rem]">{flag}</span>}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-[0.78rem]" style={{ color: "rgba(238,242,248,0.6)" }}>
              <MapPin size={12} strokeWidth={2} />
              {geo.country}{generatedAt ? ` · Assessed ${generatedAt}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
            <div className="flex gap-1.5">
              {(["risky", "caution", "moderate", "safe"] as Tone[]).map((k) => (
                <span key={k} className="h-2.5 w-2.5 rounded-full" style={{ background: TONES[k].strong, outline: k === indexTone ? "2px solid rgba(255,255,255,0.85)" : "none", outlineOffset: 1.5 }} />
              ))}
            </div>
            <p className="text-[0.62rem] uppercase tracking-[0.14em]" style={{ color: "rgba(238,242,248,0.5)" }}>Read the colors</p>
          </div>
        </div>
      </section>

      {/* category tiles — top of the report, click to jump to a section */}
      <CategoryTiles categories={categories} />

      {/* composite index */}
      <Block
        tone={indexTone}
        eyebrow="01 · Composite Index"
        title="Rating"
        icon={<Gauge size={13} strokeWidth={2.4} />}
        statusWord={levelCfg.label}
        info="A single 0–100 score blending every signal below (crime, governance, health, advisories, weather) by weight. 100 = safest."
        delay={80}
      >
        <div className="flex items-end justify-between gap-6">
          <p className="display-xl tnum" style={{ color: TONES[indexTone].deep, fontWeight: 560 }}>
            {safety.index}
            <span className="text-[0.34em] font-normal tracking-normal" style={{ color: `${TONES[indexTone].deep}99` }}> / 100</span>
          </p>
          <div className="pb-2 text-right">
            <p className="text-[0.95rem] font-semibold" style={{ color: INK }}>{levelCfg.answer}</p>
            {safety.saferThanPct != null && (
              <p className="mt-0.5 text-[0.78rem]" style={{ color: `${INK}99` }}>Safer than ~{safety.saferThanPct}% of countries</p>
            )}
          </div>
        </div>
        <div className="mt-5">
          <ScoreBar value={safety.index} color={TONES[indexTone].strong} track={TONES[indexTone].track} style={{ height: 8 }} />
          <div className="mt-1.5 flex justify-between text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: `${TONES[indexTone].deep}aa` }}>
            <span>High risk</span>
            <span>Very safe</span>
          </div>
        </div>
      </Block>

      {/* advisories */}
      <Block
        id="sec-advisories"
        tone={toneForScore(catScore("advisories"))}
        eyebrow="02 · Official Guidance"
        title="Advisories"
        icon={<ShieldAlert size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "advisories")?.levelName ?? ""}
        info="Travel advisories issued directly by governments — the U.S. State Department (Level 1–4) and the UK Foreign Office (FCDO). Shown verbatim from their feeds."
        delay={160}
      >
        {safety.advisories.length ? (
          <div className="space-y-4">
            {safety.advisories.map((a) => (
              <article key={a.source} className="rounded-[3px] px-4 py-3.5" style={{ background: "rgba(255,255,255,0.42)", borderLeft: `3px solid ${a.level && a.level >= 3 ? TONES.risky.strong : a.level === 2 ? TONES.caution.strong : TONES.safe.strong}` }}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]" style={{ color: `${INK}99` }}>{a.source}</p>
                  <span className="tnum shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.08em]" style={{ color: INK }}>
                    {a.level != null ? `Level ${a.level}` : a.sourceShort}
                  </span>
                </div>
                <p className="mt-1 text-[0.92rem] font-semibold" style={{ color: INK }}>{a.levelLabel || a.headline}</p>
                {a.summary && <p className="mt-1 text-[0.8rem] leading-relaxed" style={{ color: `${INK}b3` }}>“{a.summary}”</p>}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {a.updated && <p className="text-[0.66rem]" style={{ color: `${INK}77` }}>Updated {a.updated}</p>}
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[0.66rem] font-semibold" style={{ color: "var(--accent-deep)" }}>Full advisory →</a>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-[0.85rem]" style={{ color: `${INK}b3` }}>No official government advisory is currently published for this destination — typically a sign of routine, normal-precautions travel.</p>
        )}
      </Block>

      {/* crime */}
      <Block
        id="sec-crime"
        tone={toneForScore(catScore("crime"))}
        eyebrow="03 · Evidence Signals"
        title="Crime"
        icon={<Siren size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "crime")?.levelName ?? ""}
        info="Violent- and street-crime risk. The homicide rate and road-safety data are hard statistics; robbery and pickpocketing are assessed from current on-the-ground reporting."
        delay={240}
      >
        <div>
          <SignalRow signal={sig("homicide")} extra={<ContextHover comparison={homicideCmp} />} />
          <RiskRow label="Robbery / mugging" rating={intel?.robbery} note="How likely a visitor is to face mugging or armed robbery, and where — assessed from recent local reporting." loading={loading} />
          <RiskRow label="Pickpocketing" rating={intel?.pickpocket} note="Risk of pickpocketing and bag-snatching, and the usual hotspots (transit, markets, tourist crowds)." loading={loading} />
          <SignalRow signal={sig("road")} />
        </div>
      </Block>

      {/* health & air */}
      <Block
        id="sec-health"
        tone={toneForScore(catScore("health"))}
        eyebrow="04 · Environment"
        title="Health & Air"
        icon={<HeartPulse size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "health")?.levelName ?? ""}
        info="Live air quality, nearby hospitals, the seasonal extreme-weather outlook, and any active CDC disease notices for this destination."
        delay={320}
      >
        <div className="grid grid-cols-3 gap-px" style={{ background: `${TONES.safe.deep}26` }}>
          <StatTile icon={<Wind size={13} strokeWidth={2} />} k="Air quality" signal={sig("air_quality")} />
          <StatTile icon={<Building2 size={13} strokeWidth={2} />} k="Hospitals" signal={sig("hospitals")} />
          <StatTile icon={<CloudSun size={13} strokeWidth={2} />} k="Weather" signal={sig("weather")} />
        </div>

        <div className="mt-5">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em]" style={{ color: `${TONES.safe.deep}bb` }}>
            CDC travel health notices · {safety.health.length ? `${safety.health.length} active` : "none active"}
          </p>
          {safety.health.length ? (
            <div className="mt-2 space-y-2">
              {safety.health.slice(0, 5).map((n) => (
                <div key={n.title} className="flex items-center gap-3 rounded-[3px] px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.45)" }}>
                  <span className="shrink-0 rounded-sm px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em]" style={{ background: n.level >= 2 ? `${TONES.caution.strong}2b` : `${TONES.safe.strong}26`, color: n.level >= 2 ? TONES.caution.deep : TONES.safe.deep }}>
                    {n.levelLabel}
                  </span>
                  <p className="text-[0.82rem]" style={{ color: INK }}>{n.title}{n.scope === "global" ? " (worldwide)" : ""}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[0.82rem]" style={{ color: `${INK}b3` }}>No active CDC health notices for this destination.</p>
          )}
        </div>
      </Block>

      {/* stability */}
      <Block
        id="sec-stability"
        tone={toneForScore(catScore("stability"))}
        eyebrow="05 · Institutions"
        title="Stability"
        icon={<Landmark size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "stability")?.levelName ?? ""}
        info="The World Bank's Worldwide Governance Indicators — percentile ranks (vs every country) for the institutions that keep travellers safe when something goes wrong."
        delay={400}
      >
        <div>
          <SignalRow signal={sig("stability")} />
          <SignalRow signal={sig("rule_of_law")} />
          <SignalRow signal={sig("corruption")} />
          <SignalRow signal={sig("gov_effectiveness")} />
          <SignalRow signal={sig("regulatory")} />
          <SignalRow signal={sig("voice")} />
        </div>
      </Block>

      {/* on the ground (AI) */}
      <Block
        tone="safe"
        eyebrow="06 · On the Ground"
        title="Local Intelligence"
        icon={<Newspaper size={13} strokeWidth={2.4} />}
        statusWord={intel ? "Live research" : "Researching…"}
        info="Synthesised by an AI analyst from live web search — current incidents, neighbourhood detail, scams and practical advice that databases can't capture."
        delay={480}
      >
        {intel ? (
          <>
            <p className="font-display text-[1.02rem] leading-[1.6]" style={{ color: INK }}>{intel.verdict}</p>
            {intel.summary && <p className="mt-2 text-[0.86rem] leading-relaxed" style={{ color: `${INK}c8` }}>{intel.summary}</p>}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {!!intel.safeAreas?.length && (
                <div className="rounded-[3px] px-4 py-3" style={{ background: "rgba(255,255,255,0.45)" }}>
                  <p className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em]" style={{ color: TONES.safe.deep }}>
                    <CircleCheck size={12} strokeWidth={2.4} /> Stay around
                  </p>
                  <p className="mt-1.5 text-[0.84rem] leading-relaxed" style={{ color: INK }}>{intel.safeAreas.join(" · ")}</p>
                </div>
              )}
              {!!intel.avoidAreas?.length && (
                <div className="rounded-[3px] px-4 py-3" style={{ background: "rgba(255,255,255,0.45)" }}>
                  <p className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em]" style={{ color: TONES.risky.deep }}>
                    <CircleAlert size={12} strokeWidth={2.4} /> Avoid
                  </p>
                  <p className="mt-1.5 text-[0.84rem] leading-relaxed" style={{ color: INK }}>{intel.avoidAreas.join(" · ")}</p>
                </div>
              )}
            </div>

            {!!(intel.watchOuts?.length || intel.tips?.length) && (
              <ul className="mt-5 space-y-2">
                {(intel.watchOuts?.length ? intel.watchOuts : intel.tips).slice(0, 5).map((n) => (
                  <li key={n} className="flex items-start gap-2.5 text-[0.84rem] leading-relaxed" style={{ color: `${INK}cc`, borderTop: `1px solid ${TONES.safe.deep}22`, paddingTop: "0.55rem" }}>
                    <ArrowUpRight size={13} strokeWidth={2.2} className="mt-[3px] shrink-0" style={{ color: TONES.safe.strong }} />
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <PendingLines queries={searchQueries} />
        )}

        {/* streaming prose briefing */}
        {prose && (
          <div className="mt-6 border-t pt-5" style={{ borderColor: `${TONES.safe.deep}22` }}>
            <p className="mb-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em]" style={{ color: `${TONES.safe.deep}bb` }}>Full briefing</p>
            <div className={`prose-brief ${streaming ? "typing" : ""}`} style={{ fontSize: "0.9rem" }} dangerouslySetInnerHTML={{ __html: formatProse(prose) }} />
          </div>
        )}
      </Block>

      {/* footer */}
      <footer className="rise-in px-7 py-6 sm:px-9" style={{ background: INK, borderTop: `1px solid ${RULE}`, animationDelay: "560ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="wordmark text-[0.95rem] text-white">IsMyTripSafe<span style={{ color: "rgba(238,242,248,0.45)" }}>.com</span></p>
          <p className="text-[0.68rem] tracking-[0.04em]" style={{ color: "rgba(238,242,248,0.55)" }}>Not legal or medical advice</p>
        </div>
        <p className="mt-3 text-[0.66rem] leading-relaxed" style={{ color: "rgba(238,242,248,0.4)" }}>
          Sources: U.S. State Dept · UK FCDO · World Bank · WGI · OpenStreetMap · Open-Meteo · CDC. Composite index recomputed at request time.
        </p>
      </footer>
    </div>
  )
}

function PendingLines({ queries }: { queries: string[] }) {
  const recent = queries.slice(-3)
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="spin inline-block h-4 w-4 flex-shrink-0 rounded-full border-2 border-[rgba(20,25,34,0.15)] border-t-[var(--accent)]" />
        <p className="text-[0.84rem]" style={{ color: `${INK}c8` }}>Cross-referencing current news, incidents and neighbourhood reports…</p>
      </div>
      {recent.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: `${TONES.safe.deep}22` }}>
          {recent.map((q, i) => (
            <div key={i} className="flex items-center gap-2 text-[0.74rem]" style={{ color: `${INK}99` }}>
              <Search size={10} className="flex-shrink-0" />
              <span className="truncate">{q}</span>
            </div>
          ))}
        </div>
      )}
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
