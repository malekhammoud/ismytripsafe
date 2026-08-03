import Link from "next/link"
import { Mail } from "lucide-react"
import { Logo } from "@/components/Logo"
import { humanDate } from "@/lib/site"

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Check a place",
    links: [
      { label: "Safety checker", href: "/" },
      { label: "All destinations", href: "/destinations" },
    ],
  },
  {
    title: "How this works",
    links: [
      { label: "How to use it", href: "/how-it-works" },
      { label: "Methodology", href: "/methodology" },
      { label: "About us", href: "/about" },
    ],
  },
]

/**
 * The site's closing block: brand mark, the routes out, and the honest small
 * print (dates, sourcing, "this is not advice"). `updatedAt` is passed on
 * report pages, where the date is about that report's data.
 */
export function SiteFooter({ updatedAt }: { updatedAt?: string | null }) {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-14 border-t border-[var(--hairline)] pt-9 pb-12">
      <div className="flex flex-col gap-9 sm:flex-row sm:justify-between sm:gap-12">
        {/* Brand */}
        <div className="max-w-[19rem]">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={36} />
            <span className="wordmark text-[1.05rem] text-[var(--navy)]">
              IsMyTripSafe<span style={{ color: "var(--orange)" }}>.com</span>
            </span>
          </Link>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-[var(--ink-soft)]">
            One place, one click, one report. Up-to-date, personalised travel safety for
            anywhere you&apos;re thinking of going — free, every time.
          </p>
          <a
            href="mailto:malek@ismytripsafe.com"
            className="mt-3.5 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--accent-deep)] hover:underline"
          >
            <Mail size={13} strokeWidth={2.2} />
            malek@ismytripsafe.com
          </a>
        </div>

        {/* Routes out */}
        <div className="flex gap-12 sm:gap-16">
          {COLUMNS.map((col) => (
            <nav key={col.title}>
              <p className="label mb-2.5 whitespace-nowrap">{col.title}</p>
              <ul className="space-y-1.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="whitespace-nowrap text-[0.83rem] font-medium text-[var(--ink-soft)] hover:text-[var(--orange-deep)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mt-9 border-t border-[var(--hairline)] pt-5 text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
        {updatedAt && (
          <p className="mb-2">
            Data last updated <time dateTime={updatedAt}>{humanDate(updatedAt)}</time>. Reports
            refresh as new data arrives from the underlying sources.
          </p>
        )}
        <p>
          Every score is computed from named public sources — see{" "}
          <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
            how we score safety
          </Link>{" "}
          and{" "}
          <Link href="/about" className="font-medium text-[var(--accent-deep)] hover:underline">
            who runs IsMyTripSafe
          </Link>
          . Conditions change quickly; always check your own government&apos;s current travel
          advisory before departure. This is general information, not legal, medical or security
          advice.
        </p>
        <p className="mt-2.5">
          © {year} IsMyTripSafe. Founded 2026. ·{" "}
          <Link href="/disclaimer" className="hover:text-[var(--accent-deep)] hover:underline">
            Disclaimer
          </Link>{" "}
          ·{" "}
          <Link href="/credits" className="hover:text-[var(--accent-deep)] hover:underline">
            Photo credits
          </Link>
        </p>
      </div>
    </footer>
  )
}
