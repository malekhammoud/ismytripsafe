// Builds the web renditions of the photography in `public/photos`.
//
//   node scripts/build-photo-variants.mjs
//
// The sources stay in the repo (they are the art drop, and the supplied
// portrait is re-derived by `build-supplied-photos.mjs`), but the page never
// paints them any more. What ships is a set of WebP renditions at the width
// the element actually occupies:
//
//   postcards   480w + 960w   the marquee card is 320–480 CSS px wide
//   hero        960w + 1600w  a full-bleed band, cropped to 3.24:1 by CSS
//   pool        1280w         card fallbacks and /credits
//   supplied    960w          card fallback; the big postcard uses next/image
//
// A 960×640 JPEG postcard was 83–152 KB; the 960w WebP is 30–55 KB and the
// 480w one is 8–18 KB. Eleven cards used to cost 1.2 MB before the first
// screen had finished painting. Now the desktop marquee costs ~450 KB and a
// phone ~180 KB, and neither blocks the hero.
import sharp from "sharp"
import { readdirSync, statSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const out = (f) => console.log(f.padEnd(62), `${(statSync(f).size / 1024).toFixed(0)}KB`)
await mkdir("public/photos/opt", { recursive: true })

async function webp(src, dest, width, quality = 78, height) {
  await sharp(src)
    .resize(width, height, { fit: height ? "cover" : "inside", withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(dest)
  out(dest)
}

// ── Postcards ─────────────────────────────────────────────────────────
const POSTCARDS = "public/photos/postcards"
for (const name of readdirSync(POSTCARDS)) {
  if (!name.endsWith(".jpg")) continue
  const base = path.join(POSTCARDS, name.replace(/\.jpg$/, ""))
  await webp(`${base}.jpg`, `${base}-480.webp`, 480, 76, 320)
  await webp(`${base}.jpg`, `${base}-960.webp`, 960, 78, 640)
}

// ── Header plate ──────────────────────────────────────────────────────
const HERO = "public/photos/hero/barcelona-park-guell"
await webp(`${HERO}.jpg`, `${HERO}-1600.webp`, 1600, 80)
await webp(`${HERO}.jpg`, `${HERO}-1280.webp`, 1280, 79)
await webp(`${HERO}.jpg`, `${HERO}-960.webp`, 960, 78)

// ── House pool ────────────────────────────────────────────────────────
// The pool is only ever painted as a card fallback (~480 CSS px) or on
// /credits. 1920px originals were 319–1185 KB each.
const POOL = [
  "hero-shoreline",
  "koh-mak-sunset",
  "philippines",
  "surfer-walk",
  "surfer-sunset",
  "palms",
  "rhodes",
  "busan",
  "nissi",
  "eraclea",
]
for (const slug of POOL) {
  const src = `public/photos/${slug}.jpg`
  const dest = `public/photos/opt/${slug}-1280.webp`
  await sharp(src)
    .resize(1280, null, { withoutEnlargement: true })
    .webp({ quality: 78, effort: 6 })
    .toFile(dest)
  out(dest)
  const thumb = `public/photos/opt/${slug}-320.webp`
  await sharp(src)
    .resize(320, null, { withoutEnlargement: true })
    .webp({ quality: 75, effort: 6 })
    .toFile(thumb)
  out(thumb)
}

// ── Commissioned set ──────────────────────────────────────────────────
// The report hero (`BigPostcard`) goes through next/image and needs the
// 1440px original. The cards in the related grid and the plate card do
// not; they get a 960px rendition.
const SUPPLIED = "public/photos/supplied"
for (const name of readdirSync(SUPPLIED)) {
  if (!name.endsWith(".webp") || name.includes("-960")) continue
  const base = path.join(SUPPLIED, name.replace(/\.webp$/, ""))
  await webp(`${base}.webp`, `${base}-960.webp`, 960, 78, 640)
  await webp(`${base}.webp`, `${base}-320.webp`, 320, 75, 214)
}

console.log("\nDone.")
