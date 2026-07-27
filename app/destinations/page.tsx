import type { Metadata } from "next"
import Link from "next/link"
import { listCountries, type CountryHub } from "@/lib/reports"
import { LEVELS } from "@/lib/safety-display"
import { absUrl, humanDate } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import {
  Breadcrumbs,
  ScoreBadge,
  SectionHeading,
  SeoFooter,
  SiteHeader,
  scoreTint,
} from "@/components/seo/shared"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear()
  return {
    title: `All Destination Safety Reports ${year} — Scores by Country & City`,
    description:
      `Every IsMyTripSafe travel safety report, updated for ${year} and organised by country: composite safety ` +
      "scores, government advisory levels, crime data and field research for each destination.",
    alternates: { canonical: "/destinations" },
  }
}

/** One country: header row (flag, name, score) + its city reports + overview link. */
function CountryCard({ c }: { c: CountryHub }) {
  const score = c.countryReport?.score ?? c.avgScore
  return (
    <div className="card flex flex-col overflow-hidden">
      <Link
        href={`/${c.countrySlug}`}
        className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[rgba(31,116,207,0.05)]"
      >
        <span className="font-display min-w-0 truncate text-[1.05rem] font-medium tracking-tight text-[var(--ink)] group-hover:text-[var(--accent-deep)]">
          {c.flag && <span className="mr-2">{c.flag}</span>}
          Is {c.country} safe?
        </span>
        {score != null && <ScoreBadge score={score} size={34} />}
      </Link>
      {c.cities.length > 0 && (
        <ul className="border-t border-[var(--hairline)]">
          {c.cities.map((m) => (
            <li key={m.path}>
              <Link
                href={m.path}
                className="flex items-center justify-between gap-3 px-4 py-2 text-[0.85rem] transition-colors hover:bg-[rgba(31,116,207,0.05)]"
              >
                <span className="min-w-0 truncate font-medium text-[var(--ink)]">{m.city}</span>
                <span className="flex shrink-0 items-center gap-2 text-[0.72rem] text-[var(--ink-faint)]">
                  {LEVELS[m.level].label}
                  <span
                    className="tnum inline-flex w-8 justify-center rounded-full py-0.5 text-[0.7rem] font-bold text-white"
                    style={{ background: scoreTint(m.score) }}
                  >
                    {m.score}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto flex items-center justify-between border-t border-[var(--hairline)] px-4 py-2 text-[0.72rem] text-[var(--ink-faint)]">
        Updated {humanDate(c.updatedAt)}
        <Link href={`/${c.countrySlug}`} className="font-semibold text-[var(--accent-deep)] hover:underline">
          {c.country} overview →
        </Link>
      </p>
    </div>
  )
}

export default async function DestinationsPage() {
  const countries = await listCountries()
  const total = countries.reduce(
    (n, c) => n + c.cities.length + (c.countryReport ? 1 : 0),
    0
  )
  const updatedAt = countries.map((c) => c.updatedAt).sort().at(-1) ?? null

  // Group by continent/region so the country → city structure reads at a glance.
  const regions = new Map<string, CountryHub[]>()
  for (const c of countries) {
    const key = c.region || "Other regions"
    regions.set(key, [...(regions.get(key) ?? []), c])
  }
  const regionEntries = [...regions.entries()].sort(
    (a, b) =>
      b[1].reduce((n, c) => n + c.cities.length + 1, 0) -
      a[1].reduce((n, c) => n + c.cities.length + 1, 0)
  )

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
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div className="mx-auto max-w-[760px]">
          <Breadcrumbs trail={trail} />
          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
            Destination safety reports
          </h1>
          <p className="mt-3 max-w-[640px] text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
            {total} independent safety report{total === 1 ? "" : "s"} across {countries.length}{" "}
            countr{countries.length === 1 ? "y" : "ies"}, each combining official advisories,
            crime and governance data, live environmental feeds and AI field research into one
            0–100 score. Don&apos;t see your destination?{" "}
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

          <div className="mt-9 space-y-10">
            {regionEntries.map(([region, list]) => (
              <section key={region}>
                <SectionHeading
                  note={`${list.reduce((n, c) => n + c.cities.length + (c.countryReport ? 1 : 0), 0)} reports`}
                >
                  {region}
                </SectionHeading>
                <div className="mt-3.5 grid items-start gap-3 sm:grid-cols-2">
                  {list.map((c) => (
                    <CountryCard key={c.countrySlug} c={c} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <SeoFooter updatedAt={updatedAt} />
        </div>
      </main>
    </>
  )
}
