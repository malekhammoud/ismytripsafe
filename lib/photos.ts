// ─────────────────────────────────────────────────────────────────────
// Photography.
//
// Every image on this site is a real photograph. There is no illustration
// and nothing generated.
//
// Two sources, in order of preference:
//
//  1. **The destination's own photo.** Reports already carry a lead image
//     picked from Wikipedia / Wikivoyage / Wikimedia Commons by
//     `lib/data/images.ts`. A picture of the actual place always beats a
//     picture of a beach, so it wins wherever we have one (about 3 in 4).
//
//  2. **The house pool below.** Freely-licensed coastal photography, used
//     where a destination has no photo of its own, and for decorative
//     furniture like the homepage band.
//
// Pool licensing: CC0, public domain and CC BY only. ShareAlike is
// deliberately excluded — resizing is an adaptation, and none of this is
// worth relicensing the site over. Attribution for every CC BY photo is on
// /credits, linked from the footer, which is the condition those licences
// actually impose.
//
// Every pool photo was reviewed by eye before being added. Candid beach
// photography of identifiable strangers, and anything with children in
// swimwear, is not usable here whatever its licence says — one otherwise
// well-licensed candidate was rejected on exactly those grounds.
// ─────────────────────────────────────────────────────────────────────

export interface PoolPhoto {
  slug: string
  /**
   * Where the photograph was actually taken, from the Commons description or
   * its coordinates. Null where Commons doesn't record one — and a photo
   * without a verified location is never put on a destination card, because
   * the card would then be showing an unlabelled elsewhere under that
   * destination's name.
   */
  place: string | null
  file: string
  title: string
  author: string
  license: string
  licenseUrl: string
  source: string
}

export const PHOTO_POOL: PoolPhoto[] = [
  {
    slug: "hero-shoreline",
    place: "Cap Ferret, France",
    file: "/photos/hero-shoreline.jpg",
    title: "Sunrise Cap Ferret Banc du Toulinguet - Arcachon - Oc\u00e9an Atlantique - Picture Image Photography - Sunset - Coucher de soleil - Dune du pilat pyla - Banc d'arguin water eau vagues waves beach plage sky colors red yellow (14501089751).jpg",
    author: "Grand Parc - Bordeaux, France from France",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File%3ASunrise%20Cap%20Ferret%20Banc%20du%20Toulinguet%20-%20Arcachon%20-%20Oc%C3%A9an%20Atlantique%20-%20Picture%20Image%20Photography%20-%20Sunset%20-%20Coucher%20de%20soleil%20-%20Dune%20du%20pilat%20pyla%20-%20Banc%20d'arguin%20water%20eau%20vagues%20waves%20beach%20plage%20sky%20colors%20red%20yellow%20(14501089751).jpg",
  },
  {
    slug: "koh-mak-sunset",
    place: "Koh Mak, Thailand",
    file: "/photos/koh-mak-sunset.jpg",
    title: "Koh Mak, Thailand, Sunset on the beach with palms.jpg",
    author: "Vyacheslav Argenberg",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    source: "https://commons.wikimedia.org/wiki/File%3AKoh%20Mak%2C%20Thailand%2C%20Sunset%20on%20the%20beach%20with%20palms.jpg",
  },
  {
    slug: "philippines",
    place: "Boracay, Philippines",
    file: "/photos/philippines.jpg",
    title: "Tropical Sunset, Philippines (53014260401).jpg",
    author: ". Ray in Manila",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File%3ATropical%20Sunset%2C%20Philippines%20(53014260401).jpg",
  },
  {
    slug: "relax",
    place: null,
    file: "/photos/relax.jpg",
    title: "Relax (262571903).jpeg",
    author: "Denis Lintner",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0",
    source: "https://commons.wikimedia.org/wiki/File%3ARelax%20(262571903).jpeg",
  },
  {
    slug: "surfer-walk",
    place: null,
    file: "/photos/surfer-walk.jpg",
    title: "Sufer carrying surfboard along the beach.JPG",
    author: "Johntex",
    license: "CC BY 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by/2.5",
    source: "https://commons.wikimedia.org/wiki/File%3ASufer%20carrying%20surfboard%20along%20the%20beach.JPG",
  },
  {
    slug: "surfer-sunset",
    place: "Seven Mile Beach, Australia",
    file: "/photos/surfer-sunset.jpg",
    title: "Silhouette surfer at sunset (Unsplash).jpg",
    author: "Rafael Le\u00e3o raflfc",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File%3ASilhouette%20surfer%20at%20sunset%20(Unsplash).jpg",
  },
  {
    slug: "palms",
    place: "Puerto Plata, Dominican Republic",
    file: "/photos/palms.jpg",
    title: "Palm Trees - Flickr - MassiveKontent.jpg",
    author: "Jason Thibault from Montreal, Canada",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File%3APalm%20Trees%20-%20Flickr%20-%20MassiveKontent.jpg",
  },
  {
    slug: "rhodes",
    place: "Rhodes, Greece",
    file: "/photos/rhodes.jpg",
    title: "A Beach on Rhodes (4838668793).jpg",
    author: "J B from Champaign, IL, USA",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File%3AA%20Beach%20on%20Rhodes%20(4838668793).jpg",
  },
  {
    slug: "busan",
    place: "Haeundae Beach, Busan, South Korea",
    file: "/photos/busan.jpg",
    title: "\"Hae-Un-Dae\" Beach, Sunny Day.(Busan City, Korea) (8661277231).jpg",
    author: "yuseokoh from South Korea",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File%3A%22Hae-Un-Dae%22%20Beach%2C%20Sunny%20Day.(Busan%20City%2C%20Korea)%20(8661277231).jpg",
  },
  {
    slug: "nissi",
    place: "Nissi Beach, Ayia Napa, Cyprus",
    file: "/photos/nissi.jpg",
    title: "2022 03 Nissi beach 1.jpg",
    author: "Qasinka",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File%3A2022%2003%20Nissi%20beach%201.jpg",
  },
  {
    slug: "eraclea",
    place: "Eraclea Mare, Italy",
    file: "/photos/eraclea.jpg",
    title: "Eraclea mare 2009 03.JPG",
    author: "Alberto Vigani",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0",
    source: "https://commons.wikimedia.org/wiki/File%3AEraclea%20mare%202009%2003.JPG",
  },
]

