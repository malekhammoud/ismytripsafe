import type { Metadata } from "next"
import Link from "next/link"
import { Mail, ShieldCheck } from "lucide-react"
import { absUrl, monthYear } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { StoplightStrip } from "@/components/home/StoplightStrip"
import { Breadcrumbs, SeoFooter, SiteHeader } from "@/components/seo/shared"

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

// This page is set the way /methodology and /about are: prose on the paper,
// display-serif subheads, nothing boxed. It used to be a stack of numbered
// `DocSection`s inside a `ReportDoc` card — a card of cards, on a page that is
// four plain questions and their answers. The numbering implied an order that
// doesn't exist, the card put a second frame around text that was already on a
// page, and the whole thing was narrower than the reading it contained.

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

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div className="mx-auto max-w-[720px]">
          <Breadcrumbs trail={trail} />

          <h1 className="font-display text-[clamp(1.6rem,5vw,2.1rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
            How to use IsMyTripSafe
          </h1>
          <p className="mt-1.5 text-[0.8rem] text-[var(--ink-faint)]">
            Reading your report · page current as of {monthYear()}
          </p>

          <div className="prose-brief mt-5 space-y-4 text-[0.94rem] leading-relaxed text-[var(--ink-soft)]">
            <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              How do I use it?
            </h2>
            <p>
              Simply enter the destination you&apos;re interested in, along with the core details
              about who&apos;s travelling that let us personalise the report. You&apos;ll see one
              rating at the top, which is a weighting of the five sub-categories beneath it.{" "}
              <strong>Advisories</strong> and <strong>Stability</strong> are country-wide
              statistics. <strong>Crime</strong> is a combination of city and country data.{" "}
              <strong>Sentiment</strong> and <strong>Health</strong>{" "}
              are both specific to the precise location. Scroll further down for a map with neighbourhood-by-neighbourhood
              safety notes and an in-depth briefing, under the &quot;Map&quot; tab.
            </p>
            <p>Think of this report as a stoplight for your car on the way to adventure:</p>
          </div>

          <div className="mt-4">
            <StoplightStrip stacked />
          </div>

          <div className="prose-brief mt-5 space-y-4 text-[0.94rem] leading-relaxed text-[var(--ink-soft)]">
            <p>
              This resource is best used for urban and town settings. If you&apos;re venturing into
              the mountains or far off the beaten path, we recommend using the site to assess your
              base camp or starting point.
            </p>
            <p>
              You can also compare and contrast prospective trips against the ratings of places
              you&apos;ve already been, and use those as a watermark for future decisions —{" "}
              <strong>every report is free</strong>.
            </p>

            <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              How does it work?
            </h2>
            <p>
              This product may seem impossibly difficult, but we promise we&apos;ve figured it out.
              We&apos;re not trying to boil the Mediterranean, power-wash the pyramids, or count
              each brick on the Great Wall of China.
            </p>
            <p>
              Instead we use a proprietary combination of proven sources: meticulously assembled
              databases built with millions in funding, detailed private research projects focusing
              on important subjects like human trafficking and sexual violence, and high-density
              crowdsourced information for every major city in the world.
            </p>
            <p>
              First, we extract the most important indicators. Then we weight each of those data
              points by importance and by user demographic, to create an overall rating out of 100.
              Violent crime, for example, is valued more heavily than crimes committed against
              businesses; for women, more emphasis is placed on sexual crime and on safety walking
              alone; if you&apos;re travelling primarily for nightlife, the city&apos;s safety
              during those hours becomes more integral to the final score. Finally, each statistic
              and the overall rating are compiled into one comprehensive, easily intelligible
              report — ready for you to screenshot, share or compare.
            </p>
            <p>
              If you&apos;d like to learn more about the specific weighting process and algorithm,
              it&apos;s all written up in the{" "}
              <Link href="/methodology">full methodology</Link> — or just{" "}
              <a href="mailto:malek@ismytripsafe.com">contact us</a>.
            </p>

            <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              Why not ChatGPT?
            </h2>
            <p>
              You can put your destination into ChatGPT, but you&apos;ll be severely disappointed.
              An LLM lacks any definable metric of rating and knows nothing about who you are,
              which leaves you with an uninspiring answer. The report will be 100% anecdotal — and
              all of those anecdotes will be out of date, because it relies on news from when it
              was trained.
            </p>
            <p>
              IsMyTripSafe is free and takes just a few seconds longer — which is good! Those
              seconds are us actively updating and customising the report every single time, to
              give you a healthy balance of real user sentiment and hard data.
            </p>

            <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
              Can I contribute?
            </h2>
            <p>
              Yes. We&apos;re always looking to add data in the name of improving the product and
              adding a human connection component. If you&apos;re a travel influencer or blogger,
              we&apos;d love to partner. Similarly, if you live in — or have travelled to — a
              certain destination and can provide more insight, we&apos;d be grateful to hear your
              opinion.
            </p>
          </div>

          <div className="mt-11 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-9">
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
            <a
              href="mailto:malek@ismytripsafe.com?subject=Contributing%20to%20IsMyTripSafe"
              className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
            >
              <Mail size={14} />
              Tell us about a place you know
            </a>
          </div>

          <SeoFooter />
        </div>
      </main>
    </>
  )
}
