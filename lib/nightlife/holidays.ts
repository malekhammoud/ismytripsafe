import { fetchJson } from "./http"
import { cached } from "./sources"
import { SourceHttpError, SourceUnavailable } from "./source-errors"
import type { City, PublicHoliday } from "./types"

// Nationwide public holidays are a small but useful planning input: a national
// holiday can make a night busier, close venues, or change transport. We use
// only country-wide rows because the nightlife report has no county-level
// match for subnational holidays.
const VERSION = "holidays-v1"
const CACHE_DAYS = 30
const WINDOW_DAYS = 120
const MAX_HOLIDAYS = 8
const DAY = 86400000

interface HolidayRow {
  date?: unknown
  name?: unknown
  localName?: unknown
  global?: unknown
}

export function upcomingHolidays(rows: HolidayRow[], now = Date.now(), days = WINDOW_DAYS): PublicHoliday[] {
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  const start = today.getTime(), end = now + days * DAY
  const seen = new Set<string>()
  return rows.flatMap(row => {
    if (row.global !== true || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return []
    if (typeof row.name !== "string" || !row.name.trim()) return []
    const at = Date.parse(`${row.date}T00:00:00Z`)
    if (!Number.isFinite(at) || at < start || at > end) return []
    const name = row.name.trim().slice(0, 120)
    const key = `${row.date}|${name}`
    if (seen.has(key)) return []
    seen.add(key)
    const localName = typeof row.localName === "string" && row.localName.trim() && row.localName.trim() !== name
      ? row.localName.trim().slice(0, 120)
      : undefined
    return [{ date: row.date, name, ...(localName ? { localName } : {}) }]
  }).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)).slice(0, MAX_HOLIDAYS)
}

export async function fetchHolidays(city: City, force = false) {
  if (!/^[A-Za-z]{2}$/.test(city.countryCode)) throw new SourceUnavailable("A two-letter country code is needed for public-holiday data.")
  const country = city.countryCode.toUpperCase(), year = new Date().getUTCFullYear()
  const result = await cached(city.key, "holidays", CACHE_DAYS, async () => {
    const years = [year, year + 1]
    const settled = await Promise.allSettled(years.map(async y => {
      try {
        return await fetchJson<HolidayRow[]>(
          `https://date.nager.at/api/v3/PublicHolidays/${y}/${encodeURIComponent(country)}`,
          {},
          { timeoutMs: 10000, operation: "Nager.Date public holidays" },
        )
      } catch (error) {
        if (error instanceof SourceHttpError && [400, 404].includes(error.status)) {
          throw new SourceUnavailable(`Nager.Date has no public-holiday coverage for ${country} in ${y}.`)
        }
        throw error
      }
    }))
    const rows: HolidayRow[] = []
    for (const item of settled) {
      if (item.status === "fulfilled") rows.push(...item.value)
      else if (!(item.reason instanceof SourceUnavailable)) throw item.reason
    }
    // A missing next-year list must not discard a successful current-year list.
    if (!rows.length && settled.every(item => item.status === "rejected")) {
      throw new SourceUnavailable(`Nager.Date has no public-holiday coverage for ${country}.`)
    }
    return { rows }
  }, force, `holidays-${VERSION}:${country}:${year}`)
  const holidays = upcomingHolidays(result.data.rows)
  return {
    holidays,
    source: {
      ...result.source,
      note: holidays.length
        ? `${holidays.length} nationwide public holidays in the next ${WINDOW_DAYS} days. Local and county holidays are excluded because the report has no county-level match.`
        : `No nationwide public holidays in the next ${WINDOW_DAYS} days. Local and county holidays are excluded.`,
    },
  }
}
