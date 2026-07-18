"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { SearchBar } from "@/components/SearchBar"
import { AssessmentProgress } from "@/components/AssessmentProgress"
import { ProfileSetup } from "@/components/ProfileSetup"
import { TrafficReport } from "@/components/report/TrafficReport"
import { TopNav } from "@/components/report/TopNav"
import { useReport } from "@/lib/store"
import { profileFromParams, profileToParams, type TravelerProfile } from "@/lib/profile"
import type { SafetyQuery } from "@/lib/types"

export default function Home() {
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
      <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 py-16">
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 50% at 80% 8%, rgba(31,116,207,0.12), transparent 70%), radial-gradient(45% 45% at 8% 92%, rgba(20,157,90,0.1), transparent 70%)",
          }}
        />
        <ProfileSetup
          place={pending.place}
          onConfirm={(p) => startReport(pending, p)}
          onSkip={() => startReport(pending, null)}
        />
      </main>
    )
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
        // Hold the whole report until the field research is in — the final
        // score blends it, so nothing renders before it can be computed.
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
          images={images}
          intel={intel}
          profile={profile}
          prose={prose}
          searchQueries={queries}
          loading={loading}
          generatedAt={generatedAt}
        />
      ) : null}
    </main>
  )
}
