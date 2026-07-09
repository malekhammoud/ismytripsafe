"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { MapPin, Search, CircleCheck, CircleAlert, Smile, Eye, Lightbulb, MousePointerClick } from "lucide-react"
import { useReport } from "@/lib/store"
import { TopNav } from "@/components/report/TopNav"
import { InfoTip } from "@/components/report/InfoTip"
import { SourceLink } from "@/components/report/SourceLink"
import { scoreColor } from "@/lib/safety-display"
import { extractSourceLinksFromText, sourceUrlForSearchQuery } from "@/lib/source-links"
import type { ZoneLevel } from "@/lib/types"
import type { MapZonePoint } from "@/components/map/CityMap"

const CityMap = dynamic(() => import("@/components/map/CityMap").then((m) => m.CityMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" style={{ minHeight: 460 }} />,
})

const ZONE_META: Record<ZoneLevel, { color: string; label: string }> = {
  safe: { color: "#2f9e6f", label: "Safer" },
  caution: { color: "#e0a13b", label: "Caution" },
  avoid: { color: "#d4503a", label: "Avoid" },
}

function cleanArea(s: string): string {
  return s.split(/[(—–-]/)[0].replace(/\bafter dark\b/i, "").trim() || s.trim()
}

function avoidReason(s: string): string {
  const paren = s.match(/\(([^)]+)\)/)
  if (paren) return paren[1].trim().replace(/^\w/, (c) => c.toUpperCase())
  const parts = s.split(/\s[—–-]\s/)
  if (parts.length > 1) return parts.slice(1).join(" ").trim()
  return "Flagged to avoid by local intelligence."
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
  const { bundle, intel, status, run, prose, queries, query } = useReport()
  const geo = bundle?.geo ?? null
  const [zones, setZones] = useState<MapZonePoint[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  // Re-hydrate from the URL — landing here directly, on a reload, or via the
  // browser's back/forward button finds an empty store; replay from cache
  // using the place carried in `?place=` instead of bouncing to "no destination".
  useEffect(() => {
    if (status !== "idle") return
    const place = new URLSearchParams(window.location.search).get("place")
    if (place) run({ place })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build the zone list from the AI's mapZones (preferred) or, for older cached
  // reports, fall back to the safe / avoid area lists.
  const rawZones = useMemo(() => {
    if (!intel) return []
    if (intel.mapZones?.length) {
      return intel.mapZones.map((z) => ({ name: cleanArea(z.name), level: z.level, note: z.note }))
    }
    return [
      ...(intel.safeAreas ?? []).map((a) => ({ name: cleanArea(a), level: "safe" as ZoneLevel, note: "Considered safer for visitors." })),
      ...(intel.avoidAreas ?? []).map((a) => ({ name: cleanArea(a), level: "avoid" as ZoneLevel, note: avoidReason(a) })),
    ]
  }, [intel])

  // Resolve each zone to real coordinates + OSM boundary polygon so we can
  // plot accurate shapes.
  useEffect(() => {
    if (!geo || !rawZones.length) return
    const items = rawZones.filter((z) => z.name.length > 1).slice(0, 12)
    let cancelled = false
    ;(async () => {
      const res = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: geo.city, country: geo.country, zones: items }),
      })
        .then((r) => r.json())
        .catch(() => null)
      if (cancelled || !res?.results) return
      const pts: MapZonePoint[] = []
      res.results.forEach(
        (r: { lat: number | null; lon: number | null; name: string; level: ZoneLevel; note: string; geojson: unknown | null }) => {
          if (r.lat != null && r.lon != null && haversineKm(r.lat, r.lon, geo.lat, geo.lon) < 70) {
            pts.push({ lat: r.lat, lon: r.lon, name: r.name, level: r.level, note: r.note, geojson: r.geojson })
          }
        }
      )
      setZones(pts)
    })()
    return () => {
      cancelled = true
    }
  }, [geo, rawZones])

  const center = useMemo<[number, number]>(() => (geo ? [geo.lat, geo.lon] : [0, 0]), [geo])
  const activeZone = zones.find((z) => z.name === selected) ?? null

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
  const intelLinks = useMemo(() => extractSourceLinksFromText(prose), [prose])
  const searchSource = useMemo(
    () => sourceUrlForSearchQuery(queries[queries.length - 1] ?? null),
    [queries]
  )
  const placeQuery = query?.place ?? (geo ? `${geo.city}, ${geo.country}` : "")
  const reportSourceAnchor = `/?place=${encodeURIComponent(placeQuery)}#sec-local-intel-sources`
  const intelSourceHref = intelLinks[0] ?? searchSource ?? reportSourceAnchor

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <TopNav active="map" />

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
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
          <span className="flex items-center gap-1 group relative cursor-help">
            <Dot c="#1f74cf" />
            City
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden rounded-[6px] bg-[var(--ink)] px-2.5 py-1.5 text-[0.68rem] font-normal text-white whitespace-nowrap group-hover:block" style={{ zIndex: 1000 }}>
              Destination centre
            </div>
          </span>
          {(["safe", "caution", "avoid"] as ZoneLevel[]).map((l) => {
            const tooltips: Record<ZoneLevel, string> = {
              safe: "Generally safer; low reported crime & good services",
              caution: "Elevated precautions advised; some risk present",
              avoid: "High-risk areas; not recommended for visitors",
            }
            return (
              <span key={l} className="flex items-center gap-1 group relative cursor-help">
                <Dot c={ZONE_META[l].color} />
                {ZONE_META[l].label}
                <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden rounded-[6px] bg-[var(--ink)] px-2.5 py-1.5 text-[0.68rem] font-normal text-white whitespace-nowrap group-hover:block" style={{ zIndex: 1000 }}>
                  {tooltips[l]}
                </div>
              </span>
            )
          })}
        </div>
      </header>

      {/* split: map | panels */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="card overflow-hidden" style={{ minHeight: 460 }}>
          <CityMap center={center} city={geo.city} zones={zones} selected={selected} onSelect={(z) => setSelected(z.name)} />
        </div>

        <div className="space-y-4">
          {/* selected zone detail — updates on click */}
          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
              <MousePointerClick size={13} /> Area detail
            </p>
            {activeZone ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-display text-[1.15rem] font-medium text-[var(--ink)]">{activeZone.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em]" style={{ color: ZONE_META[activeZone.level].color, background: `color-mix(in oklab, ${ZONE_META[activeZone.level].color} 16%, transparent)` }}>
                    {ZONE_META[activeZone.level].label}
                  </span>
                </div>
                <p className="mt-2 text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">{activeZone.note}</p>
                <div className="mt-1">
                  <SourceLink href={intelSourceHref} label={`${activeZone.name} intelligence`} />
                </div>
              </>
            ) : (
              <p className="mt-2 text-[0.82rem] italic text-[var(--ink-faint)]">
                {zones.length ? "Click a coloured zone on the map for details." : intel ? "No mappable districts for this place." : "Locating districts…"}
              </p>
            )}
          </div>

          {/* zone list */}
          {!!zones.length && (
            <div className="card p-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Districts ({zones.length})</p>
              <div className="mt-2.5 space-y-1">
                {zones.map((z) => {
                  const levelTooltips: Record<ZoneLevel, string> = {
                    safe: "Generally safer; low reported crime & good services",
                    caution: "Elevated precautions advised; some risk present",
                    avoid: "High-risk areas; not recommended for visitors",
                  }
                  return (
                    <button
                      key={z.name}
                      onClick={() => setSelected(z.name)}
                      className="group relative flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--paper)]"
                      style={selected === z.name ? { background: "var(--paper)" } : undefined}
                    >
                      <div className="relative cursor-help">
                        <Dot c={ZONE_META[z.level].color} />
                        <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-[6px] bg-[var(--ink)] px-2.5 py-1.5 text-[0.65rem] font-normal text-white whitespace-nowrap group-hover:block" style={{ zIndex: 1000 }}>
                          {levelTooltips[z.level]}
                        </div>
                      </div>
                      <span className="flex-1 truncate text-[0.82rem] text-[var(--ink)]">{z.name}</span>
                      <SourceLink href={intelSourceHref} label={`${z.name} district assessment`} />
                      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.08em]" style={{ color: ZONE_META[z.level].color }}>{ZONE_META[z.level].label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* consumer sentiment */}
          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
              <Smile size={13} /> Consumer sentiment
              <InfoTip text="How safe visitors report actually feeling day-to-day, gathered from recent traveller reports and reviews." align="left" color="var(--ink-faint)" />
              <SourceLink href={intelSourceHref} label="consumer sentiment" />
            </p>
            {sentiment ? (
              <>
                <div className="mt-2 flex items-end gap-2">
                  <span className="tnum font-display text-[2rem] font-medium leading-none" style={{ color: scoreColor(sentiment.score) }}>{sentiment.score}</span>
                  <span className="mb-1 text-[0.72rem] text-[var(--ink-faint)]">/100 · {sentiment.label}</span>
                </div>
                <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full" style={{ background: "rgba(20,25,34,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: `${sentiment.score}%`, background: scoreColor(sentiment.score) }} />
                </div>
                <p className="mt-2.5 flex items-center gap-1 text-[0.82rem] leading-relaxed text-[var(--ink-soft)]">
                  {sentiment.summary}
                  <SourceLink href={intelSourceHref} label="sentiment summary" />
                </p>
              </>
            ) : (
              <p className="mt-2 text-[0.82rem] italic text-[var(--ink-faint)]">{intel ? "No sentiment read available." : "Gathering traveller sentiment…"}</p>
            )}
          </div>

          {/* watch out for */}
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
                    <SourceLink href={intelSourceHref} label="watchout source" className="mt-[3px] shrink-0" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.82rem] italic text-[var(--ink-faint)]">{intel ? "Nothing notable flagged." : "Researching current hazards…"}</p>
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
                    <SourceLink href={intelSourceHref} label="safety tip source" className="mt-[3px] shrink-0" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
}
