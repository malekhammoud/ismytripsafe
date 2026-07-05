import type { GeoPoint, SafetySignal, HealthNotice } from "../types"
import { countryMatchNames } from "./country"

// ─────────────────────────────────────────────────────────────────────
// Environmental & health hazards, pulled directly from source feeds:
//   • Air quality — Open-Meteo Air Quality API (live US AQI + PM2.5).
//   • Health notices — CDC Travelers' Health notices RSS (disease
//     outbreaks & health warnings, Level 1–3), matched to the country.
// Both are free, key-less, and require no AI.
// ─────────────────────────────────────────────────────────────────────

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

function bandLowerBetter(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (value >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    if (value <= x2) {
      const t = (value - x1) / (x2 - x1)
      return clamp(y1 + t * (y2 - y1))
    }
  }
  return last[1]
}

async function fetchText(url: string, timeoutMs: number, ua?: string) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": ua ?? "TravelAI/1.0 (travel safety research)" },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// ─── Air quality (Open-Meteo) ────────────────────────────────────────

function aqiCategory(aqi: number): string {
  if (aqi <= 50) return "Good"
  if (aqi <= 100) return "Moderate"
  if (aqi <= 150) return "Unhealthy for sensitive groups"
  if (aqi <= 200) return "Unhealthy"
  if (aqi <= 300) return "Very unhealthy"
  return "Hazardous"
}

