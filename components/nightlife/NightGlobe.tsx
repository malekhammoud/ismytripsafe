"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import type { MeshPhongMaterial } from "three"
import { Crosshair, Maximize2, Moon, Pause, Play, Search, X } from "lucide-react"
import type { NightlifeGlobeCountry, NightlifeGlobePayload, NightlifeGlobePoint } from "@/lib/nightlife/globe"
import { loadCountryFeatures, type GlobeFeature } from "@/lib/globe-geo"
import {
  canAutoStartGlobe,
  MAX_GLOBE_PIXEL_RATIO,
  prefersReducedMotion,
  whenIdle,
} from "@/lib/globe-runtime"

// WebGL only exists in the browser; keep the globe out of the server bundle.
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false, loading: () => null })

type Feat = GlobeFeature
type Poly = Feat & { __c?: NightlifeGlobeCountry }
type LightCity = NightlifeGlobePoint & { showName: boolean; size: number }

const NIGHT_RAMP: [number, [number, number, number]][] = [
  [1, [122, 92, 226]],
  [2, [174, 92, 226]],
  [3, [226, 94, 174]],
  [4, [255, 113, 122]],
  [5, [255, 178, 91]],
]

function ramp(score: number): [number, number, number] {
  const s = Math.max(0, Math.min(5, score))
  for (let i = 1; i < NIGHT_RAMP.length; i++) {
    const [hi, hiColor] = NIGHT_RAMP[i]
    if (s <= hi) {
      const [lo, loColor] = NIGHT_RAMP[i - 1]
      const t = hi === lo ? 0 : (s - lo) / (hi - lo)
      return [0, 1, 2].map(k => Math.round(loColor[k] + (hiColor[k] - loColor[k]) * t)) as [number, number, number]
    }
  }
  return NIGHT_RAMP[NIGHT_RAMP.length - 1][1]
}
const solid = (score: number) => { const [r, g, b] = ramp(score); return `rgb(${r}, ${g}, ${b})` }
const glow = (score: number, alpha = 1) => { const [r, g, b] = ramp(score); return `rgba(${r}, ${g}, ${b}, ${alpha})` }
const lightFor = (score: number | null) => score == null ? "rgb(120, 137, 204)" : solid(score)

const LEGEND = [1, 2, 3, 4, 5].map(score => ({ score, color: solid(score) }))

