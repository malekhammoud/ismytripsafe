import Link from "next/link"
import { ChevronDown } from "lucide-react"

/**
 * The sticky jump menu pinned under the site header on report pages.
 *
 * A report is a long document; the jump menu turns it into a navigable
 * index — every item is a click, and every click lands somewhere real
 * (native anchor links, no JS). It sticks so the rest of the document
 * always knows what's inside. Horizontal-scrolls on small screens.
 */

export interface JumpItem {
  label: string
  href: string // "#sec-crime" etc.
}

export function ReportJumpNav({ items }: { items: JumpItem[] }) {
  if (!items.length) return null
  return (
    <nav
      aria-label="Report sections"
      className="sticky top-[56px] z-30 -mx-4 mt-5 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
    >
      <div className="overflow-x-auto no-scrollbar rounded-full border border-[var(--hairline)] bg-[rgba(253,250,243,0.94)] px-1.5 py-1 shadow-[var(--shadow-card)] backdrop-blur-md">
        <div className="flex w-max items-center gap-0.5">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.78rem] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[rgba(12,159,180,0.1)] hover:text-[var(--accent-deep)]"
            >
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

/** The little "scroll to start" affordance used at the end of the document. */
export function BackToTopPill({ href = "#report-hero" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-4 py-2 text-[0.78rem] font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
    >
      Back to the top
      <ChevronDown size={13} className="-rotate-180" aria-hidden />
    </Link>
  )
}