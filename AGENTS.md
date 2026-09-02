<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# IsMyTripSafe

Next.js 16.2.9 / React 19 / TypeScript strict / Tailwind v4 (App Router). No test or lint scripts — `npm run build` (typechecks + compiles all routes) is the only verification. `CLAUDE.md` has the ops narrative and the design traps; below is what's verified and what changes day-to-day behavior.

## Deploy model — treat this checkout as live

- `git push origin main` auto-deploys: a webhook on this host runs `git reset --hard origin/main`, `npm install`, `npm run build`, `systemctl restart` (see `/usr/local/bin/ismytripsafe-deploy.sh`, `/etc/webhook.conf`). **Uncommitted work is destroyed by the next push.** Commit (and expect an auto-deploy) before ending a session.
- Never run `next dev` or `next start` in this checkout. Ports 3000–3004 are taken; use 3005 from a copy (`/root/ismytripsafe-preview`) instead.
- The deploy pipeline (build here → `systemctl restart ismytripsafe`) and the unit's `WorkingDirectory` are aligned on `/root/ismytripsafe` since 2026-09-02 — previously the unit pointed at `/root/ismytripsafe-beta` and every deploy served a stale build. If one checkout drifts again, verify with `systemctl cat ismytripsafe.service` and `ls -l /proc/<next-server-pid>/cwd`.
- `.env*` are gitignored; `.env.local` (OPENROUTER_API_KEY) is machine-local, the deploy writes `.env.production.local`.

## Architecture

- **Reports are cache files.** Every completed report is JSON in `/var/lib/ismytripsafe/reports` (`REPORT_CACHE_DIR`, outside the repo so deploys can't wipe it; 7-day TTL, 30-day stale-while-revalidate). Each file doubles as a page: `app/[country]/[city]/page.tsx` serves `/{country}` and `/{country}/{city}` dynamically from the cache (no `generateStaticParams`); `lib/reports.ts` indexes it (mtime-incremental). `/sitemap.xml` lists every report on disk.
- **Research** (`app/api/research`, SSE, `maxDuration = 300`): `lib/agent.ts` does all searching in plain code (`lib/research.ts` — Google News RSS + DuckDuckGo + page fetches, keyless), then **one OpenRouter free-model call per report** (~1,000 req/day account budget). nginx rate-limits `/api/research` (10/min, burst 5, 2 conns); `scripts/pregenerate.mjs` (systemd service, talks to 127.0.0.1:3000 direct, `--daily-budget 800`) bypasses it. Interrupted runs resume by re-running; state is journaled to `/var/lib/ismytripsafe/pregenerate-state.json`.
- **Search** (`/api/search`): curated local index in `lib/search.ts` (world-countries + report index + TIER1 from `scripts/destinations.mjs` + human aliases in `lib/data/aliases.ts`), Open-Meteo geocoder for the long tail. WIP AI long-tail resolver at `/api/resolve` (`lib/ai-resolve.ts`) — grounded to the candidate list, capped ~40 calls/hr.
- **`proxy.ts`** (was `middleware.ts` — deprecated name in this Next version) 301s www→apex and mixed-case paths, excluding `/api` and files. Never redirect to the internal origin (127.0.0.1:3000); pin to `https://ismytripsafe.com`. `instrumentation-client.ts` inits PostHog (client instrumentation is its own file in this Next version).

## Conventions & traps (from CLAUDE.md, still current)

- `globals.css` imports Tailwind then defines `:root` tokens with the same names as production (postcard re-skin). At equal specificity plain classes beat `sm:`/`lg:` utilities — put responsive switches for `.ith-*`/`.pc-*` in the stylesheet's own media queries.
- Fonts: next/font sets `--font-{display,text,mono}-src`; globals.css composes the final tokens. Rename neither half.
- Globe (`components/globe/GlobeExplorer.tsx`): never set React state from unsnapped `onZoom` (fires every frame); keep the capture-phase click handler that pauses the WebGL render loop, or links stop working.
- Run `node scripts/check-locations.mjs` after editing `lib/data/geo.ts` or a batch pregeneration — catches reports filed under the wrong country.
- AI-generated "Illustration" imagery rules: see the header comment in `lib/photos.ts`.

## Uncommitted WIP (as of 2026-08-13)

Search/resolve feature: `app/api/search`, `app/api/resolve`, `lib/search.ts`, `lib/ai-resolve.ts`, `lib/data/aliases.ts`, `scripts/bench-search.mts`, `bench-search.cjs`; `tsconfig.json` extended to include `**/*.mts`. These are not merged; build before relying on them.