import type { Metadata } from "next"
import Link from "next/link"
import { HomeClient } from "@/components/HomeClient"
import { getCityReport, listCountries, listReports } from "@/lib/reports"
import { homeDemo } from "@/lib/home-demo"
import { graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Postcard } from "@/components/beach/Postcard"
import { BigPostcard } from "@/components/home/BigPostcard"
import { StoplightStrip } from "@/components/home/StoplightStrip"
import { SiteFooter } from "@/components/SiteFooter"

// Server-rendered so crawlers land on real HTML with real links; the
// interactive checker hydrates on top.
export const dynamic = "force-dynamic"

/** The city the big demonstration card shows. */
const SHOWCASE = { country: "hungary", city: "budapest" } as const

/**
 * The six laid around the search, in seat order: two along the top, one out
 * to each side, two along the bottom.
 *
 * Every one of these has a picture drawn for it, so the arrangement never has
 * a gap in it — and they are picked for spread rather than for score. Prague
 * and Venice lead because River asked for them; Lima and El Nido are there so
 * the table isn't six European afternoons.
 */
const HERO_SEATS = [
  "/czechia/prague",
  "/italy/venice",
  "/japan/tokyo",
  "/italy/rome",
  "/peru/lima",
  "/philippines/el-nido",
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
  const [reports, countries, demo, showcase] = await Promise.all([
    listReports(),
    listCountries(),
    homeDemo(),
    getCityReport(SHOWCASE.country, SHOWCASE.city),
  ])

  const cities = reports.filter((m) => m.path.split("/").filter(Boolean).length === 2)
  const byPath = new Map(cities.map((m) => [m.path, m]))
  // Whatever we still have a report for. Missing one just leaves that seat
  // empty rather than breaking the arrangement.
  const seated = HERO_SEATS.map((p) => byPath.get(p)).filter((m) => !!m)

  // Then the biggest destinations (population as the proxy for what people
  // search), minus anything already shown above so nothing appears twice.
  //
  // One city per country, though. Sorting the world by population alone hands
  // back four Chinese megacities in a row, and six near-identical skylines is
  // both duller to look at and a worse answer to "where have you checked?"
  const shown = new Set([showcase?.meta.path, ...seated.map((m) => m!.path)])
  const seenCountry = new Set<string>()
  const featured: typeof cities = []
  for (const m of [...cities].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))) {
    if (featured.length === 6) break
    if (shown.has(m.path) || seenCountry.has(m.countrySlug)) continue
    seenCountry.add(m.countrySlug)
    featured.push(m)
  }

  const jsonLd = graph(organizationNode(), websiteNode())

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <HomeClient
        demo={demo}
        heroCards={seated.map((m, i) => <Postcard key={m!.path} meta={m!} index={i} />)}
        footer={<SiteFooter />}
      >
        {showcase && (
          <section className="mt-4 rise-in" style={{ animationDelay: "0.16s" }}>
            <div className="text-center">
              <p className="postcard-greeting">What you get</p>
              <h2 className="font-display mt-1 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
                One card, one answer, and the reasons behind it
              </h2>
            </div>
            <div className="mt-6">
              <BigPostcard meta={showcase.meta} report={showcase.report} />
            </div>
          </section>
        )}

        {featured.length > 0 && (
          <section className="mt-14 w-full rise-in" style={{ animationDelay: "0.24s" }}>
            <div className="text-center">
              <p className="postcard-greeting">Postcards from the road</p>
              <h2 className="font-display mt-1 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
                Somewhere we&apos;ve already checked
              </h2>
              <p className="mx-auto mt-2 max-w-[30rem] text-[0.83rem] leading-relaxed text-[var(--ink-soft)]">
                Every score is the same 0–100 scale, built from the same sources. Pick a card to
                read what we found.
              </p>
            </div>
            <div className="postcard-deck mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((m, i) => (
                <Postcard key={m.path} meta={m} index={i} />
              ))}
            </div>
            {countries.length > 0 && (
              <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.78rem] text-[var(--ink-soft)]">
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

        <section className="mt-14 rise-in" style={{ animationDelay: "0.28s" }}>
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
      </HomeClient>
    </>
  )
}
