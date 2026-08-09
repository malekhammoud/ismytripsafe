"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { SiteHeader } from "@/components/SiteHeader"
import { HeaderBand } from "@/components/home/HeaderBand"

import { AssessmentProgress } from "@/components/AssessmentProgress"
import { ProfileSetup } from "@/components/ProfileSetup"
import { TrafficReport } from "@/components/report/TrafficReport"
import { TopNav } from "@/components/report/TopNav"
import { useReport } from "@/lib/store"
import { profileFromParams, profileToParams, type TravelerProfile } from "@/lib/profile"
import type { HomeDemo } from "@/lib/home-demo"
import type { SafetyQuery } from "@/lib/types"

/**
 * The interactive checker (search → profile → streaming report).
 *
 * This is the only component on the home page that knows about search state,
 * which is why the header band lives inside it. Everything holding real
 * report data — the postcards, the worked example, the footer — is server-
 * rendered and passed in through `children` and `footer`, so none of it ends
 * up in the client bundle.
 *
 * `children` renders only on the landing state, which is why the whole page
 * gives way to the report the moment a search starts.
 */
export function HomeClient({
  demo,
  children,
  footer,
}: {
  /** A real destination's live scores, for the header band. */
  demo: HomeDemo | null
  children?: ReactNode
  footer?: ReactNode
}) {
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
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 50% at 80% 8%, rgba(15,155,171,0.12), transparent 70%), radial-gradient(45% 45% at 8% 92%, rgba(255,200,87,0.1), transparent 70%)",
        }}
      />

      {/* Full-bleed, directly under the nav — the first thing anyone sees */}
      <HeaderBand demo={demo} onSearch={search} loading={loading} />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col px-5 pb-4">
        {/* Server-rendered latest-reports directory (crawlable) */}
        {children}




        {footer}
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
