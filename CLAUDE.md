@AGENTS.md

# This checkout is BETA, not production

`/root/ismytripsafe-beta` is the **beta** branch, serving
<https://beta.ismytripsafe.com> from `ismytripsafe-beta.service` on port
**3002**. Production is a different directory (`/root/ismytripsafe`, `main`,
port 3000) and is not affected by anything you do here.

Deploying beta means `git commit` + `git push origin beta`: a GitHub webhook
(`/hooks/deploy-ismytripsafe-beta`) runs
`/usr/local/bin/ismytripsafe-beta-deploy.sh`, which does `git reset --hard
origin/beta`, writes `.env.production.local`, `npm install`, `npm run build`
and `systemctl restart ismytripsafe-beta`. Watch
`/var/log/ismytripsafe-beta-deploy.log` for `beta deploy OK`.

The same two consequences as production apply — **uncommitted work is
destroyed by the next deploy**, and **never run `next dev` in this
directory**, because the live beta site is served from this `.next`. Ports
3000, 3001, 3002 and 3003 are taken; preview on 3005 from a copy.

## Beta is a separate origin, and must stay uncrawlable

Beta serves the same 1,000+ reports on a second hostname. `NEXT_PUBLIC_IS_BETA=1`
(set by the deploy script into `.env.production.local`, because `NEXT_PUBLIC_*`
is inlined at build time and the systemd unit is too late for it) turns on:

- `app/robots.ts` → `Disallow: /` for everything
- `app/layout.tsx` → `noindex, nofollow` on every page
- `components/beach/BetaRibbon.tsx` → the orange strip at the top

If you ever merge beta into main, those three switch themselves off — but
check `.env.production.local` is not committed and `NEXT_PUBLIC_SITE_URL`
isn't pointing at the beta host.

## beta2 is the frozen backup

`beta2.ismytripsafe.com` is a snapshot of this site, kept so a previous design
stays visible while beta keeps moving. Separate checkout
(`/root/ismytripsafe-beta2`) pinned to the **`beta2` branch**, its own unit
(`ismytripsafe-beta2.service`, port **3003**), its own nginx vhost and cert.

It is deliberately **not** wired to the deploy webhook — a backup that follows
the thing it is backing up is not a backup. To move it forward, point the
`beta2` branch at a new commit by hand and rebuild:

```
git branch -f beta2 <sha> && git push -f origin beta2
cd /root/ismytripsafe-beta2 && git fetch && git reset --hard origin/beta2 \
  && npm install && npm run build && systemctl restart ismytripsafe-beta2
```

It shares the production report cache like beta does, and carries
`NEXT_PUBLIC_IS_BETA=1`, so it is noindex and `Disallow: /` too.

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
