@AGENTS.md

# This checkout is production

`/opt/ismytripsafe` is **production** (`main`, port **3000**,
<https://ismytripsafe.com>, `ismytripsafe.service`). Beta is a separate
checkout — `/opt/ismytripsafe-beta` (`origin/beta`, port **3002**,
<https://beta.ismytripsafe.com>, `ismytripsafe-beta.service`).

Both are live: whatever is in a checkout's `.next` is what that host serves,
so **uncommitted work is destroyed by the next deploy** and **`next build`
here breaks the running site's assets**. See AGENTS.md for the safe
worktree build recipe.

## Deploying

- **Prod:** `git push origin main` → webhook runs
  `/usr/local/bin/ismytripsafe-deploy.sh` (`git reset --hard origin/main`,
  `npm install`, `npm run build`, `systemctl restart ismytripsafe`).
  Watch `/var/log/ismytripsafe-deploy.log` for `deploy OK`.
- **Beta:** `git push origin beta` (or `main:beta`) → the same pipeline
  against `origin/beta` in `/opt/ismytripsafe-beta`, restarting
  `ismytripsafe-beta`; log at `/var/log/ismytripsafe-beta-deploy.log`.
- **Nightlife env is build-time.** `/nightlife` and `/nightlife/testimonials`
  are prerendered, so `NIGHTLIFE_INDEXABLE`, `NIGHTLIFE_SITE_URL` and
  `NIGHTLIFE_CACHE_DIR` must be present for `npm run build`, not only in the
  service unit. Both deploy scripts export them; production uses
  `NIGHTLIFE_SITE_URL=https://ismytripsafe.com` and `NIGHTLIFE_INDEXABLE=1`.
  Beta uses the production URL for canonicals and `NIGHTLIFE_INDEXABLE=0`.

Ports: 3000 prod, 3002 beta, 3001 whatgradsmake. 3003–3005 are free for
worktree previews. **Outley** (`/opt/outley`, ports 3200/3400/8200) is a
different app on this host — leave its dirs, units, ports and vhosts alone.

Beta is currently a **public mirror** (the deploy script writes
`NEXT_PUBLIC_IS_BETA=0`), so it is crawlable like production. Flip that env to
`1` in the deploy script if it ever needs to be a noindex staging origin —
`app/robots.ts`, `app/layout.tsx` and `components/beach/BetaRibbon.tsx`
already honour it.

## Nightlife reports (on production)

The feature now lives on both `main` and `origin/beta`: pages at
`/{country}/{city}/nightlife`, pipeline in `lib/nightlife/*`, batch entry
`scripts/nightlife.cjs`, worker under `workers/nightlife/`, and the request
intake at `/api/nightlife/request` (form on `/nightlife`). Records are shared
at `/var/lib/ismytripsafe/nightlife` (`NIGHTLIFE_CACHE_DIR`): `outcome:
limited` publishes with a "Limited data" label, `withheld` publishes nothing.
Production is canonical; beta points `NIGHTLIFE_SITE_URL` at
`https://ismytripsafe.com` and keeps `NIGHTLIFE_INDEXABLE=0` so the two hosts
do not compete. The nightly refresh still runs from the beta checkout against
the shared cache.

## Design system

The postcard theme lives in `app/globals.css`: same CSS variable *names* as
ever, values re-skinned. Type is Instrument Serif (display) over Newsreader
(reading) over Azeret Mono (every number, label and date), wired in
`app/layout.tsx`; the tokens compose the `-src` variables next/font sets, so
don't rename either half. The rule the split encodes: nothing that is a fact
wears the same face as something that is a mood.

Supplied artwork is AI-generated and labelled "Illustration"; the rule for
where it may appear is the header comment in `lib/photos.ts`, processing in
`scripts/build-supplied-photos.mjs`. Related-destination cards prefer each
city's own report photo (Wikipedia → Wikivoyage → Wikimedia Commons), then its
commissioned illustration, and otherwise show no photo — never a generic
beach.

**Location integrity** — `node scripts/check-locations.mjs` after changing
`lib/data/geo.ts` or running a batch pregeneration.


## Traps this site has already hit — don't undo these

- **Never set React state from `onZoom` unsnapped.** It fires every animation
  frame; a stream of default-priority updates starves React's transitions.
- **globals.css is declared after Tailwind's layer**, so at equal specificity
  a plain class in it beats a `lg:`/`sm:` utility in the markup. Put
  responsive switches for `.ith-*`, `.pc-*` and friends in the stylesheet's
  own media queries, not in `className`.
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
