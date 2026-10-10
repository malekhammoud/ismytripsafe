import { getCityReport } from "@/lib/reports"
import {
  computeCategories,
  computeFinalScore,
  LEVELS,
  PYRAMID,
  type CategoryKey,
} from "@/lib/safety-display"

/**
 * The worked example on the home page.
 *
 * The header shows a real destination's real scores, read out of the report
 * store on every request — the same numbers the same visitor gets if they
 * type that city into the box a second later. Nothing here is illustrative.
 *
 * That is not fussiness. The whole product is "we will tell you the real
 * number." A landing page that shows an invented 84 to look good, on a site
 * whose reason to exist is that it doesn't do that, has given the game away
 * before anyone has clicked anything.
 */

/** Where the worked example comes from. Barcelona: widely visited, widely
 *  worried about, and not a score that flatters us — which is the point. */
const DEMO = { country: "spain", city: "barcelona" } as const

export interface DemoCategory {
  key: CategoryKey
  short: string
  score: number
  color: string
}

export interface HomeDemo {
  city: string
  country: string
  flag: string
  path: string
  score: number
  /** "Yes — generally safe" */
  answer: string
  levelColor: string
  cats: DemoCategory[]
}

export async function homeDemo(): Promise<HomeDemo | null> {
  const hit = await getCityReport(DEMO.country, DEMO.city)
  if (!hit) return null

  const { report, meta } = hit
  const final = computeFinalScore(report.bundle.safety, report.enrichment, report.bundle.geo?.countryCode)
  const byKey = new Map(
    computeCategories(report.bundle.safety.signals, report.enrichment).map((c) => [c.key, c]),
  )

  // Pyramid order, flattened: crime, sentiment, advisories, stability, health.
  // That is the order the report itself puts them in, and the order the header
  // reads left to right, so the two never teach different vocabularies.
  const cats: DemoCategory[] = []
  for (const key of PYRAMID.flat()) {
    const c = byKey.get(key)
    // A category with no data is dropped rather than shown as a dash. The
    // header is a promise about what you get; an empty tile isn't one.
    if (!c || c.score == null) continue
    cats.push({ key: c.key, short: c.short, score: Math.round(c.score), color: c.color })
  }
  if (cats.length < 5) return null

  return {
    city: meta.city,
    country: meta.country,
    flag: meta.flag,
    path: meta.path,
    score: final.index,
    answer: LEVELS[final.level].answer,
    levelColor: LEVELS[final.level].color,
    cats,
  }
}
