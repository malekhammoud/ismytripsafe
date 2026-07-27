import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck, Search, Users, Map as MapIcon, Sparkles } from "lucide-react"
import { absUrl, monthYear } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import {
  Breadcrumbs,
  DocSection,
  ReportDoc,
  SeoFooter,
  SiteHeader,
  sectionNumberer,
} from "@/components/seo/shared"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear()
  return {
    title: `How to Use IsMyTripSafe (${year}) — Reading Your Travel Safety Report`,
    description:
      "How to read an IsMyTripSafe report: what the headline rating means, what sits behind it, the green/yellow/red stoplight, how the score is built from real databases, and why it beats asking a chatbot.",
    alternates: { canonical: "/how-it-works" },
    openGraph: {
      title: `How to use IsMyTripSafe (${year})`,
      description:
        "One rating, five scores behind it, and a stoplight you can act on. Here's how to read it.",
      url: absUrl("/how-it-works"),
      siteName: "IsMyTripSafe",
      type: "website",
    },
  }
}

/** River's stoplight: the whole report distilled into three colours. */
const LIGHTS: { label: string; color: string; body: string }[] = [
  {
    label: "Green light",
    color: "linear-gradient(150deg, #34a878, #1f7b55)",
    body: "Little cause for concern — keep cruising. Normal travel sense is enough.",
  },
  {
    label: "Yellow light",
    color: "linear-gradient(150deg, #e0ad3d, #c3862a)",
    body: "Caution and a bit of extra research. Not a showstopper at all — a helpful alert so you arrive better prepared.",
  },
  {
    label: "Red light",
    color: "linear-gradient(150deg, #e0654a, #bd3c26)",
    body: "A genuine risk. Something to pause on and evaluate properly before you make a final decision.",
  },
]

const WHAT_YOU_GET: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Search size={14} strokeWidth={2.3} />,
    title: "Type a destination",
    body: "A city, a town or a whole country. Anywhere with a name on the map.",
  },
  {
    icon: <Users size={14} strokeWidth={2.3} />,
    title: "Say who's going",
    body: "Solo or with family, women or men in the party, age, trip style. This is what makes the report yours rather than generic.",
  },
  {
    icon: <ShieldCheck size={14} strokeWidth={2.3} />,
    title: "Read the rating",
    body: "One number out of 100, which is a weighting of the five sub-scores under it.",
  },
  {
    icon: <MapIcon size={14} strokeWidth={2.3} />,
    title: "Go deeper",
    body: "Scroll on for the district-by-district map and the full written briefing.",
  },
]

