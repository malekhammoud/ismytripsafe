import { createRequire } from "node:module"
import type { City, Lateness, Venue } from "./types"
interface Hours { getState(d: Date): boolean; getUnknown(d: Date): boolean }
type Parser = new (hours: string, location: unknown, options: { mode: number }) => Hours
// Optional worker dependency. No hand-written interpretation of OSM hours.
export function lateness(venues: Venue[], city: City, now = new Date(), provided?: Parser): Lateness {
  let ParserClass = provided
  if (!ParserClass) {
    try { ParserClass = createRequire(`${process.cwd()}/workers/nightlife/package.json`)("opening_hours") as Parser }
    catch { return { known: 0, total: venues.length, afterMidnight: 0, after2: 0, after4: 0, note: "Opening hours have not been evaluated. Install the opening_hours worker dependency to enable this section." } }
  }
  // opening_hours uses local Date fields. Synthetic local dates represent city
  // wall-clock times, avoiding a dependency on the batch server's time zone.
  const reference = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let known = 0, afterMidnight = 0, after2 = 0, after4 = 0
  for (const venue of venues) {
    if (!venue.hours) continue
    try {
      const oh = new ParserClass(venue.hours, { lat: city.lat, lon: city.lon, address: { country_code: city.countryCode.toLowerCase() } }, { mode: 0 })
      const results: boolean[][] = [[], [], []]
      let uncertain = false
      for (let day = 0; day < 7; day++) for (let i = 0; i < 3; i++) {
        const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + day, [0, 2, 4][i], 1)
        if (oh.getUnknown(d)) uncertain = true
        results[i].push(oh.getState(d))
      }
      if (uncertain) continue
      known++
      if (results[0].some(Boolean)) afterMidnight++
      if (results[1].some(Boolean)) after2++
      if (results[2].some(Boolean)) after4++
    } catch { /* Invalid/conditional schedules stay out of the denominator. */ }
  }
  return { known, total: venues.length, afterMidnight, after2, after4, note: "Share of venues with interpretable hours open after each time on at least one night in the reference week. Seasonal hours can change; check the venue before going. Unknown hours are excluded, never treated as closed." }
}
