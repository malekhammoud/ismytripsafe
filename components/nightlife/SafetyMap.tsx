"use client"
import dynamic from "next/dynamic"
import type { SafetyInput } from "@/lib/nightlife/types"
const CityMap = dynamic(() => import("@/components/map/CityMap").then(m => m.CityMap), { ssr: false, loading: () => <p className="nl-empty">Loading neighborhood map…</p> })
export function SafetyMap({ safety, city, lat, lon }: { safety: SafetyInput; city: string; lat: number; lon: number }) {
  const zones = safety.zones.flatMap(z => z.lat != null && z.lon != null ? [{ ...z, lat: z.lat, lon: z.lon }] : [])
  if (!zones.length) return null
  return <div className="nl-safety-map"><CityMap center={[lat, lon]} city={city} zones={zones} /></div>
}
