"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { feature } from "topojson-client"
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from "three"
import type { Topology, GeometryCollection } from "topojson-specification"
import { Search, X, Pause, Play, Compass, Maximize2, Crosshair } from "lucide-react"
import type { GlobeCountry, GlobePayload, GlobePoint } from "@/lib/globe-data"
import { PosterArt } from "@/components/beach/PosterArt"

// react-globe.gl reaches for WebGL at import time — it can only ever run in
// the browser, so it loads lazily and never renders on the server.
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => null,
})

// ─────────────────────────────────────────────────────────────────────
// The globe that replaced the destinations list.
//
// Drag to spin, scroll to zoom, click a country to fly to it. Countries
// we've published a report for are tinted by their safety score; the rest
// are sand-coloured and inert. City reports are small names set on the map
// itself — nothing standing off the surface, and only ever the handful you
// are actually looking at.
// ─────────────────────────────────────────────────────────────────────

const SEA = "#0d5f74"
const SAND_IDLE = "rgba(233, 214, 178, 0.42)"
const SAND_IDLE_HOVER = "rgba(243, 226, 189, 0.62)"

/** Score → globe tint. Brighter than the page palette to survive the dark sea. */
function tint(score: number, alpha = 0.9): string {
  const [r, g, b] =
    score >= 70 ? [26, 186, 140] : score >= 55 ? [235, 176, 66] : score >= 40 ? [246, 140, 76] : [232, 92, 78]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function tintSolid(score: number): string {
  return score >= 70 ? "#1aba8c" : score >= 55 ? "#ebb042" : score >= 40 ? "#f68c4c" : "#e85c4e"
}

interface Feat {
  type: "Feature"
  id?: string | number
  properties: { name?: string }
  geometry: unknown
}

type Poly = Feat & { __c?: GlobeCountry }

/** A city label on the globe, plus the row it was dealt (see `stagger`). */
type PinCity = GlobePoint & { row: number }

/** How many city names may sit on the globe at once before it reads as noise. */
const MAX_LABELS = 26

const LEGEND = [
  { label: "70+ · safe", color: "#1aba8c" },
  { label: "55–69 · moderate", color: "#ebb042" },
  { label: "40–54 · caution", color: "#f68c4c" },
  { label: "under 40 · high risk", color: "#e85c4e" },
]

export function GlobeExplorer({ payload }: { payload: GlobePayload }) {
  const stageRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [polys, setPolys] = useState<Poly[]>([])
  const [hover, setHover] = useState<Poly | null>(null)
  const [selected, setSelected] = useState<GlobeCountry | null>(null)
  /**
   * Point of view, snapped to a coarse grid.
   *
   * This MUST stay snapped. `onZoom` fires on every animation frame the globe
   * moves, and setting React state from it unsnapped puts the page into a
   * permanent stream of default-priority updates — which starves React's
   * low-priority transitions indefinitely. The visible symptom is that every
   * link on the page stops working: `router.push` is called, the transition
   * is scheduled, and it never gets a chance to commit.
   */
  const [pov, setPov] = useState({ lat: 22, lng: -22, altitude: 2.4 })
  const [spinning, setSpinning] = useState(true)
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState<string>("All")
  const [ready, setReady] = useState(false)

  /**
   * The sea. There's no texture on this globe — the whole point is that the
   * countries carry the colour — so the sphere itself is one lagoon-blue
   * Phong material with enough emissive to keep the night side readable
   * rather than a black void.
   */
  const seaMaterial = useMemo(() => {
    const m = new MeshPhongMaterial({
      color: new Color(SEA),
      emissive: new Color("#0a4356"),
      emissiveIntensity: 0.85,
      shininess: 18,
      specular: new Color("#7fd4de"),
      transparent: true,
      opacity: 0.97,
    })
    return m
  }, [])

  // ─── Indexes ───────────────────────────────────────────────────────

  const byNumericId = useMemo(() => {
    const m = new Map<string, GlobeCountry>()
    for (const c of payload.countries) m.set(c.id, c)
    return m
  }, [payload.countries])

  const pointsBySlug = useMemo(() => {
    const m = new Map<string, GlobePoint[]>()
    for (const p of payload.points) {
      const arr = m.get(p.countrySlug)
      if (arr) arr.push(p)
      else m.set(p.countrySlug, [p])
    }
    for (const arr of m.values()) arr.sort((a, b) => b.score - a.score)
    return m
  }, [payload.points])

  const regions = useMemo(() => {
    const set = new Set(payload.countries.map((c) => c.region))
    return ["All", ...[...set].sort()]
  }, [payload.countries])

  const visibleCountries = useMemo(
    () => (region === "All" ? payload.countries : payload.countries.filter((c) => c.region === region)),
    [payload.countries, region]
  )
  const visibleIds = useMemo(() => new Set(visibleCountries.map((c) => c.id)), [visibleCountries])

  // Search across countries and cities at once — one box, both kinds of hit.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return null
    const countries = payload.countries
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
    const cities = payload.points
      .filter((p) => p.city.toLowerCase().includes(q))
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 7)
    return { countries, cities }
  }, [query, payload])

  const regionBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of payload.countries) m.set(c.slug, c.region)
    return m
  }, [payload.countries])

  /** Every city the current region filter allows. */
  const inRegion = useMemo(
    () =>
      region === "All"
        ? payload.points
        : payload.points.filter((p) => regionBySlug.get(p.countrySlug) === region),
    [payload.points, regionBySlug, region]
  )

  /**
   * The city layer: a place name, small, sitting on its own coordinate.
   * Only ever the cities you're actually looking at —
   *
   *   • a country is open  → its cities, biggest first
   *   • zoomed in close    → the nearest cities to the centre of the view
   *   • otherwise          → none
   *
   * Capped so the globe never turns into a wall of type, and the point of
   * view is snapped to a coarse grid so gently rotating the planet doesn't
   * rebuild the whole DOM layer on every frame.
   */
  const nextPins = useMemo((): PinCity[] => {
    /**
     * Nudge alternate labels a few pixels up and down. Neighbours a short
     * drive apart land on nearly the same pixel when you're zoomed out, and
     * two names printed over each other are worth less than one. Ordering by
     * latitude means the pair that would collide is the pair that gets split.
     */
    const stagger = (list: GlobePoint[]): PinCity[] =>
      [...list].sort((a, b) => b.lat - a.lat).map((p, i) => ({ ...p, row: i % 2 }))

    if (selected) {
      return stagger(
        [...(pointsBySlug.get(selected.slug) ?? [])]
          .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
          .slice(0, MAX_LABELS)
      )
    }
    if (pov.altitude > 1.15) return []

    // Angular distance from the centre of the view, on the unit sphere.
    const toRad = Math.PI / 180
    const cLat = pov.lat * toRad
    const cLng = pov.lng * toRad
    const near = inRegion
      .map((p) => {
        const dLat = p.lat * toRad - cLat
        const dLng = p.lng * toRad - cLng
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(cLat) * Math.cos(p.lat * toRad) * Math.sin(dLng / 2) ** 2
        return { p, d: 2 * Math.asin(Math.min(1, Math.sqrt(a))) }
      })
      // Only what's on the near face and roughly in frame.
      .filter((x) => x.d < 0.55 + pov.altitude * 0.45)
      .sort((a, b) => a.d - b.d)

    // Nearest the centre first, then the biggest of those — a capital should
    // not lose its label to a village six miles nearer the middle.
    return stagger(
      near
        .slice(0, 120)
        .sort((a, b) => (b.p.population ?? 0) - (a.p.population ?? 0))
        .slice(0, MAX_LABELS)
        .map((x) => x.p)
    )
  }, [selected, pointsBySlug, inRegion, pov])

  /**
   * Hold the pin array's identity steady while its *contents* are unchanged.
   *
   * Without this the memo above returns a fresh array on every point-of-view
   * tick, three-globe treats that as new data, and it tears down and rebuilds
   * every label element continuously — which drops the DOM node out from
   * under your cursor between mousedown and mouseup, so labels can't be
   * clicked while the globe is moving at all.
   */
  const pinsRef = useRef<PinCity[]>([])
  const pinCities = useMemo(() => {
    const sig = nextPins.map((p) => p.path).join("|")
    if (sig !== pinsRef.current.map((p) => p.path).join("|")) pinsRef.current = nextPins
    return pinsRef.current
  }, [nextPins])

  // ─── Load the country outlines ─────────────────────────────────────

  useEffect(() => {
    let alive = true
    fetch("/geo/countries-110m.json")
      .then((r) => r.json())
      .then((topo: Topology<{ countries: GeometryCollection }>) => {
        if (!alive) return
        const fc = feature(topo, topo.objects.countries) as unknown as { features: Feat[] }
        setPolys(fc.features as Poly[])
      })
      .catch(() => setPolys([]))
    return () => {
      alive = false
    }
  }, [])

  // ─── Size the canvas to its container ──────────────────────────────

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // ─── Controls: gentle auto-spin that yields to the user ────────────

  useEffect(() => {
    const g = globeRef.current
    if (!g || !ready) return
    const controls = g.controls()
    controls.autoRotate = spinning
    controls.autoRotateSpeed = 0.34
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.minDistance = 130
    controls.maxDistance = 700
  }, [spinning, ready])

  /**
   * Stop the render loop as soon as anything on the page is trying to
   * navigate away.
   *
   * A WebGL globe is the heaviest thing on this page by an order of
   * magnitude. Where the GPU is slow or absent — software rendering, an old
   * laptop, a VM — its frame loop eats the whole main thread, and React's
   * scheduler never gets the idle slice it needs to commit a low-priority
   * transition. Every link on the page then appears dead: `router.push`
   * runs, the transition is scheduled, and it starves. Measured here at
   * 1 fps with 2.2s frame gaps under software rendering.
   *
   * Pausing on the click's capture phase hands the thread back before the
   * router even starts, so the navigation commits normally. The component
   * is on its way out anyway, so there is nothing to resume.
   */
  useEffect(() => {
    if (!ready) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]")
      const href = a?.getAttribute("href")
      if (!href || !href.startsWith("/") || href === window.location.pathname) return
      globeRef.current?.pauseAnimation()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [ready])

  /** Don't burn a core rendering a globe nobody is looking at. */
  useEffect(() => {
    const onVis = () => {
      const g = globeRef.current
      if (!g) return
      if (document.hidden) g.pauseAnimation()
      else g.resumeAnimation()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  const flyTo = useCallback((lat: number, lng: number, alt = 0.85) => {
    setSpinning(false)
    globeRef.current?.pointOfView({ lat, lng, altitude: alt }, 1100)
  }, [])

  const openCountry = useCallback(
    (c: GlobeCountry) => {
      setSelected(c)
      const pts = pointsBySlug.get(c.slug) ?? []
      if (!pts.length) return
      // Frame the country rather than flying to a fixed height: Portugal and
      // Russia both need to end up filling roughly the same screen.
      const lats = pts.map((p) => p.lat)
      const lngs = pts.map((p) => p.lng)
      const lat = (Math.min(...lats) + Math.max(...lats)) / 2
      const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2
      const latSpan = Math.max(...lats) - Math.min(...lats)
      const lngSpan = (Math.max(...lngs) - Math.min(...lngs)) * Math.cos((lat * Math.PI) / 180)
      const span = Math.max(latSpan, lngSpan)
      flyTo(lat, lng, Math.min(1.9, Math.max(0.52, span / 22 + 0.42)))
    },
    [pointsBySlug, flyTo]
  )

  // ─── Accessors (stable identities keep three-globe from re-diffing) ─

  const capColor = useCallback(
    (o: object) => {
      const d = o as Poly
      const c = byNumericId.get(String(d.id))
      if (!c || !visibleIds.has(c.id)) return hover === d ? SAND_IDLE_HOVER : SAND_IDLE
      const isSel = selected?.id === c.id
      return tint(c.score, hover === d || isSel ? 1 : 0.82)
    },
    [byNumericId, visibleIds, hover, selected]
  )

  const altOf = useCallback(
    (o: object) => {
      const d = o as Poly
      const c = byNumericId.get(String(d.id))
      if (!c || !visibleIds.has(c.id)) return 0.006
      if (selected?.id === c.id) return 0.09
      if (hover === d) return 0.075
      return 0.014 + (c.reports > 8 ? 0.012 : 0)
    },
    [byNumericId, visibleIds, hover, selected]
  )

  const polygonLabel = useCallback(
    (o: object) => {
      const d = o as Poly
      const c = byNumericId.get(String(d.id))
      const name = c?.name ?? d.properties?.name ?? ""
      if (!c) {
        return `<div style="font:500 12px/1.4 system-ui;background:rgba(13,59,77,.92);color:#e8f6f7;
          padding:6px 9px;border-radius:4px;box-shadow:0 6px 20px rgba(0,0,0,.4)">
          ${name}<br><span style="opacity:.6;font-size:11px">No report yet</span></div>`
      }
      return `<div style="font:500 12px/1.45 system-ui;background:rgba(255,253,246,.97);color:#0d3b4d;
        padding:8px 11px;border-radius:4px;box-shadow:0 8px 26px rgba(0,0,0,.45);min-width:150px">
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <b style="font-size:13px">${c.flag} ${name}</b>
          <span style="background:${tintSolid(c.score)};color:#fff;font-weight:700;
            border-radius:3px;padding:1px 6px;font-size:12px">${c.score}</span>
        </div>
        <div style="opacity:.62;font-size:11px;margin-top:3px">
          ${c.reports} report${c.reports === 1 ? "" : "s"} · click to open
        </div></div>`
    },
    [byNumericId]
  )


  /**
   * Build one city pin: a real anchor with a real href, so it has a URL,
   * opens in a new tab on middle-click, shows the target in the status bar
   * and reads correctly to a screen reader.
   *
   * Deliberately NOT intercepted into `router.push`. These nodes are created
   * by three-globe outside React's tree, and a soft navigation from here did
   * not reliably commit; a plain browser navigation always does. The pin
   * leads to a full report page, so there is little to gain from a soft one
   * — and the capture-phase handler above still pauses the render loop first.
   */
  const makePin = useCallback(
    (o: object) => {
      const p = o as PinCity
      const el = document.createElement("a")
      el.className = "globe-pin"
      // The score tints the tick, not the type. Colouring the words by score
      // put green names on green countries — the one thing the label must
      // never be is the same colour as what it sits on.
      el.style.setProperty("--score", tintSolid(p.score))
      el.style.setProperty("--row", p.row ? "-8px" : "7px")
      el.href = p.path
      el.title = `${p.city}, ${p.country} — ${p.score}/100, ${p.levelLabel}`
      el.setAttribute(
        "aria-label",
        `${p.city}, ${p.country}. Safety score ${p.score} out of 100, ${p.levelLabel}`
      )
      // textContent, not innerHTML — city names are data, and one of them
      // will eventually contain an apostrophe or an ampersand.
      el.textContent = p.city
      return el
    },
    []
  )

  /** Fade pins on the far side of the planet instead of letting them float. */
  const pinVisibility = useCallback((el: HTMLElement, isVisible: boolean) => {
    el.dataset.behind = String(!isVisible)
  }, [])

  const selectedPoints = selected ? pointsBySlug.get(selected.slug) ?? [] : []

  return (
    <div className="globe-stage relative h-[min(86vh,860px)] w-full">
      {/* ── The planet ── */}
      <div ref={stageRef} className="absolute inset-0">
        {size.w > 0 && polys.length > 0 && (
          /* The lazy WebGL component must sit behind its own Suspense
             boundary. Without one, every client-side navigation away from
             this page re-renders it inside React's transition, it suspends,
             and the transition never commits — the URL simply never changes
             and every link on the page looks dead. */
          <Suspense fallback={null}>
          <Globe
            ref={globeRef}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            /* Antialiasing is the single most expensive renderer option
               where rasterisation is done on the CPU, and the globe is all
               large flat fills — it buys very little here. */
            rendererConfig={{ antialias: false, powerPreference: "high-performance" }}
            /* With the country panel open the right third of the stage is
               covered — shift the planet left so the country you just opened
               isn't hiding behind its own card. */
            globeOffset={selected && size.w > 900 ? [-165, 0] : [0, 0]}
            showAtmosphere
            atmosphereColor="#ffc857"
            atmosphereAltitude={0.2}
            globeImageUrl={null}
            globeMaterial={seaMaterial}
            onGlobeReady={() => {
              setReady(true)
              // Open on the Atlantic — land on both sides, sun on the water.
              globeRef.current?.pointOfView({ lat: 22, lng: -22, altitude: 2.4 })
              // Relight it: a strong warm ambient so no hemisphere falls into
              // black, plus a low golden key from the upper right for shape.
              const ambient = new AmbientLight(0xfff1d6, 2.5)
              const key = new DirectionalLight(0xffd9a0, 1.5)
              key.position.set(1, 0.55, 0.9)
              const rim = new DirectionalLight(0x9fe6f0, 0.75)
              rim.position.set(-1, -0.3, -0.6)
              globeRef.current?.lights([ambient, key, rim])
            }}
            onZoom={(v: { lat: number; lng: number; altitude: number }) => {
              const snap = {
                lat: Math.round(v.lat / 4) * 4,
                lng: Math.round(v.lng / 4) * 4,
                altitude: Math.round(v.altitude * 20) / 20,
              }
              // Returning `prev` unchanged is what makes React bail out, so
              // a spinning globe produces no re-renders at all until the view
              // actually crosses into a new cell.
              setPov((prev) =>
                prev.lat === snap.lat && prev.lng === snap.lng && prev.altitude === snap.altitude
                  ? prev
                  : snap
              )
            }}
            polygonsData={polys}
            polygonAltitude={altOf}
            polygonCapColor={capColor}
            polygonSideColor={() => "rgba(11, 92, 114, 0.5)"}
            polygonStrokeColor={() => "rgba(255, 253, 246, 0.26)"}
            polygonLabel={polygonLabel}
            polygonsTransitionDuration={200}
            polygonCapCurvatureResolution={7}
            onPolygonHover={(p: object | null) => setHover(p as Poly | null)}
            onPolygonClick={(p: object) => {
              const c = byNumericId.get(String((p as Poly).id))
              if (c) openCountry(c)
            }}
            /* One city layer, and it's text. globe.gl's points layer draws
               extruded cylinders standing off the surface, which read as
               debris rather than as places — city names sitting flat on the
               map say the same thing and say it better. */
            htmlElementsData={pinCities}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.01}
            htmlElement={makePin}
            htmlElementVisibilityModifier={pinVisibility}
            htmlTransitionDuration={220}
          />
          </Suspense>
        )}
      </div>

      {/* ── Loading state ── */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center">
            <Compass className="spin-slow mx-auto text-[#ffc857]" size={30} />
            <p className="mt-3 text-[0.78rem] font-medium tracking-wide text-[#bfe6ef]">
              Bringing the world into view…
            </p>
          </div>
        </div>
      )}

      {/* ── Top-left: search ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 sm:p-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3">
          <div className="pointer-events-auto relative w-full max-w-[19rem]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8fb9c4]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a country or city…"
              aria-label="Search destinations"
              className="w-full rounded-[4px] border border-white/25 bg-[rgba(7,45,61,0.72)] py-2 pl-9 pr-8 text-[0.85rem] text-[#eaf7f8] outline-none backdrop-blur-md placeholder:text-[#7fa6b2] focus:border-[#ffc857]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8fb9c4] hover:text-white"
              >
                <X size={14} />
              </button>
            )}

            {results && (results.countries.length > 0 || results.cities.length > 0) && (
              <div className="globe-panel absolute left-0 right-0 top-[calc(100%+6px)] max-h-[52vh] overflow-y-auto p-1.5">
                {results.countries.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => {
                      openCountry(c)
                      setQuery("")
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-[3px] px-2.5 py-1.5 text-left text-[0.83rem] hover:bg-[rgba(15,155,171,0.12)]"
                  >
                    <span className="truncate font-medium text-[var(--navy)]">
                      {c.flag} {c.name}
                    </span>
                    <span
                      className="tnum shrink-0 rounded-[3px] px-1.5 py-0.5 text-[0.7rem] font-bold text-white"
                      style={{ background: tintSolid(c.score) }}
                    >
                      {c.score}
                    </span>
                  </button>
                ))}
                {results.cities.map((p) => (
                  <Link
                    key={p.path}
                    href={p.path}
                    className="flex items-center justify-between gap-2 rounded-[3px] px-2.5 py-1.5 text-[0.83rem] hover:bg-[rgba(15,155,171,0.12)]"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-[var(--navy)]">{p.city}</span>
                      <span className="ml-1.5 text-[0.72rem] text-[var(--ink-faint)]">{p.country}</span>
                    </span>
                    <span
                      className="tnum shrink-0 rounded-[3px] px-1.5 py-0.5 text-[0.7rem] font-bold text-white"
                      style={{ background: tintSolid(p.score) }}
                    >
                      {p.score}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Region filter */}
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                data-on={region === r}
                onClick={() => setRegion(r)}
                className="sea-chip"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom-left: legend + spin toggle ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div className="pointer-events-auto rounded-[4px] border border-white/16 bg-[rgba(7,45,61,0.66)] px-3.5 py-2.5 backdrop-blur-md">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#8fb9c4]">
              Safety score
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[0.72rem] text-[#dcf0f3]">
                  <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-[0.72rem] text-[#93b4bd]">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "rgba(233,214,178,0.5)" }} />
                not yet checked
              </span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSpinning((v) => !v)}
              className="sea-chip flex items-center gap-1.5"
              aria-pressed={spinning}
            >
              {spinning ? <Pause size={12} /> : <Play size={12} />}
              {spinning ? "Pause spin" : "Spin"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setSpinning(true)
                globeRef.current?.pointOfView({ lat: 22, lng: -22, altitude: 2.4 }, 900)
              }}
              className="sea-chip flex items-center gap-1.5"
            >
              <Maximize2 size={12} />
              Reset view
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: the country panel, opened by a click ── */}
      {selected && (
        <aside className="globe-panel absolute right-3 top-16 bottom-24 z-30 flex w-[min(21rem,calc(100%-1.5rem))] flex-col overflow-hidden sm:right-5 sm:top-[4.6rem]">
          <div className="relative shrink-0">
            <div className="postcard-art aspect-[3/2]">
              <PosterArt seed={selected.slug} />
            </div>
            <span
              className="score-stamp"
              style={{ "--stamp": tintSolid(selected.score) } as React.CSSProperties}
            >
              <span className="n">{selected.score}</span>
              <span className="cap">Safety</span>
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(7,45,61,0.7)] text-white backdrop-blur-sm hover:bg-[rgba(7,45,61,0.9)]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="shrink-0 px-4 pb-2 pt-3">
            <p className="postcard-greeting">Greetings from</p>
            <h2 className="font-display text-[1.4rem] font-medium leading-tight tracking-tight text-[var(--navy)]">
              {selected.flag} {selected.name}
            </h2>
            <p className="mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
              {selected.region} · {selected.reports} report{selected.reports === 1 ? "" : "s"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {selectedPoints.length > 0 ? (
              <ul className="border-t border-[var(--hairline)]">
                {selectedPoints.map((p) => (
                  <li
                    key={p.path}
                    className="flex items-center gap-1 border-b border-[var(--hairline)]"
                  >
                    <button
                      type="button"
                      onClick={() => flyTo(p.lat, p.lng, 0.45)}
                      title={`Find ${p.city} on the globe`}
                      aria-label={`Find ${p.city} on the globe`}
                      className="shrink-0 rounded-[3px] p-1 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(15,155,171,0.12)] hover:text-[var(--accent-deep)]"
                    >
                      <Crosshair size={13} />
                    </button>
                    <Link
                      href={p.path}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-[0.84rem] hover:text-[var(--accent-deep)]"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--ink)]">{p.city}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[0.68rem] text-[var(--ink-faint)]">{p.levelLabel}</span>
                        <span
                          className="tnum w-7 rounded-[3px] py-0.5 text-center text-[0.7rem] font-bold text-white"
                          style={{ background: tintSolid(p.score) }}
                        >
                          {p.score}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-[var(--hairline)] py-3 text-[0.8rem] text-[var(--ink-soft)]">
                A country-level report — no individual city reports yet.
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--hairline)] p-3">
            <Link
              href={`/${selected.slug}`}
              className="btn flex w-full items-center justify-center gap-1.5 py-2 text-[0.85rem]"
            >
              Open {selected.name} overview →
            </Link>
          </div>
        </aside>
      )}
    </div>
  )
}
