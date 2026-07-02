import type { DestinationImages } from "../types"
import { fetchJson } from "./geo"

/**
 * Curated hero photo + summary blurb from the Wikipedia REST API
 * (free, no key). The lead image is editorially chosen and high quality.
 */
async function getWikipedia(
  city: string,
  country: string
): Promise<{ hero: string | null; blurb: string | null }> {
  // Try "City" then "City, Country" for disambiguation
  const titles = [city, `${city}, ${country}`]
  for (const title of titles) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title
      )}`
      const data = (await fetchJson(url)) as {
        type?: string
        originalimage?: { source?: string }
        thumbnail?: { source?: string }
        extract?: string
      }
      if (data.type === "disambiguation") continue
      const hero =
        data.originalimage?.source ?? data.thumbnail?.source ?? null
      if (hero) {
        return { hero, blurb: data.extract ?? null }
      }
    } catch {
      // try next title
    }
  }
  return { hero: null, blurb: null }
}

/**
 * Supporting Creative-Commons gallery from Openverse (free, no key).
 */
async function getOpenverse(query: string): Promise<string[]> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
      query
    )}&page_size=6&license_type=commercial&mature=false`
    const data = (await fetchJson(url)) as {
      results?: Array<{ url?: string; thumbnail?: string }>
    }
    return (data.results ?? [])
      .map((r) => r.thumbnail ?? r.url)
      .filter((u): u is string => Boolean(u))
  } catch {
    return []
  }
}

export async function getImages(
  city: string,
  country: string
): Promise<DestinationImages> {
  const [wiki, gallery] = await Promise.all([
    getWikipedia(city, country),
    getOpenverse(`${city} ${country} cityscape landmark`),
  ])
  return {
    hero: wiki.hero,
    blurb: wiki.blurb,
    gallery,
  }
}
