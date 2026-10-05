import type { NextRequest } from "next/server"
import { searchPlace, normQuery, matchCountryQuery, flagOf, MIN_QUERY_LEN } from "@/lib/search"
import { openMeteoSearch } from "@/lib/data/geo"
import { englishCountryName } from "@/lib/data/country"
import { withBudget } from "@/lib/timing"

export const dynamic = "force-dynamic"

const LONG_TAIL_LIMIT = 5

/**
 * Destination autocomplete. The local curated index (lib/search.ts) answers
 * first — every country, every city with a report, aliases, typos, and the
 * intent-aware ranking that lifts countries and popular destinations. When it
 * comes back thin (an obscure village, a neighbourhood), the Open-Meteo
 * geocoder fills the long tail. Exactly the shape travel search is built on:
 * a curated lexicon up front, a geocoder for everything it doesn't know.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const q = (params.get("q") ?? "").trim().slice(0, 80)
  const reqLimit = Number(params.get("limit") ?? "8")
  const limit = Number.isFinite(reqLimit)
    ? Math.min(Math.max(Math.floor(reqLimit), 2), 12)
    : 8

  if (normQuery(q).length < MIN_QUERY_LEN) {
    return Response.json({ hits: [], aliased: false })
  }

  const local = await searchPlace(q, limit)

  let hits = local.hits
  if (hits.length < Math.min(limit, LONG_TAIL_LIMIT)) {
    // An alias redirect already disambiguated the query ("goa" → "Goa,
    // India"): hand the geocoder that canonical form so its country hint
    // sticks, not the raw abbreviation.
    const [head, ...rest] = (local.resolvedQuery ?? q).split(",")
    // Bounded; openMeteoSearch already swallows its own failures.
    const graded = await withBudget(
      openMeteoSearch(head.trim() || q, rest.join(",").trim()),
      2500
    )
    if (graded) {
      const seen = new Set(hits.map((h) => `${h.countryCode}:${normQuery(h.name)}`))
      for (const r of graded.ranked) {
        if (hits.length >= limit) break
        const cc = (r.country_code ?? "").toUpperCase()
        const key = `${cc}:${normQuery(r.name)}`
        if (seen.has(key)) continue
        seen.add(key)
        hits.push({
          type: "city",
          name: r.name,
          country: r.country ?? englishCountryName(cc) ?? "",
          countryCode: cc,
          region: r.admin1,
          lat: r.latitude,
          lon: r.longitude,
          population: r.population ?? null,
          flag: flagOf(cc),
          tier: 0,
          hasReport: false,
          quality: 40,
        })
      }
    }
  }

  // Last rung: an alias named a destination neither the local index nor the
  // geocoder can answer in the right country ("Goa, India" — Open-Meteo has
  // no Indian states; "Tuscany, Italy" — no ADM records; "Bali" it overran
  // with same-named hamlets). The alias itself is the answer: hand back the
  // canonical "City, Country" with the country's own coordinates. Any hits
  // already gathered are wrong-country geocoder junk — replace them.
  if (local.aliased && local.resolvedQuery && local.resolvedQuery.includes(",")) {
    const [city, ...rest] = local.resolvedQuery.split(",")
    const countryName = rest.join(",").trim()
    const cc = matchCountryQuery(countryName)
    if (city && cc && !hits.some((h) => h.countryCode === cc.countryCode)) {
      hits = [
        {
          type: "city",
          name: city.trim(),
          country: cc.name,
          countryCode: cc.countryCode,
          region: undefined,
          lat: cc.lat,
          lon: cc.lon,
          population: null,
          flag: flagOf(cc.countryCode),
          tier: 0,
          hasReport: false,
          quality: 100,
          resolvedFrom: normQuery(q),
        },
      ]
    }
  }

  return Response.json(
    { hits, aliased: local.aliased },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  )
}