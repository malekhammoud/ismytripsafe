import type { MetadataRoute } from "next"
import { absUrl } from "@/lib/site"
import { NIGHTLIFE_INDEXABLE, nightlifeUrl } from "@/lib/nightlife/store"

// Read NIGHTLIFE_INDEXABLE at request time; the service environment is not
// present during the production build, so a prerendered robots.txt would
// silently omit the nightlife sitemap.
export const dynamic = "force-dynamic"

// Everything public is crawlable. AI *search* crawlers (the ones that cite
// pages in answers) are explicitly welcomed — ChatGPT search is fed by Bing,
// so Bingbot matters as much as Googlebot. /api/ is workers-only.
//
// EXCEPT on beta.ismytripsafe.com, which is a staging origin. Two copies of
// the same 1000+ reports on two hostnames is exactly the duplicate-content
// problem production's SEO work exists to avoid, so beta blocks everything
// outright (and layout.tsx sends `noindex` alongside it).
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_IS_BETA === "1") {
    return { rules: [{ userAgent: "*", disallow: "/" }] }
  }

  // Nightlife is a beta-origin pilot. When it is explicitly indexable, point
  // crawlers at the nightlife sitemap on its own canonical origin as well as
  // the main safety sitemap.
  const sitemaps = [absUrl("/sitemap.xml"), ...(NIGHTLIFE_INDEXABLE ? [nightlifeUrl("/nightlife/sitemap.xml")] : [])]
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "Claude-SearchBot",
          "Claude-User",
          "PerplexityBot",
          "Perplexity-User",
        ],
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: [...new Set(sitemaps)],
  }
}
