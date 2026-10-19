"use client"
import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, LayerGroup } from "leaflet"
import "leaflet/dist/leaflet.css"
import { VENUE_TYPES, type Venue, type VenueType } from "@/lib/nightlife/types"
const COLORS: Record<string, string> = { Nightclub: "#9375e6", "Live music": "#e4856b", Pub: "#6d9d91", "Cocktail bar": "#b8cf73" }
export function VenueMap({ venues, city, lat, lon }: { venues: Venue[]; city: string; lat: number; lon: number }) {
  const ref = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), layer = useRef<LayerGroup | null>(null)
  const [type, setType] = useState<VenueType | "All">("All"), [error, setError] = useState(false)
  const filtered = type === "All" ? venues : venues.filter(v => v.type === type)
  useEffect(() => {
    let disposed = false
    import("leaflet").then(mod => {
      if (disposed || !ref.current) return
      const L = mod.default ?? mod
      if (!map.current) {
        map.current = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lon], 13)
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map.current)
        layer.current = L.layerGroup().addTo(map.current)
        if (venues.length) map.current.fitBounds(L.latLngBounds(venues.map(v => [v.lat, v.lon] as [number, number])), { padding: [24, 24], maxZoom: 14 })
      }
      layer.current?.clearLayers()
      for (const v of filtered) {
        const content = document.createElement("div"), strong = document.createElement("strong"), small = document.createElement("p"), a = document.createElement("a")
        strong.textContent = v.name; small.textContent = `${v.type}${v.neighborhood ? ` · ${v.neighborhood}` : ""}`
        a.textContent = "View source ↗"; a.href = v.sources[0].url; a.target = "_blank"; a.rel = "noopener noreferrer"
        content.append(strong, small, a)
        L.circleMarker([v.lat, v.lon], { radius: 6, color: "#fff", weight: 1.5, fillColor: COLORS[v.type] ?? "#b99860", fillOpacity: 0.9 }).bindPopup(content).addTo(layer.current!)
      }
    }).catch(() => setError(true))
    return () => { disposed = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, venues, city, lat, lon])
  useEffect(() => () => { map.current?.remove(); map.current = null; layer.current = null }, [])
  return <div>
    <div className="nl-map-toolbar"><label htmlFor="nightlife-map-filter">Explore by type</label><select id="nightlife-map-filter" value={type} onChange={e => setType(e.target.value as VenueType | "All")}><option>All</option>{VENUE_TYPES.filter(t => venues.some(v => v.type === t)).map(t => <option key={t}>{t}</option>)}</select><span>{filtered.length} venues</span></div>
    {error ? <p className="nl-empty">The interactive map could not load. All venue locations remain available in the list below.</p> : <div ref={ref} className="nl-map" role="region" aria-label={`${city} nightlife venue map`} />}
    <details className="nl-map-list"><summary>Browse {filtered.length} mapped venues as a list</summary><ul>{filtered.map(v => <li key={v.id}><a href={v.sources[0].url} target="_blank" rel="noopener noreferrer">{v.name} ↗</a><span>{v.type}{v.neighborhood ? ` · ${v.neighborhood}` : ""}</span></li>)}</ul></details>
  </div>
}
