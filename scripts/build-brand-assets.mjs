// Turns the raw brand art River sent over WhatsApp into the web assets the site
// ships: a transparent circular badge, the banner and its three panels cut out
// separately, the share card, and the founder photo. The sources are the chat
// export, which is gitignored — the derived assets in public/brand and app/ are
// what's committed, so this only needs re-running when the art changes.
//
//   node scripts/build-brand-assets.mjs
import sharp from "sharp"
import { mkdir } from "node:fs/promises"

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
  return { cx, cy, r, W, H }
}

// ── 1. The badge, cropped to its circle and masked transparent ─────────
{
  const { cx, cy, r } = await circleBounds(badgeSrc)
  const size = Math.round(r * 2)
  const left = Math.round(cx - r)
  const top = Math.round(cy - r)
  const N = 1024
  // Inset by 2px so the JPEG's white antialiasing fringe is cut away rather
  // than left as a pale halo against the site's paper background.
  const mask = Buffer.from(
    `<svg width="${N}" height="${N}"><circle cx="${N / 2}" cy="${N / 2}" r="${N / 2 - 2}" fill="#fff"/></svg>`,
  )
  const circle = await sharp(badgeSrc)
    .extract({ left, top, width: size, height: size })
    .resize(N, N, { fit: "fill" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer()

  await sharp(circle).resize(512, 512).png({ compressionLevel: 9 }).toFile(`${OUT}/badge.png`)
  // Apple touch icon wants an opaque square; the badge's own navy ring reads as
  // the tile edge, so flatten onto the ring colour rather than white.
  await sharp(circle)
    .resize(180, 180)
    .flatten({ background: "#0b1f45" })
    .png({ compressionLevel: 9 })
    .toFile("app/apple-icon.png")
}

// ── 2. The banner: full lockup, plus the panels without the wordmark bar ──
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

  // The navy wordmark strip runs across the bottom of the art, under an orange
  // rule at y≈658 — the panels are cut above it.
  const barTop = 656

  // The three panels are separated by diagonal white slashes that lean ~135px
  // left across the height, so each panel is cut inside the narrowest span the
  // slashes leave — and below the baked-in captions, which the page renders as
  // real text instead.
  const PANELS = [
    { name: "one-place", left: 64 },
    { name: "one-click", left: 601 },
    { name: "one-report", left: 1140 },
  ]
  for (const p of PANELS) {
    await sharp(bannerSrc)
      .extract({ left: p.left, top: 262, width: 390, height: barTop - 262 })
      .resize(780, 788)
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(`${OUT}/panel-${p.name}.jpg`)
  }
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

console.log("brand assets written to", OUT)
