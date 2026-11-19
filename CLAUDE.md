@AGENTS.md

# This checkout is BETA, not production

`/opt/ismytripsafe-beta` is the **beta** branch, serving
<https://beta.ismytripsafe.com> from `ismytripsafe-beta.service` on port
**3002**. Production is `/opt/ismytripsafe` (`main`, port 3000,
`ismytripsafe.service`) and is not affected by anything you do here.

Both are live: whatever is in a checkout's `.next` is what that host serves,
so **uncommitted work is destroyed by the next deploy** and **`next build`
here breaks the running site's assets**. See AGENTS.md for the safe
worktree build recipe.

## Deploying

- **Beta:** `git push origin beta` (or `main:beta`) → webhook runs
  `/usr/local/bin/ismytripsafe-beta-deploy.sh` (`git reset --hard origin/beta`,
  writes `.env.production.local`, `npm install`, `npm run build`,
  `systemctl restart ismytripsafe-beta`). Watch
  `/var/log/ismytripsafe-beta-deploy.log` for `beta deploy OK`.
  The env file now also carries `NIGHTLIFE_INDEXABLE=1`,
  `NIGHTLIFE_SITE_URL` and `NIGHTLIFE_CACHE_DIR`: `/nightlife` and
  `/nightlife/testimonials` are prerendered, so those values must exist at
  **build** time, not only in the service drop-in.
- **Prod:** `git push origin main` deploys `/opt/ismytripsafe` through
  `/usr/local/bin/ismytripsafe-deploy.sh`; log at
  `/var/log/ismytripsafe-deploy.log`.

Ports: 3000 prod, 3002 beta, 3001 whatgradsmake. 3003–3005 are free for
worktree previews. **Outley** (`/opt/outley`, ports 3200/3400/8200) is a
different app on this host — leave its dirs, units, ports and vhosts alone.

Beta is currently a **public mirror** (the deploy script writes
`NEXT_PUBLIC_IS_BETA=0`), so it is crawlable like production. Flip that env to
`1` in the deploy script if it ever needs to be a noindex staging origin —
`app/robots.ts`, `app/layout.tsx` and `components/beach/BetaRibbon.tsx`
already honour it.

## What beta is currently testing

1. **The globe** (`components/globe/GlobeExplorer.tsx`) replacing the
   destinations list — WebGL, countries tinted by score, clickable city pins.
2. **The postcard beach theme** — `app/globals.css` keeps production's CSS
   variable *names* and only changes their values, so every page re-skins for
   free. Type is Instrument Serif (display) over Newsreader (reading) over
   Azeret Mono (every number, label and date), wired in `app/layout.tsx`; the
   tokens in `globals.css` compose them from the `-src` variables next/font
   sets, so don't rename either half. The rule the split encodes: nothing
   that is a fact wears the same face as something that is a mood.
3. **River's art direction on the home page** — the header band
   (`components/home/HeaderBand.tsx`) is his comp
   `WhatsAppChatRiver2/00000105` converted to elements, measured off the
   original rather than eyeballed; the geometry lives in `app/globals.css`
   under `.ith-*`. Its numbers are read live from the report store, so they
   will not match the comp's invented 84 and should not be made to.
   The imagery he supplied is AI-generated and is labelled "Illustration"
   wherever it appears; see the header comment in `lib/photos.ts` for the
   rule that governs where it may and may not be used, and
   `scripts/build-supplied-photos.mjs` for how it is processed.
4. **Location integrity** — `node scripts/check-locations.mjs` asks whether
   every report is filed under the country it is actually in. Run it after
   any change to `lib/data/geo.ts` or a batch of pregeneration.

## Two traps this page has already hit — don't undo these

- **Never set React state from `onZoom` unsnapped.** It fires every animation
  frame; a stream of default-priority updates starves React's transitions.
- **globals.css is declared after Tailwind's layer**, so at equal specificity
  a plain class in it beats a `lg:`/`sm:` utility in the markup. Three bugs so
  far: a label that stayed orange serif on a dark panel, a hero band stuck at
  its mobile height, and a desktop layout that collapsed into one enormous
  postcard. Put responsive switches for `.ith-*`, `.pc-*` and friends in the
  stylesheet's own media queries, not in `className`.
- **The globe pauses its render loop on any outbound link click** (the
  capture-phase handler in `GlobeExplorer`). Where WebGL is slow the frame
  loop eats the whole main thread — measured at 1 fps — and React never gets
  the idle slice it needs to commit a navigation, so *every link on the page
  stops working*. Pausing first hands the thread back.

## Performance invariants — don't undo these

- **The globe does not mount itself on a software renderer.**
  `lib/globe-runtime.ts` probes WebGL, rejects SwiftShader/llvmpipe, Save-Data
  and <4 cores, and shows the poster with an explicit button instead. On a
  normal GPU it mounts after idle. Measured cost of mounting
  unconditionally on a software renderer: a **90-second main-thread task**.
- **110m geometry first, 50m only when zoomed.** `lib/globe-geo.ts` loads
  `countries-110m.json` (108 KB) with the renderer in parallel; the 756 KB
  50m file is fetched once the camera crosses `altitude <= 1.05`. The old
  order was 50m first and the renderer after — serial, and seven times the
  vertices.
- **Every Wikimedia image goes through `sized()` / `wikimediaThumb()`.** They
  strip `?utm_…` before matching. A query string used to defeat the resize
  and fetch 2 MB originals for 1,043 of 1,424 heroes.
- **The postcards use the `-480.webp` / `-960.webp` variants**, not the JPEG
  art drop. `scripts/build-photo-variants.mjs` makes them; the home page must
  not go back to eleven eager 960px JPEG preloads (1.2 MB before first paint).
- **No block of `prefetch` on navigation.** Next fired 5–11 redundant RSC
  requests per page (the testimonials page six times, every related card,
  every self-link). With ISR a click is a cached route; leave
  `prefetch={false}` on links.
- **Pages are ISR, with a small seed.** `revalidate` is 60–300s, and the city
  and country routes have `generateStaticParams` seeds so on-demand ISR
  actually caches the rest. Re-adding `force-dynamic` to the home page,
  destinations or reports gives back the per-request render.
- **Nightlife city pages stay `force-dynamic`.** They render live on-demand
  research state; the rest of the nightlife surface is cached.