export function NightGlobe({ payload }: { payload: NightlifeGlobePayload }) {
  const stageRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [polys, setPolys] = useState<Poly[]>([])
  const [hover, setHover] = useState<Poly | null>(null)
  const [selected, setSelected] = useState<NightlifeGlobeCountry | null>(null)
  const [spinning, setSpinning] = useState(true)
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("All")
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [gated, setGated] = useState(false)
  const detailedRef = useRef(false)
  /** True once the camera is close enough that 110m coastlines would show. */
  const [close, setClose] = useState(false)

  // three.js travels with the globe, never with the page (see the safety
  // globe for the measured reason: an 83 KB initial chunk for a gated toy).
  const [three, setThree] = useState<typeof import("three") | null>(null)
  const [seaMaterial, setSeaMaterial] = useState<MeshPhongMaterial | null>(null)

  useEffect(() => {
    if (!enabled || three) return
    void import("three").then(setThree)
  }, [enabled, three])

  useEffect(() => {
    if (!three || seaMaterial) return
    setSeaMaterial(
      new three.MeshPhongMaterial({
        color: new three.Color("#040711"),
        emissive: new three.Color("#080d23"),
        emissiveIntensity: 0.95,
        shininess: 14,
        specular: new three.Color("#6e5bff"),
        transparent: false,
        opacity: 1,
      }),
    )
  }, [three, seaMaterial])

  const byNumericId = useMemo(() => {
    const map = new Map<string, NightlifeGlobeCountry>()
    for (const country of payload.countries) map.set(country.id, country)
    return map
  }, [payload.countries])

  const pointsBySlug = useMemo(() => {
    const map = new Map<string, NightlifeGlobePoint[]>()
    for (const point of payload.points) {
      const list = map.get(point.countrySlug) ?? []
      list.push(point)
      map.set(point.countrySlug, list)
    }
    for (const list of map.values()) list.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0) || b.venueCount - a.venueCount)
    return map
  }, [payload.points])

  const regions = useMemo(() => {
    const set = new Set(payload.countries.filter(country => country.reports > 0).map(country => country.region))
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b))]
  }, [payload.countries])

  const regionBySlug = useMemo(() => {
    const map = new Map<string, string>()
    for (const country of payload.countries) map.set(country.slug, country.region)
    return map
  }, [payload.countries])

  const visibleCountries = useMemo(
    () => region === "All" ? payload.countries : payload.countries.filter(country => country.region === region),
    [payload.countries, region]
  )
  const visibleIds = useMemo(() => new Set(visibleCountries.map(country => country.id)), [visibleCountries])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return null
    const countries = payload.countries.filter(country => country.name.toLowerCase().includes(q)).sort((a, b) => b.reports - a.reports || b.venues - a.venues).slice(0, 4)
    const cities = payload.points.filter(point => `${point.city} ${point.country}`.toLowerCase().includes(q))
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0) || b.venueCount - a.venueCount).slice(0, 7)
    return { countries, cities }
  }, [query, payload])

  // The named cities are the biggest scenes; the rest stay as unlabelled
  // lights until hovered. Selecting a country names all of its guides.
  const topPaths = useMemo(() => new Set([...payload.points].sort((a, b) => b.venueCount - a.venueCount).slice(0, 16).map(point => point.path)), [payload.points])

  const lights = useMemo((): LightCity[] => {
    const inRegion = region === "All" ? payload.points : payload.points.filter(point => regionBySlug.get(point.countrySlug) === region)
    return inRegion.map(point => ({
      ...point,
      showName: selected ? point.countrySlug === selected.slug : topPaths.has(point.path),
      size: Math.max(6, Math.min(15, 6 + Math.log2(point.venueCount + 1) * 1.25)),
    }))
  }, [payload.points, region, regionBySlug, selected, topPaths])

  const selectedPoints = selected ? pointsBySlug.get(selected.slug) ?? [] : []

  // ─── World geometry ────────────────────────────────────────────────
  // 110m first (108 KB), 50m only when the camera is close. See
  // `lib/globe-geo.ts` for the French Guiana fix that both globes share.
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadCountryFeatures("/geo/countries-110m.json")
      .then((features) => {
        if (alive) setPolys(features as Poly[])
      })
      .catch(() => {
        if (alive) setPolys([])
      })
    return () => {
      alive = false
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || detailedRef.current || !close) return
    detailedRef.current = true
    let alive = true
    whenIdle(() => {
      loadCountryFeatures("/geo/countries-50m.json")
        .then((features) => {
          if (alive) setPolys(features as Poly[])
        })
        .catch(() => {
          /* keep the 110m outlines */
        })
    }, 2500)
    return () => {
      alive = false
    }
  }, [enabled, close])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setSize({ w: element.clientWidth, h: element.clientHeight }))
    observer.observe(element)
    setSize({ w: element.clientWidth, h: element.clientHeight })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !ready) return
    const controls = globe.controls()
    controls.autoRotate = spinning
    controls.autoRotateSpeed = 0.28
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.minDistance = 130
    controls.maxDistance = 720
  }, [spinning, ready])

  useEffect(() => {
    if (prefersReducedMotion()) setSpinning(false)
    if (canAutoStartGlobe()) whenIdle(() => setEnabled(true), 900)
    else setGated(true)
  }, [])

  // Same rules as the safety globe: CSS-resolution buffer, and no render
  // loop once the stage has been scrolled past.
  useEffect(() => {
    if (!ready) return
    const renderer = globeRef.current?.renderer?.()
    renderer?.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, MAX_GLOBE_PIXEL_RATIO))
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const element = stageRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const globe = globeRef.current
        if (!globe) return
        if (entry.isIntersecting && !document.hidden) globe.resumeAnimation()
        else globe.pauseAnimation()
      },
      { threshold: 0.02 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ready])

  // Hand the main thread back before a link navigates. Without this, a slow
  // WebGL frame loop can starve the router's transition and make every link
  // on the page look dead.
  useEffect(() => {
    if (!ready) return
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]")
      const href = anchor?.getAttribute("href")
      if (!href || !href.startsWith("/") || href === window.location.pathname) return
      globeRef.current?.pauseAnimation()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [ready])

  useEffect(() => {
    const onVisibility = () => {
      const globe = globeRef.current
      if (!globe) return
      if (document.hidden) globe.pauseAnimation()
      else globe.resumeAnimation()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  const flyTo = useCallback((lat: number, lng: number, altitude = 0.9) => {
    setSpinning(false)
    globeRef.current?.pointOfView({ lat, lng, altitude }, 1100)
  }, [])

  const openCountry = useCallback((country: NightlifeGlobeCountry) => {
    setSelected(country)
    const points = pointsBySlug.get(country.slug) ?? []
    if (!points.length) return
    const lats = points.map(point => point.lat), lngs = points.map(point => point.lng)
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2
    const latSpan = Math.max(...lats) - Math.min(...lats)
    const lngSpan = (Math.max(...lngs) - Math.min(...lngs)) * Math.cos(lat * Math.PI / 180)
    const span = Math.max(latSpan, lngSpan)
    flyTo(lat, lng, Math.min(1.9, Math.max(0.52, span / 22 + 0.42)))
  }, [pointsBySlug, flyTo])

  const capColor = useCallback((object: object) => {
    const feature = object as Poly
    const country = byNumericId.get(String(feature.id))
    if (!country || !visibleIds.has(country.id) || country.score == null) {
      return hover === feature ? "rgba(33, 43, 79, 0.72)" : "rgba(15, 21, 43, 0.62)"
    }
    const active = selected?.id === country.id || hover === feature
    return glow(country.score, active ? 0.92 : 0.56)
  }, [byNumericId, visibleIds, hover, selected])

  const altOf = useCallback((object: object) => {
    const feature = object as Poly
    const country = byNumericId.get(String(feature.id))
    if (!country || !visibleIds.has(country.id)) return 0.003
    if (selected?.id === country.id || hover === feature) return 0.026
    return country.score == null ? 0.004 : 0.01
  }, [byNumericId, visibleIds, selected, hover])

  const strokeOf = useCallback((object: object) => {
    const feature = object as Poly
    const country = byNumericId.get(String(feature.id))
    if (country && (selected?.id === country.id || hover === feature)) return "rgba(255, 211, 142, 0.95)"
    if (country && country.reports > 0) return "rgba(184, 164, 255, 0.32)"
    return "rgba(110, 130, 200, 0.13)"
  }, [byNumericId, selected, hover])

  const polygonLabel = useCallback((object: object) => {
    const feature = object as Poly
    const country = byNumericId.get(String(feature.id))
    const name = country?.name ?? feature.properties?.name ?? "Unknown"
    if (!country || country.reports === 0 || country.score == null) {
      return `<div style="font:500 12px/1.45 system-ui;background:rgba(8,12,28,.95);color:#f6f0ff;border:1px solid rgba(160,140,255,.35);padding:7px 10px;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.55)">
        <b>${name}</b><br><span style="opacity:.62;font-size:11px">No nightlife guide yet · click for safety reports</span></div>`
    }
    return `<div style="font:500 12px/1.45 system-ui;background:rgba(8,12,28,.96);color:#f6f0ff;border:1px solid rgba(255,190,120,.38);padding:8px 11px;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.6);min-width:155px">
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
        <b style="font-size:13px">${country.flag} ${name}</b>
        <span style="background:${solid(country.score)};color:#160d20;font-weight:800;border-radius:3px;padding:1px 6px;font-size:12px">${country.score.toFixed(1)}</span>
      </div>
      <div style="opacity:.68;font-size:11px;margin-top:3px">${country.reports} guide${country.reports === 1 ? "" : "s"} · ${country.venues.toLocaleString("en")} venues · click to open</div>
    </div>`
  }, [byNumericId])

  const makeLight = useCallback((object: object) => {
    const point = object as LightCity
    const anchor = document.createElement("a")
    anchor.className = `night-light${point.showName ? "" : " is-dot"}`
    anchor.href = point.path
    anchor.style.setProperty("--light", lightFor(point.overall))
    anchor.style.setProperty("--light-size", `${point.size}px`)
    anchor.setAttribute("aria-label", `${point.city}, ${point.country}. Nightlife ${point.overall?.toFixed(1) ?? "not scored"} out of 5, ${point.venueCount} mapped venues.`)

    const dot = document.createElement("span")
    dot.className = "night-light-dot"

    const name = document.createElement("span")
    name.className = "night-light-name"
    name.textContent = point.city

    const card = document.createElement("span")
    card.className = "night-light-card"
    const score = document.createElement("span")
    score.className = "night-light-score"
    score.style.background = lightFor(point.overall)
    score.textContent = point.overall?.toFixed(1) ?? "–"
    const body = document.createElement("span")
    body.className = "night-light-body"
    const title = document.createElement("b")
    title.textContent = point.city
    const meta = document.createElement("span")
    meta.className = "night-light-meta"
    meta.textContent = `${point.flag ? `${point.flag} ` : ""}${point.country} · ${point.venueCount} venues${point.limited ? " · limited data" : ""}`
    const cta = document.createElement("span")
    cta.className = "night-light-cta"
    cta.textContent = "Open the nightlife guide →"
    body.append(title, meta, cta)
    card.append(score, body)
    anchor.append(dot, name, card)

    anchor.addEventListener("mouseenter", () => anchor.classList.add("is-open"))
    anchor.addEventListener("mouseleave", () => anchor.classList.remove("is-open"))
    anchor.addEventListener("focus", () => anchor.classList.add("is-open"))
    anchor.addEventListener("blur", () => anchor.classList.remove("is-open"))
    return anchor
  }, [])

  const hideBehind = useCallback((element: HTMLElement, visible: boolean) => {
    element.dataset.behind = String(!visible)
  }, [])

  return (
    <div className="night-globe-stage relative h-[min(86vh,860px)] w-full">
      <div ref={stageRef} className="absolute inset-0">
        {enabled && size.w > 0 && (
          <Suspense fallback={null}>
            <Globe
              ref={globeRef}
              width={size.w}
              height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              rendererConfig={{ antialias: false, powerPreference: "high-performance" }}
              globeOffset={selected && size.w > 900 ? [-165, 0] : [0, 0]}
              showAtmosphere
              atmosphereColor="#6d5cff"
              atmosphereAltitude={0.22}
              globeImageUrl={null}
              globeMaterial={seaMaterial ?? undefined}
              onGlobeReady={async () => {
                setReady(true)
                globeRef.current?.pointOfView({ lat: 20, lng: -18, altitude: 2.45 })
                const T = three ?? (await import("three"))
                const ambient = new T.AmbientLight(0x7786ff, 1.9)
                const key = new T.DirectionalLight(0xffb875, 1.7)
                key.position.set(1, 0.6, 0.9)
                const rim = new T.DirectionalLight(0x7b5cff, 0.9)
                rim.position.set(-1, -0.35, -0.6)
                globeRef.current?.lights([ambient, key, rim])
              }}
              onZoom={(view: { altitude: number }) => {
                // Only the crossing, never the frame — this state must not
                // update continuously while the globe turns.
                const next = view.altitude <= 1.05
                setClose((prev) => (prev === next ? prev : next))
              }}
              polygonsData={polys}
              polygonAltitude={altOf}
              polygonCapColor={capColor}
              polygonSideColor={() => "rgba(24, 18, 58, 0.55)"}
              polygonStrokeColor={strokeOf}
              polygonLabel={polygonLabel}
              polygonsTransitionDuration={180}
              polygonCapCurvatureResolution={7}
              onPolygonHover={(polygon: object | null) => setHover(polygon as Poly | null)}
              onPolygonClick={(polygon: object) => {
                const country = byNumericId.get(String((polygon as Poly).id))
                if (country) openCountry(country)
              }}
              htmlElementsData={lights}
              htmlLat="lat"
              htmlLng="lng"
              htmlAltitude={(object: object) => {
                const point = object as LightCity
                return 0.012 + Math.min(0.024, Math.log2(point.venueCount + 1) * 0.003)
              }}
              htmlElement={makeLight}
              htmlElementVisibilityModifier={hideBehind}
              htmlTransitionDuration={220}
            />
          </Suspense>
        )}
      </div>

      {!ready && (
        <div className="absolute inset-0 z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/geo/globe-night.webp"
            alt=""
            aria-hidden
            width={1400}
            height={1000}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-contain object-center"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(60%_60%_at_50%_50%,transparent,rgba(3,2,12,0.42))]">
            {gated ? (
              <div className="pointer-events-auto px-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setGated(false)
                    setEnabled(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-[#ffcb8c] px-5 py-2.5 text-[0.86rem] font-semibold text-[#1b1033] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)] transition hover:brightness-105"
                >
                  <Play size={14} aria-hidden />
                  Explore the interactive globe
                </button>
                <p className="mt-2.5 text-[0.72rem] text-[#c9c5ff]">
                  The 3D globe is heavy on this device. The guides work without it.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Moon className="night-moon mx-auto text-[#ffcb8c]" size={30} />
                <p className="mt-3 text-[0.78rem] font-medium tracking-wide text-[#c9c5ff]">Lighting up the cities…</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 sm:p-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3">
          <div className="pointer-events-auto relative w-full max-w-[19rem]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7a3d8]" aria-hidden />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Find a city or country…"
              aria-label="Search nightlife guides"
              className="night-search w-full"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a7a3d8] hover:text-white">
                <X size={14} />
              </button>
            )}
            {results && (results.countries.length > 0 || results.cities.length > 0) && (
              <div className="night-panel night-search-results">
                {results.countries.map(country => (
                  <button key={country.slug} type="button" onClick={() => { openCountry(country); setQuery("") }} className="night-result-row">
                    <span className="min-w-0 truncate">{country.flag} {country.name}</span>
                    <span className="night-result-score" style={{ background: country.score == null ? "rgba(120,137,204,.5)" : solid(country.score) }}>{country.score?.toFixed(1) ?? "–"}</span>
                  </button>
                ))}
                {results.cities.map(point => (
                  <Link key={point.path} href={point.path} className="night-result-row">
                    <span className="min-w-0 truncate">{point.city}<small>{point.country}</small></span>
                    <span className="night-result-score" style={{ background: lightFor(point.overall) }}>{point.overall?.toFixed(1) ?? "–"}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            {regions.map(value => <button key={value} type="button" data-on={region === value} onClick={() => setRegion(value)} className="night-chip">{value}</button>)}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div className="pointer-events-auto night-legend">
            <p>Nightlife score</p>
            <div className="night-legend-row">
              <span>quiet</span>
              <span className="night-legend-ramp">{LEGEND.map(item => <span key={item.score} style={{ background: item.color }} title={`${item.score} / 5`} />)}</span>
              <span>buzzing</span>
            </div>
            <div className="night-legend-row night-legend-note">
              <span className="night-legend-blue" /> no guide yet
              <span className="night-legend-dot" /> city light = mapped venues
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button type="button" onClick={() => setSpinning(value => !value)} className="night-chip flex items-center gap-1.5" aria-pressed={spinning}>
              {spinning ? <Pause size={12} /> : <Play size={12} />}{spinning ? "Pause spin" : "Spin"}
            </button>
            <button type="button" onClick={() => { setSelected(null); setSpinning(true); globeRef.current?.pointOfView({ lat: 20, lng: -18, altitude: 2.45 }, 900) }} className="night-chip flex items-center gap-1.5">
              <Maximize2 size={12} /> Reset view
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <aside className="night-panel night-country-panel">
          <div className="night-country-head">
            <span className="night-country-flag">{selected.flag}</span>
            <div className="min-w-0 flex-1">
              <p>{selected.region}</p>
              <h2>{selected.name}</h2>
              <span>{selected.reports} nightlife {selected.reports === 1 ? "guide" : "guides"} · {selected.venues.toLocaleString("en")} venues</span>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close country panel" className="night-close"><X size={14} /></button>
          </div>
          <div className="night-country-body">
            {selectedPoints.length > 0 ? (
              <ul>
                {selectedPoints.map(point => (
                  <li key={point.path}>
                    <Link href={point.path} className="night-city-row">
                      <span className="night-city-name">{point.city}</span>
                      <span className="night-city-meta">{point.venueCount} venues{point.limited ? " · limited" : ""}</span>
                      <span className="night-city-score" style={{ background: lightFor(point.overall) }}>{point.overall?.toFixed(1) ?? "–"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="night-empty">
                <Crosshair size={18} />
                <p>No nightlife guide yet in {selected.name}.</p>
                <span>Open a city safety report below to start a guide.</span>
              </div>
            )}
          </div>
          <div className="night-country-foot">
            <Link href={`/${selected.slug}`}>Open the {selected.name} safety report →</Link>
          </div>
        </aside>
      )}

      <p className="night-hint">Drag to spin · scroll to zoom · every light is a city guide</p>
    </div>
  )
}
