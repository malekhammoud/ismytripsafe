"use client"

import { useMemo, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import {
  ShieldAlert,
  Landmark,
  HeartPulse,
  Newspaper,
  Gauge,
  MapPin,
  Map as MapIcon,
  Radar,
  CarFront,
  Wind,
  Building2,
  CloudSun,
  Siren,
  Eye,
  Search,
} from "lucide-react"
import type {
  SafetyBundle,
  SafetyEnrichment,
  SafetySignal,
  RiskLevel,
  RiskRating,
  Comparison,
  DestinationImages,
} from "@/lib/types"
import { computeCategories, computeFinalScore, scoreColor, LEVELS, type CategoryKey } from "@/lib/safety-display"
import { personalizeScore, profileSummary, type TravelerProfile } from "@/lib/profile"
import { extractSourceLinksFromText, sourceUrlForName, sourceUrlForSearchQuery } from "@/lib/source-links"
import { CategoryTiles } from "./CategoryTiles"
import { InfoTip } from "./InfoTip"
import { ShareButton } from "./ShareButton"
import { SourceLink } from "./SourceLink"
import { Logo } from "@/components/Logo"

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
  const src = sourceUrlForName(signal.source)
  return (
    <div className="py-2.5" style={{ borderTop: `1px solid rgba(20,25,34,0.1)` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1 text-[0.85rem] font-medium" style={{ color: INK }}>
          {signal.label}
          <InfoTip text={signal.note} color={INK} align="left" />
        </p>
        <div className="tnum flex shrink-0 items-center gap-1.5 text-[0.82rem]" style={{ color: "var(--ink-soft)" }}>
          {signal.display}
          {extra}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <ScoreBar value={has ? (signal.score as number) : 0} color={c} track="rgba(20,25,34,0.08)" />
        <span className="tnum w-7 shrink-0 text-right text-[0.72rem] font-semibold" style={{ color: c }}>
          {has ? signal.score : "—"}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[0.66rem]" style={{ color: `${INK}88` }}>
        {signal.source}
        {signal.year ? ` · ${signal.year}` : ""}
        {src && <SourceLink href={src} label={signal.source} color={`${INK}99`} />}
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
        {/* spans (display-styled) rather than p/div — this tooltip can render
            inside inline flow, where block elements break HTML nesting rules */}
        <span className="mb-2 block text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ink-faint)" }}>
          {comparison.metric} · {comparison.unit}
        </span>
        <span className="block space-y-1">
          {comparison.entries.map((e) => (
            <span key={e.name} className="flex items-center gap-2">
              <span className="w-[5.6rem] shrink-0 truncate text-[0.68rem]" style={{ color: e.isTarget ? "var(--ink)" : "var(--ink-faint)", fontWeight: e.isTarget ? 700 : 400 }}>
                {e.name}
              </span>
              <span className="block h-[6px] flex-1 rounded-sm" style={{ background: "rgba(20,25,34,0.06)" }}>
                <span className="block h-full rounded-sm" style={{ width: `${(e.value / max) * 100}%`, background: e.isTarget ? "#d4503a" : "rgba(212,80,58,0.4)" }} />
              </span>
              <span className="tnum w-8 shrink-0 text-right text-[0.66rem]" style={{ color: e.isTarget ? "var(--ink)" : "var(--ink-faint)", fontWeight: e.isTarget ? 700 : 400 }}>
                {e.value}
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}

/** Robbery / pickpocketing qualitative risk row (AI-assessed). */
function RiskRow({
  label,
  rating,
  note,
  loading,
  sourceHref,
}: {
  label: string
  rating: RiskRating | undefined
  note: string
  loading: boolean
  sourceHref?: string | null
}) {
  return (
    <div className="py-2.5" style={{ borderTop: `1px solid rgba(20,25,34,0.1)` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1 text-[0.85rem] font-medium" style={{ color: INK }}>
          {label}
          <InfoTip text={note} color={INK} align="left" />
          {sourceHref && <SourceLink href={sourceHref} label={`${label} source`} color={`${INK}99`} />}
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
        <p className="mt-1 flex items-center gap-1 text-[0.74rem] leading-relaxed" style={{ color: `${INK}b0` }}>
          {rating.note}
          {sourceHref && <SourceLink href={sourceHref} label={`${label} note source`} color={`${INK}99`} />}
        </p>
      )}
    </div>
  )
}

/** Long-tail indicators, collapsed by default — the data stays on the page
 *  (and in the crawlable HTML) without burying the rows travellers care about. */
function MoreSignals({ signals }: { signals: (SafetySignal | undefined)[] }) {
  const present = signals.filter((s): s is SafetySignal => !!s && s.score != null)
  if (!present.length) return null
  return (
    <details className="group">
      <summary
        className="cursor-pointer list-none py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] opacity-55 transition-opacity hover:opacity-90 [&::-webkit-details-marker]:hidden"
        style={{ color: INK, borderTop: `1px solid rgba(20,25,34,0.1)` }}
      >
        <span className="group-open:hidden">▸ {present.length} more indicator{present.length === 1 ? "" : "s"}</span>
        <span className="hidden group-open:inline">▾ Hide extra indicators</span>
      </summary>
      {present.map((s) => (
        <SignalRow key={s.key} signal={s} />
      ))}
    </details>
  )
}

function StatTile({ icon, k, signal }: { icon: ReactNode; k: string; signal: SafetySignal | undefined }) {
  const deep = TONES.safe.deep
  const src = sourceUrlForName(signal?.source)
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
      <p className="mt-0.5 flex items-center gap-1 text-[0.62rem]" style={{ color: `${INK}88` }}>
        {signal?.source ?? ""}
        {src && <SourceLink href={src} label={`${k} source`} color={`${INK}99`} />}
      </p>
    </div>
  )
}

// ————— main —————

/** Circular 0–100 meter with the score centered inside — the hero's focal point. */
function ScoreRing({ score, accent, strong }: { score: number; accent: string; strong: string }) {
  const R = 54
  const C = 2 * Math.PI * R
  const filled = (Math.max(0, Math.min(100, score)) / 100) * C
  return (
    <div className="relative mx-auto h-[168px] w-[168px] sm:h-[192px] sm:w-[192px]">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" style={{ filter: `drop-shadow(0 0 16px ${strong}66)` }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(238,242,248,0.16)" strokeWidth="6.5" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={accent} strokeWidth="6.5" strokeLinecap="round" strokeDasharray={`${filled} ${C}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display leading-none text-white" style={{ fontSize: "clamp(2.9rem,12vw,3.5rem)", fontWeight: 560, letterSpacing: "-0.02em" }}>
          {score}
        </p>
        <p className="mt-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "rgba(238,242,248,0.6)" }}>
          / 100
        </p>
      </div>
    </div>
  )
}

interface Props {
  bundle: SafetyBundle
  images: DestinationImages | null
  intel: SafetyEnrichment | null
  profile?: TravelerProfile | null
  prose: string
  searchQueries: string[]
  loading: boolean
  generatedAt: string
  /** "h1" in the SPA (default); "h2" on the permanent report pages, which provide their own h1. */
  heroHeading?: "h1" | "h2"
  /** Canonical permanent URL for this report — shown in the footer when set. */
  permalink?: string | null
}

export function TrafficReport({ bundle, images, intel, profile = null, prose, searchQueries, loading, generatedAt, heroHeading = "h1", permalink = null }: Props) {
  const safety = bundle.safety
  const geo = bundle.geo
  const flag = bundle.country?.flag
  const sig = (key: string) => safety.signals.find((s) => s.key === key)
  const categories = computeCategories(safety.signals)
  const catScore = (k: CategoryKey) => categories.find((c) => c.key === k)?.score ?? null
  const homicideCmp = safety.comparisons.find((c) => /homicide/i.test(c.metric))
  // The published score blends the database composite with the field research
  // (street-crime ratings + traveller sentiment) — it's only final once the
  // research is in, which is why the page holds the report until then. A
  // traveller profile then deterministically re-weights it for who's going.
  const final = computeFinalScore(safety, intel)
  const personal = personalizeScore(final, categories, profile)
  const levelCfg = LEVELS[personal.level]
  const indexTone = toneForScore(personal.index)
  // The tone colours are tuned for light panels; lift them toward white so the
  // hero ring and pill stay vivid on the dark photo backdrop.
  const heroAccent = `color-mix(in oklab, ${TONES[indexTone].strong} 66%, #f4f7fb)`
  // Wikimedia lead images arrive at up to 3840px — request the 1280px thumb
  // bucket instead so the hero paints fast; other hosts pass through untouched.
  // On any load failure the <img> falls back to the original URL. Country pages
  // often lead with a flag / coat of arms / map (SVG-derived) — skip those, the
  // dark tone-glow backdrop looks better than a stretched flag.
  const heroPhoto =
    images?.hero && !/flag_of|coat_of_arms|locator|\.svg/i.test(images.hero)
      ? images.hero.replace(/\/\d{3,4}px-([^/]+)$/, "/1280px-$1")
      : null
  // The "on the ground" block reflects how safe it actually is right now — the
  // AI's current-sentiment read if present, otherwise the overall rating — so a
  // "not safe right now" verdict never sits on a green panel.
  const intelTone: Tone = intel?.consumerSentiment
    ? toneForScore(intel.consumerSentiment.score)
    : indexTone
  const it = TONES[intelTone]
  const toneWord: Record<Tone, string> = { safe: "Stable", moderate: "Moderate", caution: "Caution", risky: "Elevated" }
  const streaming = loading && prose.length > 0
  const intelLinks = useMemo(() => extractSourceLinksFromText(prose), [prose])
  const intelFallback = sourceUrlForSearchQuery(searchQueries[searchQueries.length - 1] ?? null)
  const intelSourceHref = intelLinks[0] ?? intelFallback ?? null
  const mapHref = `/map?place=${encodeURIComponent(`${geo.city}, ${geo.country}`)}`

  return (
    <div className="mx-auto max-w-[640px] overflow-hidden sm:rounded-[3px]" style={{ border: `1px solid ${RULE}`, boxShadow: "var(--shadow-float)" }}>
      {/* masthead — the shareable hero: destination photo, centered score ring,
          verdict and scale in one screenshot */}
      <section id="report-hero" className="rise-in relative overflow-hidden px-5 py-6 sm:px-9 sm:py-8" style={{ background: INK }}>
        {heroPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center 35%" }}
            onError={(e) => {
              const img = e.currentTarget
              if (images?.hero && img.src !== images.hero) img.src = images.hero
              else img.style.display = "none"
            }}
          />
        )}
        {/* ink scrim so type stays readable over any photo, plus a tone-coloured
            glow behind the ring that carries the verdict colour */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${INK}e8 0%, ${INK}a6 30%, ${INK}b0 62%, ${INK}f2 100%)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(58% 44% at 50% 48%, ${TONES[indexTone].strong}38, transparent 72%)` }} />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="eyebrow" style={{ color: "rgba(238,242,248,0.65)" }}>Safety Report</p>
            <span className="flex items-center gap-2.5">
              <p className="wordmark flex items-center gap-1.5 text-[0.82rem] text-white">
                <Logo size={13} />
                IsMyTripSafe<span style={{ color: "rgba(238,242,248,0.5)" }}>.com</span>
              </p>
              <ShareButton targetId="report-hero" city={geo.city} score={personal.index} answer={levelCfg.answer} />
            </span>
          </div>

          <Heading
            as={heroHeading}
            className="font-display mt-4 text-center text-[clamp(1.7rem,7.5vw,2.2rem)] font-medium leading-[1.08] tracking-tight text-white"
          >
            {geo.city} {flag && <span className="align-middle text-[0.72em]">{flag}</span>}
          </Heading>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[0.76rem]" style={{ color: "rgba(238,242,248,0.72)" }}>
            <MapPin size={12} strokeWidth={2} className="shrink-0" />
            {geo.country}{generatedAt ? ` · Assessed ${generatedAt}` : ""}
          </p>

          <div className="mt-5">
            <ScoreRing score={personal.index} accent={heroAccent} strong={TONES[indexTone].strong} />
          </div>

          <div className="mt-4 text-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold text-white"
              style={{
                background: `color-mix(in oklab, ${TONES[indexTone].strong} 42%, ${INK}cc)`,
                border: `1px solid color-mix(in oklab, ${TONES[indexTone].strong} 65%, transparent)`,
                boxShadow: `0 4px 20px -6px ${TONES[indexTone].strong}88`,
              }}
            >
              <Gauge size={14} strokeWidth={2.4} className="shrink-0" style={{ color: heroAccent }} />
              {levelCfg.answer}
            </span>
            {personal.personalized && profile && (
              <p className="mt-2 flex items-center justify-center gap-1 text-[0.72rem]" style={{ color: "rgba(238,242,248,0.72)" }}>
                <span className="font-semibold uppercase tracking-[0.1em]" style={{ color: heroAccent }}>Personalised</span>
                {profileSummary(profile)}
                <InfoTip
                  text={`Deterministically re-weighted for your group — same answers always give the same score. ${personal.drivers.join(", ")}. General score: ${personal.baseIndex}/100.`}
                  color="rgba(238,242,248,0.7)"
                />
              </p>
            )}
            <p className="mt-2 flex items-center justify-center gap-1 text-[0.75rem]" style={{ color: "rgba(238,242,248,0.72)" }}>
              Safer than ~{final.saferThanPct}% of countries
              <InfoTip
                text={
                  (final.includesFieldResearch
                    ? "A single 0–100 score. The database composite carries 80%; the live field research — street-crime ratings and current traveller sentiment — carries 20%. "
                    : "A single 0–100 score built from every indicator below. ") +
                  "Indicators are grouped into hazard families (crime, conflict, official guidance, institutions, everyday hazards, health) and combined so that severe risk in any one family dominates rather than being averaged away by the others. 100 = safest."
                }
                color="rgba(238,242,248,0.7)"
              />
            </p>
            {final.caps.length > 0 && (
              /* A capped score must never look arbitrary — say what bounds it. */
              <p
                className="mx-auto mt-2.5 max-w-[30rem] rounded-lg px-3 py-2 text-[0.72rem] leading-snug"
                style={{
                  color: "rgba(238,242,248,0.9)",
                  background: "rgba(212,80,58,0.16)",
                  border: "1px solid rgba(212,80,58,0.4)",
                }}
              >
                <span className="font-semibold uppercase tracking-[0.08em]">
                  Score capped at {final.caps[0].max}
                </span>{" "}
                — {final.caps[0].reason}. No other indicator can raise the score above this.
              </p>
            )}
          </div>

          <div
            className="mt-5 flex items-center justify-center gap-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "rgba(238,242,248,0.6)" }}
            aria-label="Report color scale"
          >
            <span>High risk</span>
            <span className="flex items-center gap-1.5">
              {(["risky", "caution", "moderate", "safe"] as Tone[]).map((k) => (
                <span key={k} className="h-2 w-2 rounded-full" style={{ background: TONES[k].strong, outline: k === indexTone ? "2px solid rgba(255,255,255,0.85)" : "none", outlineOffset: 1.5 }} />
              ))}
            </span>
            <span>Very safe</span>
          </div>
        </div>
      </section>

      {/* category tiles — click to jump to a section */}
      <CategoryTiles categories={categories} />

      {/* advisories */}
      <Block
        id="sec-advisories"
        tone={toneForScore(catScore("advisories"))}
        eyebrow="01 · Official Guidance"
        title="Advisories"
        icon={<ShieldAlert size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "advisories")?.levelName ?? ""}
        info="Travel advisories issued directly by governments — the U.S. State Department (Level 1–4) and the UK Foreign Office (FCDO). Shown verbatim from their feeds."
        delay={120}
      >
        {safety.advisories.length ? (
          <div className="space-y-4">
            {safety.advisories.map((a) => (
              <article key={a.source} className="rounded-[3px] px-4 py-3.5" style={{ background: "rgba(255,255,255,0.42)", borderLeft: `3px solid ${a.level && a.level >= 3 ? TONES.risky.strong : a.level === 2 ? TONES.caution.strong : TONES.safe.strong}` }}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em]" style={{ color: `${INK}99` }}>
                    {a.source}
                    {a.url && <SourceLink href={a.url} label={a.source} color={`${INK}99`} />}
                  </p>
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
        eyebrow="02 · Evidence Signals"
        title="Crime"
        icon={<Siren size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "crime")?.levelName ?? ""}
        info="Violent- and street-crime risk from multiple databases: homicide (World Bank / UNODC / WHO), physical assault and sexual violence victimisation (UNODC via UN SDG), trafficking, bribery, business crime exposure, and Numbeo crowdsourced indices (city-level where available). When a country lacks data, the nearest wider geography (region) fills in — labeled as such. Robbery and pickpocketing are assessed from current on-the-ground reporting."
        delay={200}
      >
        <div>
          <SignalRow signal={sig("homicide")} extra={<ContextHover comparison={homicideCmp} />} />
          <SignalRow signal={sig("safe_walking_dark")} />
          <SignalRow signal={sig("violence_victimization")} />
          <SignalRow signal={sig("numbeo_crime_index")} />
          <RiskRow
            label="Robbery / mugging"
            rating={intel?.robbery}
            note="How likely a visitor is to face mugging or armed robbery, and where — assessed from recent local reporting."
            loading={loading}
            sourceHref={intelSourceHref}
          />
          <RiskRow
            label="Pickpocketing"
            rating={intel?.pickpocket}
            note="Risk of pickpocketing and bag-snatching, and the usual hotspots (transit, markets, tourist crowds)."
            loading={loading}
            sourceHref={intelSourceHref}
          />
          <MoreSignals
            signals={[
              sig("sexual_violence"),
              sig("human_trafficking_victims"),
              sig("bribery_contact_rate"),
              sig("firm_crime_losses"),
              sig("crime_major_constraint"),
            ]}
          />
        </div>
      </Block>

      {/* health & air */}
      <Block
        id="sec-health"
        tone={toneForScore(catScore("health"))}
        eyebrow="03 · Environment"
        title="Health & Air"
        icon={<HeartPulse size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "health")?.levelName ?? ""}
        info="Live air quality, nearby hospitals, the seasonal extreme-weather outlook, road-traffic death rates (WHO), and any active CDC disease notices for this destination."
        delay={280}
      >
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: `${TONES.safe.deep}26` }}>
          <StatTile icon={<Wind size={13} strokeWidth={2} />} k="Air quality" signal={sig("air_quality")} />
          <StatTile icon={<Building2 size={13} strokeWidth={2} />} k="Hospitals" signal={sig("hospitals")} />
          <StatTile icon={<CloudSun size={13} strokeWidth={2} />} k="Weather" signal={sig("weather")} />
          <StatTile icon={<CarFront size={13} strokeWidth={2} />} k="Road safety" signal={sig("road_deaths")} />
        </div>

        <div className="mt-2">
          <SignalRow signal={sig("natural_hazards")} />
        </div>

        {!!safety.hazardEvents?.length && (
          <div className="mt-3 space-y-2">
            {safety.hazardEvents.slice(0, 3).map((h) => (
              <div key={h.url || h.title} className="flex items-center gap-3 rounded-[3px] px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.45)" }}>
                <span
                  className="shrink-0 rounded-sm px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em]"
                  style={{
                    background: h.severity === "red" ? `${TONES.risky.strong}2b` : h.severity === "orange" ? `${TONES.caution.strong}2b` : `${TONES.safe.strong}26`,
                    color: h.severity === "red" ? TONES.risky.deep : h.severity === "orange" ? TONES.caution.deep : TONES.safe.deep,
                  }}
                >
                  {h.kind}
                </span>
                <p className="flex items-center gap-1 text-[0.82rem]" style={{ color: INK }}>
                  {h.title} · ~{h.distanceKm} km away
                  {h.url && <SourceLink href={h.url} label={h.title} color={`${INK}99`} />}
                </p>
              </div>
            ))}
          </div>
        )}

        {(() => {
          // Destination-specific notices get cards; the standing worldwide
          // notices (polio, dengue, measles…) collapse to one muted line so
          // they don't read as local risks on every report.
          const local = safety.health.filter((n) => n.scope !== "global")
          const global = safety.health.filter((n) => n.scope === "global")
          return (
            <div className="mt-5">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em]" style={{ color: `${TONES.safe.deep}bb` }}>
                CDC travel health notices · {local.length ? `${local.length} for this destination` : "none for this destination"}
              </p>
              {local.length > 0 && (
                <div className="mt-2 space-y-2">
                  {local.slice(0, 5).map((n) => (
                    <div key={n.title} className="flex items-center gap-3 rounded-[3px] px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.45)" }}>
                      <span className="shrink-0 rounded-sm px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em]" style={{ background: n.level >= 2 ? `${TONES.caution.strong}2b` : `${TONES.safe.strong}26`, color: n.level >= 2 ? TONES.caution.deep : TONES.safe.deep }}>
                        {n.levelLabel}
                      </span>
                      <p className="flex items-center gap-1 text-[0.82rem]" style={{ color: INK }}>
                        {n.title}
                        <SourceLink href={n.url} label={n.title} color={`${INK}99`} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {global.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[0.72rem]" style={{ color: `${INK}88` }}>
                  Worldwide notices (not specific to this trip):{" "}
                  {global.map((n) => n.title.replace(/^Global\s+/i, "")).join(", ")}
                  <SourceLink href={global[0].url} label="CDC worldwide notices" color={`${INK}88`} />
                </p>
              )}
            </div>
          )
        })()}
      </Block>

      {/* stability */}
      <Block
        id="sec-stability"
        tone={toneForScore(catScore("stability"))}
        eyebrow="04 · Institutions"
        title="Stability"
        icon={<Landmark size={13} strokeWidth={2.4} />}
        statusWord={categories.find((c) => c.key === "stability")?.levelName ?? ""}
        info="The World Bank's Worldwide Governance Indicators — percentile ranks (vs every country) for the institutions that keep travellers safe when something goes wrong — plus terrorism deaths per million residents (Global Terrorism Database). Backed by fallback sources so the data is always populated."
        delay={360}
      >
        <div>
          <SignalRow signal={sig("stability")} />
          <SignalRow signal={sig("terrorism_deaths_pm")} />
          <SignalRow signal={sig("rule_of_law")} />
          <SignalRow signal={sig("corruption")} />
          <MoreSignals signals={[sig("gov_effectiveness"), sig("regulatory"), sig("voice")]} />
        </div>
      </Block>

      {/* current situation (live field research) */}
      <Block
        id="sec-local-intel"
        tone={intelTone}
        eyebrow="05 · Field Research"
        title="Current Situation"
        icon={<Radar size={13} strokeWidth={2.4} />}
        statusWord={intel ? toneWord[intelTone] : "Researching…"}
        info="What it's like on the ground right now — researched live from current news and traveller reports, independently of the databases above. District-by-district ratings live on the Safety Map page. This panel's colour reflects conditions right now."
        delay={440}
      >
        {intel ? (
          <>
            <p className="font-display flex items-center gap-1 text-[1.02rem] leading-[1.6]" style={{ color: INK }}>
              {intel.verdict}
              {intelSourceHref && <SourceLink href={intelSourceHref} label="field research" color={`${INK}99`} />}
            </p>
            {intel.summary && (
              <p className="mt-2 flex items-center gap-1 text-[0.86rem] leading-relaxed" style={{ color: `${INK}c8` }}>
                {intel.summary}
                {intelSourceHref && <SourceLink href={intelSourceHref} label="field research summary" color={`${INK}99`} />}
              </p>
            )}

            {!!intel.recentIncidents?.length && (
              <div className="mt-5 rounded-[3px] px-4 py-3" style={{ background: "rgba(255,255,255,0.45)" }}>
                <p className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em]" style={{ color: it.deep }}>
                  <Newspaper size={12} strokeWidth={2.2} /> Recent developments
                </p>
                <ul className="mt-2 space-y-2">
                  {intel.recentIncidents.slice(0, 4).map((r) => (
                    <li key={r.what} className="flex items-start gap-2.5 text-[0.84rem] leading-relaxed" style={{ color: INK }}>
                      <span className="tnum mt-[2px] shrink-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em]" style={{ background: `${it.strong}22`, color: it.deep }}>
                        {r.when}
                      </span>
                      <span>
                        {r.what}
                        {r.source && <span className="ml-1.5 text-[0.68rem]" style={{ color: `${INK}88` }}>— {r.source}</span>}
                        {intelSourceHref && <SourceLink href={intelSourceHref} label="recent development source" color={`${INK}99`} className="ml-1" />}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!intel.scams?.length && (
              <div className="mt-5 rounded-[3px] px-4 py-3" style={{ background: "rgba(255,255,255,0.45)" }}>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em]" style={{ color: TONES.caution.deep }}>
                  Common scams
                </p>
                <ul className="mt-2 space-y-1.5">
                  {intel.scams.slice(0, 5).map((scam) => (
                    <li key={scam} className="flex items-start gap-1 text-[0.84rem] leading-relaxed" style={{ color: INK }}>
                      {scam}
                      {intelSourceHref && <SourceLink href={intelSourceHref} label="scam insight" color={`${INK}99`} className="mt-[3px] shrink-0" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* neighbourhood ratings live on the map page, not here */}
            <Link
              href={mapHref}
              className="mt-4 flex items-center justify-between gap-3 rounded-[3px] px-4 py-3 transition-opacity hover:opacity-75"
              style={{ background: `${it.deep}12`, border: `1px solid ${it.deep}2e` }}
            >
              <span className="flex items-center gap-2 text-[0.82rem] font-medium" style={{ color: INK }}>
                <MapIcon size={14} strokeWidth={2.2} className="shrink-0" style={{ color: it.deep }} />
                Which areas are safe? District-by-district ratings are on the Safety Map
              </span>
              <span className="shrink-0 text-[0.85rem] font-semibold" style={{ color: it.deep }}>→</span>
            </Link>
          </>
        ) : (
          <PendingLines queries={searchQueries} />
        )}

        {/* streaming prose briefing */}
        {prose && (
          <div id="sec-local-intel-sources" className="mt-6 border-t pt-5" style={{ borderColor: `${it.deep}22` }}>
            <p className="mb-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em]" style={{ color: `${it.deep}bb` }}>Full briefing</p>
            <div className={`prose-brief ${streaming ? "typing" : ""}`} style={{ fontSize: "0.9rem" }} dangerouslySetInnerHTML={{ __html: formatProse(prose) }} />
            {!!intelLinks.length && (
              <div className="mt-3 flex items-center gap-1.5">
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.12em]" style={{ color: `${it.deep}a8` }}>Sources</p>
                {intelLinks.slice(0, 8).map((url) => (
                  <SourceLink key={url} href={url} label="briefing source" color={`${it.deep}bb`} />
                ))}
              </div>
            )}
          </div>
        )}
      </Block>

      {/* footer */}
      <footer className="rise-in px-7 py-6 sm:px-9" style={{ background: INK, borderTop: `1px solid ${RULE}`, animationDelay: "560ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="wordmark flex items-center gap-1.5 text-[0.95rem] text-white">
            <Logo size={15} />
            IsMyTripSafe<span style={{ color: "rgba(238,242,248,0.45)" }}>.com</span>
          </p>
          <p className="text-[0.68rem] tracking-[0.04em]" style={{ color: "rgba(238,242,248,0.55)" }}>Not legal or medical advice</p>
        </div>
        {permalink && (
          <p className="mt-2 text-[0.68rem]" style={{ color: "rgba(238,242,248,0.55)" }}>
            Permanent report:{" "}
            <Link href={permalink} className="font-medium underline" style={{ color: "rgba(238,242,248,0.8)" }}>
              ismytripsafe.com{permalink}
            </Link>
          </p>
        )}
        <p className="mt-3 text-[0.66rem] leading-relaxed" style={{ color: "rgba(238,242,248,0.4)" }}>
          Sources: U.S. State Dept · UK FCDO · World Bank · WGI · UNODC · WHO · UN SDG · Global Terrorism Database · Numbeo · OpenStreetMap · Open-Meteo · CDC. Composite index recomputed at request time.
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[0.64rem]" style={{ color: "rgba(238,242,248,0.55)" }}>
          <span>Links:</span>
          {safety.sources.map((s) => {
            const href = sourceUrlForName(s.name)
            if (!href) return null
            return <SourceLink key={s.name} href={href} label={s.name} color="rgba(238,242,248,0.72)" />
          })}
        </div>
      </footer>
    </div>
  )
}

function Heading({
  as,
  className,
  children,
}: {
  as: "h1" | "h2"
  className: string
  children: ReactNode
}) {
  return as === "h1" ? (
    <h1 className={className}>{children}</h1>
  ) : (
    <h2 className={className}>{children}</h2>
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
