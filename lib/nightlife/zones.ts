import { promises as fs } from "node:fs"
import path from "node:path"
import { fetchJson } from "./sources"
import { NIGHTLIFE_DIR, safeKey, writeJson } from "./store"
import { distance } from "./venues"
import type { City, SafetyInput } from "./types"
export async function resolveSafetyZones(city: City, safety: SafetyInput): Promise<SafetyInput> {
  const file = path.join(NIGHTLIFE_DIR, "raw", safeKey(city.key), "zones.json")
  const signature = JSON.stringify(safety.zones.map(z => z.name))
  try {
    const old = JSON.parse(await fs.readFile(file, "utf8"))
    if (old.signature === signature && Date.now() - Date.parse(old.fetchedAt) < 30 * 86400000) return { ...safety, zones: safety.zones.map(z => ({ ...z, ...old.locations[z.name] })) }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e }
  const locations: Record<string, { lat: number; lon: number; geojson?: unknown }> = {}
  const endpoint = process.env.NIGHTLIFE_NOMINATIM_URL
  if (!endpoint) return safety // Scheduled bulk geocoding needs a configured provider.
  for (const zone of safety.zones.slice(0, 12)) {
    const query = new URLSearchParams({ q: `${zone.name}, ${city.city}, ${city.country}`, format: "jsonv2", limit: "1", countrycodes: city.countryCode.toLowerCase(), polygon_geojson: "1" })
    try {
      const results = await fetchJson<{ lat: string; lon: string; geojson?: { type: string } }[]>(`${endpoint}?${query}`)
      const r = results[0], lat = Number(r?.lat), lon = Number(r?.lon)
      if (Number.isFinite(lat) && Number.isFinite(lon) && distance(city, { lat, lon }) < 30000) {
        const polygon = r.geojson && ["Polygon", "MultiPolygon"].includes(r.geojson.type) && JSON.stringify(r.geojson).length < 200000 ? r.geojson : undefined
        locations[zone.name] = { lat, lon, geojson: polygon }
      }
    } catch { /* No guessed locations. A failed lookup leaves a text-only district. */ }
    await new Promise(resolve => setTimeout(resolve, endpoint.includes("nominatim.openstreetmap.org") ? 15500 : 1100))
  }
  await writeJson(file, { signature, fetchedAt: new Date().toISOString(), locations })
  return { ...safety, zones: safety.zones.map(z => ({ ...z, ...locations[z.name] })) }
}
