"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, Check, LoaderCircle, Moon, ShieldCheck } from "lucide-react"
import type { BuildPhase, VisitStatus } from "@/lib/nightlife/visit-types"
import { watchNightlife } from "@/lib/nightlife/watch"
import { sourceStatus } from "@/lib/nightlife/source-status"
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
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const controller = new AbortController()
    setSlow(false)
    setStatus({ state: "idle", available: mode === "refresh" })
    void watchNightlife({ endpoint: `/api/nightlife/${encodeURIComponent(country)}/${encodeURIComponent(city)}`, mode, signal: controller.signal,
      onStatus: setStatus, onReport: () => router.refresh(), onSlow: () => setSlow(true) }).catch(() => {})
    return () => controller.abort()
  }, [country, city, mode, attempt, router])
  useEffect(() => {
    if (!status.retryAt) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status.retryAt])
  const retrySeconds = status.retryAt ? Math.max(0, Math.ceil((Date.parse(status.retryAt) - now) / 1000)) : 0
  const retryLabel = retrySeconds >= 3600 ? `${Math.ceil(retrySeconds / 3600)}h` : retrySeconds >= 60 ? `${Math.ceil(retrySeconds / 60)}m` : `${retrySeconds}s`
  const terminal = ["failed", "unavailable", "deferred"].includes(status.state) || slow
  const phaseIndex = Math.max(0, PHASES.findIndex(p => p.key === status.phase))
  const heading = `${cityName} nightlife`
  const subtitle = slow ? "This check is taking longer than usual" : status.state === "unavailable" ? "Not enough evidence for a rating yet" : status.state === "failed" ? status.issue === "connection" ? "Reconnecting to your report" : "Some data is temporarily unavailable" : status.state === "deferred" ? "Today’s research capacity is full" : status.state === "busy" ? "Your check will start shortly" : "Checking the city’s nightlife"
  const explanation = slow ? "The research may still be running. You can read the safety report while it finishes, or check its progress again." : status.state === "unavailable"
    ? status.issue === "city" ? "We couldn’t verify the city in our geographic sources. Its safety report is available below."
      : status.issue === "boundary" ? "The city is identified, but we couldn’t verify its boundary. We need that to count venues and compare them with the population."
        : `We found ${status.venueCount ?? 0} mapped venues and enough evidence for ${status.scoreCount ?? 0} of the five ratings. A report needs at least 10 venues and three ratings. We’ll check for new data on a later visit.`
    : status.state === "failed" ? status.issue === "connection"
      ? "We lost the connection while checking progress. Your research can still finish in the background. Try reconnecting below."
      : status.issue === "service" ? "The research service couldn’t finish this check. Please try again shortly."
        : `${sourceStatus(status)} ${retrySeconds > 0 ? status.retryScheduled ? `This page will try again in ${retryLabel}.` : `Another check will be available in ${retryLabel}.` : "You can request another check below."}`
    : status.state === "deferred" ? "New city checks resume tomorrow. Saved reports and this city’s safety report are available now."
    : status.state === "busy" ? "Another city is being checked. We’ll start this one automatically when the research slot opens."
    : "We’re finding venues, checking available sources and calculating the ratings. The first report usually takes a few minutes; saved reports open immediately."
  if (mode === "refresh") {
    if (status.state === "idle" || status.state === "ready") return null
    return <p className="nl-live-refresh" role="status">{terminal ? "Showing the saved report. A fresh check isn’t available yet." : <><LoaderCircle size={13} className="nl-research-spin"/> Updating the nightlife evidence in the background. Your saved report stays available.</>}</p>
  }
  if (mode === "teaser") return <div className="nl-live-teaser"><p role="status">{terminal ? explanation : <><LoaderCircle size={13} className="nl-research-spin"/> {status.state === "busy" ? "Waiting to research the nightlife scene…" : "Researching this city’s nightlife automatically…"}</>}</p><Link href={`/${country}/${city}/nightlife`}>Explore the nightlife report <ArrowUpRight size={13}/></Link></div>
  return <section className="nl-research" aria-labelledby="nightlife-progress-title">
    <div className="nl-research-icon"><Moon size={27}/>{!terminal && <span/>}</div>
    <Link className="nl-research-back" href="/nightlife">← All nightlife reports</Link>
    <h1 id="nightlife-progress-title">{heading}</h1>
    <h2 className="nl-research-subtitle">{subtitle}</h2>
    <p className="nl-research-explanation" role="status" aria-live="polite">{explanation}</p>
    {!terminal && <ol className="nl-research-steps">{PHASES.map((phase, index) => <li key={phase.key} className={status.state === "running" && index === phaseIndex ? "is-current" : index < phaseIndex ? "is-done" : ""}><span>{index < phaseIndex ? <Check size={15}/> : index === phaseIndex && status.state === "running" ? <LoaderCircle size={15} className="nl-research-spin"/> : String(index + 1).padStart(2, "0")}</span><div><h2>{phase.label}</h2><p>{phase.detail}</p></div></li>)}</ol>}
    <div className="nl-research-actions"><Link className="nl-button" href={`/${country}/${city}`}><ShieldCheck size={15}/> Read the {cityName} safety report</Link>{terminal && <button type="button" disabled={retrySeconds > 0} onClick={() => setAttempt(value => value + 1)}>{retrySeconds > 0 ? `Retry in ${retryLabel}` : status.issue === "connection" ? "Reconnect ↗" : "Check again ↗"}</button>}</div>
    <p className="nl-footnote">Ratings use sourced data. Missing evidence stays unscored.</p>
    <noscript><p className="nl-footnote">Enable JavaScript to start the nightlife research and see live progress.</p></noscript>
  </section>
}
