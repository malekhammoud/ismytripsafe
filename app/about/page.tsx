import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Mail, Quote } from "lucide-react"
import { absUrl, monthYear } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import {
  Breadcrumbs,
  DocSection,
  FaqList,
  ReportDoc,
  SeoFooter,
  SiteHeader,
  sectionNumberer,
} from "@/components/seo/shared"
import banner from "@/public/brand/banner.jpg"
import river from "@/public/brand/river-ica-peru.jpg"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear()
  return {
    title: `About Us (${year}) — The Two People Behind IsMyTripSafe`,
    description:
      "IsMyTripSafe.com was founded in 2026 by two young entrepreneurs in North America: a solo traveller who has crossed four continents and a builder who wanted one honest answer instead of forty browser tabs.",
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
  const num = sectionNumberer(0)

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

        {/* The brand banner, used at the one width where its three panels read */}
        <div className="photo-frame mb-9 hidden sm:block">
          <Image
            src={banner}
            alt="IsMyTripSafe — one place, one click, one report"
            placeholder="blur"
            sizes="(max-width: 896px) 100vw, 896px"
            priority
          />
        </div>

        <div className="mx-auto max-w-[680px]">
          <Breadcrumbs trail={trail} />

          <h1 className="font-display text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--navy)]">
            About us
          </h1>
          <p className="mt-1.5 text-[0.8rem] text-[var(--ink-faint)]">
            Independent travel safety reports · page current as of {monthYear()}
          </p>
          <p className="mt-4 text-[1rem] leading-[1.75] text-[var(--ink)]">
            IsMyTripSafe.com was founded in 2026 by two young entrepreneurs in North America, as a
            tool for travellers across the globe to access up-to-date, personalised and insightful
            information — within seconds.
          </p>

          {/* ─── Founders ─────────────────────────────────────── */}
          <section className="mt-10">
            <h2 className="swash text-[1.35rem]">The two of us</h2>

            {/* River — photo, caption and the quote that started it */}
            <div className="mt-9 grid gap-6 sm:grid-cols-[1fr_15rem] sm:gap-8">
              <div>
                <h3 className="font-display text-[1.15rem] font-medium text-[var(--navy)]">
                  River Tompkins
                </h3>
                <p className="label mt-0.5" style={{ letterSpacing: "0.12em" }}>
                  Co-founder · Ross School of Business
                </p>
                <div className="mt-3.5 space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    River solo travelled four continents last year and has no plan to stop. Between
                    late-night hostel chats and copious amounts of trip planning, he understands
                    what fellow explorers are looking for.
                  </p>
                  <p>
                    He thinks the benefits and joy of travel are endless, and wants to support
                    others in experiencing it to the fullest by equipping them with the tools to
                    determine what is — and what is not — the right adventure for them. In
                    today&apos;s digital world a lack of information should never be the reason you
                    shy away from a trip. Equally, before booking those plane tickets you should
                    know what you&apos;re getting yourself into as far as safety and stability are
                    concerned. Leave the rest unknown, for tons of adventure while confident in
                    your own health and wellbeing.
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

            {/* The reason the site exists, in his words */}
            <blockquote
              className="mt-7 rounded-[3px] px-5 py-5 sm:px-7 sm:py-6"
              style={{ background: "rgba(243,108,10,0.06)", borderLeft: "3px solid var(--orange)" }}
            >
              <Quote size={17} style={{ color: "var(--orange)" }} aria-hidden />
              <p className="font-display mt-2 text-[clamp(1.02rem,2.4vw,1.2rem)] leading-[1.65] text-[var(--ink)]">
                My Mom and I spent hours scrolling through forums and government sites, searching
                for peace of mind more than anything — when we could have used IsMyTripSafe, if
                only it existed!
              </p>
              <footer className="mt-3 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                River Tompkins, co-founder
              </footer>
            </blockquote>

            {/* Malek */}
            <div className="mt-11 border-t border-[var(--hairline)] pt-9">
              <h3 className="font-display text-[1.15rem] font-medium text-[var(--navy)]">
                Malek Hammoud
              </h3>
              <p className="label mt-0.5" style={{ letterSpacing: "0.12em" }}>
                Co-founder · Computer Science, McMaster University
              </p>
              <div className="mt-3.5 space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                <p>
                  Malek brings the technical savvy to the table. He&apos;s the kind of person who
                  takes things apart to find out how they work — electronics on the desk in his
                  spare time, drones in the air when the weather cooperates — and he built
                  IsMyTripSafe for a simple reason: the answer to &quot;is it safe there?&quot; was
                  always scattered across a dozen government pages and a hundred forum posts, none
                  of which knew the first thing about the person asking.
                </p>
                <p>
                  He travels too — hikes in national parks, and regular trips to Lebanon, where
                  advisories can change faster than the news covers them. Being able to see exactly
                  where things stand in a few seconds is the whole reason this site exists.
                </p>
              </div>
            </div>
          </section>

          {/* ─── The document: what we stand behind ───────────── */}
          <div className="mt-11">
            <ReportDoc>
              <DocSection num={num()} kicker="The idea" title="Why this exists" first>
                <div className="space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    The safety information travellers can actually find is either a government
                    advisory written for an entire country, a forum thread from four years ago, or
                    a listicle written to sell a tour. None of it tells you how one place compares
                    with another, and none of it shows its work.
                  </p>
                  <p>
                    Every report here is computed, not written. Nothing is hand-tuned for a
                    particular destination, which is what makes two scores comparable: when one
                    city scores twelve points above another, that gap came out of the same
                    arithmetic applied to both. Where the data is thin, the report says so and the
                    score carries a confidence figure rather than quietly flattering the place.
                  </p>
                  <p>
                    It is also meant to be honest about risk in both directions — not sugar-coating
                    a genuinely dangerous city, and not fear-mongering about a safe one because its
                    name sounds unfamiliar. If you want the step-by-step version of how a report is
                    put together, that&apos;s{" "}
                    <Link href="/how-it-works" className="font-medium text-[var(--accent-deep)] hover:underline">
                      how it works
                    </Link>
                    .
                  </p>
                </div>
              </DocSection>

              <DocSection num={num()} kicker="Contents" title="What's in every report">
                <ul className="space-y-2 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <li>
                    <strong className="text-[var(--ink)]">One score and one verdict</strong> — 0–100
                    with a plain-English answer, plus how it compares with every other country.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">The five scores behind it</strong>
                    {" — "}crime and traveller sentiment on top, advisories, stability and health
                    &amp; air as context. Each links to the evidence it came from.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">Official advisories verbatim</strong> —
                    U.S. State Department, UK FCDO and Canada, quoted from their own feeds and never
                    AI-generated.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">The current situation</strong> — dated
                    recent developments, common scams, robbery and pickpocketing risk, and a written
                    briefing with its sources linked.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">A district-by-district map</strong> — named
                    neighbourhoods rated safe, caution or avoid.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">Your version of the score</strong>
                    {" — "}re-weighted for who&apos;s actually travelling, with the findings that
                    matter for that party pulled to the top.
                  </li>
                </ul>
              </DocSection>

              <DocSection num={num()} kicker="Independence" title="How it's paid for">
                <div className="space-y-3.5 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <p>
                    IsMyTripSafe is independent. It is not owned by, sponsored by or affiliated with
                    any tourism board, hotel group, insurer or travel seller.
                  </p>
                  <p>
                    <strong className="text-[var(--ink)]">No destination can pay to change its
                    score</strong>, and there are no paid placements, affiliate rankings or
                    sponsored &quot;safest cities&quot; lists. Reports are free to read, and the
                    underlying data for each report is published as JSON under CC BY 4.0 so anyone
                    can check the arithmetic.
                  </p>
                  <p>
                    Where AI is used it is disclosed on the page — it researches current conditions
                    and carries 18% of the score. It never sets advisory levels and never overrides
                    a measured indicator.
                  </p>
                </div>
              </DocSection>

              <DocSection num={num()} kicker="Limits" title="What this can't tell you">
                <ul className="space-y-2 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  <li>
                    Most statistical indicators are{" "}
                    <strong className="text-[var(--ink)]">national</strong>. City-level detail comes
                    from crowdsourced indices, live environmental feeds, mapped hospitals and the
                    field research — a big country is not uniform.
                  </li>
                  <li>
                    Survey data is often <strong className="text-[var(--ink)]">years old</strong>.
                    Every value on a report shows the year it was measured; nothing is presented as
                    more current than it is.
                  </li>
                  <li>
                    A score is a summary of risk,{" "}
                    <strong className="text-[var(--ink)]">not a guarantee</strong>. Safe places have
                    bad nights and risky places have uneventful decades.
                  </li>
                  <li>
                    This is{" "}
                    <strong className="text-[var(--ink)]">
                      general information, not legal, medical or security advice
                    </strong>
                    . Always read your own government&apos;s current advisory before you travel.
                  </li>
                </ul>
              </DocSection>

              <DocSection num={num()} kicker="Questions" title="Common questions">
                <FaqList
                  items={[
                    {
                      q: "How often are reports updated?",
                      a: (
                        <p>
                          Live feeds — advisories, air quality, disaster alerts, weather — are
                          fetched when a report is built, and a report older than seven days is
                          rebuilt on request. The date on each report is the moment its data was
                          actually rebuilt; dates are never bumped without new data behind them.
                        </p>
                      ),
                    },
                    {
                      q: "Why does the score change when I say who's travelling?",
                      a: (
                        <p>
                          Because the same city is not equally risky for everyone. Answering
                          &quot;who&apos;s going?&quot; shifts weight onto the categories that bear
                          on that party — street crime for a woman travelling alone or a night out,
                          health care for families and older travellers — using fixed arithmetic,
                          capped so the general score stays the backbone. It is a re-weighting of
                          the same measured data, not a different opinion.
                        </p>
                      ),
                    },
                    {
                      q: "Is a low score the same as 'don't go'?",
                      a: (
                        <p>
                          No. It means the measurable risk is higher and the report is telling you
                          where it comes from. Plenty of people travel safely in low-scoring places
                          by knowing which districts, which hours and which scams to watch for —
                          which is exactly what the report sets out.
                        </p>
                      ),
                    },
                    {
                      q: "I found something wrong. Will you fix it?",
                      a: (
                        <p>
                          Yes — email the report URL and what looks wrong. Reports are rebuilt from
                          fresh data on request, and genuine scoring errors get fixed for every
                          destination at once, not patched for one city.
                        </p>
                      ),
                    },
                  ]}
                />
              </DocSection>

              <DocSection num={num()} kicker="Contact" title="Get in touch">
                <p className="text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
                  Corrections, data partnerships, press questions, influencer collaborations, or a
                  report that doesn&apos;t match what&apos;s happening on the ground:
                </p>
                <a
                  href="mailto:malek@malekhammoud.com"
                  className="mt-3.5 inline-flex items-center gap-2 rounded-[3px] px-4 py-3 text-[0.9rem] font-semibold text-[var(--orange-deep)]"
                  style={{ background: "rgba(243,108,10,0.08)", border: "1px solid rgba(243,108,10,0.25)" }}
                >
                  <Mail size={15} strokeWidth={2.2} />
                  malek@malekhammoud.com
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
              href="/how-it-works"
              className="text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
            >
              How to read a report →
            </Link>
            <Link
              href="/methodology"
              className="text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
            >
              Read the full methodology →
            </Link>
          </div>

          <SeoFooter />
        </div>
      </main>
    </>
  )
}