export default function HowItWorksPage() {
  const trail = [
    { name: "Home", href: "/" },
    { name: "How it works", href: "/how-it-works" },
  ]
  const jsonLd = graph(organizationNode(), websiteNode(), breadcrumbNode(trail), {
    "@type": "WebPage",
    name: "How to use IsMyTripSafe",
    url: absUrl("/how-it-works"),
    isPartOf: { "@id": `${absUrl("/")}#website` },
  })
  const num = sectionNumberer(0)

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div className="mx-auto max-w-[680px]">
          <Breadcrumbs trail={trail} />

          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--navy)]">
            How to use IsMyTripSafe
          </h1>
          <p className="mt-1.5 text-[0.8rem] text-[var(--ink-faint)]">
            Reading your report · page current as of {monthYear()}
          </p>
          <p className="mt-4 text-[1rem] leading-[1.75] text-[var(--ink)]">
            One place, one click, one report. Below: what the rating actually means, what sits
            behind it, and how we get to a number we&apos;re willing to put our name on.
          </p>

          <div className="mt-8">
            <ReportDoc>
              <DocSection num={num()} kicker="Getting started" title="How do I use it?" first>
                <p className="text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  Simply enter the destination you&apos;re interested in, along with the core
                  details about who&apos;s travelling that let us personalise the report. You&apos;ll
                  see one rating at the top, which is a weighting of the five sub-categories
                  beneath it. <strong className="text-[var(--ink)]">Advisories</strong> and{" "}
                  <strong className="text-[var(--ink)]">Stability</strong> are country-wide
                  statistics. <strong className="text-[var(--ink)]">Crime</strong> is a combination
                  of city and country data.{" "}
                  <strong className="text-[var(--ink)]">Sentiment</strong> and{" "}
                  <strong className="text-[var(--ink)]">Health</strong>
                  {" are both specific to the precise location. "} Scroll further down for a map with neighbourhood-by-neighbourhood
                  safety notes and an in-depth briefing, under the &quot;Map&quot; tab.
                </p>

                <ol className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {WHAT_YOU_GET.map((s, i) => (
                    <li
                      key={s.title}
                      className="rounded-[3px] px-4 py-3.5"
                      style={{ background: "rgba(20,25,34,0.03)", borderLeft: "3px solid var(--orange)" }}
                    >
                      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--navy)]">
                        <span className="tnum">{String(i + 1).padStart(2, "0")}</span>
                        <span style={{ color: "var(--orange-deep)" }}>{s.icon}</span>
                        {s.title}
                      </p>
                      <p className="mt-1.5 text-[0.85rem] leading-relaxed text-[var(--ink-soft)]">
                        {s.body}
                      </p>
                    </li>
                  ))}
                </ol>

                <p className="mt-7 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  Think of this report as a stoplight for your car on the way to adventure:
                </p>
                <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
                  {LIGHTS.map((l) => (
                    <div key={l.label} className="light-card" style={{ background: l.color }}>
                      <p className="flex items-center gap-2 text-[0.82rem] font-bold uppercase tracking-[0.08em]">
                        <span className="lamp" aria-hidden />
                        {l.label}
                      </p>
                      <p className="mt-2 text-[0.8rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.94)" }}>
                        {l.body}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    This resource is best used for urban and town settings. If you&apos;re venturing
                    into the mountains or far off the beaten path, we recommend using the site to
                    assess your base camp or starting point.
                  </p>
                  <p>
                    You can also compare and contrast prospective trips against the ratings of
                    places you&apos;ve already been, and use those as a watermark for future
                    decisions —{" "}
                    <strong className="text-[var(--ink)]">every report is free</strong>.
                  </p>
                </div>
              </DocSection>

              <DocSection num={num()} kicker="Under the hood" title="How does it work?">
                <div className="space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    This product may seem impossibly difficult, but we promise we&apos;ve figured it
                    out. We&apos;re not trying to boil the Mediterranean, power-wash the pyramids, or
                    count each brick on the Great Wall of China.
                  </p>
                  <p>
                    Instead we use a proprietary combination of proven sources: meticulously
                    assembled databases built with millions in funding, detailed private research
                    projects focusing on important subjects like human trafficking and sexual
                    violence, and high-density crowdsourced information for every major city in the
                    world.
                  </p>
                  <p>
                    First, we extract the most important indicators. Then we weight each of those
                    data points by importance and by user demographic, to create an overall rating
                    out of 100. Violent crime, for example, is valued more heavily than crimes
                    committed against businesses; for women, more emphasis is placed on sexual
                    crime and on safety walking alone; if you&apos;re travelling primarily for
                    nightlife, the city&apos;s safety during those hours becomes more integral to the
                    final score. Finally, each statistic and the overall rating are compiled into
                    one comprehensive, easily intelligible report — ready for you to screenshot,
                    share or compare.
                  </p>
                  <p>
                    If you&apos;d like to learn more about the specific weighting process and
                    algorithm, it&apos;s all written up in the{" "}
                    <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
                      full methodology
                    </Link>{" "}
                    — or just{" "}
                    <a
                      href="mailto:malek@malekhammoud.com"
                      className="font-medium text-[var(--accent-deep)] hover:underline"
                    >
                      contact us
                    </a>
                    .
                  </p>
                </div>
              </DocSection>

              <DocSection num={num()} kicker="The alternative" title="Why not ChatGPT?">
                <div className="space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    You can put your destination into ChatGPT, but you&apos;ll be severely
                    disappointed. An LLM lacks any definable metric of rating and knows nothing
                    about who you are, which leaves you with an uninspiring answer. The report will
                    be 100% anecdotal — and all of those anecdotes will be out of date, because it
                    relies on news from when it was trained.
                  </p>
                  <p>
                    IsMyTripSafe is free and takes just a few seconds longer — which is good! Those
                    seconds are us actively updating and customising the report every single time,
                    to give you a healthy balance of real user sentiment and hard data.
                  </p>
                </div>
              </DocSection>

              <DocSection num={num()} kicker="Get involved" title="Can I contribute?">
                <div className="space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    Yes. We&apos;re always looking to add data in the name of improving the product
                    and adding a human connection component. If you&apos;re a travel influencer or
                    blogger, we&apos;d love to partner. Similarly, if you live in — or have
                    travelled to — a certain destination and can provide more insight, we&apos;d be
                    grateful to hear your opinion.
                  </p>
                </div>
                <a
                  href="mailto:malek@malekhammoud.com?subject=Contributing%20to%20IsMyTripSafe"
                  className="mt-4 inline-flex items-center gap-2 rounded-[3px] px-4 py-3 text-[0.9rem] font-semibold text-[var(--orange-deep)]"
                  style={{ background: "rgba(243,108,10,0.08)", border: "1px solid rgba(243,108,10,0.25)" }}
                >
                  <Sparkles size={15} strokeWidth={2.2} />
                  Tell us about a place you know
                </a>
              </DocSection>
            </ReportDoc>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/" className="btn inline-flex items-center gap-2 px-5 py-2.5 text-sm">
              <ShieldCheck size={15} />
              Check a destination
            </Link>
            <Link
              href="/about"
              className="text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
            >
              Meet the people behind it →
            </Link>
          </div>

          <SeoFooter />
        </div>
      </main>
    </>
  )
}
