"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { SearchBar } from "@/components/SearchBar"
import { AssessmentProgress } from "@/components/AssessmentProgress"
import { TrafficReport } from "@/components/report/TrafficReport"
import { TopNav } from "@/components/report/TopNav"
import { useReport } from "@/lib/store"
import type { SafetyQuery } from "@/lib/types"

export default function Home() {
  const {
    status,
    geo,
    bundle,
    intel,
    prose,
    queries,
    error,
    generatedAt,
    run,
    reset,
  } = useReport()
  const router = useRouter()

  const loading = status === "loading"
  const started = status !== "idle"

  // Re-hydrate from the URL — a reload, a direct link, or the browser's back/
  // forward button lands here with an empty store, so replay from cache using
  // the place carried in `?place=`.
  useEffect(() => {
    if (status !== "idle") return
    const place = new URLSearchParams(window.location.search).get("place")
    if (place) run({ place })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = (q: SafetyQuery) => {
    router.replace(`/?place=${encodeURIComponent(q.place)}`)
    run(q)
  }

  // ─── Landing ───────────────────────────────────────────────
  if (!started) {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 py-16">
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 50% at 80% 8%, rgba(31,116,207,0.12), transparent 70%), radial-gradient(45% 45% at 8% 92%, rgba(20,157,90,0.1), transparent 70%)",
          }}
        />

        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white/60 px-4 py-1.5 text-xs font-medium text-[var(--ink-soft)] rise-in">
            <ShieldCheck size={13} style={{ color: "var(--accent)" }} />
            10+ safety databases · one clear answer
          </div>
          <h1 className="display-xl rise-in" style={{ animationDelay: "0.08s" }}>
            Is it
            <span style={{ color: "var(--accent)", fontStyle: "italic" }}> safe</span>
            <br />
            to go there?
          </h1>
          <p
            className="mx-auto mt-5 max-w-md text-[0.98rem] leading-relaxed text-[var(--ink-soft)] rise-in"
            style={{ animationDelay: "0.16s" }}
          >
            Type any city or country. We pull crime statistics, governance data, air
            quality, nearby hospitals, seasonal weather and government advisories from a
            dozen sources — then give you one honest verdict and a live map.
          </p>
        </div>

        <div className="w-full rise-in" style={{ animationDelay: "0.24s" }}>
          <SearchBar onSubmit={search} loading={loading} />
        </div>

        <p className="mt-6 text-center text-[0.72rem] text-[var(--ink-faint)] rise-in" style={{ animationDelay: "0.32s" }}>
          World Bank · Governance Indicators · OpenStreetMap · Open-Meteo · CDC
        </p>
      </main>
    )
  }

  // ─── Result ───────────────────────────────────────────────
  return (
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <TopNav active="report" />

      {error ? (
        <div className="mx-auto max-w-[640px] card border-l-4 p-6" style={{ borderLeftColor: "var(--risky)" }}>
          <p className="font-display text-lg font-medium text-[var(--ink)]">Couldn&apos;t complete the check</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{error}</p>
          <button onClick={reset} className="btn mt-4 px-5 py-2.5 text-sm">Try again</button>
        </div>
      ) : loading && !intel ? (
        // Hold the whole report — including the Rating — until the local
        // intelligence research is in, so nothing contradicts a late verdict.
        <div className="mx-auto max-w-[640px]">
          <AssessmentProgress
            geo={geo}
            hasData={!!bundle}
            hasIntel={!!intel}
            proseLength={prose.length}
            searchQueries={queries}
            flag={bundle?.country?.flag}
          />
        </div>
      ) : bundle ? (
        <TrafficReport
          bundle={bundle}
          intel={intel}
          prose={prose}
          searchQueries={queries}
          loading={loading}
          generatedAt={generatedAt}
        />
      ) : null}
    </main>
  )
}
