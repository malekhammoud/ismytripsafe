"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Map as MapIcon, FileText, Zap } from "lucide-react"
import { useReport } from "@/lib/store"
import { Logo } from "@/components/Logo"

/** Shared header for the report and map pages: reset + Report/Map tabs. */
export function TopNav({ active }: { active: "report" | "map" }) {
  const router = useRouter()
  const reset = useReport((s) => s.reset)
  const generatedAt = useReport((s) => s.generatedAt)
  const cached = useReport((s) => s.cached)
  const place = useReport((s) => s.query?.place)
  const placeParam = place ? `?place=${encodeURIComponent(place)}` : ""

  const tab = (href: string, label: string, icon: React.ReactNode, on: boolean) => (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition-colors"
      style={
        on
          ? { background: "var(--ink)", color: "var(--paper)" }
          : { color: "var(--ink-soft)" }
      }
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <header className="mx-auto mb-5 flex max-w-[640px] items-center justify-between gap-3 px-1">
      <button
        onClick={() => {
          reset()
          router.push("/")
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={15} /> New
      </button>

      <div className="flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-white/60 p-1">
        {tab(`/${placeParam}`, "Report", <FileText size={13} />, active === "report")}
        {tab(`/map${placeParam}`, "Map", <MapIcon size={13} />, active === "map")}
      </div>

      <div className="hidden text-right leading-tight sm:block">
        <div className="wordmark flex items-center justify-end gap-1.5 text-sm text-[var(--ink)]">
          <Logo size={14} />
          Is It Safe<span style={{ color: "var(--accent)" }}>?</span>
        </div>
        <div className="flex items-center justify-end gap-1 text-[0.62rem] uppercase tracking-wider text-[var(--ink-faint)]">
          {cached && <Zap size={9} style={{ color: "var(--accent)" }} />}
          {generatedAt ? `${cached ? "Cached" : "Assessed"} ${generatedAt}` : "Independent assessment"}
        </div>
      </div>
    </header>
  )
}
