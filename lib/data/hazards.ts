import type { GeoPoint, SafetySignal, HazardEvent } from "../types"

// ─────────────────────────────────────────────────────────────────────
// Natural-hazard exposure, pulled directly from source feeds:
//   • GDACS (EU/UN Global Disaster Alert & Coordination System) — live
//     alerts for earthquakes, cyclones, floods, volcanoes, wildfires,
//     droughts, with coordinates and Green/Orange/Red severity.
//   • USGS Earthquake Catalog — significant quakes near the destination
//     over the past year (seismic-exposure history).
// Both are free, key-less, and require no AI.
// ─────────────────────────────────────────────────────────────────────

const NEARBY_KM = 500 // a GDACS alert within this radius counts as "nearby"
const QUAKE_RADIUS_KM = 300

export type { HazardEvent }

export interface HazardsResult {
  signal: SafetySignal
  /** Active nearby GDACS alerts — also fed to the research agent as context. */
  events: HazardEvent[]
  /** One-line seismic history summary (USGS), e.g. "3 quakes ≥M4.5 within 300 km in the past year". */
  quakeSummary: string | null
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TravelAI/1.0 (travel safety research)" },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// ─── GDACS live alerts ───────────────────────────────────────────────

const GDACS_RSS = "https://www.gdacs.org/xml/rss.xml"

const GDACS_KIND: Record<string, string> = {
  EQ: "Earthquake",
  TC: "Tropical cyclone",
  FL: "Flood",
  VO: "Volcano",
  WF: "Wildfire",
  DR: "Drought",
  TS: "Tsunami",
}

function tagValue(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))
  if (!m) return ""
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
}

async function fetchGdacs(geo: GeoPoint): Promise<HazardEvent[]> {
  const xml = await fetchText(GDACS_RSS, 9000)
  if (!xml) return []

  const out: HazardEvent[] = []
  for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const lat = Number(tagValue(block, "geo:lat"))
    const lon = Number(tagValue(block, "geo:long"))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const distanceKm = haversineKm(geo.lat, geo.lon, lat, lon)
    if (distanceKm > NEARBY_KM) continue

    const title = tagValue(block, "title")
    const level = /^red/i.test(title) ? "red" : /^orange/i.test(title) ? "orange" : "green"
    const subject = tagValue(block, "dc:subject") // e.g. "EQ1"
    const kind = GDACS_KIND[subject.slice(0, 2).toUpperCase()] ?? "Disaster alert"

    out.push({
      kind,
      severity: level,
      title: title.replace(/^(green|orange|red)\s+/i, ""),
      distanceKm: Math.round(distanceKm),
      url: tagValue(block, "link"),
      date: tagValue(block, "gdacs:fromdate") || null,
    })
  }
  // Most severe first, then nearest.
  const rank = { red: 0, orange: 1, green: 2 }
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.distanceKm - b.distanceKm)
  return out
}

// ─── USGS seismic history ────────────────────────────────────────────

async function fetchQuakes(
  geo: GeoPoint
): Promise<{ count: number; maxMag: number | null } | null> {
  const start = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const url =
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
    `&latitude=${geo.lat}&longitude=${geo.lon}&maxradiuskm=${QUAKE_RADIUS_KM}` +
    `&minmagnitude=4.5&starttime=${start}&orderby=magnitude&limit=50`
  const raw = await fetchText(url, 9000)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as {
      features?: Array<{ properties?: { mag?: number } }>
    }
    if (!Array.isArray(data.features)) return null
    const mags = data.features
      .map((f) => f.properties?.mag)
      .filter((m): m is number => typeof m === "number")
    return { count: data.features.length, maxMag: mags.length ? Math.max(...mags) : null }
  } catch {
    return null
  }
}

// ─── Signal assembly ─────────────────────────────────────────────────

export async function getHazards(geo: GeoPoint): Promise<HazardsResult> {
  const [events, quakes] = await Promise.all([fetchGdacs(geo), fetchQuakes(geo)])

  // Score: start clean, subtract for live alerts (by severity & proximity)
  // and for a heavy seismic year nearby.
  let score = 100
  for (const e of events) {
    const near = e.distanceKm <= 150 ? 1 : 0.55 // closer alerts weigh more
    if (e.severity === "red") score -= 55 * near
    else if (e.severity === "orange") score -= 28 * near
    else score -= 7 * near
  }
  if (quakes && quakes.count > 0) {
    if ((quakes.maxMag ?? 0) >= 6.5) score -= 25
    else if ((quakes.maxMag ?? 0) >= 5.5) score -= 14
    else score -= 6
    if (quakes.count >= 10) score -= 10
  }
  score = Math.round(clamp(score))

  const quakeSummary =
    quakes && quakes.count > 0
      ? `${quakes.count} earthquake${quakes.count > 1 ? "s" : ""} ≥M4.5 within ${QUAKE_RADIUS_KM} km in the past year${quakes.maxMag ? ` (strongest M${quakes.maxMag.toFixed(1)})` : ""}`
      : quakes
        ? `No earthquakes ≥M4.5 within ${QUAKE_RADIUS_KM} km in the past year`
        : null

  let display: string
  if (events.length) {
    const worst = events[0]
    display = `${events.length} active alert${events.length > 1 ? "s" : ""} · ${worst.kind} (${worst.severity})`
  } else if (quakes && quakes.count > 0) {
    display = `No active alerts · ${quakes.count} quake${quakes.count > 1 ? "s" : ""} ≥M4.5 past yr`
  } else if (quakes) {
    display = "No active alerts · low seismicity"
  } else {
    display = "No active alerts"
  }

  const signal: SafetySignal = {
    key: "natural_hazards",
    label: "Natural hazards",
    group: "Everyday hazards",
    source: "GDACS / USGS",
    value: events.length,
    display,
    year: null,
    score,
    lowerIsBetter: true,
    note: "Live disaster alerts within 500 km (GDACS — earthquakes, cyclones, floods, volcanoes, wildfires) plus the past year of significant earthquakes within 300 km (USGS).",
  }

  return { signal, events, quakeSummary }
}
