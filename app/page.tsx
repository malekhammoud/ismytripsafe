"use client"

import { useState, useCallback } from "react"
import { ShieldCheck, ArrowLeft } from "lucide-react"
import { SearchBar } from "@/components/SearchBar"
import { Hero } from "@/components/Hero"
import { SafetyReportView } from "@/components/SafetyReportView"
import { AssessmentProgress } from "@/components/AssessmentProgress"
import type {
  SafetyQuery,
  SafetyBundle,
  SafetyEnrichment,
  GeoPoint,
  DestinationImages,
  StreamEvent,
} from "@/lib/types"

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [geo, setGeo] = useState<GeoPoint | null>(null)
  const [images, setImages] = useState<DestinationImages | null>(null)
  const [bundle, setBundle] = useState<SafetyBundle | null>(null)
  const [intel, setIntel] = useState<SafetyEnrichment | null>(null)
  const [prose, setProse] = useState("")
  const [queries, setQueries] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState("")

  const reset = () => {
    setStarted(false)
    setGeo(null)
    setImages(null)
    setBundle(null)
    setIntel(null)
    setProse("")
    setQueries([])
    setError(null)
  }

  const check = useCallback(async (q: SafetyQuery) => {
    setLoading(true)
    setStarted(true)
    setGeneratedAt(
      new Date().toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    )
    setGeo(null)
    setImages(null)
    setBundle(null)
    setIntel(null)
    setProse("")
    setQueries([])
    setError(null)

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      })
      if (!res.body) throw new Error("No response stream")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          let ev: StreamEvent
          try {
            ev = JSON.parse(raw)
          } catch {
            continue
          }
          switch (ev.type) {
            case "geo":
              setGeo(ev.place)
              break
            case "image":
              setImages(ev.images)
              break
            case "safety":
              setBundle(ev.bundle)
              break
            case "enrichment":
              setIntel(ev.data)
              break
            case "text":
              setProse((p) => p + ev.content)
              break
            case "searching":
              setQueries((s) => [...s, ev.query])
              break
            case "error":
              setError(ev.message)
              setLoading(false)
              break
            case "done":
              setLoading(false)
              break
          }
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

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
            Type any city or country. We pull crime statistics, governance &amp; conflict
            data, seismic activity, and government advisories from a dozen sources — and
            give you one honest verdict.
          </p>
        </div>

        <div className="w-full rise-in" style={{ animationDelay: "0.24s" }}>
          <SearchBar onSubmit={check} loading={loading} />
        </div>

        <p className="mt-6 text-center text-[0.72rem] text-[var(--ink-faint)] rise-in" style={{ animationDelay: "0.32s" }}>
          World Bank · Governance Indicators · USGS · travel-advisory.info
        </p>
      </main>
    )
  }

  // ─── Result ───────────────────────────────────────────────
  return (
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Report masthead — frames the result as a dated assessment, not a dashboard */}
      <header className="mb-6 flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--accent)]"
        >
          <ArrowLeft size={15} /> New assessment
        </button>
        <div className="text-right leading-tight">
          <div className="wordmark flex items-center justify-end gap-1.5 text-sm text-[var(--ink)]">
            <ShieldCheck size={14} style={{ color: "var(--accent)" }} />
            Is It Safe<span style={{ color: "var(--accent)" }}>?</span>
          </div>
          <div className="text-[0.66rem] uppercase tracking-wider text-[var(--ink-faint)]">
            Independent safety assessment{generatedAt ? ` · ${generatedAt}` : ""}
          </div>
        </div>
      </header>

      {error ? (
        <div className="card border-l-4 p-6" style={{ borderLeftColor: "var(--risky)" }}>
          <p className="font-display text-lg font-medium text-[var(--ink)]">Couldn&apos;t complete the check</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{error}</p>
          <button onClick={reset} className="btn mt-4 px-5 py-2.5 text-sm">Try again</button>
        </div>
      ) : loading || !bundle ? (
        // Hold the final screen until EVERYTHING is computed — show live progress.
        <AssessmentProgress
          geo={geo}
          hasData={!!bundle}
          hasIntel={!!intel}
          proseLength={prose.length}
          searchQueries={queries}
          flag={bundle?.country?.flag}
        />
      ) : (
        <div className="space-y-5">
          <Hero
            place={bundle.geo}
            safety={bundle.safety}
            heroImage={images?.hero ?? null}
            flag={bundle.country?.flag}
          />
          <SafetyReportView
            bundle={bundle}
            intel={intel}
            prose={prose}
            searchQueries={queries}
            loading={loading}
          />
        </div>
      )}

      {!loading && bundle && (
        <footer className="mt-10 border-t border-[var(--hairline)] pt-5 text-center">
          <p className="text-[0.72rem] leading-relaxed text-[var(--ink-faint)]">
            The safety index blends crime, governance, conflict, seismic, health and advisory data
            from public databases. Country-level data is a baseline — always check official sources
            and local conditions before you travel.
          </p>
        </footer>
      )}
    </main>
  )
}
