"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, Check, LoaderCircle, Moon, ShieldCheck } from "lucide-react"
import type { BuildPhase, VisitStatus } from "@/lib/nightlife/visit-types"
const PHASES: { key: BuildPhase; label: string; detail: string }[] = [
  { key: "resolve", label: "Find the right city", detail: "Matching the city, its population and its boundaries." },
  { key: "venues", label: "Map the scene", detail: "Finding bars, clubs and live-music venues inside the city." },
  { key: "details", label: "Gather the evidence", detail: "Checking available ratings, events, traveler accounts and safety data." },
  { key: "score", label: "Put it all together", detail: "Calculating the stars and checking whether there is enough data to publish." },
]
export function OnDemandReport({ country, city, cityName, mode = "page" }: { country: string; city: string; cityName: string; mode?: "page" | "teaser" | "refresh" }) {
  const router = useRouter()
  const [status, setStatus] = useState<VisitStatus>({ state: "idle", available: mode === "refresh" })
  const [attempt, setAttempt] = useState(0)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const controller = new AbortController(), endpoint = `/api/nightlife/${encodeURIComponent(country)}/${encodeURIComponent(city)}`
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, startedWork = false
    const startedAt = Date.now()
    setSlow(false)
    const poll = async (start: boolean) => {
      try {
        const response = await fetch(endpoint, { method: start ? "POST" : "GET", signal: controller.signal, cache: "no-store" })
        if (!response.ok && response.status !== 202) throw new Error("Research is unavailable")
        const next = await response.json() as VisitStatus
        if (disposed) return
        setStatus(next)
        if (next.state === "running" || next.state === "busy") startedWork = true
        const completed = ["ready", "failed", "unavailable", "deferred"].includes(next.state)
        if (next.available && (mode !== "refresh" || (startedWork && completed))) {
          router.refresh()
          return
        }
        if (["ready", "failed", "unavailable", "deferred"].includes(next.state)) return
        if (Date.now() - startedAt > 5 * 60 * 1000) { setSlow(true); return }
        timer = setTimeout(() => void poll(next.state === "idle" || next.state === "busy"), Math.max(2000, Math.min(10000, (next.retryAfter ?? 3) * 1000)))
      } catch (error) {
        if (disposed || (error instanceof Error && error.name === "AbortError")) return
        setStatus({ state: "failed", available: mode === "refresh" })
      }
    }
    void poll(true)
    return () => { disposed = true; controller.abort(); if (timer) clearTimeout(timer) }
  }, [country, city, mode, attempt, router])
  const terminal = ["failed", "unavailable", "deferred"].includes(status.state) || slow
  const phaseIndex = Math.max(0, PHASES.findIndex(p => p.key === status.phase))
  const heading = slow ? "A little more time after dark." : status.state === "unavailable" ? "A scene we can’t fairly rate yet." : status.state === "failed" ? "The research hit a pause." : status.state === "deferred" ? "More city research is on the way." : status.state === "busy" ? "Waiting for a research slot." : `${cityName} after dark, taking shape.`
  const explanation = slow ? "This is taking longer than usual. Research can continue while you read the safety report; check back here shortly." : status.state === "unavailable" ? "There isn’t enough reliable venue or rating data for a standalone nightlife report yet. We’ve kept the gaps visible rather than filling them with guesses." : status.state === "failed" ? "We couldn’t reach enough sources to finish this check. You can still read the city’s safety report, and we’ll try again on a later visit." : status.state === "deferred" ? "We’ve reached today’s research capacity. Existing reports remain available; this city can be checked again on a later visit." : status.state === "busy" ? "Another city’s research is finishing. This page will check again automatically." : "We’re gathering real sources for this city. This first check can take a few minutes. The report will appear here as soon as there’s enough evidence."
  if (mode === "refresh") {
    if (status.state === "idle" || status.state === "ready") return null
    return <p className="nl-live-refresh" role="status">{terminal ? "Showing the saved report. A fresh check isn’t available yet." : <><LoaderCircle size={13} className="nl-research-spin"/> Updating the nightlife evidence in the background. Your saved report stays available.</>}</p>
  }
  if (mode === "teaser") return <div className="nl-live-teaser"><p role="status">{terminal ? explanation : <><LoaderCircle size={13} className="nl-research-spin"/> {status.state === "busy" ? "Waiting to research the nightlife scene…" : "Researching this city’s nightlife automatically…"}</>}</p><Link href={`/${country}/${city}/nightlife`}>Explore the nightlife report <ArrowUpRight size={13}/></Link></div>
  return <section className="nl-research" aria-labelledby="nightlife-progress-title">
    <div className="nl-research-icon"><Moon size={27}/>{!terminal && <span/>}</div>
    <p className="nl-eyebrow">THE AFTER-DARK EDITION</p>
    <h1 id="nightlife-progress-title">{heading}</h1>
    <p className="nl-research-explanation" role="status" aria-live="polite">{explanation}</p>
    {!terminal && <ol className="nl-research-steps">{PHASES.map((phase, index) => <li key={phase.key} className={status.state === "running" && index === phaseIndex ? "is-current" : index < phaseIndex ? "is-done" : ""}><span>{index < phaseIndex ? <Check size={15}/> : index === phaseIndex && status.state === "running" ? <LoaderCircle size={15} className="nl-research-spin"/> : String(index + 1).padStart(2, "0")}</span><div><h2>{phase.label}</h2><p>{phase.detail}</p></div></li>)}</ol>}
    <div className="nl-research-actions"><Link className="nl-button" href={`/${country}/${city}`}><ShieldCheck size={15}/> Read the {cityName} safety report</Link>{terminal && <button type="button" onClick={() => setAttempt(value => value + 1)}>Check again ↗</button>}</div>
    <p className="nl-footnote">Every star needs evidence. When a source is missing, we say so.</p>
    <noscript><p className="nl-footnote">Enable JavaScript to start the nightlife research and see live progress.</p></noscript>
  </section>
}
