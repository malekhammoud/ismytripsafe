// Turns River's second art drop — the postcard set and the header plate — into
// the web assets the site ships. The sources are the WhatsApp export, which is
// gitignored; the derived files in public/photos/supplied and public/photos/hero
// are what's committed, so this only needs re-running when the art changes.
//
//   node scripts/build-supplied-photos.mjs
//
// The thing this has to get right is **the deckle**. The postcards arrive with a
// torn cream border painted into the pixels, and the site's own `.postcard` frame
// draws that same border in CSS — ship both and every card has two frames. So the
// deck gets the baked border trimmed off and drops into the CSS frame, while the
// one big demonstration postcard keeps its baked border and has the CSS frame
// removed instead. See `.postcard-hero` in app/globals.css.
import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const SRC = "WhatsAppChatRiver2"
const OUT = "public/photos/supplied"
const HERO_OUT = "public/photos/hero"

/** Deck cards. `place` is the caption on /credits; `bind` is the report it may
 *  be shown under — set only where the image really is of that city. */
const CARDS = [
  { src: "00000122", slug: "budapest-liberty-bridge", place: "Budapest, Hungary", bind: "/hungary/budapest", big: true },
  { src: "00000114", slug: "prague-hostel-table", place: "Prague, Czechia", bind: "/czechia/prague" },
  { src: "00000110", slug: "venice-san-marco-pigeons", place: "Venice, Italy", bind: "/italy/venice" },
  { src: "00000111", slug: "tokyo-izakaya-alley", place: "Tokyo, Japan", bind: "/japan/tokyo" },
  { src: "00000115", slug: "milan-duomo-tram", place: "Milan, Italy", bind: "/italy/milan" },
  { src: "00000116", slug: "gdansk-mariacka", place: "Gdańsk, Poland", bind: "/poland/gdansk" },
  { src: "00000117", slug: "london-regent-street", place: "London, United Kingdom", bind: "/united-kingdom/london" },
  { src: "00000119", slug: "lima-miraflores", place: "Lima, Peru", bind: "/peru/lima" },
  { src: "00000120", slug: "rome-da-enzo", place: "Rome, Italy", bind: "/italy/rome" },
  { src: "00000113", slug: "san-francisco-golden-gate", place: "San Francisco, United States", bind: "/united-states/san-francisco" },
  { src: "00000121", slug: "el-nido-paddleboards", place: "El Nido, Philippines", bind: "/philippines/el-nido" },
]

// Dropped on purpose, not forgotten:
//   00000118  London Underground — the tube map in it is invented geometry and
//             the roundel beside the platform sign reads "G HILL GATE".
//   00000112  Bangkok floating market — the stalls repeat and the hands are
//             mush. Both are legible at card size, which is the whole problem.
//   00000095  Positano — a demo, with an "85 / 100" ring painted into it. Every
//             number on this site is read from the report store; none is art.

const HERO = { src: "00000124", slug: "barcelona-park-guell", place: "Park Güell, Barcelona, Spain" }

const file = (id) => {
  const stamps = {
    "00000110": "PHOTO-2026-08-04-23-38-18",
    "00000111": "PHOTO-2026-08-04-23-38-18",
    "00000113": "PHOTO-2026-08-04-23-38-18",
    "00000114": "PHOTO-2026-08-04-23-38-18",
    "00000115": "PHOTO-2026-08-04-23-38-18",
    "00000116": "PHOTO-2026-08-04-23-38-18",
    "00000117": "PHOTO-2026-08-04-23-38-19",
    "00000119": "PHOTO-2026-08-04-23-38-19",
    "00000120": "PHOTO-2026-08-04-23-38-19",
    "00000121": "PHOTO-2026-08-04-23-38-19",
    "00000122": "PHOTO-2026-08-04-23-38-19",
    "00000124": "PHOTO-2026-08-04-23-38-20",
  }
  return `${SRC}/${id}-${stamps[id]}.jpg`
}

/**
 * Trim the painted deckle off, as a fraction of each edge.
 *
 * This is a measured constant rather than edge detection, deliberately. The
 * border is a torn, mottled, feathered thing that fades into bright skies at
 * the top of half these frames, so every automatic detector either leaves a
 * cream hairline on one file or eats a face on another. Measured across the
 * set, the solid part runs 0.1–1.5% and the feathering carries it to about 4%. Cropping
 * 4.5% off a 1536px frame costs 69px of sky — nothing — and the result is
 * checked by eye before it ships.
 */
const DECKLE = 0.045

/** Trim the deckle, then cover-crop to 3:2 at `w` wide. */
async function card(f, out, w = 1440) {
  const { width: W, height: H } = await sharp(f).metadata()
  const frac = DECKLE
  const dx = Math.round(W * frac)
  const dy = Math.round(H * frac)
  await sharp(f)
    .extract({ left: dx, top: dy, width: W - dx * 2, height: H - dy * 2 })
    // Centre, not "attention": the source is already 3:2 and stays 3:2 after a
    // uniform trim, so there is nothing to choose between — and a saliency crop
    // would be free to wander a few pixels and take the top off someone's head.
    .resize(w, Math.round((w * 2) / 3), { fit: "cover", position: "centre" })
    .webp({ quality: 80, effort: 6 })
    .toFile(out)
  return `trim ${dx}px/${dy}px`
}

await mkdir(OUT, { recursive: true })
await mkdir(HERO_OUT, { recursive: true })

for (const c of CARDS) {
  const src = file(c.src)
  // The big postcard keeps its painted deckle — it *is* the frame there — so it
  // is only resized, and wider, because it renders about a thousand CSS px across.
  if (c.big) {
    await sharp(src)
      .resize(1800, 1200, { fit: "cover", position: "attention" })
      .webp({ quality: 84, effort: 6 })
      .toFile(`${OUT}/${c.slug}.webp`)
    console.log(`${c.slug.padEnd(28)} 1800×1200  (deckle kept)`)
    continue
  }
  const d = await card(src, `${OUT}/${c.slug}.webp`)
  console.log(`${c.slug.padEnd(28)} 1440×960   ${d}`)
}

// ── The header plate ───────────────────────────────────────────────────
// No deckle on this one — it arrived as a clean 3.24:1 crop. Kept as JPEG at
// full width: next/image derives the AVIF/WebP ladder from it, and this is the
// one eager image on the homepage.
{
  const src = file(HERO.src)
  const { width, height } = await sharp(src).metadata()
  await sharp(src).jpeg({ quality: 86, mozjpeg: true }).toFile(`${HERO_OUT}/${HERO.slug}.jpg`)
  console.log(`${HERO.slug.padEnd(28)} ${width}×${height}  hero plate`)
}

console.log(`\n${CARDS.length} cards → ${OUT}, 1 plate → ${HERO_OUT}`)
