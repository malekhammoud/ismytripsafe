import { getCityReport } from "@/lib/reports"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { OnDemandReport } from "@/components/nightlife/OnDemandReport"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { NightlifeReportPage } from "@/components/nightlife/Report"
import { findNightlife, listNightlife, nightlifePath, nightlifeUrl, NIGHTLIFE_INDEXABLE } from "@/lib/nightlife/store"
import { distance } from "@/lib/nightlife/venues"
// This page is the on-demand research surface: it must render the live job
// state, not a five-minute-old cached "researching" screen. The index and
// published reports are cached separately.
export const dynamic = "force-dynamic"
type Props = { params: Promise<{ country: string; city: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, city } = await params, r = await findNightlife(country, city)
  if (!r) {
    const hit = await getCityReport(country, city)
    return { title: hit ? `${hit.meta.city} Nightlife: Researching Bars, Clubs & Safety` : "Nightlife report not found", robots: { index: false, follow: false } }
  }
  const year = new Date(r.updatedAt).getUTCFullYear(), late = r.lateness.known ? Math.round(r.lateness.after2 / r.lateness.known * 100) : null
  const title = `${r.city.city} Nightlife Report ${year}: Bars, Clubs & Safety`
  const description = `${r.city.city} nightlife guide: ${r.venues.length.toLocaleString("en")} mapped bars, clubs and live-music venues${late != null ? `, ${late}% open past 2am` : ""}, plus after-dark safety${r.overall != null ? ` (${r.overall.toFixed(1)}/5)` : ""}.`
  return { title, description, robots: { index: NIGHTLIFE_INDEXABLE, follow: NIGHTLIFE_INDEXABLE }, alternates: { canonical: nightlifeUrl(nightlifePath(r)) }, openGraph: { title, description, url: nightlifeUrl(nightlifePath(r)), type: "article" } }
}
export default async function Page({ params }: Props) {
  const { country, city } = await params, report = await findNightlife(country, city)
  if (!report) {
    const hit = await getCityReport(country, city)
    if (!hit) notFound()
    return <div className="nl-page"><SiteHeader/><main className="nl-container"><OnDemandReport country={country} city={city} cityName={hit.meta.city}/><SiteFooter/></main></div>
  }
  const nearby = (await listNightlife()).filter(r => r.city.key !== report.city.key).sort((a, b) => distance(report.city, a.city) - distance(report.city, b.city)).slice(0, 3)
  const canonical = nightlifeUrl(nightlifePath(report))
  // Editorial score is not passed off as a consumer AggregateRating.
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: `${report.city.city} Nightlife: Bars, Clubs & Safety`, dateModified: report.updatedAt, url: canonical, mainEntityOfPage: canonical, author: { "@type": "Organization", name: "IsMyTripSafe", url: nightlifeUrl("/") }, publisher: { "@type": "Organization", name: "IsMyTripSafe", url: nightlifeUrl("/") }, about: { "@type": "City", name: report.city.city, containedInPlace: { "@type": "Country", name: report.city.country } }, citation: report.sources.filter(s => s.fetchedAt).map(s => s.url) }
  const breadcrumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "IsMyTripSafe", item: nightlifeUrl("/") },
    { "@type": "ListItem", position: 2, name: "Nightlife reports", item: nightlifeUrl("/nightlife") },
    { "@type": "ListItem", position: 3, name: `${report.city.city} nightlife`, item: canonical },
  ] }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}/><OnDemandReport country={country} city={city} cityName={report.city.city} mode="refresh"/><NightlifeReportPage report={report} nearby={nearby}/></>
}
