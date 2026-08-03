"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { SiteHeader } from "@/components/SiteHeader"
import { PanoramaArt } from "@/components/beach/PosterArt"
import { SearchBar } from "@/components/SearchBar"
import { AssessmentProgress } from "@/components/AssessmentProgress"
import { ProfileSetup } from "@/components/ProfileSetup"
import { TrafficReport } from "@/components/report/TrafficReport"
import { TopNav } from "@/components/report/TopNav"
import { useReport } from "@/lib/store"
import { profileFromParams, profileToParams, type TravelerProfile } from "@/lib/profile"
import type { SafetyQuery } from "@/lib/types"

/**
 * The panoramic beach that sits behind the hero: pinned to the bottom of
 * the block, faded into the page so the search stays the loudest thing on
 * screen, and hidden from assistive tech — it says nothing the copy doesn't.
 */
function BeachHero() {
  return (
    // Dropped below the block's own baseline so the horizon and the figures
    // clear the source line above them rather than sitting behind the words.
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-16 -z-10 select-none">
      <div className="relative h-[17rem] w-full overflow-hidden sm:h-[20rem]">
        <PanoramaArt className="hero-band-mask absolute inset-0 h-full w-full opacity-[0.72]" />
      </div>
    </div>
  )
}

/**
 * The interactive checker (search → profile → streaming report). Server-
 * rendered content for crawlers — the latest-reports directory — comes in
 * through `children` and is shown on the landing state.
 */
export function HomeClient({ children }: { children?: ReactNode }) {
  const {
    status,
    geo,
    images,
    bundle,
    intel,
    prose,
    queries,
    error,
    generatedAt,
    reportPath,
    run,
    reset,
  } = useReport()
  const router = useRouter()
  // A search sits here while the traveller answers "who's going?" — the report
  // only starts once the profile is confirmed (or skipped).
  const [pending, setPending] = useState<SafetyQuery | null>(null)
  const [profile, setProfile] = useState<TravelerProfile | null>(null)

  const loading = status === "loading"
  const started = status !== "idle"

  // Re-hydrate from the URL — a reload, a direct link, or the browser's back/
  // forward button lands here with an empty store, so replay from cache using
  // the place (and traveller profile) carried in the query string.
  useEffect(() => {
    if (status !== "idle") return
    const params = new URLSearchParams(window.location.search)
    const place = params.get("place")
    if (place) {
      setProfile(profileFromParams(params))
      run({ place })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = (q: SafetyQuery) => {
    setPending(q)
  }

  const startReport = (q: SafetyQuery, p: TravelerProfile | null) => {
    const params = new URLSearchParams({ place: q.place })
    if (p) profileToParams(p, params)
    router.replace(`/?${params.toString()}`)
    setProfile(p)
    setPending(null)
    run(q)
  }

  // ─── Personalise (between search and report) ───────────────
  if (!started && pending) {
    return (
      <>
      <SiteHeader />
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-56px)] max-w-2xl flex-col items-center justify-center px-5 py-16">
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 50% at 80% 8%, rgba(15,155,171,0.12), transparent 70%), radial-gradient(45% 45% at 8% 92%, rgba(255,200,87,0.1), transparent 70%)",
          }}
        />
        <ProfileSetup
          place={pending.place}
          onConfirm={(p) => startReport(pending, p)}
          onSkip={() => startReport(pending, null)}
        />
      </main>
      </>
    )
  }

  // ─── Landing ───────────────────────────────────────────────
  if (!started) {
    return (
      <>
      <SiteHeader />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-4">
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 50% at 80% 8%, rgba(15,155,171,0.12), transparent 70%), radial-gradient(45% 45% at 8% 92%, rgba(255,200,87,0.1), transparent 70%)",
          }}
        />

        {/* Hero — the search is the product, so it sits high and alone */}
        <div className="relative flex flex-col items-center py-14 sm:py-20">
          <BeachHero />
          <div className="mb-8 text-center">
            <div
              className="mb-5 inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] rise-in sm:text-xs"
              style={{
                background: "rgba(242,112,74,0.1)",
                border: "1px solid rgba(242,112,74,0.26)",
                color: "var(--orange-deep)",
              }}
            >
              <ShieldCheck size={13} />
              One place · One click · One report
            </div>
            <h1 className="display-xl rise-in" style={{ animationDelay: "0.08s", color: "var(--navy)" }}>
              Is it
              <span style={{ color: "var(--orange)", fontStyle: "italic" }}> safe</span>
              <br />
              to go there?
            </h1>
          </div>

          {/* z-20: the autocomplete drops over the source line below it, and
              both are animated (each makes its own stacking context) */}
          <div className="relative z-20 w-full max-w-2xl rise-in" style={{ animationDelay: "0.16s" }}>
            <SearchBar onSubmit={search} loading={loading} />
          </div>

          <p
            className="relative z-0 mt-6 text-center text-[0.72rem] text-[var(--ink-faint)] rise-in"
            style={{ animationDelay: "0.24s" }}
          >
            World Bank · Governance Indicators · UNODC · GDACS · Open-Meteo · CDC
          </p>
        </div>

        {/* Server-rendered latest-reports directory (crawlable) */}
        {children}
      </main>
      </>
    )
  }

  // ─── Result ───────────────────────────────────────────────
  return (
    <>
    <SiteHeader />
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <TopNav active="report" />

      {error ? (
        <div className="mx-auto max-w-[640px] card border-l-4 p-6" style={{ borderLeftColor: "var(--risky)" }}>
          <p className="font-display text-lg font-medium text-[var(--ink)]">Couldn&apos;t complete the check</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{error}</p>
          <button onClick={reset} className="btn mt-4 px-5 py-2.5 text-sm">Try again</button>
        </div>
      ) : loading && !bundle ? (
        // Only the pre-database phase is a blank wait. Once the bundle lands
        // (~4s) the report renders with every database-derived section real;
        // the score alone stays pending until the field research lands, since
        // it blends that in — see `scorePending` in TrafficReport.
        <div className="mx-auto max-w-[640px]">
          {/* bundle is null in this branch by construction — the flag arrives
              with it, and by then the report itself has taken over */}
          <AssessmentProgress
            geo={geo}
            hasData={false}
            hasIntel={!!intel}
            proseLength={prose.length}
            searchQueries={queries}
          />
        </div>
      ) : bundle ? (
        <TrafficReport
          bundle={bundle}
          images={images}
          intel={intel}
          profile={profile}
          prose={prose}
          searchQueries={queries}
          loading={loading}
          generatedAt={generatedAt}
          permalink={reportPath}
        />
      ) : null}
    </main>
    </>
  )
}
