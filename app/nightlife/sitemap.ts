import type { MetadataRoute } from "next"
import { listNightlife, nightlifePath, nightlifeUrl } from "@/lib/nightlife/store"

// Nightlife lives on the beta origin while the feature is being piloted, so it
// gets its own sitemap instead of mixing beta URLs into the production list.
// Only published reports are listed; withheld cities stay out until they have
// enough verified evidence.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reports = await listNightlife()
  const newest = reports.map(report => report.updatedAt).sort().at(-1)
  return [
    { url: nightlifeUrl("/nightlife"), ...(newest ? { lastModified: newest } : {}) },
    ...reports.map(report => ({ url: nightlifeUrl(nightlifePath(report)), lastModified: report.updatedAt })),
  ]
}
