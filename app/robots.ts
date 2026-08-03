import type { MetadataRoute } from "next"
import { absUrl } from "@/lib/site"

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
    sitemap: absUrl("/sitemap.xml"),
  }
}
