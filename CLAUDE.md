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
3000, 3001 and 3002 are taken; preview on 3005 from a copy.

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

## What beta is currently testing

1. **The globe** (`components/globe/GlobeExplorer.tsx`) replacing the
   destinations list — WebGL, countries tinted by score, clickable city pins.
2. **The postcard beach theme** — `app/globals.css` keeps production's CSS
   variable *names* and only changes their values, so every page re-skins for
   free. Artwork is hand-authored SVG in `components/beach/PosterArt.tsx`.

## Two traps this page has already hit — don't undo these

- **Never set React state from `onZoom` unsnapped.** It fires every animation
  frame; a stream of default-priority updates starves React's transitions.
- **The globe pauses its render loop on any outbound link click** (the
  capture-phase handler in `GlobeExplorer`). Where WebGL is slow the frame
  loop eats the whole main thread — measured at 1 fps — and React never gets
  the idle slice it needs to commit a navigation, so *every link on the page
  stops working*. Pausing first hands the thread back.