/**
 * The photographs usable on a destination card.
 *
 * A card says "Greetings from Monte Carlo". If the photograph under that is
 * a beach in Rhodes, the card is lying, however pretty it looks — and about
 * one destination in four has no photograph of its own. So a fallback photo
 * is captioned with where it really is, and any photo whose location Commons
 * doesn't record is excluded from this pool rather than shown unlabelled.
 */
export const CARD_POOL: PoolPhoto[] = PHOTO_POOL.filter((p) => p.place)

/**
 * The wide photograph behind the homepage hero.
 *
 * Deliberately a high-key one. The band is masked into a cream page, and a
 * dark photograph doesn't dissolve into cream — it sits there as a grey slab
 * with the page showing through the edges. Bright sand and open water fade
 * out properly.
 */
export const HERO_PHOTO = PHOTO_POOL.find((p) => p.slug === "relax") ?? PHOTO_POOL[0]

/** Stable 32-bit hash — same value on the server and in the browser. */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * A pool photo for a destination with no picture of its own. Chosen from a
 * hash of the slug, never at random, so a place keeps the same photo between
 * renders and the server and client agree.
 */
export function poolPhotoFor(seed: string, offset = 0): PoolPhoto {
  const h = hashString(seed || "ismytripsafe")
  return CARD_POOL[(h + offset) % CARD_POOL.length]
}

/**
 * Ask Wikimedia for a sensibly-sized rendition of a lead image.
 *
 * Lead images arrive at up to 3840px and several megabytes, which is absurd
 * behind a 400px postcard. But upload.wikimedia.org no longer renders
 * arbitrary widths on demand: it serves a fixed set of pre-rendered buckets
 * and answers everything else with a 400. Measured across a sample of the
 * report cache, only **960px and 1280px** come back — 640, 800, 1600 and
 * 2560 all fail. So this picks from that set rather than asking for what it
 * would like.
 *
 * A full-size original (no /thumb/ in the path) is left alone. Constructing
 * a thumb path for one 400s just the same, and the original at least loads.
 * Callers pair this with an onError fallback to the untouched URL.
 */
export function sized(url: string, prefer: 960 | 1280 = 960): string {
  if (!/^https?:\/\/upload\.wikimedia\.org\//.test(url)) return url
  if (!/\/thumb\//.test(url)) return url
  return url.replace(/\/\d{2,4}px-([^/]+)$/, `/${prefer}px-$1`)
}
