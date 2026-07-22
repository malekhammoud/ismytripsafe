// Free web-research harness for the safety agent.
//
// The old backend let the Claude CLI run its own WebSearch/WebFetch tool
// loop. Free OpenRouter models don't come with browsing, so the searching
// and crawling happens HERE, in plain code, and the model gets a finished
// research dossier in its prompt. Everything below is keyless and free:
//   - Google News RSS  → dated, sourced headlines (recent incidents)
//   - DuckDuckGo HTML  → general web results with snippets + real URLs
//   - direct fetch     → full-text extracts of the top result pages
import type { GeoPoint } from "./types"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"

const FETCH_TIMEOUT_MS = 10_000
const MAX_ARTICLES = 5
const MAX_EXTRACT_CHARS = 2_600

export interface NewsHeadline {
  title: string
  source: string
  when: string // e.g. "Apr 2026"
}

export interface WebResult {
  title: string
  url: string
  snippet: string
}

export interface ArticleExtract {
  url: string
  domain: string
  text: string
}

export interface ResearchDossier {
  headlines: NewsHeadline[]
  webResults: WebResult[]
  extracts: ArticleExtract[]
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: "follow",
      ...init,
      headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
      signal: controller.signal,
    })
    if (!res.ok) return ""
    return await res.text()
  } catch {
    return ""
  } finally {
    clearTimeout(timer)
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

// ─── Google News RSS ────────────────────────────────────────────────

export async function searchGoogleNews(query: string, limit = 8): Promise<NewsHeadline[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const xml = await fetchText(url)
  if (!xml) return []

  const items: NewsHeadline[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1]
    const title = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim()
    const source = decodeEntities(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "").trim()
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? ""
    if (!title) continue
    const d = new Date(pubDate)
    const when = isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    // Google News titles end with " - Publication"; strip if we have the source
    const cleanTitle =
      source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title
    items.push({ title: cleanTitle, source, when })
    if (items.length >= limit) break
  }
  return items
}

// ─── DuckDuckGo (html endpoint — no key, includes snippets) ─────────

export async function searchDuckDuckGo(query: string, limit = 6): Promise<WebResult[]> {
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  )
  if (!html) return []

  const results: WebResult[] = []
  // Each organic result carries a redirect link with the real URL in ?uddg=
  const blocks = html.split(/class="result results_links/).slice(1)
  for (const block of blocks) {
    const linkMatch = block.match(
      /class="result__a"[^>]*href="[^"]*uddg=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/
    )
    if (!linkMatch) continue
    let url: string
    try {
      url = decodeURIComponent(linkMatch[1])
    } catch {
      continue
    }
    if (!url.startsWith("http")) continue
    const title = decodeEntities(linkMatch[2].replace(/<[^>]+>/g, "")).trim()
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
    const snippet = decodeEntities((snippetMatch?.[1] ?? "").replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim()
    results.push({ title, url, snippet })
    if (results.length >= limit) break
  }
  return results
}

// ─── Article crawling ───────────────────────────────────────────────

/** Domains that block server-side fetches or yield no useful body text. */
const SKIP_DOMAINS = /(?:^|\.)(reddit\.com|quora\.com|pinterest\.\w+|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com|tripadvisor\.\w+)$/i

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function extractReadableText(html: string): string {
  let h = html.replace(
    /<(script|style|noscript|svg|iframe|nav|header|footer|form|aside)[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  )
  h = h.replace(/<!--[\s\S]*?-->/g, " ")
  h = h.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n")
  h = h.replace(/<[^>]+>/g, " ")
  return decodeEntities(h)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    // drop nav crumbs / cookie banners / one-word menu items
    .filter((line) => line.length > 60)
    .join("\n")
}

export async function fetchArticle(url: string): Promise<ArticleExtract | null> {
  const domain = domainOf(url)
  if (!domain || SKIP_DOMAINS.test(domain)) return null
  const html = await fetchText(url)
  if (!html) return null
  const text = extractReadableText(html).slice(0, MAX_EXTRACT_CHARS)
  if (text.length < 500) return null // paywall, block page, or thin content
  return { url, domain, text }
}

/** Pick the best crawl candidates: one per domain, skipping blocked sites. */
export function pickArticleUrls(results: WebResult[], max = MAX_ARTICLES): WebResult[] {
  const seen = new Set<string>()
  const picked: WebResult[] = []
  for (const r of results) {
    const domain = domainOf(r.url)
    if (!domain || SKIP_DOMAINS.test(domain) || seen.has(domain)) continue
    if (/\.(pdf|jpg|png|mp4)(?:$|\?)/i.test(r.url)) continue
    seen.add(domain)
    picked.push(r)
    if (picked.length >= max) break
  }
  return picked
}

// ─── Query plan + dossier formatting ────────────────────────────────

export function buildQueryPlan(geo: GeoPoint) {
  const now = new Date()
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const year = String(now.getFullYear())
  const city = geo.city
  return {
    news: [
      `"${city}" ${geo.country} safety tourists`,
      `"${city}" crime OR robbery OR protest OR unrest`,
    ],
    web: [
      `${city} ${geo.country} safe for tourists ${monthYear}`,
      `${city} neighborhoods to avoid safe areas`,
      `${city} tourist scams pickpocketing`,
      `${city} is it safe reddit ${year}`,
    ],
  }
}

export function formatDossier(dossier: ResearchDossier, gatheredAt: Date): string {
  const parts: string[] = []
  parts.push(
    `=== LIVE WEB RESEARCH DOSSIER (gathered ${gatheredAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}) ===`
  )

  if (dossier.headlines.length) {
    parts.push(
      "\nRecent news headlines (Google News — dated, real publications):\n" +
        dossier.headlines
          .map((h) => `- [${h.when || "undated"}] ${h.source || "unknown source"}: ${h.title}`)
          .join("\n")
    )
  }

  if (dossier.webResults.length) {
    parts.push(
      "\nWeb search results (DuckDuckGo — title, site, snippet):\n" +
        dossier.webResults
          .map((r) => `- ${domainOf(r.url)} — "${r.title}"${r.snippet ? `: ${r.snippet}` : ""}`)
          .join("\n")
    )
  }

  if (dossier.extracts.length) {
    parts.push(
      "\nFull-text extracts from the top pages:\n" +
        dossier.extracts
          .map((a) => `--- ${a.domain} (${a.url}) ---\n${a.text}`)
          .join("\n\n")
    )
  }

  if (dossier.headlines.length + dossier.webResults.length + dossier.extracts.length === 0) {
    parts.push("\n(no live web results could be gathered — rely on the database profile only,")
    parts.push("be conservative, and leave recentIncidents empty rather than inventing any)")
  }

  parts.push("========================================================")
  return parts.join("\n")
}
