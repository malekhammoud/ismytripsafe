import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { absUrl } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, SeoFooter, SiteHeader } from "@/components/seo/shared"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Disclaimer — IsMyTripSafe",
    description:
      "IsMyTripSafe provides AI-generated travel risk assessments based on publicly available information. Read our full disclaimer before relying on a report.",
    alternates: { canonical: "/disclaimer" },
    openGraph: {
      title: "Disclaimer — IsMyTripSafe",
      description:
        "What our travel safety reports are — and are not — before you rely on one.",
      url: absUrl("/disclaimer"),
      siteName: "IsMyTripSafe",
      type: "website",
    },
  }
}

export default function DisclaimerPage() {
  const trail = [
    { name: "Home", href: "/" },
    { name: "Disclaimer", href: "/disclaimer" },
  ]
  const jsonLd = graph(organizationNode(), websiteNode(), breadcrumbNode(trail), {
    "@type": "WebPage",
    name: "Disclaimer",
    url: absUrl("/disclaimer"),
    isPartOf: { "@id": `${absUrl("/")}#website` },
  })

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

        <div className="mx-auto max-w-[680px]">
          <Breadcrumbs trail={trail} />

          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--navy)]">
            Disclaimer
          </h1>

          <div className="mt-5 space-y-4 text-[0.94rem] leading-[1.75] text-[var(--ink-soft)]">
            <p>
              IsMyTripSafe provides AI-generated travel risk assessments based on publicly
              available information analyzed at the time your report is generated. Our platform
              calculates the relative level of travel risk based on available data; it does not
              predict or guarantee that a particular event will or will not occur. A destination
              assessed as presenting a lower level of risk may still experience unexpected
              incidents, and a destination assessed as higher risk may not experience any adverse
              events during your visit.
            </p>
            <p>
              While we strive to provide accurate and up-to-date information, we cannot guarantee
              that every source is complete, accurate, or free from errors. Travel conditions can
              change rapidly and without notice.
            </p>
            <p>
              By using IsMyTripSafe, you acknowledge that travel involves inherent and
              unpredictable risks. To the fullest extent permitted by applicable law, IsMyTripSafe,
              its owners, and contributors disclaim liability for any loss, injury, damage,
              expense, or other consequences arising from the use of or reliance on information
              provided through the service.
            </p>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-7">
            <Link href="/" className="btn inline-flex items-center gap-2 px-5 py-2.5 text-sm">
              <ShieldCheck size={15} />
              Check a destination
            </Link>
            <Link
              href="/methodology"
              className="text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
            >
              How we score safety →
            </Link>
          </div>

          <SeoFooter />
        </div>
      </main>
    </>
  )
}
