import type { Metadata } from "next"
import Link from "next/link"
import { HomeClient } from "@/components/HomeClient"
import { listCountries, listReports } from "@/lib/reports"
import { graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Postcard } from "@/components/beach/Postcard"
import { SiteFooter } from "@/components/SiteFooter"

// Server-rendered so crawlers land on real HTML with real links; the
// interactive checker hydrates on top.
export const dynamic = "force-dynamic"

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
  const [reports, countries] = await Promise.all([listReports(), listCountries()])
  // Feature the biggest destinations first (population as the proxy for what
  // people search), newest first among the rest.
  const featured = [...reports]
    .filter((m) => m.path.split("/").filter(Boolean).length === 2)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, 8)

  const jsonLd = graph(organizationNode(), websiteNode())

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <HomeClient>
        {(featured.length > 0 || countries.length > 0) && (
          <section className="mt-8 w-full rise-in" style={{ animationDelay: "0.4s" }}>
            <div className="text-center">
              <p className="postcard-greeting">Postcards from the road</p>
              <h2 className="font-display mt-1 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
                Somewhere we&apos;ve already checked
              </h2>
              <p className="mx-auto mt-2 max-w-[30rem] text-[0.83rem] leading-relaxed text-[var(--ink-soft)]">
                Hover a card to read what we found. Every score is the same 0–100 scale,
                built from the same sources.
              </p>
            </div>
            {featured.length > 0 && (
              <div className="postcard-deck mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.slice(0, 6).map((m, i) => (
                  <Postcard key={m.path} meta={m} index={i} />
                ))}
              </div>
            )}
            {countries.length > 0 && (
              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.78rem] text-[var(--ink-soft)]">
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
        <SiteFooter />
      </HomeClient>
    </>
  )
}
