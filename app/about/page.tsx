import type { Metadata } from "next"
import Link from "next/link"
import { absUrl } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, SeoFooter, SiteHeader } from "@/components/seo/shared"

export const metadata: Metadata = {
  title: "About IsMyTripSafe — Who's Behind These Safety Reports",
  description:
    "IsMyTripSafe publishes independent, data-first travel safety reports. Who runs it, why it exists, how it's funded and how to get in touch.",
  alternates: { canonical: "/about" },
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
      <div className="mx-auto max-w-[680px]">
        <Breadcrumbs trail={trail} />
        <h1 className="font-display text-[clamp(1.6rem,5vw,2.1rem)] font-medium leading-tight tracking-tight text-[var(--ink)]">
          About IsMyTripSafe
        </h1>
        <div className="mt-5 space-y-4 text-[0.94rem] leading-relaxed text-[var(--ink-soft)]">
          <p>
            &quot;Is it safe there?&quot; is the question everyone asks before a trip — and the
            answers online are usually either anecdotes or fear. IsMyTripSafe exists to answer
            it with data: every report pulls the same 15+ public databases — government
            advisories, UN and World Bank crime statistics, WHO health data, live air-quality
            and disaster feeds — and turns them into one honest, comparable 0–100 score, with
            every underlying number and its source shown on the page.
          </p>
          <p>
            The site is built and run by <strong>Malek Hammoud</strong>, an independent
            developer. It is not sponsored by tourism boards, hotels or travel sellers, and no
            destination can pay to change a score. Reports mix measured data (75% of the score)
            with AI-assisted research over current local reporting (25%) — clearly disclosed,
            with the method documented in full in the{" "}
            <Link href="/methodology" className="font-medium text-[var(--accent-deep)] hover:underline">
              methodology
            </Link>
            .
          </p>
          <p>
            Spotted an error, or a report that doesn&apos;t match what&apos;s happening on the
            ground? Email{" "}
            <a href="mailto:malek@malekhammoud.com" className="font-medium text-[var(--accent-deep)] hover:underline">
              malek@malekhammoud.com
            </a>{" "}
            — reports are rebuilt from fresh data on request.
          </p>
        </div>
        <SeoFooter />
      </div>
    </main>
    </>
  )
}
