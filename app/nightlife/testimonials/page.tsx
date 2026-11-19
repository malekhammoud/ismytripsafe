import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"
import { TestimonialSearch } from "@/components/nightlife/TestimonialSearch"
import { listTestimonials, nightlifeUrl, NIGHTLIFE_INDEXABLE } from "@/lib/nightlife/store"
import "@/components/nightlife/nightlife.css"
import "@/components/nightlife/testimonials.css"

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const entries = await listTestimonials()
  const cities = new Set(entries.map(entry => entry.city)).size
  return {
    title: "What People Say About Nightlife: Traveler Quotes by City",
    description: `Search ${entries.length} short, attributed traveler quotes about nightlife across ${cities} cities. Filter by city, tone or what people mention.`,
    robots: { index: NIGHTLIFE_INDEXABLE, follow: NIGHTLIFE_INDEXABLE },
    alternates: { canonical: nightlifeUrl("/nightlife/testimonials") },
    openGraph: { title: "What people say about nightlife", description: `Attributed traveler quotes about bars, clubs and nights out in ${cities} cities.`, url: nightlifeUrl("/nightlife/testimonials"), type: "website" },
  }
}

export default async function TestimonialsPage() {
  const entries = await listTestimonials()
  const cities = new Set(entries.map(entry => entry.city)).size
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "IsMyTripSafe", url: nightlifeUrl("/") },
      { "@type": "CollectionPage", name: "What people say about nightlife", url: nightlifeUrl("/nightlife/testimonials"), isPartOf: { "@type": "WebSite", url: nightlifeUrl("/") } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: nightlifeUrl("/") },
        { "@type": "ListItem", position: 2, name: "Nightlife", item: nightlifeUrl("/nightlife") },
        { "@type": "ListItem", position: 3, name: "Testimonials", item: nightlifeUrl("/nightlife/testimonials") },
      ] },
    ],
  })
  return <div className="nl-page nlt-page">
    <SiteHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    <main className="nlt-main">
      <header className="nlt-masthead">
        <Link prefetch={false} href="/nightlife" className="nlt-back">← Nightlife reports</Link>
        <p className="postcard-greeting">What people say</p>
        <h1>Nightlife, in other people&apos;s words.</h1>
        <p className="nlt-deck">Short, attributed excerpts from public travel guides and articles. Search by city, tone or what people mention, then follow the link to the original source. These are opinions, not verified reviews or paid endorsements.</p>
        <p className="nlt-note">{entries.length.toLocaleString("en")} quotes across {cities} cities · updated when reports refresh</p>
      </header>
      <TestimonialSearch entries={entries} />
      <div className="nlt-footer"><Link prefetch={false} href="/nightlife">Explore the nightlife globe and city guides →</Link><SiteFooter /></div>
    </main>
  </div>
}
