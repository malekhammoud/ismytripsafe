<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# IsMyTripSafe

Next.js 16.2.9 / React 19 / TypeScript strict / Tailwind v4 (App Router). No test or lint scripts — `npm run build` (typechecks + compiles all routes) is the only verification. `CLAUDE.md` has the ops narrative and the design traps; below is what's verified and what changes day-to-day behavior.

## Deploy model — treat these checkouts as live

- **Layout:** production `/opt/ismytripsafe` (port 3000, `ismytripsafe.service`), beta `/opt/ismytripsafe-beta` (port 3002, `ismytripsafe-beta.service`). Port 3001 is another site (whatgradsmake); 3003–3005 are free.
- **Another app lives here too:** Outley at `/opt/outley` (frontend :3200, admin :3400, API :8200, scheduler) — never touch its directories, ports, units or nginx vhosts.
- `git push origin main` auto-deploys production: the webhook (`/etc/webhook.conf` → `/usr/local/bin/ismytripsafe-deploy.sh`) runs `git reset --hard origin/main`, `npm install`, `npm run build`, `systemctl restart ismytripsafe`. Pushing `beta` (or `main:beta`) does the same against `origin/beta` in `/opt/ismytripsafe-beta` via `…-beta-deploy.sh`. **Uncommitted work is destroyed by the next deploy of that branch.** Commit before ending a session.
- Both deploy scripts export the nightlife build env (`NIGHTLIFE_INDEXABLE`, `NIGHTLIFE_SITE_URL`, `NIGHTLIFE_CACHE_DIR`). `/nightlife` and `/nightlife/testimonials` are prerendered, so the values must exist at **build** time, not only in the service drop-in. Production is canonical; beta keeps `NIGHTLIFE_INDEXABLE=0` and points `NIGHTLIFE_SITE_URL` at production.
- Never run `next dev` or `next start` in either checkout. To preview, use a `git worktree` on a free port (3003–3005).
- **Never run `npm run build` in a live checkout unless the tree is exactly what should be served.** `next build` wipes `.next/`, and the running server serves `_next/static` *from disk* — a build here 500s every chunk until the service restarts, and a restart then serves un-released code. Build in a worktree instead: `git worktree add /tmp/x <sha>` + `mount --bind <repo>/node_modules /tmp/x/node_modules` (Turbopack refuses symlinked node_modules), build there, then swap `.next` + restart only if intended.
- Verify what a service actually serves with `systemctl cat ismytripsafe.service` / `ismytripsafe-beta.service` and `ls -l /proc/<next-server-pid>/cwd`.
- `.env*` are gitignored; `.env.local` is machine-local (OPENROUTER key). The deploy scripts write `.env.production.local` with the site origin and the nightlife build env.

## Architecture

- **Reports are cache files.** Every completed report is JSON in `/var/lib/ismytripsafe/reports` (`REPORT_CACHE_DIR`, outside the repo so deploys can't wipe it; 7-day TTL, 30-day stale-while-revalidate). Each file doubles as a page: `app/[country]/[city]/page.tsx` serves `/{country}` and `/{country}/{city}` from the cache with ISR (300s; 24 populous city seeds plus 12 country seeds in `generateStaticParams`, every other path on demand); `lib/reports.ts` indexes it (mtime-incremental). `/sitemap.xml` lists every report on disk.
- **Research** (`app/api/research`, SSE, `maxDuration = 300`): `lib/agent.ts` does all searching in plain code (`lib/research.ts` — Google News RSS + DuckDuckGo + page fetches, keyless), then **one OpenRouter free-model call per report** (~1,000 req/day account budget). nginx rate-limits `/api/research` (10/min, burst 5, 2 conns); `scripts/pregenerate.mjs` (systemd service, talks to 127.0.0.1:3000 direct, `--daily-budget 800`) bypasses it. Interrupted runs resume by re-running; state is journaled to `/var/lib/ismytripsafe/pregenerate-state.json`.
- **Search** (`/api/search`): curated local index in `lib/search.ts` (world-countries + report index + TIER1 from `scripts/destinations.mjs` + human aliases in `lib/data/aliases.ts`), Open-Meteo geocoder for the long tail. WIP AI long-tail resolver at `/api/resolve` (`lib/ai-resolve.ts`) — grounded to the candidate list, capped ~40 calls/hr.
- **`proxy.ts`** (was `middleware.ts` — deprecated name in this Next version) 301s www→apex and mixed-case paths, excluding `/api` and files. Never redirect to the internal origin (127.0.0.1:3000); pin to `https://ismytripsafe.com`. `instrumentation-client.ts` inits PostHog (client instrumentation is its own file in this Next version).

## Conventions & traps (from CLAUDE.md, still current)

- `globals.css` imports Tailwind then defines `:root` tokens with the same names as production (postcard re-skin). At equal specificity plain classes beat `sm:`/`lg:` utilities — put responsive switches for `.ith-*`/`.pc-*` in the stylesheet's own media queries.
- Fonts: next/font sets `--font-{display,text,mono}-src`; globals.css composes the final tokens. Rename neither half.
- Globe (`components/globe/GlobeExplorer.tsx`): never set React state from unsnapped `onZoom` (fires every frame); keep the capture-phase click handler that pauses the WebGL render loop, or links stop working.
- Run `node scripts/check-locations.mjs` after editing `lib/data/geo.ts` or a batch pregeneration — catches reports filed under the wrong country.
- AI-generated "Illustration" imagery rules: see the header comment in `lib/photos.ts`.

## Beta branch — nightlife reports

The Nightlife Report feature is now on both `main` and `origin/beta`: pages at `/{country}/{city}/nightlife`, pipeline in `lib/nightlife/*`, batch entry `scripts/nightlife.cjs`, worker under `workers/nightlife/`. Records are shared at `/var/lib/ismytripsafe/nightlife` (`NIGHTLIFE_CACHE_DIR`): `outcome: limited` publishes with a "Limited data" label, `withheld` publishes nothing. Production is canonical; beta must remain noindex for nightlife and canonical to `https://ismytripsafe.com`. The nightly refresh still runs from the beta checkout against the shared cache.
