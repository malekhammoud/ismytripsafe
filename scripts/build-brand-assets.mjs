// Turns the raw brand art River sent over WhatsApp into the web assets the site
// ships: the banner, the share card, the illustrated badge as a soft background
// wash, the founder photo, and the apple touch icon drawn from app/icon.svg.
// The sources are the chat export, which is gitignored — the derived assets in
// public/brand and app/ are what's committed, so this only needs re-running
// when the art changes.
//
//   node scripts/build-brand-assets.mjs
import sharp from "sharp"
import { mkdir, readFile } from "node:fs/promises"

const SRC = "WhatsApp Chat - River"
const OUT = "public/brand"

const badgeSrc = `${SRC}/00000061-PHOTO-2026-07-25-21-38-41.jpg`
const bannerSrc = `${SRC}/00000062-PHOTO-2026-07-25-21-38-41.jpg`
const riverSrc = `${SRC}/00000070-PHOTO-2026-07-26-12-34-23.jpg`

await mkdir(OUT, { recursive: true })

/** Find the badge's circle: the bounding box of everything that isn't paper-white. */
async function circleBounds(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  let minX = W, minY = H, maxX = 0, maxY = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C
      if (data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const r = Math.min(maxX - minX, maxY - minY) / 2
  return { cx, cy, r }
}

// ── 1. The illustrated badge, as a background wash ─────────────────────
{
  const { cx, cy, r } = await circleBounds(badgeSrc)
  const size = Math.round(r * 2)
  const N = 1400
  // Feathered rather than cut: as a backdrop the badge has to dissolve into the
  // paper, so the alpha ramps away over the outer third instead of ending at a
  // hard circular edge that would read as a sticker sitting on the page.
  const mask = Buffer.from(
    `<svg width="${N}" height="${N}">
       <defs>
         <radialGradient id="f" cx="50%" cy="50%" r="50%">
           <stop offset="0.62" stop-color="#fff" stop-opacity="1"/>
           <stop offset="0.86" stop-color="#fff" stop-opacity="0.55"/>
           <stop offset="1" stop-color="#fff" stop-opacity="0"/>
         </radialGradient>
       </defs>
       <circle cx="${N / 2}" cy="${N / 2}" r="${N / 2}" fill="url(#f)"/>
     </svg>`,
  )
  await sharp(badgeSrc)
    .extract({ left: Math.round(cx - r), top: Math.round(cy - r), width: size, height: size })
    .resize(N, N, { fit: "fill" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9, quality: 82 })
    .toFile(`${OUT}/badge-wash.png`)
}

// ── 2. The banner, whole — it's one piece of art, not three ────────────
{
  await sharp(bannerSrc)
    .resize(1600, null, { withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(`${OUT}/banner.jpg`)

  // Default share card for every page that doesn't generate its own.
  await sharp(bannerSrc)
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile("app/opengraph-image.jpg")
}

// ── 3. Founder photo, cropped to portrait ──────────────────────────────
{
  const meta = await sharp(riverSrc).metadata()
  const H = meta.height
  const w = Math.round((H * 3) / 4)
  await sharp(riverSrc)
    .extract({ left: Math.round((meta.width - w) / 2), top: 0, width: w, height: H })
    .resize(900, 1200)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT}/river-ica-peru.jpg`)
}

// ── 4. Touch icon, rendered from the vector mark ───────────────────────
{
  // The emblem's own navy disc would leave paper-coloured corners on a tile, so
  // it's drawn edge to edge on navy instead.
  const icon = (await readFile("app/icon.svg", "utf8"))
    .replace("<svg", '<svg width="180" height="180"')
    .replace(/viewBox="[^"]+"/, 'viewBox="7.5 8 47 47"')
  await sharp(Buffer.from(icon))
    .resize(180, 180)
    .flatten({ background: "#16304f" })
    .png({ compressionLevel: 9 })
    .toFile("app/apple-icon.png")
}

console.log("brand assets written to", OUT)
