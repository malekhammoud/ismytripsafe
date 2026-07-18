import type { DestinationImages } from "../types"
import { fetchJson } from "./geo"

// Flags, coats of arms, locator maps and other SVG-derived lead images make
// terrible hero photos — skip them and keep looking.
const NOT_A_PHOTO = /flag_of|coat_of_arms|locator|_map\b|\.svg/i

function usable(url: string | null | undefined): url is string {
  return !!url && !NOT_A_PHOTO.test(url)
}

/** Wikipedia REST summary — editorially-chosen lead image + intro blurb. */
async function getWikipediaSummary(
  title: string
): Promise<{ hero: string | null; blurb: string | null } | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    const data = (await fetchJson(url)) as {
      type?: string
      originalimage?: { source?: string }
      thumbnail?: { source?: string }
      extract?: string
    }
    if (data.type === "disambiguation") return null
    const img = data.originalimage?.source ?? data.thumbnail?.source ?? null
    return { hero: usable(img) ? img : null, blurb: data.extract ?? null }
  } catch {
    return null
  }
}

/** Wikivoyage page image — travel-focused photos, great for destinations. */
async function getWikivoyageImage(title: string): Promise<string | null> {
  try {
    const url =
      `https://en.wikivoyage.org/w/api.php?action=query&format=json&redirects=1` +
      `&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}`
    const data = (await fetchJson(url)) as {
      query?: { pages?: Record<string, { original?: { source?: string } }> }
    }
    for (const page of Object.values(data.query?.pages ?? {})) {
      const src = page.original?.source
      if (usable(src)) return src
    }
    return null
  } catch {
    return null
  }
}

/** Wikimedia Commons search — the wide net when nothing curated exists. */
async function getCommonsImage(query: string): Promise<string | null> {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
      `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8` +
      `&prop=imageinfo&iiprop=url|mime&iiurlwidth=1600`
    const data = (await fetchJson(url)) as {
      query?: {
        pages?: Record<
          string,
          { imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }
        >
      }
    }
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0]
      if (!info || !/image\/(jpeg|png|webp)/.test(info.mime ?? "")) continue
      const src = info.thumburl ?? info.url
      if (usable(src)) return src
    }
    return null
  } catch {
    return null
  }
}

/** Supporting Creative-Commons gallery from Openverse (free, no key). */
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

/**
 * Hero photo + blurb, from as many sources as it takes. All sources are
 * queried in parallel; the winner is picked by quality order: Wikipedia lead
 * image (city, then "City, Country", then the capital for country-level
 * searches) → Wikivoyage → Wikimedia Commons search. Flag/map/SVG images are
 * never used.
 */
export async function getImages(
  city: string,
  country: string,
  capital?: string | null
): Promise<DestinationImages> {
  const isCountryQuery =
    !city || city.trim().toLowerCase() === country.trim().toLowerCase()
  const wikiTitles = isCountryQuery
    ? [country, ...(capital ? [capital] : [])]
    : [city, `${city}, ${country}`]
  const voyageTitle = isCountryQuery ? (capital ?? country) : city
  const searchSubject = isCountryQuery ? (capital ?? country) : city

  const [summaries, voyage, commons, gallery] = await Promise.all([
    Promise.all(wikiTitles.map(getWikipediaSummary)),
    getWikivoyageImage(voyageTitle),
    getCommonsImage(`${searchSubject} ${country} skyline cityscape`),
    getOpenverse(`${city || country} ${country} cityscape landmark`),
  ])

  const blurb = summaries.find((s) => s?.blurb)?.blurb ?? null
  const hero =
    summaries.find((s) => s?.hero)?.hero ?? voyage ?? commons ?? null

  return { hero, blurb, gallery }
}
