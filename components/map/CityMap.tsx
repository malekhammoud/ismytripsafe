"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LMap, LayerGroup } from "leaflet"

export interface MapMarker {
  lat: number
  lon: number
  label: string
  kind: "safe" | "avoid" | "city"
}

const COLORS: Record<MapMarker["kind"], string> = {
  safe: "#2f9e6f",
  avoid: "#d4503a",
  city: "#1f74cf",
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  )
}

/**
 * A real OpenStreetMap map (Leaflet) centred on the destination, with coloured
 * markers for the city and the AI-named safe / avoid areas. Leaflet is loaded
 * imperatively in the browser only, and markers are circle markers so there are
 * no image assets to configure.
 */
export function CityMap({
  center,
  zoom = 12,
  markers,
}: {
  center: [number, number]
  zoom?: number
  markers: MapMarker[]
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)

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

      const layer = layerRef.current
      if (!layer) return
      layer.clearLayers()
      for (const m of markers) {
        const cm = L.circleMarker([m.lat, m.lon], {
          radius: m.kind === "city" ? 9 : 7,
          color: "#ffffff",
          weight: 2,
          fillColor: COLORS[m.kind],
          fillOpacity: 0.95,
        })
        cm.bindPopup(`<strong>${escapeHtml(m.label)}</strong>`)
        cm.addTo(layer)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [center, zoom, markers])

  // Tear the map down on unmount.
  useEffect(
    () => () => {
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    },
    []
  )

  return <div ref={elRef} className="h-full w-full" style={{ minHeight: 440 }} />
}
