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

// ─── Public API ──────────────────────────────────────────────────────

export interface EnvironmentResult {
  signals: SafetySignal[]
  health: HealthNotice[]
}

/** Air-quality + CDC health signals for a place, fetched in parallel. */
export async function getEnvironment(geo: GeoPoint): Promise<EnvironmentResult> {
  const [air, health] = await Promise.all([
    fetchAirQuality(geo),
    fetchHealthNotices(geo),
  ])
  return {
    signals: [airQualitySignal(air), healthSignal(health)],
    health,
  }
}
