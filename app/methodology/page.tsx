import type { Metadata } from "next"
import Link from "next/link"
import { absUrl } from "@/lib/site"
import { breadcrumbNode, graph, organizationNode, websiteNode } from "@/lib/seo/jsonld"
import { Breadcrumbs, SeoFooter, SiteHeader } from "@/components/seo/shared"

export const metadata: Metadata = {
  title: "Methodology — How IsMyTripSafe Scores Travel Safety",
  description:
    "Exactly how each 0–100 safety score is computed: the 20+ indicators, the six hazard families and how they combine, the hard caps, the databases behind them, how AI field research is used and verified, and the system's limitations.",
  alternates: { canonical: "/methodology" },
}

const SOURCES: { name: string; role: string; url: string }[] = [
  { name: "U.S. Department of State travel advisories", role: "Official advisory level (1–4), pulled from the State Department RSS feed", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" },
  { name: "UK Foreign Office (FCDO)", role: "Official UK travel advice and structured alert status, from the gov.uk content API", url: "https://www.gov.uk/foreign-travel-advice" },
  { name: "Government of Canada travel advisories", role: "Canada's official risk level (normal precautions → avoid all travel), from its open-data feed", url: "https://travel.gc.ca/travelling/advisories" },
  { name: "World Bank Open Data (WDI)", role: "Homicide rate per 100,000 (UNODC-sourced)", url: "https://data.worldbank.org/" },
  { name: "Worldwide Governance Indicators", role: "Political stability, rule of law, control of corruption, government effectiveness, regulatory quality, voice & accountability (percentile ranks)", url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators" },
  { name: "UN SDG Global Database", role: "Feeling safe walking alone at night (16.1.4), physical and sexual violence victimisation (16.1.3), trafficking (16.2.2), bribery (16.5.1)", url: "https://unstats.un.org/sdgs/dataportal" },
  { name: "World Bank Enterprise Surveys", role: "Businesses experiencing theft/vandalism; crime as a business constraint", url: "https://www.enterprisesurveys.org/" },
  { name: "Global Terrorism Database (via Our World in Data)", role: "Terrorism deaths in the latest recorded year", url: "https://www.start.umd.edu/gtd/" },
  { name: "WHO Global Health Observatory", role: "Road-traffic death rates; hospital-bed density fallback", url: "https://www.who.int/data/gho" },
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

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">The composite index</h2>
          <p>
            20+ indicators are grouped into six <strong>hazard families</strong>: crime,
            conflict &amp; terrorism, official guidance, institutions &amp; rule of law,
            everyday hazards, and health &amp; environment. Within a family the indicators are
            averaged — they are several noisy readings of one underlying thing, so averaging
            cancels noise. Across families they are <em>not</em> averaged.
          </p>
          <p>
            That distinction is the whole design. Averaging across families is
            &quot;compensatory&quot;: a good indicator cancels a bad one. For travel risk that
            is simply wrong — clean air does not offset an armed conflict. So families are
            combined on the risk scale through a generalised mean that weights severity, which
            means high risk in any one family dominates the result instead of being diluted by
            the calmer ones. Family weights: crime 30%, conflict 20%, official guidance 20%,
            institutions 14%, everyday hazards 10%, health 6%.
          </p>
          <p>
            Raw values are normalised onto a 0–100 safety scale with piecewise bands calibrated
            per indicator (a homicide rate of 1/100k ≈ 94, 20/100k ≈ 26). Governance percentiles
            are used as-is. Counts are always per-capita, never absolute. When a primary source
            has no data, the pipeline falls back through independent secondary databases (UNODC
            via Our World in Data, WHO, V-Dem), then regional aggregates — each fallback labeled
            as such on the report. Every report also carries a <strong>confidence</strong> figure:
            the share of the weighting actually backed by measured data.
          </p>

          <h3 className="font-display !mt-6 text-[1.1rem] font-medium tracking-tight text-[var(--ink)]">Hard caps</h3>
          <p>
            Some facts are categorical, not quantitative. &quot;Do not travel&quot; is not a
            data point to be weighed against air quality — it is a statement that bounds the
            answer. So a handful of conditions set a <strong>ceiling</strong> on the score
            rather than contributing a term to it: a Level 4 advisory caps the score at 18, a
            Level 3 advisory at 44, a homicide rate above 40/100k at 30, and bottom-5%
            political stability (active conflict) at 22. When a cap binds, the report says so
            and names the reason. No other indicator — and no traveller-type re-weighting —
            can lift a score above its cap.
          </p>

          <h3 className="font-display !mt-6 text-[1.1rem] font-medium tracking-tight text-[var(--ink)]">Reporting reliability</h3>
          <p>
            Recorded-crime statistics are only as trustworthy as the institutions producing
            them. A country in the 40th percentile for rule of law reporting 1.2 homicides per
            100k is not making the same claim as one in the 87th percentile reporting 0.5. So
            where institutions are weak, flattering crime figures are shrunk toward what the
            institutional data supports. The adjustment only ever lowers a crime score, never
            raises one — a country with strong institutions honestly reporting high crime keeps
            its high crime.
          </p>

          <h3 className="font-display !mt-6 text-[1.1rem] font-medium tracking-tight text-[var(--ink)]">Missing data</h3>
          <p>
            Dropping a missing hazard family and renormalising the rest quietly assumes it
            matches the families we <em>can</em> see — which systematically flatters closed and
            unsurveyed countries, exactly the places least likely to publish crime statistics.
            Instead, a missing core family is filled with a conservative prior derived from the
            families that did resolve, marked as estimated on the report, and reflected in the
            confidence figure.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">AI field research — and how it&apos;s bounded</h2>
          <p>
            Databases lag reality, so each report also includes AI-assisted field research: an
            agent searches current news and traveller reporting for recent incidents, unrest,
            district-level safety, scams and sentiment, with the database profile and official
            advisories supplied as fixed ground truth it must not contradict. Its street-crime
            ratings and traveller-sentiment read contribute <strong>18%</strong> of the final
            published score; the databases keep 82%. Robbery and pickpocketing are scored on
            separate scales, because a threat to your person and a threat to your wallet are
            not the same risk. The field research is bound by the same caps as the composite —
            a positive sentiment read cannot argue away a &quot;Do Not Travel&quot; advisory. Advisory levels are never AI-generated —
            they are shown verbatim from the issuing governments&apos; own feeds. We disclose
            this on every report because you should know which parts are measured and which are
            researched.
          </p>
          <p>
            That research is published as a score of its own — the{" "}
            <strong>traveller-sentiment score</strong>, shown beside the crime score on every
            report. It combines how safe travellers report actually feeling day to day (35%) with
            current robbery (45%) and pickpocketing (20%) risk, on the same 0–100 scale as
            everything else. It is not a second opinion sitting next to the headline number: it
            is exactly the 18% term inside it, the part the databases cannot see.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">The score pyramid</h2>
          <p>
            Each report leads with the composite, then the five scores behind it, arranged by how
            directly a traveller meets them. <strong>Crime</strong> and{" "}
            <strong>traveller sentiment</strong> sit on the upper tier — the two you feel walking
            down a street. <strong>Advisories</strong>, <strong>stability</strong> and{" "}
            <strong>health &amp; air</strong> sit below as context. Every tile reads straight off
            the same engine as the headline, so a tile can never disagree with the number above it,
            and each one links to the evidence it came from.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Traveller-type adjustments</h2>
          <p>
            Per-traveller scores (solo, family, nightlife, 65+) are deterministic re-weightings
            of the already-computed category scores — extra weight on crime for a solo nightlife
            trip, on health &amp; care for families and older travellers, capped so the general
            score stays the backbone and re-bounded by the same hard caps. Same inputs, same number, every time.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Update cadence &amp; dates</h2>
          <p>
            Live feeds (advisories, air quality, disaster alerts, weather) are fetched at report
            build time. A report&apos;s &quot;last updated&quot; date is the moment its data was
            actually rebuilt — we never bump dates without rebuilding the data behind them.
            Reports are rebuilt on demand once they&apos;re older than seven days.
          </p>

          <h2 className="font-display !mt-8 text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">Limitations</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Most statistical indicators are national; city-level nuance comes from Numbeo (where cities have enough contributors), OpenStreetMap, live environmental feeds and the field research.</li>
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

        <p className="mt-6 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
          Questions about the methodology? See{" "}
          <Link href="/about" className="font-medium text-[var(--accent-deep)] hover:underline">who runs IsMyTripSafe</Link>{" "}
          or start from{" "}
          <Link href="/destinations" className="font-medium text-[var(--accent-deep)] hover:underline">all destination reports</Link>.
        </p>

        <SeoFooter />
      </div>
    </main>
    </>
  )
}