async function fetchAirQuality(
  geo: GeoPoint
): Promise<{ aqi: number; pm25: number | null } | null> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${geo.lat}&longitude=${geo.lon}&current=us_aqi,pm2_5`
  const raw = await fetchText(url, 7000)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as {
      current?: { us_aqi?: number; pm2_5?: number }
    }
    const aqi = data.current?.us_aqi
    if (typeof aqi !== "number") return null
    return { aqi, pm25: data.current?.pm2_5 ?? null }
  } catch {
    return null
  }
}

function airQualitySignal(
  air: { aqi: number; pm25: number | null } | null
): SafetySignal {
  const score = air
    ? Math.round(
        bandLowerBetter(air.aqi, [
          [0, 98],
          [50, 90],
          [100, 66],
          [150, 44],
          [200, 24],
          [300, 8],
          [500, 2],
        ])
      )
    : null
  return {
    key: "air_quality",
    label: "Air quality",
    group: "Health & environment",
    source: "Open-Meteo Air Quality",
    value: air?.aqi ?? null,
    display: air ? `US AQI ${air.aqi} · ${aqiCategory(air.aqi)}` : "No data",
    year: null,
    score,
    lowerIsBetter: true,
    note: "Live US Air Quality Index (0 = clean, 300+ = hazardous). High values raise respiratory and cardiovascular risk — relevant for asthma, children and older travellers.",
  }
}

// ─── CDC Travelers' Health notices ───────────────────────────────────

const CDC_RSS = "https://wwwnc.cdc.gov/travel/rss/notices.xml"

const CDC_LEVEL_LABEL: Record<number, string> = {
  1: "Watch",
  2: "Alert",
  3: "Warning",
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseCdcItems(xml: string) {
  const items: { title: string; description: string; link: string; pubDate: string }[] =
    []
  for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const tag = (n: string) => {
      const m = block.match(new RegExp(`<${n}>([\\s\\S]*?)<\\/${n}>`, "i"))
      if (!m) return ""
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
    }
    items.push({
      title: stripHtml(tag("title")),
      description: stripHtml(tag("description")),
      link: tag("link"),
      pubDate: tag("pubDate"),
    })
  }
  return items
}

async function fetchHealthNotices(geo: GeoPoint): Promise<HealthNotice[]> {
  const xml = await fetchText(CDC_RSS, 8000, "Mozilla/5.0 (TravelAI safety research)")
  if (!xml) return []

  const names = countryMatchNames(geo.countryCode).map((n) => n.toLowerCase())
  const out: HealthNotice[] = []

  for (const item of parseCdcItems(xml)) {
    const m = item.title.match(/Level\s*(\d)\s*-\s*(.*)$/i)
    if (!m) continue
    const level = Number(m[1])
    const title = m[2].trim()
    // A "Global"/"Worldwide" notice is always global scope, even if its
    // description happens to name the country. Otherwise, match the country
    // in the title or description.
    const isGlobal = /\bglobal\b|\bworldwide\b/i.test(item.title)
    const haystack = `${item.title} ${item.description}`.toLowerCase()
    const matchesCountry = !isGlobal && names.some((n) => haystack.includes(n))

    if (!isGlobal && !matchesCountry) continue

    out.push({
      level,
      levelLabel: CDC_LEVEL_LABEL[level] ?? `Level ${level}`,
      title,
      description: item.description,
      url: item.link,
      updated: item.pubDate || null,
      scope: matchesCountry ? "country" : "global",
    })
  }

  // Country-specific first, then by severity.
  out.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "country" ? -1 : 1
    return b.level - a.level
  })
  return out
}

function healthSignal(notices: HealthNotice[]): SafetySignal {
  const country = notices.filter((n) => n.scope === "country")
  const maxCountry = country.reduce((m, n) => Math.max(m, n.level), 0)
  const total = notices.length

  let score: number
  if (maxCountry >= 3) score = 35
  else if (maxCountry === 2) score = 60
  else if (maxCountry === 1) score = 84
  else score = total > 0 ? 92 : 100 // global-only notices are informational

  let display: string
  if (total === 0) display = "No active notices"
  else if (country.length > 0)
    display = `${country.length} notice${country.length > 1 ? "s" : ""} · max ${CDC_LEVEL_LABEL[maxCountry]}`
  else display = `${total} global notice${total > 1 ? "s" : ""}`

  return {
    key: "health",
    label: "Travel health notices",
    group: "Health & environment",
    source: "CDC Travelers' Health",
    value: maxCountry || null,
    display,
    year: null,
    score,
    lowerIsBetter: true,
    note: "Active CDC health notices for this destination — disease outbreaks, special events or conditions affecting travellers' health (Level 1 Watch → Level 3 Warning).",
  }
}

// ─── Nearby hospitals (OpenStreetMap / Overpass) ─────────────────────

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

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

/** Count hospitals within ~15 km of the destination and the nearest distance. */
async function fetchHospitals(
  geo: GeoPoint
): Promise<{ count: number; nearestKm: number | null } | null> {
  const q =
    `[out:json][timeout:12];(` +
    `node["amenity"="hospital"](around:15000,${geo.lat},${geo.lon});` +
    `way["amenity"="hospital"](around:15000,${geo.lat},${geo.lon});` +
    `relation["amenity"="hospital"](around:15000,${geo.lat},${geo.lon});` +
    `);out center 80;`
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const raw = await fetchText(`${endpoint}?data=${encodeURIComponent(q)}`, 12000)
    if (!raw) continue
    try {
      const data = JSON.parse(raw) as {
        elements?: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number } }>
      }
      const els = data.elements ?? []
      let nearest = Infinity
      for (const e of els) {
        const lat = e.lat ?? e.center?.lat
        const lon = e.lon ?? e.center?.lon
        if (lat == null || lon == null) continue
        nearest = Math.min(nearest, haversineKm(geo.lat, geo.lon, lat, lon))
      }
      return {
        count: els.length,
        nearestKm: Number.isFinite(nearest) ? Math.round(nearest * 10) / 10 : null,
      }
    } catch {
      /* try next endpoint */
    }
  }
  return null
}

function hospitalsSignal(
  h: { count: number; nearestKm: number | null } | null
): SafetySignal {
  const score =
    h == null
      ? null
      : h.count === 0
        ? 22
        : h.count === 1
          ? 52
          : h.count <= 2
            ? 66
            : h.count <= 4
              ? 78
              : h.count <= 9
                ? 88
                : 95
  const display =
    h == null
      ? "No data"
      : h.count === 0
        ? "None mapped within 15 km"
        : `${h.count} within 15 km${h.nearestKm != null ? ` · nearest ~${h.nearestKm} km` : ""}`
  return {
    key: "hospitals",
    label: "Hospitals nearby",
    group: "Health & environment",
    source: "OpenStreetMap",
    value: h?.count ?? null,
    display,
    year: null,
    score,
    lowerIsBetter: false,
    note: "Hospitals mapped within 15 km of the destination — a proxy for how quickly you can reach emergency care if something goes wrong.",
  }
}

// ─── Seasonal / extreme weather (Open-Meteo forecast) ─────────────────

function fmtTemp(c: number): string {
  return `${Math.round(c)}°C`
}

async function fetchWeather(geo: GeoPoint): Promise<{
  heatMax: number
  coldMin: number
  precipTotal: number
  gustMax: number
} | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max` +
    `&forecast_days=16&timezone=auto`
  const raw = await fetchText(url, 7000)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as {
      daily?: {
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_sum?: number[]
        wind_gusts_10m_max?: number[]
      }
    }
    const d = data.daily
    if (!d?.temperature_2m_max?.length) return null
    const max = (a?: number[]) => (a?.length ? Math.max(...a.filter((n) => n != null)) : 0)
    const min = (a?: number[]) => (a?.length ? Math.min(...a.filter((n) => n != null)) : 0)
    const sum = (a?: number[]) => (a?.length ? a.reduce((x, y) => x + (y ?? 0), 0) : 0)
    return {
      heatMax: max(d.temperature_2m_max),
      coldMin: min(d.temperature_2m_min),
      precipTotal: sum(d.precipitation_sum),
      gustMax: max(d.wind_gusts_10m_max),
    }
  } catch {
    return null
  }
}

