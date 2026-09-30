import type { Metadata } from "next"
import { absUrl } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, SeoFooter, SiteHeader } from "@/components/seo/shared"

export const metadata: Metadata = {
  title: "Methodology — How IsMyTripSafe Scores Travel Safety",
  description:
    "How each 0–100 travel-safety score is built: official government advisories, crime and governance statistics, health and hazards data, and on-the-ground field research — with the database list and our limitations.",
  alternates: { canonical: "/methodology" },
}

const SOURCES: { name: string; role: string; url: string }[] = [
  { name: "U.S. Department of State travel advisories", role: "Official advisory level (1–4), pulled from the State Department RSS feed", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" },
  { name: "UK Foreign Office (FCDO)", role: "Official UK travel advice and structured alert status, from the gov.uk content API", url: "https://www.gov.uk/foreign-travel-advice" },
  { name: "Government of Canada travel advisories", role: "Canada's official risk level (normal precautions → avoid all travel), from its open-data feed", url: "https://travel.gc.ca/travelling/advisories" },
  { name: "World Bank Open Data (WDI)", role: "Homicide rate per 100,000 (UNODC-sourced)", url: "https://data.worldbank.org/" },
  { name: "Worldwide Governance Indicators", role: "Political stability, rule of law, control of corruption, government effectiveness, regulatory quality, voice & accountability (percentile ranks)", url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators" },
  { name: "FBI Crime Data Explorer", role: "City-level violent and property crime rates per 100,000 for U.S. destinations (UCR Table 8)", url: "https://cde.ucr.cjis.gov/LATEST/webapp/" },
  { name: "UN SDG Global Database", role: "Feeling safe walking alone at night (16.1.4), physical and sexual violence victimisation (16.1.3), trafficking (16.2.2), bribery (16.5.1)", url: "https://unstats.un.org/sdgs/dataportal" },
  { name: "World Bank Enterprise Surveys", role: "Businesses experiencing theft/vandalism; crime as a business constraint", url: "https://www.enterprisesurveys.org/" },
  { name: "Global Terrorism Database (via Our World in Data)", role: "Terrorism deaths in the latest recorded year", url: "https://www.start.umd.edu/gtd/" },
  { name: "WHO Global Health Observatory", role: "Road-traffic death rates; hospital data fallbacks", url: "https://www.who.int/data/gho" },
  { name: "Numbeo Crime Index", role: "Crowdsourced crime & safety perception, city-level where available", url: "https://www.numbeo.com/crime/" },
  { name: "CDC Travelers' Health", role: "Active disease outbreak notices (Watch / Alert / Warning)", url: "https://wwwnc.cdc.gov/travel/notices" },
  { name: "GDACS", role: "Live natural-disaster alerts (earthquakes, cyclones, floods, volcanoes, wildfires) within 500 km", url: "https://www.gdacs.org/" },
  { name: "USGS Earthquake Catalog", role: "Significant earthquakes within 300 km over the past year", url: "https://earthquake.usgs.gov/" },
  { name: "Open-Meteo", role: "Live air quality (US AQI, PM2.5) and 16-day extreme-weather outlook", url: "https://open-meteo.com/" },
  { name: "OpenStreetMap", role: "Hospitals within 15 km of the destination", url: "https://www.openstreetmap.org/" },
  { name: "Wikivoyage", role: "Traveller-maintained \"Stay safe\" background, used as leads for the field research (verified before use)", url: "https://en.wikivoyage.org/" },
]

export default function MethodologyPage() {
  const trail = [
    { name: "Home", href: "/" },
    { name: "Methodology", href: "/methodology" },
  ]
  const jsonLd = graph(organizationNode(), websiteNode(), breadcrumbNode(trail), {
    "@type": "WebPage",
    name: "How IsMyTripSafe scores travel safety",
    url: absUrl("/methodology"),
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
          How we score travel safety
        </h1>

        <div className="prose-brief mt-5 space-y-4 text-[0.94rem] leading-relaxed text-[var(--ink-soft)]">
          <p>
            Every IsMyTripSafe report answers one question — <em>is this place safe to
            visit?</em> — with a 0–100 score (100 = safest) built the same way for every
            destination. Nothing on a report page is hand-written per city; everything is
            computed from the sources below, so scores are comparable across destinations.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">The score</h2>
          <p>
            20+ indicators are grouped into six <strong>hazard families</strong>: crime,
            conflict &amp; terrorism, official guidance, institutions &amp; rule of law,
            everyday hazards, and health &amp; environment. Within a family, indicators are
            averaged — they are several noisy readings of one underlying thing, so averaging
            cancels noise. Across families they are <em>not</em> averaged: a good score in
            one family cannot buy off a bad one elsewhere. High risk in any single family
            dominates the result, which is the only honest way to combine hazards a
            traveller would meet all at once.
          </p>
          <p>
            A few facts are categorical, not quantitative. A &quot;Do Not Travel&quot;
            advisory or active-conflict conditions set a <strong>ceiling</strong> on the
            score that no other indicator can argue away; when a ceiling binds, the report
            says so and names the reason.
          </p>
          <p>
            Where institutions are weak, flattering recorded-crime figures are read with
            appropriate caution, and a missing hazard family is never silently assumed
            safe — each report carries a <strong>confidence</strong> figure that says how
            much of the score is backed by measured data rather than estimates.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">AI-assisted field research</h2>
          <p>
            Databases lag reality, so each report also includes AI-assisted field research:
            an agent searches current news and traveller reporting for recent incidents,
            unrest, district-level safety, scams and traveller sentiment, with the
            database profile and official advisories supplied as fixed ground truth it must
            not contradict. That research contributes to the published score — its share
            is disclosed on every report — and its street-crime and sentiment findings are
            shown on the page with their sources.
          </p>
          <p>
            Advisory levels are never AI-generated — they are shown verbatim from the
            issuing governments&apos; own feeds. The scoring, the data and the published
            numbers are fully transparent; only the prose research summary is written by a
            model, over real, cited evidence.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Personalised scores</h2>
          <p>
            Safety is not one number. Per-traveller scores — solo, family, a women-only
            party, nightlife, 65+ — are deterministic re-weightings of the same category
            scores: more weight on health for families and older travellers, more on
            street-crime where it matters most. Same inputs, same answers, same number,
            every time — nothing about personalisation is AI-generated.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Update cadence</h2>
          <p>
            Live feeds (advisories, air quality, disaster alerts, weather) are fetched at
            report build time, and a report&apos;s &quot;last updated&quot; date is the
            moment its data was actually rebuilt — we never bump dates without rebuilding
            the data behind them. Reports are rebuilt on demand once they&apos;re older
            than seven days.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Limitations</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Most statistical indicators are national; city-level nuance comes from FBI and Numbeo (where cities have enough contributors), OpenStreetMap, live environmental feeds and the field research.</li>
            <li>Survey-based indicators (victimisation, feeling safe at night) can be years old — every value shows its year on the report.</li>
            <li>Crowdsourced indices reflect perception, which can diverge from recorded crime.</li>
            <li>A score is a summary, not a guarantee. Conditions change fast; check your government&apos;s advisory before you travel.</li>
          </ul>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Every source we use</h2>
        </div>

        <div className="mt-4 space-y-2">
          {SOURCES.map((s) => (
            <div key={s.name} className="card px-4 py-3">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[0.9rem] font-semibold text-[var(--ink)] hover:text-[var(--accent-deep)] hover:underline">
                {s.name}
              </a>
              <p className="mt-0.5 text-[0.8rem] leading-relaxed text-[var(--ink-soft)]">{s.role}</p>
            </div>
          ))}
        </div>

        <div className="card mt-6 border-l-4 px-4 py-4" style={{ borderLeftColor: "var(--accent)" }}>
          <p className="text-[0.92rem] text-[var(--ink)]">
            Want the full scoring specification?{" "}
            <a href="mailto:malek@ismytripsafe.com?subject=Scoring%20methodology" className="font-semibold text-[var(--accent-deep)] hover:underline">
              Email us
            </a>{" "}
            — we&apos;re happy to explain exactly how a specific report was scored.
          </p>
        </div>

        <p className="mt-6 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
          Questions about the methodology? See{" "}
          <a href="/about" className="font-medium text-[var(--accent-deep)] hover:underline">who runs IsMyTripSafe</a>{" "}
          or start from{" "}
          <a href="/destinations" className="font-medium text-[var(--accent-deep)] hover:underline">all destination reports</a>.
        </p>

        <SeoFooter />
      </div>
    </main>
    </>
  )
}