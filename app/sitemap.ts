import type { MetadataRoute } from "next"
import { listCountries, listReports } from "@/lib/reports"
import { absUrl } from "@/lib/site"

// Rebuilt on every request so new reports appear immediately. lastModified is
// the report's real data-refresh timestamp — never "now" — so Google can
// trust our dates. (Single file is fine up to 50,000 URLs; shard by country
// via generateSitemaps if the store ever approaches that.)
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [reports, countries] = await Promise.all([listReports(), listCountries()])
  const newest = reports[0]?.updatedAt

  const staticPages: MetadataRoute.Sitemap = [
    { url: absUrl("/"), ...(newest ? { lastModified: newest } : {}) },
    { url: absUrl("/destinations"), ...(newest ? { lastModified: newest } : {}) },
    { url: absUrl("/methodology") },
    { url: absUrl("/about") },
  ]

  const countryPages: MetadataRoute.Sitemap = countries.map((c) => ({
    url: absUrl(`/${c.countrySlug}`),
    lastModified: c.updatedAt,
  }))

  const cityPages: MetadataRoute.Sitemap = reports
    .filter((m) => m.path.split("/").filter(Boolean).length === 2)
    .map((m) => ({
      url: absUrl(m.path),
      lastModified: m.updatedAt,
    }))

  return [...staticPages, ...countryPages, ...cityPages]
}