function weatherSignal(
  w: { heatMax: number; coldMin: number; precipTotal: number; gustMax: number } | null
): SafetySignal {
  const month = new Date().toLocaleString("en-US", { month: "long" })
  if (w == null) {
    return {
      key: "weather",
      label: "Extreme weather",
      group: "Everyday hazards",
      source: "Open-Meteo",
      value: null,
      display: "No data",
      year: null,
      score: null,
      lowerIsBetter: false,
      note: "Seasonal extreme-weather outlook for the weeks ahead (heat, cold, storms, high wind).",
    }
  }

  let score = 100
  const hazards: string[] = []
  if (w.heatMax >= 42) { score -= 55; hazards.push("dangerous heat") }
  else if (w.heatMax >= 38) { score -= 38; hazards.push("extreme heat") }
  else if (w.heatMax >= 34) { score -= 20; hazards.push("high heat") }
  if (w.coldMin <= -20) { score -= 50; hazards.push("severe cold") }
  else if (w.coldMin <= -12) { score -= 32; hazards.push("hard freeze") }
  else if (w.coldMin <= -5) { score -= 16; hazards.push("freezing temps") }
  if (w.gustMax >= 90) { score -= 30; hazards.push("damaging winds") }
  else if (w.gustMax >= 70) { score -= 18; hazards.push("strong winds") }
  if (w.precipTotal >= 120) { score -= 18; hazards.push("heavy rain / flooding") }
  else if (w.precipTotal >= 60) { score -= 8; hazards.push("wet spell") }

  score = clamp(score)
  const cond = hazards.length ? hazards.slice(0, 2).join(", ") : "no weather extremes"
  return {
    key: "weather",
    label: "Extreme weather",
    group: "Everyday hazards",
    source: "Open-Meteo",
    value: Math.round(w.heatMax),
    display: `${month}: highs ~${fmtTemp(w.heatMax)} · ${cond}`,
    year: null,
    score: Math.round(score),
    lowerIsBetter: false,
    note: "Seasonal extreme-weather outlook for the weeks ahead — peak heat/cold, heavy rain and wind gusts near your destination.",
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export interface EnvironmentResult {
  signals: SafetySignal[]
  health: HealthNotice[]
}

/** Air-quality + CDC health + hospitals + weather signals, fetched in parallel. */
export async function getEnvironment(geo: GeoPoint): Promise<EnvironmentResult> {
  const [air, health, hospitals, weather] = await Promise.all([
    fetchAirQuality(geo),
    fetchHealthNotices(geo),
    fetchHospitals(geo),
    fetchWeather(geo),
  ])
  return {
    signals: [
      airQualitySignal(air),
      healthSignal(health),
      hospitalsSignal(hospitals),
      weatherSignal(weather),
    ],
    health,
  }
}
