"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LMap, LayerGroup } from "leaflet"
import type { ZoneLevel } from "@/lib/types"

export interface MapZonePoint {
  lat: number
  lon: number
  name: string
  level: ZoneLevel
  note: string
}

const ZONE_COLOR: Record<ZoneLevel, string> = {
  safe: "#2f9e6f",
  caution: "#e0a13b",
  avoid: "#d4503a",
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  )
}

/**
 * A real OpenStreetMap map (Leaflet) centred on the destination, overlaying the
 * AI-rated districts as colour-coded zones — green (safe), yellow (caution),
 * red (avoid). Clicking a zone reports it back via onSelect so the side panel
 * can show its detail. Leaflet is loaded in the browser only.
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
  const layerRef = useRef<LayerGroup | null>(null)
  const fittedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import("leaflet")
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod
      if (cancelled || !elRef.current) return

      if (!mapRef.current) {
        const map = L.map(elRef.current, { scrollWheelZoom: false }).setView(center, zoom)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map)
        layerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 150)
      }

      const map = mapRef.current
      const layer = layerRef.current
      if (!map || !layer) return
      layer.clearLayers()

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

      // Coloured zone blobs
      for (const z of zones) {
        const active = selected === z.name
        const color = ZONE_COLOR[z.level]
        const circle = L.circle([z.lat, z.lon], {
          radius: 850,
          color,
          weight: active ? 3.5 : 1.8,
          fillColor: color,
          fillOpacity: active ? 0.42 : 0.22,
        })
        circle.bindPopup(`<strong>${escapeHtml(z.name)}</strong><br/>${escapeHtml(z.note)}`)
        circle.on("click", () => onSelectRef.current?.(z))
        circle.addTo(layer)
      }

      // Frame all zones once, the first time they load.
      if (!fittedRef.current && zones.length) {
        const pts: [number, number][] = [center, ...zones.map((z) => [z.lat, z.lon] as [number, number])]
        map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 })
        fittedRef.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [center, zoom, city, zones, selected])

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
