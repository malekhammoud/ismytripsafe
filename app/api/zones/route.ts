import type { ZoneLevel } from "@/lib/types"

export const maxDuration = 60

interface ZoneInput {
  name: string
  level: ZoneLevel
  note: string
}

interface ZoneResult extends ZoneInput {
  lat: number | null
  lon: number | null
  geojson: unknown | null // OSM boundary polygon when available, else null
}

/**
 * Resolve each district to its real location AND, where OpenStreetMap has one,
 * its actual boundary polygon (via Nominatim `polygon_geojson`). This makes the
 * map zones accurate shapes rather than guessed circles. Sequential + throttled
 * to respect Nominatim's usage policy.
 */
export async function POST(request: Request) {
  let city = ""
  let country = ""
  let zones: ZoneInput[] = []
  try {
    const body = await request.json()
    city = String(body?.city ?? "")
    country = String(body?.country ?? "")
    if (Array.isArray(body?.zones)) zones = body.zones
  } catch {
    /* ignore */
  }

  const results: ZoneResult[] = []
  for (const z of zones.slice(0, 12)) {
    if (!z?.name) continue
    const q = [z.name, city, country].filter(Boolean).join(", ")
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
      `&format=jsonv2&limit=1&polygon_geojson=1&addressdetails=0&accept-language=en`

    let lat: number | null = null
    let lon: number | null = null
    let geojson: unknown | null = null
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "IsMyTripSafe/1.0 (travel safety map)" },
      })
      if (res.ok) {
        const data = (await res.json()) as Array<{
          lat?: string
          lon?: string
          geojson?: { type?: string }
        }>
        const r = data?.[0]
        if (r) {
          lat = r.lat != null ? parseFloat(r.lat) : null
          lon = r.lon != null ? parseFloat(r.lon) : null
          // Keep only real area shapes; ignore points/lines → circle fallback.
          const t = r.geojson?.type
          if (t === "Polygon" || t === "MultiPolygon") {
            const size = JSON.stringify(r.geojson).length
            if (size < 200_000) geojson = r.geojson // guard against huge admin areas
          }
        }
      }
    } catch {
      /* leave nulls → client falls back to a circle */
    }

    results.push({ ...z, lat, lon, geojson })
    await new Promise((r) => setTimeout(r, 300))
  }

  return Response.json({ results })
}
