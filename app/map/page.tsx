"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { MapPin, Search, CircleCheck, CircleAlert, Smile, Eye, Lightbulb } from "lucide-react"
import { useReport } from "@/lib/store"
import { TopNav } from "@/components/report/TopNav"
import { InfoTip } from "@/components/report/InfoTip"
import { scoreColor } from "@/lib/safety-display"
import type { MapMarker } from "@/components/map/CityMap"

const CityMap = dynamic(() => import("@/components/map/CityMap").then((m) => m.CityMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" style={{ minHeight: 440 }} />,
})

/** Strip an avoid-area's parenthetical / em-dash reason, leaving the place name. */
function cleanArea(s: string): string {
  return s.split(/[(—–-]/)[0].replace(/\bafter dark\b/i, "").trim() || s.trim()
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export default function MapPage() {
  const { bundle, intel, status } = useReport()
  const geo = bundle?.geo ?? null
  const [areaPts, setAreaPts] = useState<MapMarker[]>([])

  // Geocode the AI-named safe / avoid areas so we can drop markers.
  useEffect(() => {
    if (!geo || !intel) return
    const items = [
      ...(intel.safeAreas ?? []).map((a) => ({ name: cleanArea(a), kind: "safe" as const })),
      ...(intel.avoidAreas ?? []).map((a) => ({ name: cleanArea(a), kind: "avoid" as const })),
    ].filter((it) => it.name.length > 1)
    if (!items.length) return

    let cancelled = false
    ;(async () => {
      const queries = items.map((it) => `${it.name}, ${geo.city}, ${geo.country}`)
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
      })
        .then((r) => r.json())
        .catch(() => null)
      if (cancelled || !res?.results) return
      const pts: MapMarker[] = []
      res.results.forEach(
        (r: { lat: number | null; lon: number | null }, i: number) => {
          // Only keep sensible geocodes (within ~70 km of the city centre).
          if (r.lat != null && r.lon != null && haversineKm(r.lat, r.lon, geo.lat, geo.lon) < 70) {
            pts.push({ lat: r.lat, lon: r.lon, label: items[i].name, kind: items[i].kind })
          }
        }
      )
      setAreaPts(pts)
    })()
    return () => {
      cancelled = true
    }
  }, [geo, intel])

  const markers = useMemo<MapMarker[]>(() => {
    if (!geo) return []
    return [{ lat: geo.lat, lon: geo.lon, label: geo.city, kind: "city" }, ...areaPts]
  }, [geo, areaPts])

  // No report yet (e.g. hard refresh) — send them to search.
  if (!geo) {
    return (
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <TopNav active="map" />
        <div className="mx-auto max-w-[640px] card p-8 text-center">
          <MapPin size={22} className="mx-auto" style={{ color: "var(--ink-faint)" }} />
          <p className="mt-3 font-display text-lg font-medium text-[var(--ink)]">No destination yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--ink-soft)]">
            {status === "loading" ? "Your report is still loading…" : "Search a place first, then open its safety map."}
          </p>
          <Link href="/" className="btn mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Search size={14} /> Search a destination
          </Link>
        </div>
      </main>
    )
  }

  const sentiment = intel?.consumerSentiment
  const watch = intel?.watchOuts ?? []
  const tips = intel?.tips ?? []

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <TopNav active="map" />

      <div className="mx-auto max-w-[1000px]">
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Safety Map</p>
            <h1 className="font-display text-[1.8rem] font-medium leading-none tracking-tight text-[var(--ink)]">
              {geo.city} {bundle?.country?.flag}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.8rem] text-[var(--ink-soft)]">
              <MapPin size={12} /> {geo.country}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[0.72rem] font-medium text-[var(--ink-soft)]">
            <span className="flex items-center gap-1"><Dot c="#1f74cf" /> City</span>
            <span className="flex items-center gap-1"><Dot c="#2f9e6f" /> Safer</span>
            <span className="flex items-center gap-1"><Dot c="#d4503a" /> Avoid</span>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* map */}
          <div className="card overflow-hidden" style={{ minHeight: 440 }}>
            <CityMap center={[geo.lat, geo.lon]} markers={markers} />
          </div>

          {/* panels */}
          <div className="space-y-4">
            {/* consumer sentiment */}
            <div className="card p-5">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                <Smile size={13} /> Consumer sentiment
                <InfoTip text="How safe visitors report actually feeling day-to-day, gathered from recent traveller reports and reviews." align="left" color="var(--ink-faint)" />
              </p>
              {sentiment ? (
                <>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="tnum font-display text-[2rem] font-medium leading-none" style={{ color: scoreColor(sentiment.score) }}>
                      {sentiment.score}
                    </span>
                    <span className="mb-1 text-[0.72rem] text-[var(--ink-faint)]">/100 · {sentiment.label}</span>
                  </div>
                  <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full" style={{ background: "rgba(20,25,34,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${sentiment.score}%`, background: scoreColor(sentiment.score) }} />
                  </div>
                  <p className="mt-2.5 text-[0.82rem] leading-relaxed text-[var(--ink-soft)]">{sentiment.summary}</p>
                </>
              ) : (
                <p className="mt-2 text-[0.82rem] italic text-[var(--ink-faint)]">
                  {intel ? "No sentiment read available for this place." : "Gathering traveller sentiment…"}
                </p>
              )}
            </div>

            {/* things to watch out for */}
            <div className="card p-5">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                <Eye size={13} /> Watch out for
              </p>
              {watch.length ? (
                <ul className="mt-2.5 space-y-2">
                  {watch.slice(0, 6).map((w) => (
                    <li key={w} className="flex items-start gap-2 text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">
                      <CircleAlert size={13} className="mt-[3px] shrink-0" style={{ color: "var(--caution)" }} />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[0.82rem] italic text-[var(--ink-faint)]">
                  {intel ? "Nothing notable flagged right now." : "Researching current hazards…"}
                </p>
              )}
            </div>

            {/* tips */}
            {!!tips.length && (
              <div className="card p-5">
                <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                  <Lightbulb size={13} /> Safety tips
                </p>
                <ul className="mt-2.5 space-y-2">
                  {tips.slice(0, 6).map((t) => (
                    <li key={t} className="flex items-start gap-2 text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">
                      <CircleCheck size={13} className="mt-[3px] shrink-0" style={{ color: "var(--safe)" }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
}
