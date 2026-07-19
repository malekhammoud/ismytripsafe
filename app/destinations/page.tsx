import type { Metadata } from "next"
import Link from "next/link"
import { listCountries } from "@/lib/reports"
import { absUrl, humanDate } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, ReportLink, SeoFooter, SiteHeader, scoreTint } from "@/components/seo/shared"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "All Destination Safety Reports — Scores by Country & City",
  description:
    "Every IsMyTripSafe travel safety report, organised by country: composite safety scores, government advisory levels, crime data and field research for each destination.",
  alternates: { canonical: "/destinations" },
}

export default async function DestinationsPage() {
  const countries = await listCountries()
  const total = countries.reduce(
    (n, c) => n + c.cities.length + (c.countryReport ? 1 : 0),
    0
  )
  const updatedAt = countries.map((c) => c.updatedAt).sort().at(-1) ?? null

  const trail = [
    { name: "Home", href: "/" },
    { name: "Destinations", href: "/destinations" },
  ]

  const jsonLd = graph(organizationNode(), websiteNode(), breadcrumbNode(trail), {
    "@type": "CollectionPage",
    name: "All destination safety reports",
    url: absUrl("/destinations"),
    isPartOf: { "@id": `${absUrl("/")}#website` },
    ...(updatedAt ? { dateModified: updatedAt } : {}),
  })

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SiteHeader />
      <div className="mx-auto max-w-[760px]">
        <Breadcrumbs trail={trail} />
        <h1 className="font-display text-[clamp(1.6rem,5vw,2.1rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
          Destination safety reports
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
          {total} independent safety report{total === 1 ? "" : "s"} across {countries.length}{" "}
          countr{countries.length === 1 ? "y" : "ies"}, each combining official government
          advisories, crime and governance databases, live environmental data and AI field
          research into one 0–100 score. Don&apos;t see your destination?{" "}
          <Link href="/" className="font-medium text-[var(--accent-deep)] hover:underline">
            Generate its report in about a minute
          </Link>
          .
        </p>

        {countries.length === 0 && (
          <p className="mt-8 text-[0.9rem] text-[var(--ink-soft)]">
            No reports published yet —{" "}
            <Link href="/" className="font-medium text-[var(--accent-deep)] hover:underline">
              run the first one
            </Link>
            .
          </p>
        )}

        <div className="mt-8 space-y-9">
          {countries.map((c) => (
            <section key={c.countrySlug}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[1.3rem] font-medium tracking-tight text-[var(--ink)]">
                  <Link href={`/${c.countrySlug}`} className="hover:text-[var(--accent-deep)]">
                    {c.flag && <span className="mr-1.5">{c.flag}</span>}
                    Is {c.country} safe?
                  </Link>
                </h2>
                {(c.countryReport?.score ?? c.avgScore) != null && (
                  <span
                    className="tnum shrink-0 rounded-full px-2 py-0.5 text-[0.74rem] font-bold text-white"
                    style={{ background: scoreTint(c.countryReport?.score ?? (c.avgScore as number)) }}
                  >
                    {c.countryReport?.score ?? c.avgScore}/100
                  </span>
                )}
              </div>
              {c.cities.length > 0 && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {c.cities.map((m) => (
                    <ReportLink key={m.path} meta={m} />
                  ))}
                </div>
              )}
              <p className="mt-2 text-[0.78rem] text-[var(--ink-faint)]">
                Updated {humanDate(c.updatedAt)} ·{" "}
                <Link href={`/${c.countrySlug}`} className="font-medium text-[var(--accent-deep)] hover:underline">
                  {c.country} overview →
                </Link>
              </p>
            </section>
          ))}
        </div>

        <SeoFooter updatedAt={updatedAt} />
      </div>
    </main>
  )
}
