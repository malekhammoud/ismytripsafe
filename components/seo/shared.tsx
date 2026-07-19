import Link from "next/link"
import { ShieldCheck, ChevronRight } from "lucide-react"
import type { ReportMeta } from "@/lib/reports"
import { LEVELS } from "@/lib/safety-display"
import { humanDate } from "@/lib/site"

// Server-rendered building blocks for the crawlable pages (city reports,
// country hubs, destination index). No client JS — pure HTML/CSS.

export function scoreTint(score: number): string {
  if (score >= 70) return "#2f9e6f"
  if (score >= 55) return "#c8973f"
  if (score >= 40) return "#e08a3b"
  return "#d4503a"
}

/** Minimal top bar for SEO pages: wordmark home link + destinations link. */
export function SiteHeader() {
  return (
    <header className="mx-auto mb-6 flex max-w-4xl items-center justify-between gap-3 px-1">
      <Link href="/" className="wordmark flex items-center gap-1.5 text-sm text-[var(--ink)]">
        <ShieldCheck size={15} style={{ color: "var(--accent)" }} />
        IsMyTripSafe<span style={{ color: "var(--accent)" }}>.com</span>
      </Link>
      <nav className="flex items-center gap-4 text-[0.8rem] font-medium text-[var(--ink-soft)]">
        <Link href="/destinations" className="hover:text-[var(--accent)]">All destinations</Link>
        <Link href="/methodology" className="hover:text-[var(--accent)]">Methodology</Link>
        <Link href="/" className="btn px-3.5 py-1.5 text-[0.78rem]">Check a place</Link>
      </nav>
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
    <nav aria-label="Breadcrumb" className="mb-4">
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

/** Compact link card for a related report: flag, name, score, verdict word. */
export function ReportLink({ meta, anchor }: { meta: ReportMeta; anchor?: string }) {
  const tint = scoreTint(meta.score)
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
      <span
        className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.82rem] font-bold text-white"
        style={{ background: tint }}
        aria-label={`Safety score ${meta.score} out of 100`}
      >
        {meta.score}
      </span>
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
    <section className="mt-8">
      <h2 className="font-display text-[1.2rem] font-medium tracking-tight text-[var(--ink)]">{title}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((m) => (
          <ReportLink key={m.path} meta={m} anchor={anchors?.(m)} />
        ))}
      </div>
    </section>
  )
}

/** Visible FAQ section. Plain HTML on purpose: Google's FAQ rich results were
 *  retired in 2026, but answer-shaped sections are what AI engines cite. */
export function FaqSection({
  title = "Frequently asked questions",
  items,
}: {
  title?: string
  items: { q: string; a: React.ReactNode }[]
}) {
  const rendered = items.filter((i) => i.a)
  if (!rendered.length) return null
  return (
    <section className="mt-10">
      <h2 className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">{title}</h2>
      <div className="mt-3 space-y-5">
        {rendered.map((i) => (
          <div key={i.q}>
            <h3 className="text-[0.98rem] font-semibold text-[var(--ink)]">{i.q}</h3>
            <div className="mt-1 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">{i.a}</div>
          </div>
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
