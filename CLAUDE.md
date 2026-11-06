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
- **Beta:** `git push origin main:beta` (or push the beta branch) → the same
  pipeline against `origin/beta` in `/opt/ismytripsafe-beta`, restarting
  `ismytripsafe-beta`; log at `/var/log/ismytripsafe-beta-deploy.log`.

Ports: 3000 prod, 3002 beta, 3001 whatgradsmake. 3003–3005 are free for
worktree previews. **Outley** (`/opt/outley`, ports 3200/3400/8200) is a
different app on this host — leave its dirs, units, ports and vhosts alone.

Beta is currently a **public mirror** (the deploy script writes
`NEXT_PUBLIC_IS_BETA=0`), so it is crawlable like production. Flip that env to
`1` in the deploy script if it ever needs to be a noindex staging origin —
`app/robots.ts`, `app/layout.tsx` and `components/beach/BetaRibbon.tsx`
already honour it.

## Beta branch — nightlife reports

`origin/beta` carries the Nightlife Report feature (not on prod): pages at
`/{country}/{city}/nightlife`, pipeline in `lib/nightlife/*`, batch entry
`scripts/nightlife.cjs`, worker under `workers/nightlife/`. Records live in
`/var/lib/ismytripsafe/nightlife` (`NIGHTLIFE_CACHE_DIR`): `outcome: limited`
publishes with a "Limited data" label, `withheld` publishes nothing.
Promoting it to prod is a deliberate merge into `main`.

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
