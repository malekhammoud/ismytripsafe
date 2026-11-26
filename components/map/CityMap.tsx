"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LMap, FeatureGroup, PathOptions } from "leaflet"
import type { ZoneLevel } from "@/lib/types"

export interface MapZonePoint {
  lat: number
  lon: number
  name: string
  level: ZoneLevel
  note: string
  geojson?: unknown | null // real OSM boundary polygon, when available
}

const ZONE_COLOR: Record<ZoneLevel, string> = {
  safe: "#2f9e6f",
  caution: "#e0a13b",
  avoid: "#d4503a",
}

type ZoneShape = { name: string; update: (active: boolean) => void }

function zoneStyle(color: string, active: boolean): PathOptions {
  return { color, weight: active ? 3 : 1.6, fillColor: color, fillOpacity: active ? 0.4 : 0.2 }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  )
}

/**
 * A clean OpenStreetMap map (CartoDB Voyager basemap — light, readable street
 * labels) centred on the destination, overlaying the AI-rated districts as
 * colour-coded zones: green (safe), yellow (caution), red (avoid). Real OSM
 * boundary polygons are used where available, otherwise a small circle.
 * Clicking a zone reports it via onSelect. Scroll to zoom. Browser-only.
 */
export function CityMap({
  center,
  zoom = 12,
  city,
  zones,
  selected,
  onSelect,
}: {
  center: [number, number]
  zoom?: number
  city: string
  zones: MapZonePoint[]
  selected?: string | null
  onSelect?: (zone: MapZonePoint) => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LMap | null>(null)
  const layerRef = useRef<FeatureGroup | null>(null)
  const shapesRef = useRef<ZoneShape[]>([])
  const fittedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef(selected)
  onSelectRef.current = onSelect
  selectedRef.current = selected

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import("leaflet")
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod
      if (cancelled || !elRef.current) return

      if (!mapRef.current) {
        const map = L.map(elRef.current, {
          scrollWheelZoom: true, // zoom with the scroll wheel
          zoomControl: true,
        }).setView(center, zoom)
        // The `?key=` is a CARTO basemaps API key (public by design — basemap keys
// are meant to travel client-side). Without it CARTO overlays a "API key
// required" watermark on every tile.
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2zli_1_c8f7ed3b3b8b2b3347917aa6",
          {
            subdomains: "abcd",
            maxZoom: 20,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          }
        ).addTo(map)
        layerRef.current = L.featureGroup().addTo(map)
        mapRef.current = map
      }

      const map = mapRef.current
      const layer = layerRef.current
      if (!map || !layer) return
      layer.clearLayers()
      shapesRef.current = []

      // City centre marker
      L.circleMarker(center, {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#1f74cf",
        fillOpacity: 1,
      })
        .bindTooltip(city, { direction: "top" })
        .addTo(layer)

      // Zones — real polygon where we have one, else a small circle.
      for (const z of zones) {
        const color = ZONE_COLOR[z.level]
        const style = zoneStyle(color, selectedRef.current === z.name)
        const popup = `<strong>${escapeHtml(z.name)}</strong><br/>${escapeHtml(z.note)}`
        let shape
        if (z.geojson) {
          shape = L.geoJSON(z.geojson as GeoJSON.GeoJsonObject, { style })
        } else {
          shape = L.circle([z.lat, z.lon], { radius: 500, ...style })
        }
        shape.bindPopup(popup)
        shape.on("click", () => onSelectRef.current?.(z))
        shape.addTo(layer)
        shapesRef.current.push({
          name: z.name,
          update: (active) => shape.setStyle(zoneStyle(color, active)),
        })
      }

      // Frame everything once, the first time zones load.
      if (!fittedRef.current && zones.length) {
        try {
          map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 14 })
          fittedRef.current = true
        } catch {
          /* bounds not ready */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [center, zoom, city, zones])

  // Selection only restyles the existing zones; rebuilding every shape on each
  // click caused needless Leaflet work and resize churn.
  useEffect(() => {
    for (const { name, update } of shapesRef.current) update(selected === name)
  }, [selected])

  // Recalculate Leaflet's size when the grid cell changes, but defer the work
  // out of the observer callback so its notifications cannot loop.
  useEffect(() => {
    const el = elRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => mapRef.current?.invalidateSize())
    })
    observer.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useEffect(
    () => () => {
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    },
    []
  )

  return <div ref={elRef} className="h-full w-full" style={{ minHeight: 460 }} />
}
