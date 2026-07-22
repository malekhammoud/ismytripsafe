import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Logo } from "@/components/Logo"
import type { ReportMeta } from "@/lib/reports"
import type { SafetySignal } from "@/lib/types"
import { LEVELS, scoreColor } from "@/lib/safety-display"
import { sourceUrlForName } from "@/lib/source-links"
import { humanDate } from "@/lib/site"

// Server-rendered building blocks for the crawlable pages (city reports,
// country hubs, destination index). No client JS — pure HTML/CSS.
//
// Design rule: everything below a TrafficReport continues its "dossier"
// language — same 640px column, same 01/02/… numbered section headers,
// same bordered-document surface — so the page reads as one report, not
// a report card with loose text underneath.

const INK = "#141922"
const RULE = "rgba(20, 25, 34, 0.4)" // document border, matches TrafficReport
const HAIR = "rgba(20, 25, 34, 0.1)" // row dividers inside the document

export function scoreTint(score: number): string {
  if (score >= 70) return "#2f9e6f"
  if (score >= 55) return "#c8973f"
  if (score >= 40) return "#e08a3b"
  return "#d4503a"
}

// ─── Site chrome ─────────────────────────────────────────────────────

/** Sticky full-width top bar. Render it before <main>, not inside it. */
export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--hairline)]"
      style={{
        background: "rgba(238, 242, 248, 0.82)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
      }}
    >
      <div className="mx-auto flex h-[54px] max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="wordmark flex items-center gap-1.5 text-[0.95rem] text-[var(--ink)]">
          <Logo size={16} />
          IsMyTripSafe<span style={{ color: "var(--accent)" }}>.com</span>
        </Link>
        <nav className="flex items-center gap-4 text-[0.8rem] font-medium text-[var(--ink-soft)] sm:gap-5">
          <Link href="/destinations" className="hover:text-[var(--accent)]">Destinations</Link>
          <Link href="/methodology" className="hidden hover:text-[var(--accent)] sm:inline">Methodology</Link>
          <Link href="/" className="btn px-3.5 py-1.5 text-[0.78rem]">Check a place</Link>
        </nav>
      </div>
    </header>
  )
}

export interface Crumb {
  name: string
  href: string
}

