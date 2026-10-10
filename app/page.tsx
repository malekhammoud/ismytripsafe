import type { Metadata } from "next"
import Link from "next/link"
import { HomeClient } from "@/components/HomeClient"
import { getCityReport, listCountries, listReports } from "@/lib/reports"
import { graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { PostcardScroller } from "@/components/home/PostcardScroller"
import { BigPostcard } from "@/components/home/BigPostcard"
import { StoplightStrip } from "@/components/home/StoplightStrip"
import { SiteFooter } from "@/components/SiteFooter"

// Server-rendered so crawlers land on real HTML with real links; the
// interactive checker hydrates on top.
export const dynamic = "force-dynamic"

/** The city the big demonstration card shows. */
const SHOWCASE = { country: "hungary", city: "budapest" } as const

/**
 * Featured seat list for the home page postcard scroller.
 */
const HERO_SEATS = [
  "/italy/venice",
  "/japan/tokyo",
  "/united-states/san-francisco",
  "/czechia/prague",
  "/italy/rome",
  "/italy/milan",
  "/poland/gdansk",
  "/united-kingdom/london",
  "/philippines/el-nido",
  "/hungary/budapest",
  "/spain/barcelona",
  "/france/paris",
  "/japan/kyoto",
  "/australia/sydney",
  "/netherlands/amsterdam",
  "/portugal/lisbon",
  "/austria/vienna",
  "/united-arab-emirates/dubai",
  "/singapore/singapore",
  "/iceland/reykjavik",
  "/south-africa/cape-town",
  "/thailand/bangkok",
  "/greece/athens",
]

// Reports carry the year they were generated in their titles; the landing page
// carries the current one, so the result that ranks for "is X safe" never looks
// like it was written years ago.
export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear()
  return {
    title: `Is It Safe to Travel There? ${year} Safety Scores for Any City`,
    description:
      `Check any city or country in one click. ${year} travel safety scores built from 15+ real databases — ` +
      "crime, governance, health, air quality, natural hazards and official government advisories — " +
      "with one honest verdict, a district-by-district map and a score re-weighted for who's travelling.",
    alternates: { canonical: "/" },
    openGraph: {
      title: `Is It Safe to Travel There? ${year} Safety Scores`,
      description:
        "One honest safety verdict for any city or country, backed by 15+ real databases.",
      url: "/",
      siteName: "IsMyTripSafe",
      type: "website",
    },
  }
}

export default async function Home() {
  const [reports, countries, showcase] = await Promise.all([
    listReports(),
    listCountries(),
    getCityReport(SHOWCASE.country, SHOWCASE.city),
  ])

  const cities = reports.filter((m) => m.path.split("/").filter(Boolean).length === 2)
  const byPath = new Map(cities.map((m) => [m.path, m]))
  const seen = new Set<string>()
  const seatedCards: typeof cities = []

  for (const p of HERO_SEATS) {
    const m = byPath.get(p)
    if (m && !seen.has(m.path)) {
      seatedCards.push(m)
      seen.add(m.path)
    }
  }
  for (const c of cities) {
    if (seatedCards.length >= 30) break
    if (!seen.has(c.path)) {
      seatedCards.push(c)
      seen.add(c.path)
    }
  }

  // The hero's proof chips: four famous cities with real, current scores.
  const chips = seatedCards.slice(0, 4).map((m) => ({
    city: m.city,
    path: m.path,
    score: m.score,
  }))

  // The "wander" row is an exploration exit, not an entrance — twelve cards
  // is enough to say "there is a whole world of these".
  const wanderCards = seatedCards.slice(0, 12)

  const jsonLd = graph(organizationNode(), websiteNode())

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <HomeClient chips={chips} footer={<SiteFooter />}>
        {/* ── 1. Proof: a real report, at a glance ────────────────────────
            The single most persuasive thing on the page is an actual report,
            so it comes first — before the explainers and the wander row. */}
        {showcase && (
          <section className="mt-14 rise-in">
            <div className="text-center">
              <p className="postcard-greeting">A real report, real numbers</p>
              <h2 className="font-display mt-1 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
                One card, one answer, and the reasons behind it
              </h2>
            </div>
            <div className="mt-6">
              <BigPostcard meta={showcase.meta} report={showcase.report} />
            </div>
          </section>
        )}

        {/* ── 2. Explain: how to read the score ────────────────────────── */}
        <section className="mt-14 rise-in" style={{ animationDelay: "0.16s" }}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="postcard-greeting">Reading the score</p>
            <h2 className="font-display mt-1 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
              A stoplight for the road ahead
            </h2>
          </div>
          <div className="mt-5">
            <StoplightStrip
              footer={
                <p className="mt-4 text-center text-[0.82rem]">
                  <Link href="/how-it-works" className="font-semibold text-[var(--accent-deep)] hover:underline">
                    How the score is built →
                  </Link>
                </p>
              }
            />
          </div>
        </section>

        {/* ── 3. Explore: the wander row, and the door to everything ───── */}
        {wanderCards.length > 0 && (
          <section className="mt-14 rise-in" style={{ animationDelay: "0.28s" }}>
            <div className="text-center">
              <p className="postcard-greeting">Where will you go next?</p>
              <h2 className="font-display mt-1 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
                Popular destinations, scored for you
              </h2>
            </div>
            <div className="mt-4">
              <PostcardScroller cards={wanderCards} />
            </div>
            {countries.length > 0 && (
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.78rem] text-[var(--ink-soft)]">
                {countries.slice(0, 8).map((c) => (
                  <Link key={c.countrySlug} href={`/${c.countrySlug}`} className="font-medium hover:text-[var(--accent)]">
                    {c.flag} {c.country}
                  </Link>
                ))}
                <Link href="/destinations" className="font-semibold text-[var(--accent-deep)] hover:underline">
                  Spin the globe →
                </Link>
              </p>
            )}
          </section>
        )}
      </HomeClient>
    </>
  )
}
