"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X, ShieldCheck } from "lucide-react"
import { Logo } from "@/components/Logo"

// One header for every page — the landing checker, the written pages, the
// report and the map. It knows where it is from the path rather than from a
// prop, so no page can drift out of step with the others.
const LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // A tap in the mobile panel navigates; the panel shouldn't survive it.
  useEffect(() => setOpen(false), [pathname])

  const isHome = pathname === "/"

  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--hairline)]"
      style={{
        background: "rgba(253, 250, 243, 0.9)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
      }}
    >
      <div className="mx-auto flex h-[56px] max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="wordmark flex shrink-0 items-center gap-2 text-[1rem] text-[var(--navy)]"
        >
          <Logo size={27} />
          <span>
            IsMyTripSafe<span style={{ color: "var(--orange)" }}>.com</span>
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link text-[0.83rem] font-medium ${active ? "is-active" : ""}`}
              >
                {l.label}
              </Link>
            )
          })}
          {!isHome && (
            <Link href="/" className="btn inline-flex items-center gap-1.5 px-4 py-1.5 text-[0.8rem]">
              <ShieldCheck size={14} />
              Check a place
            </Link>
          )}
        </nav>

        {/* Mobile */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] transition-colors hover:bg-[rgba(29,47,56,0.07)] sm:hidden"
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      {open && (
        <nav
          className="border-t border-[var(--hairline)] px-4 pb-4 pt-2 sm:hidden"
          style={{ background: "rgba(253, 250, 243, 0.98)" }}
        >
          {LINKS.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="block border-b border-[var(--hairline)] py-3 text-[0.95rem] font-medium last:border-b-0"
                style={{ color: active ? "var(--orange-deep)" : "var(--ink-soft)" }}
              >
                {l.label}
              </Link>
            )
          })}
          {!isHome && (
            <Link href="/" className="btn mt-3 flex items-center justify-center gap-2 py-2.5 text-[0.9rem]">
              <ShieldCheck size={15} />
              Check a place
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