/** Visible breadcrumb trail (also emitted as BreadcrumbList JSON-LD). */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1 text-[0.76rem] text-[var(--ink-faint)]">
        {trail.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} aria-hidden />}
            {i === trail.length - 1 ? (
              <span aria-current="page" className="font-medium text-[var(--ink-soft)]">{c.name}</span>
            ) : (
              <Link href={c.href} className="hover:text-[var(--accent)]">{c.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Heading with a trailing hairline rule — for link modules outside the doc. */
export function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline gap-3.5">
      <h2 className="font-display shrink-0 text-[1.18rem] font-medium tracking-tight text-[var(--ink)]">
        {children}
      </h2>
      <span className="hairline flex-1" aria-hidden />
      {note && <span className="tnum shrink-0 text-[0.7rem] text-[var(--ink-faint)]">{note}</span>}
    </div>
  )
}

// ─── The continuation document ───────────────────────────────────────

/** Bordered document surface matching the TrafficReport card exactly. */
export function ReportDoc({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto max-w-[640px] overflow-hidden bg-white sm:rounded-[3px]"
      style={{ border: `1px solid ${RULE}`, boxShadow: "var(--shadow-float)" }}
    >
      {children}
    </div>
  )
}

/** Numbered section inside a ReportDoc — mirrors the report's Block header. */
export function DocSection({
  num,
  kicker,
  title,
  pill,
  first = false,
  children,
}: {
  num: string
  kicker: string
  title: string
  pill?: string
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className="px-6 py-7 sm:px-9 sm:py-8"
      style={first ? undefined : { borderTop: `1px solid ${RULE}` }}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow" style={{ color: "var(--accent-deep)", opacity: 0.8, letterSpacing: "0.2em" }}>
            {num} · {kicker}
          </p>
          <h2 className="font-display mt-1 text-[1.4rem] font-medium tracking-tight" style={{ color: INK }}>
            {title}
          </h2>
        </div>
        {pill && (
          <span
            className="mt-0.5 shrink-0 rounded-full px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--ink-faint)", border: `1px solid ${HAIR}`, background: "rgba(20,25,34,0.03)" }}
          >
            {pill}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

/** Sequential "06", "07", … section numbering for a page's DocSections. */
export function sectionNumberer(start = 0): () => string {
  let n = start
  return () => String(++n).padStart(2, "0")
}

// ─── Data presentation inside the document ───────────────────────────

/** Signal table styled like the report's signal rows: bar + score + source. */
export function SignalTable({ signals }: { signals: SafetySignal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[0.85rem]">
        <thead>
          <tr
            className="text-left text-[0.64rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <th className="pb-2 pr-3 font-semibold">Indicator</th>
            <th className="pb-2 pr-3 font-semibold">Value</th>
            <th className="pb-2 pr-3 font-semibold">Score</th>
            <th className="hidden pb-2 font-semibold sm:table-cell">Source</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => {
            const c = scoreColor(s.score as number)
            const src = sourceUrlForName(s.source)
            return (
              <tr key={s.key} style={{ borderTop: `1px solid ${HAIR}` }}>
                <td className="py-2.5 pr-3 font-medium" style={{ color: INK }}>
                  {s.label}
                  <span className="mt-0.5 block text-[0.68rem] font-normal sm:hidden" style={{ color: "var(--ink-faint)" }}>
                    {s.source}
                    {s.year ? ` · ${s.year}` : ""}
                  </span>
                </td>
                <td className="tnum py-2.5 pr-3 whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>
                  {s.display}
                </td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="hidden h-[5px] w-12 overflow-hidden rounded-full sm:block"
                      style={{ background: "rgba(20,25,34,0.08)" }}
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${s.score}%`, background: c }}
                      />
                    </span>
                    <span className="tnum text-[0.8rem] font-semibold" style={{ color: c }}>
                      {s.score}
                    </span>
                  </span>
                </td>
                <td className="hidden py-2.5 text-[0.72rem] sm:table-cell" style={{ color: "var(--ink-faint)" }}>
                  {src ? (
                    <a href={src} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] hover:underline">
                      {s.source}
                    </a>
                  ) : (
                    s.source
                  )}
                  {s.year ? ` (${s.year})` : ""}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Solid score circle, used everywhere a score accompanies a link or row. */
export function ScoreBadge({ score, size = 36 }: { score: number; size?: number }) {
  return (
    <span
      className="tnum flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ background: scoreTint(score), width: size, height: size, fontSize: size * 0.36 }}
      aria-label={`Safety score ${score} out of 100`}
    >
      {score}
    </span>
  )
}

/** Ranked destination rows for country hubs — makes the hierarchy legible. */
export function RankedCityList({ items }: { items: ReportMeta[] }) {
  return (
    <div>
      {items.map((m, i) => (
        <Link
          key={m.path}
          href={m.path}
          className="group flex items-center gap-3 py-3 sm:gap-4"
          style={{ borderTop: i === 0 ? undefined : `1px solid ${HAIR}` }}
        >
          <span className="tnum w-7 shrink-0 text-[0.78rem] font-semibold" style={{ color: "var(--ink-faint)" }}>
            #{i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.92rem] font-semibold text-[var(--ink)] group-hover:text-[var(--accent-deep)]">
              {m.flag && <span className="mr-1.5">{m.flag}</span>}
              {m.city}
            </span>
            <span className="block text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
              {LEVELS[m.level].label} · updated {humanDate(m.updatedAt)}
            </span>
          </span>
          <span
            className="hidden h-[5px] w-24 shrink-0 overflow-hidden rounded-full sm:block"
            style={{ background: "rgba(20,25,34,0.08)" }}
            aria-hidden
          >
            <span className="block h-full rounded-full" style={{ width: `${m.score}%`, background: scoreTint(m.score) }} />
          </span>
          <ScoreBadge score={m.score} size={34} />
        </Link>
      ))}
    </div>
  )
}

/** FAQ items rendered inside a DocSection, divided by hairlines. */
export function FaqList({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  const rendered = items.filter((i) => i.q && i.a)
  if (!rendered.length) return null
  return (
    <div>
      {rendered.map((i, idx) => (
        <div key={i.q} className="py-3.5" style={{ borderTop: idx === 0 ? undefined : `1px solid ${HAIR}` }}>
          <h3 className="text-[0.95rem] font-semibold" style={{ color: INK }}>{i.q}</h3>
          <div className="mt-1.5 text-[0.88rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{i.a}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Link modules (outside the document) ─────────────────────────────

/** Compact link card for a related report: flag, name, score, verdict word. */
export function ReportLink({ meta, anchor }: { meta: ReportMeta; anchor?: string }) {
  return (
    <Link
      href={meta.path}
      className="card flex items-center justify-between gap-3 px-4 py-3 transition-shadow hover:shadow-[var(--shadow-float)]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[0.88rem] font-semibold text-[var(--ink)]">
          {meta.flag && <span className="mr-1.5">{meta.flag}</span>}
          {anchor ?? `Is ${meta.city} safe?`}
        </span>
        <span className="block truncate text-[0.72rem] text-[var(--ink-faint)]">
          {LEVELS[meta.level].label} · {meta.country}
        </span>
      </span>
      <ScoreBadge score={meta.score} />
    </Link>
  )
}

export function ReportLinkGrid({
  title,
  items,
  anchors,
}: {
  title: string
  items: ReportMeta[]
  anchors?: (m: ReportMeta) => string
}) {
  if (!items.length) return null
  return (
    <section className="mt-9">
      <SectionHeading note={`${items.length} report${items.length === 1 ? "" : "s"}`}>{title}</SectionHeading>
      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        {items.map((m) => (
          <ReportLink key={m.path} meta={m} anchor={anchors?.(m)} />
        ))}
      </div>
    </section>
  )
}

/** Shared bottom block: honest dates, methodology + about links, disclaimer. */
export function SeoFooter({ updatedAt }: { updatedAt?: string | null }) {
  return (
    <footer className="mt-12 border-t border-[var(--hairline)] pt-5 pb-10 text-[0.78rem] leading-relaxed text-[var(--ink-faint)]">
      {updatedAt && (
        <p>
          Data last updated{" "}
          <time dateTime={updatedAt}>{humanDate(updatedAt)}</time>. Reports refresh as new
          data arrives from the underlying sources.
        </p>
      )}
      <p className="mt-2">
        Every score is computed from named public sources — see{" "}
        <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
          how we score safety
        </Link>{" "}
        and{" "}
        <Link href="/about" className="font-medium text-[var(--accent-deep)] hover:underline">
          who runs IsMyTripSafe
        </Link>
        . Conditions change quickly; always check your government&apos;s current travel advisory
        before departure. This is general information, not legal or medical advice.
      </p>
    </footer>
  )
}
