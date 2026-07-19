import type { MetadataRoute } from "next"
import { absUrl } from "@/lib/site"

// Everything public is crawlable. AI *search* crawlers (the ones that cite
// pages in answers) are explicitly welcomed — ChatGPT search is fed by Bing,
// so Bingbot matters as much as Googlebot. /api/ is workers-only.
export default function robots(): MetadataRoute.Robots {
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
