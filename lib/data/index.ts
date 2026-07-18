import type { SafetyBundle, GeoPoint } from "../types"
import { geocode } from "./geo"
import { getSafetyReport } from "./safety"
import { getCountryFacts } from "./country"
import { getImages } from "./images"

export { geocode }

/**
 * Resolve everything needed for a place's safety report: the multi-database
 * safety signals (the core product), plus country facts and a hero photo.
 * `allSettled` so one slow source never blocks the bundle.
 */
export async function gatherSafety(geo: GeoPoint): Promise<SafetyBundle> {
  const country = getCountryFacts(geo.countryCode)

  const [safety, images] = await Promise.allSettled([
    getSafetyReport(geo),
    getImages(geo.city, geo.country, country?.capital ?? null),
  ])

  return {
    geo,
    country,
    images:
      images.status === "fulfilled"
        ? images.value
        : { hero: null, blurb: null, gallery: [] },
    safety:
      safety.status === "fulfilled"
        ? safety.value
        : {
            index: 60,
            level: "MODERATE",
            saferThanPct: null,
            signals: [],
            comparisons: [],
            advisories: [],
            health: [],
            sources: [],
          },
  }
}
