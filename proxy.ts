import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ─────────────────────────────────────────────────────────────────────
// One URL per page. Search Console was reporting "Duplicate without
// user-selected canonical" and "Alternate page with proper canonical tag"
// because every report was reachable at several addresses at once:
//
//   https://www.ismytripsafe.com/portugal/lisbon   ← served 200, no redirect
//   https://ismytripsafe.com/Portugal/Lisbon       ← served 200, same content
//   https://ismytripsafe.com/portugal/lisbon       ← the real one
//
// A rel=canonical on the duplicates only asks Google to consolidate them; it
// still crawls all three. That is survivable at 57 reports and wasteful at
// 1,200, so the duplicates are collapsed here with real 301s instead.
//
// Note: this file used to be called `middleware.ts` — that convention is
// deprecated in this Next version and renamed to `proxy`.
// ─────────────────────────────────────────────────────────────────────

/** Host we canonicalise to. Every other host we answer on redirects here. */
const CANONICAL_HOST = "ismytripsafe.com"

export function proxy(request: NextRequest) {
  const url = request.nextUrl
  const host = request.headers.get("host") ?? url.host

  // Don't touch localhost / preview hosts — only the production apex and its
  // www alias are canonicalised, so dev and the :3005 preview keep working.
  const isProdHost = host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`

  let redirect = false
  const target = url.clone()

  // 1. www → apex.
  if (isProdHost && host !== CANONICAL_HOST) redirect = true

  // 2. Mixed-case paths → lowercase. Report slugs are generated lowercase, so
  //    /Portugal/Lisbon is only ever an inbound link or a crawler guess, and
  //    it renders the identical page.
  if (/[A-Z]/.test(url.pathname)) {
    target.pathname = url.pathname.toLowerCase()
    redirect = true
  }

  // Behind the reverse proxy, `url` carries the internal origin Next was
  // reached on (127.0.0.1:3000), not the public one — redirecting to it
  // verbatim would send visitors to an address that isn't routable. Any
  // redirect we issue for a production host is pinned to the canonical origin.
  if (redirect && isProdHost) {
    target.protocol = "https:"
    target.host = CANONICAL_HOST
    target.port = ""
  }

  if (redirect) return NextResponse.redirect(target, 301)
  return NextResponse.next()
}

export const config = {
  // Everything except Next's internals, the API, and files with an extension
  // (favicons, images, robots.txt, sitemap.xml — all of which must keep their
  // case and their host).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
}
