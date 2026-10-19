import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { NightlifeReportPage } from "@/components/nightlife/Report"
import { findNightlife, listNightlife, nightlifePath, nightlifeUrl, NIGHTLIFE_INDEXABLE } from "@/lib/nightlife/store"
import { distance } from "@/lib/nightlife/venues"
export const dynamic = "force-dynamic"
type Props = { params: Promise<{ country: string; city: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, city } = await params, r = await findNightlife(country, city)
  if (!r) return { title: "Nightlife report not found", robots: { index: false, follow: false } }
  const title = `${r.city.city} Nightlife ${new Date(r.updatedAt).getUTCFullYear()}: Bars, Clubs & Safety`
  const description = `${r.city.city} nightlife: ${r.overall?.toFixed(1)}/5 from ${r.venues.length} mapped venues. Explore venue types, late opening, traveler sentiment and after-dark safety.${r.outcome === "limited" ? " Limited data; gaps are clearly marked." : ""}`
  return { title, description, robots: { index: NIGHTLIFE_INDEXABLE, follow: NIGHTLIFE_INDEXABLE }, alternates: { canonical: nightlifeUrl(nightlifePath(r)) }, openGraph: { title, description, url: nightlifeUrl(nightlifePath(r)), type: "article" } }
}
export default async function Page({ params }: Props) {
  const { country, city } = await params, report = await findNightlife(country, city)
  if (!report) notFound()
  const nearby = (await listNightlife()).filter(r => r.city.key !== report.city.key).sort((a, b) => distance(report.city, a.city) - distance(report.city, b.city)).slice(0, 3)
  // Editorial score is not passed off as a consumer AggregateRating.
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: `${report.city.city} Nightlife: Bars, Clubs & Safety`, dateModified: report.updatedAt, url: nightlifeUrl(nightlifePath(report)), author: { "@type": "Organization", name: "IsMyTripSafe", url: nightlifeUrl("/") }, about: { "@type": "City", name: report.city.city, containedInPlace: { "@type": "Country", name: report.city.country } }, citation: report.sources.filter(s => s.fetchedAt).map(s => s.url) }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}/><NightlifeReportPage report={report} nearby={nearby}/></>
}
