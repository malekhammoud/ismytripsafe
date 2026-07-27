import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Mail, Quote } from "lucide-react"
import { absUrl } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, SeoFooter, SiteHeader } from "@/components/seo/shared"
import { BrandBanner } from "@/components/brand/BrandBanner"
import river from "@/public/brand/river-ica-peru.jpg"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear()
  return {
    title: `About Us (${year}) — The Two People Behind IsMyTripSafe`,
    description:
      "IsMyTripSafe.com was founded in 2026 by two young entrepreneurs in North America, as a tool for travellers across the globe to access up-to-date, personalised and insightful information within seconds.",
    alternates: { canonical: "/about" },
    openGraph: {
      title: `About IsMyTripSafe (${year})`,
      description:
        "Founded in 2026 by two young entrepreneurs, so travellers everywhere can get up-to-date, personalised, insightful safety information in seconds.",
      url: absUrl("/about"),
      siteName: "IsMyTripSafe",
      type: "website",
    },
  }
}

export default function AboutPage() {
  const trail = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
  ]
  const jsonLd = graph(organizationNode(), websiteNode(), breadcrumbNode(trail), {
    "@type": "AboutPage",
    name: "About IsMyTripSafe",
    url: absUrl("/about"),
    isPartOf: { "@id": `${absUrl("/")}#website` },
  })

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

        <BrandBanner className="mb-9" priority />

        <div className="mx-auto max-w-[680px]">
          <Breadcrumbs trail={trail} />

          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--navy)]">
            About us
          </h1>
          <p className="mt-4 text-[1rem] leading-[1.75] text-[var(--ink)]">
            IsMyTripSafe.com was founded in 2026 by two young entrepreneurs in North America, as a
            tool for travellers across the globe to access up-to-date, personalised and insightful
            information — within seconds!
          </p>

          {/* River — bio, photo, and the quote that started it */}
          <section className="mt-11">
            <div className="grid gap-6 sm:grid-cols-[1fr_15rem] sm:gap-8">
              <div>
                <h2 className="font-display text-[1.2rem] font-medium text-[var(--navy)]">
                  River Tompkins
                </h2>
                <p className="label mt-0.5" style={{ letterSpacing: "0.12em" }}>
                  Co-founder · Ross School of Business
                </p>
                <div className="mt-3.5 space-y-3.5 text-[0.94rem] leading-[1.75] text-[var(--ink-soft)]">
                  <p>
                    River solo travelled four continents last year and has no plan to stop. Between
                    late-night hostel chats and copious amounts of trip planning, he understands
                    what fellow explorers are looking for.
                  </p>
                  <p>
                    He thinks the benefits and joy of travel are endless, and wants to support
                    others in experiencing it to the fullest by equipping them with the tools to
                    determine what is — and what is not — the right adventure for them. In
                    today&apos;s digital world a lack of information should never be a reason to shy
                    away from a trip, and similarly, before booking those plane tickets you should
                    know what you&apos;re getting yourself into as far as safety and stability are
                    concerned — leave the rest unknown for tons of adventure, while confident in
                    your own health and wellbeing!
                  </p>
                </div>
              </div>

              <figure className="sm:pt-1">
                <div className="photo-frame aspect-[3/4] w-full max-w-[15rem]">
                  <Image
                    src={river}
                    alt="River Tompkins on the sand dunes outside Ica, Peru at sunset"
                    placeholder="blur"
                    sizes="(max-width: 640px) 100vw, 240px"
                  />
                </div>
                <figcaption className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
                  River in Ica, Peru last year
                </figcaption>
              </figure>
            </div>

            <blockquote
              className="mt-7 rounded-[3px] px-5 py-5 sm:px-7 sm:py-6"
              style={{ background: "rgba(243,108,10,0.06)", borderLeft: "3px solid var(--orange)" }}
            >
              <Quote size={17} style={{ color: "var(--orange)" }} aria-hidden />
              <p className="font-display mt-2 text-[clamp(1.02rem,2.4vw,1.2rem)] leading-[1.65] text-[var(--ink)]">
                My Mom and I spent hours scrolling through forums and government sites, searching
                for peace of mind more than anything, when we could have used IsMyTripSafe — if
                only it existed!
              </p>
              <footer className="mt-3 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                River Tompkins, co-founder
              </footer>
            </blockquote>
          </section>

          {/* Malek */}
          <section className="mt-11 border-t border-[var(--hairline)] pt-9">
            <h2 className="font-display text-[1.2rem] font-medium text-[var(--navy)]">
              Malek Hammoud
            </h2>
            <p className="label mt-0.5" style={{ letterSpacing: "0.12em" }}>
              Co-founder · Computer Science, McMaster University
            </p>
            <div className="mt-3.5 space-y-3.5 text-[0.94rem] leading-[1.75] text-[var(--ink-soft)]">
              <p>
                Malek brings the technical savvy to the table. He&apos;s the kind of person who takes
                things apart to find out how they work — electronics on the desk in his spare time,
                drones in the air when the weather cooperates — and he built IsMyTripSafe for a
                simple reason: the answer to &quot;is it safe there?&quot; was always scattered
                across a dozen government pages and a hundred forum posts, none of which knew the
                first thing about the person asking.
              </p>
              <p>
                He travels too — hikes in national parks, and regular trips to Lebanon, where
                advisories can change faster than the news covers them. Being able to see exactly
                where things stand in a few seconds is the whole reason this site exists.
              </p>
            </div>
          </section>

          <div className="mt-11 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-9">
            <Link href="/" className="btn inline-flex items-center gap-2 px-5 py-2.5 text-sm">
              <ShieldCheck size={15} />
              Check a destination
            </Link>
            <a
              href="mailto:malek@ismytripsafe.com"
              className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
            >
              <Mail size={14} />
              malek@ismytripsafe.com
            </a>
          </div>

          <SeoFooter />
        </div>
      </main>
    </>
  )
}
