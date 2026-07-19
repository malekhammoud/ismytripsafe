import { absUrl, SITE_URL } from "../site"

// ─────────────────────────────────────────────────────────────────────
// IndexNow: push new/updated report URLs straight to Bing (which also
// feeds ChatGPT search) instead of waiting for a crawl. The key is
// verified by serving it at /{key}.txt — see app/[the key].txt/route.ts.
// Fire-and-forget: indexing pings must never affect a user request.
// ─────────────────────────────────────────────────────────────────────

export const INDEXNOW_KEY = "b41c7e92a6d54f08b3a9e17c5d20f6a1"

export function pingIndexNow(paths: string[]): void {
  // Only ping for the real production host — localhost/dev URLs would just
  // poison the key's reputation.
  if (process.env.NODE_ENV !== "production" || !SITE_URL.startsWith("https://")) return
  const urlList = paths.map(absUrl)
  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: INDEXNOW_KEY,
      keyLocation: absUrl(`/${INDEXNOW_KEY}.txt`),
      urlList,
    }),
  }).catch(() => {
    /* best-effort */
  })
}
