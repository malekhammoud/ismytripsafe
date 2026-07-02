import {
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  Activity,
  MapPin,
  Newspaper,
  Lightbulb,
  Stethoscope,
  Scale,
  FileText,
} from "lucide-react"

/* ────────────────────────────────────────────────────────────────
   UI-5 · "The Intelligence Dossier"
   Editorial printed-document mockup for IsMyTripSafe.com
   Static data · no client interactivity
──────────────────────────────────────────────────────────────── */

const SIGNALS = [
  { label: "Homicide rate", value: "24.9 /100k", score: 26, src: 1 },
  { label: "Road traffic deaths", value: "12.7 /100k", score: 59, src: 2 },
  { label: "Armed-conflict deaths", value: "None reported", score: 100, src: 3 },
  { label: "Political stability", value: "28/100", score: 28, src: 4 },
  { label: "Rule of law", value: "31/100", score: 31, src: 4 },
  { label: "Control of corruption", value: "22/100", score: 22, src: 4 },
  { label: "Government effectiveness", value: "45/100", score: 45, src: 4 },
  { label: "Recent earthquakes", value: "3 · max M5.8", score: 62, src: 5 },
  { label: "Air quality", value: "US AQI 72 · Moderate", score: 78, src: 6 },
  { label: "Travel health notices", value: "2 · max Alert", score: 60, src: 7 },
]

const SOURCES = [
  { n: 1, text: "World Bank — Intentional homicides per 100,000 people, 2023." },
  { n: 2, text: "World Bank — Road traffic mortality per 100,000 people, 2021." },
  { n: 3, text: "World Bank — Battle-related deaths, 2023." },
  { n: 4, text: "Worldwide Governance Indicators (WGI), 2024 release." },
  { n: 5, text: "USGS Earthquake Catalog — M4.5+ events within 300 km, trailing 90 days." },
  { n: 6, text: "Open-Meteo Air Quality API — live US AQI observation." },
  { n: 7, text: "U.S. CDC Travel Health Notices — active notices at time of issue." },
  { n: 8, text: "U.S. Department of State — Mexico Travel Advisory, June 2026." },
  { n: 9, text: "UK Foreign, Commonwealth & Development Office — Mexico travel advice, June 2026." },
]

const COMPARISON = [
  { country: "Japan", rate: 0.2 },
  { country: "Switzerland", rate: 0.5 },
  { country: "United States", rate: 5.7 },
  { country: "World average", rate: 5.8 },
  { country: "Brazil", rate: 21.3 },
  { country: "Mexico", rate: 24.9, focus: true },
  { country: "South Africa", rate: 41.9 },
]

const NEWS = [
  "Tourist areas saw increased National Guard patrols in June 2026",
  "Pickpocketing spike reported on Metro Line 2",
  "No major unrest in the capital in the past 90 days",
]

const TIPS = [
  "Use Uber or authorized taxi stands, never street-hail",
  "Keep phones off café tables in crowded areas",
  "Carry a photocopy of your passport, not the original",
  "Avoid Metro at rush hour with luggage",
]

function scoreColor(score: number) {
  if (score >= 70) return "var(--safe)"
  if (score >= 50) return "var(--moderate)"
  if (score >= 35) return "var(--caution)"
  return "var(--risky)"
}

function Sup({ n }: { n: number }) {
  return (
    <sup
      className="tnum"
      style={{ color: "var(--accent-deep)", fontWeight: 600, fontSize: "0.62em" }}
    >
      {n}
    </sup>
  )
}

function SectionHead({
  num,
  title,
  note,
}: {
  num: string
  title: string
  note?: string
}) {
  return (
    <div className="section-head mt-12 mb-4">
      <span className="section-num">§ {num}</span>
      <h2 className="section-title">{title}</h2>
      <div className="section-rule" />
      {note && <span className="section-note">{note}</span>}
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-[5px] flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--paper-deep)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: scoreColor(score) }}
        />
      </div>
      <span
        className="tnum w-7 text-right text-[0.72rem] font-semibold"
        style={{ color: scoreColor(score) }}
      >
        {score}
      </span>
    </div>
  )
}

export default function DossierMockup() {
  return (
    <div className="relative z-10 min-h-screen">
      {/* ── Brand bar ─────────────────────────────────────── */}
      <header
        className="border-b"
        style={{ borderColor: "var(--hairline)", background: "var(--glass-strong)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
            <span className="wordmark text-lg">
              IsMyTripSafe
              <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
            </span>
          </div>
          <p className="eyebrow hidden sm:block" style={{ letterSpacing: "0.18em" }}>
            One destination, one click, one report
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8">
        {/* ── Document masthead ───────────────────────────── */}
        <div className="rise-in">
          <div
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-y py-2"
            style={{ borderColor: "var(--ink)", borderTopWidth: 3, borderBottomWidth: 1 }}
          >
            <span className="label" style={{ color: "var(--ink-soft)" }}>
              Destination Safety Assessment
            </span>
            <span className="label tnum" style={{ color: "var(--ink-soft)" }}>
              Report № MX-CDMX-2026-0702
            </span>
            <span className="label tnum" style={{ color: "var(--ink-soft)" }}>
              Issued 2 Jul 2026 · 14:00 UTC
            </span>
            <span className="label" style={{ color: "var(--ink-soft)" }}>
              Unrestricted distribution
            </span>
          </div>

          {/* ── Verdict spread ─────────────────────────────── */}
          <div className="mt-9 grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <p className="eyebrow mb-3">Subject of assessment</p>
              <h1 className="display-xl">
                Mexico City<span style={{ color: "var(--ink-faint)" }}>,</span>
                <br />
                Mexico <span className="align-middle text-[0.45em]">🇲🇽</span>
              </h1>
              <p
                className="mt-5 max-w-xl text-[0.95rem] leading-relaxed"
                style={{ color: "var(--ink-soft)" }}
              >
                Composite index derived from ten weighted, independently sourced signals
                spanning crime, governance, natural hazard and public-health data.
                <Sup n={1} />
                <Sup n={4} /> Assessed 2 July 2026.
              </p>
            </div>

            {/* Score block + stamp */}
            <div className="flex items-start gap-6 md:flex-col md:items-end">
              <div className="text-left md:text-right">
                <p className="eyebrow mb-1">Composite Safety Index</p>
                <div className="flex items-baseline gap-1 md:justify-end">
                  <span
                    className="font-display tnum"
                    style={{
                      fontSize: "clamp(4rem, 9vw, 6.2rem)",
                      fontWeight: 500,
                      lineHeight: 0.9,
                      letterSpacing: "-0.03em",
                      color: "var(--caution)",
                    }}
                  >
                    47
                  </span>
                  <span
                    className="tnum text-xl"
                    style={{ color: "var(--ink-faint)" }}
                  >
                    /100
                  </span>
                </div>
                <p className="mt-2 text-[0.8rem]" style={{ color: "var(--ink-faint)" }}>
                  Safer than ~38% of countries assessed
                </p>
              </div>

              {/* Ink stamp */}
              <div
                aria-label="Assessment: caution"
                className="select-none px-4 py-2"
                style={{
                  border: "2.5px solid var(--caution)",
                  borderRadius: 6,
                  color: "var(--caution)",
                  transform: "rotate(-3.5deg)",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  opacity: 0.9,
                  mixBlendMode: "multiply",
                  boxShadow: "inset 0 0 8px rgba(224,138,59,0.25)",
                }}
              >
                Assessment: Caution
              </div>
            </div>
          </div>

          {/* Key judgments */}
          <figure
            className="mt-10 border-l-[3px] py-1 pl-6"
            style={{ borderColor: "var(--accent)" }}
          >
            <figcaption className="eyebrow mb-2" style={{ color: "var(--accent-deep)" }}>
              Key judgments
            </figcaption>
            <blockquote
              className="font-display max-w-3xl text-[1.25rem] leading-[1.55]"
              style={{ fontWeight: 450, color: "var(--ink)" }}
            >
              Mexico City is manageable for informed travelers who stay in well-trodden
              districts, but the country-level data shows serious violent-crime and
              rule-of-law weaknesses.
              <Sup n={1} />
              <Sup n={4} /> Stick to Polanco, Roma Norte, Condesa and Coyoacán, use Uber
              rather than street taxis, and keep valuables out of sight.
            </blockquote>
          </figure>
        </div>

        {/* ── Two-column editorial body ───────────────────── */}
        <div className="mt-6 grid gap-x-12 lg:grid-cols-[1fr_340px]">
          {/* ══ Main narrative column ══ */}
          <article>
            {/* 01 · Official advisories */}
            <SectionHead num="01" title="Official Government Advisories" note="verbatim excerpts" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="label" style={{ color: "var(--ink-soft)" }}>
                    U.S. Department of State<Sup n={8} />
                  </p>
                  <span
                    className="tnum whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider"
                    style={{
                      background: "rgba(200,151,63,0.14)",
                      color: "var(--moderate)",
                      border: "1px solid rgba(200,151,63,0.3)",
                    }}
                  >
                    Level 2
                  </span>
                </div>
                <p className="font-display mb-2 text-[1.02rem]" style={{ fontWeight: 550 }}>
                  Exercise Increased Caution
                </p>
                <p className="text-[0.85rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  “Exercise increased caution due to crime and kidnapping. Some areas have
                  increased risk.”
                </p>
                <a
                  href="https://travel.state.gov"
                  className="mt-3 inline-flex items-center gap-1.5 text-[0.76rem] font-semibold"
                  style={{ color: "var(--accent-deep)" }}
                >
                  travel.state.gov <ExternalLink size={12} />
                </a>
                <p className="mt-1.5 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                  Updated June 2026
                </p>
              </div>

              <div className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="label" style={{ color: "var(--ink-soft)" }}>
                    UK Foreign Office (FCDO)<Sup n={9} />
                  </p>
                  <span
                    className="tnum whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider"
                    style={{
                      background: "rgba(224,138,59,0.13)",
                      color: "var(--caution)",
                      border: "1px solid rgba(224,138,59,0.32)",
                    }}
                  >
                    Level 3
                  </span>
                </div>
                <p className="font-display mb-2 text-[1.02rem]" style={{ fontWeight: 550 }}>
                  Against All-but-Essential Travel to Parts
                </p>
                <p className="text-[0.85rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  “FCDO advises against all but essential travel to parts of Mexico. Your
                  travel insurance could be invalidated if you travel against advice.”
                </p>
                <a
                  href="https://www.gov.uk/foreign-travel-advice/mexico"
                  className="mt-3 inline-flex items-center gap-1.5 text-[0.76rem] font-semibold"
                  style={{ color: "var(--accent-deep)" }}
                >
                  gov.uk/foreign-travel-advice <ExternalLink size={12} />
                </a>
                <p className="mt-1.5 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                  Updated June 2026
                </p>
              </div>
            </div>

            {/* 02 · Homicide comparison */}
            <SectionHead num="02" title="Homicide Rate in Context" note="per 100k population¹" />
            <div className="card p-6">
              <div className="space-y-3">
                {COMPARISON.map((row) => {
                  const width = Math.max((row.rate / 41.9) * 100, 1.5)
                  return (
                    <div
                      key={row.country}
                      className="grid grid-cols-[110px_1fr_46px] items-center gap-3 sm:grid-cols-[130px_1fr_52px]"
                    >
                      <span
                        className="truncate text-[0.8rem]"
                        style={{
                          color: row.focus ? "var(--ink)" : "var(--ink-soft)",
                          fontWeight: row.focus ? 700 : 400,
                        }}
                      >
                        {row.country}
                        {row.focus && (
                          <span style={{ color: "var(--risky)" }}> ◀</span>
                        )}
                      </span>
                      <div
                        className="h-[10px] overflow-hidden rounded-sm"
                        style={{ background: "var(--paper-deep)" }}
                      >
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${width}%`,
                            background: row.focus
                              ? "var(--risky)"
                              : row.rate < 6
                                ? "var(--safe)"
                                : "var(--ink-faint)",
                            opacity: row.focus ? 1 : 0.75,
                          }}
                        />
                      </div>
                      <span
                        className="tnum text-right text-[0.8rem]"
                        style={{
                          color: row.focus ? "var(--risky)" : "var(--ink-faint)",
                          fontWeight: row.focus ? 700 : 500,
                        }}
                      >
                        {row.rate.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p
                className="mt-5 border-t pt-3 text-[0.74rem] leading-relaxed"
                style={{ borderColor: "var(--hairline)", color: "var(--ink-faint)" }}
              >
                Mexico’s national homicide rate is roughly 4.4× the U.S. rate and 125× that
                of Japan. Capital-city figures vary by district; see § 04.
              </p>
            </div>

            {/* 03 · CDC health notices */}
            <SectionHead num="03" title="Travel Health Notices" note="U.S. CDC⁷" />
            <div className="grid gap-3">
              {[
                {
                  tier: "Alert",
                  color: "var(--caution)",
                  bg: "rgba(224,138,59,0.12)",
                  text: "Rocky Mountain Spotted Fever in Mexico",
                },
                {
                  tier: "Watch",
                  color: "var(--moderate)",
                  bg: "rgba(200,151,63,0.12)",
                  text: "Salmonella Newport in Mexico",
                },
              ].map((n) => (
                <div key={n.text} className="card flex items-center gap-4 px-5 py-4">
                  <Stethoscope size={18} style={{ color: n.color, flexShrink: 0 }} />
                  <span
                    className="rounded px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-widest"
                    style={{ background: n.bg, color: n.color }}
                  >
                    {n.tier}
                  </span>
                  <span className="text-[0.88rem]" style={{ color: "var(--ink)" }}>
                    {n.text}
                  </span>
                </div>
              ))}
            </div>

            {/* 04 · Neighborhoods */}
            <SectionHead num="04" title="District-Level Guidance" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="card p-5"
                style={{ borderTop: "3px solid var(--safe)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <MapPin size={15} style={{ color: "var(--safe)" }} />
                  <p className="label" style={{ color: "var(--safe)" }}>
                    Generally safe districts
                  </p>
                </div>
                <ul className="space-y-2">
                  {["Polanco", "Roma Norte", "Condesa", "Coyoacán"].map((d) => (
                    <li
                      key={d}
                      className="flex items-baseline gap-2.5 text-[0.9rem]"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 flex-shrink-0 translate-y-[-1px] rounded-full"
                        style={{ background: "var(--safe)" }}
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="card p-5"
                style={{ borderTop: "3px solid var(--risky)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle size={15} style={{ color: "var(--risky)" }} />
                  <p className="label" style={{ color: "var(--risky)" }}>
                    Exercise heightened caution
                  </p>
                </div>
                <ul className="space-y-2">
                  {["Tepito", "Doctores (after dark)", "Iztapalapa"].map((d) => (
                    <li
                      key={d}
                      className="flex items-baseline gap-2.5 text-[0.9rem]"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 flex-shrink-0 translate-y-[-1px] rounded-full"
                        style={{ background: "var(--risky)" }}
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 05 · Recent developments */}
            <SectionHead num="05" title="Recent Developments" note="trailing 90 days" />
            <div className="card p-5">
              <ul className="space-y-3">
                {NEWS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Newspaper
                      size={15}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: "var(--ink-faint)" }}
                    />
                    <span className="text-[0.88rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 06 · Field guidance */}
            <SectionHead num="06" title="Field Guidance for Travelers" />
            <div className="grid gap-3 sm:grid-cols-2">
              {TIPS.map((tip, i) => (
                <div key={tip} className="card flex items-start gap-3 p-4">
                  <span
                    className="tnum flex-shrink-0 font-display text-[1.1rem]"
                    style={{ color: "var(--accent)", fontWeight: 600, lineHeight: 1.2 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <Lightbulb
                      size={13}
                      className="mb-1"
                      style={{ color: "var(--ink-faint)" }}
                    />
                    <p className="text-[0.86rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                      {tip}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* ══ Data sidebar ══ */}
          <aside className="mt-12 lg:mt-0">
            <div className="lg:sticky lg:top-6">
              <SectionHead num="A" title="Evidence Table" />
              <div className="card overflow-hidden">
                <div
                  className="flex items-center justify-between border-b px-4 py-2.5"
                  style={{ borderColor: "var(--hairline)", background: "var(--paper)" }}
                >
                  <span className="label">Signal</span>
                  <span className="label">Score / 100</span>
                </div>
                {SIGNALS.map((s, i) => (
                  <div
                    key={s.label}
                    className="px-4 py-3"
                    style={{
                      borderBottom:
                        i < SIGNALS.length - 1 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="text-[0.8rem] font-medium" style={{ color: "var(--ink)" }}>
                        {s.label}
                        <Sup n={s.src} />
                      </span>
                      <span
                        className="tnum whitespace-nowrap text-[0.72rem]"
                        style={{ color: "var(--ink-faint)" }}
                      >
                        {s.value}
                      </span>
                    </div>
                    <ScoreBar score={s.score} />
                  </div>
                ))}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: "var(--paper)", borderTop: "1px solid var(--ink)" }}
                >
                  <span className="label" style={{ color: "var(--ink)" }}>
                    Composite index
                  </span>
                  <span
                    className="tnum font-display text-[1.3rem]"
                    style={{ color: "var(--caution)", fontWeight: 600 }}
                  >
                    47<span className="text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>/100</span>
                  </span>
                </div>
              </div>

              {/* Live-data note */}
              <div
                className="mt-4 flex items-start gap-3 rounded-xl border p-4"
                style={{ borderColor: "var(--hairline)", background: "rgba(255,255,255,0.55)" }}
              >
                <Activity size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }} />
                <p className="text-[0.74rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  Air-quality and seismic signals refresh on every report generation. All
                  other indicators use the latest published vintage from their source.
                </p>
              </div>

              {/* Scale legend */}
              <div
                className="mt-4 rounded-xl border p-4"
                style={{ borderColor: "var(--hairline)", background: "rgba(255,255,255,0.55)" }}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <Scale size={14} style={{ color: "var(--ink-faint)" }} />
                  <span className="label">Index scale</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { range: "70–100", label: "Generally safe", c: "var(--safe)" },
                    { range: "50–69", label: "Moderate risk", c: "var(--moderate)" },
                    { range: "35–49", label: "Caution advised", c: "var(--caution)" },
                    { range: "0–34", label: "High risk", c: "var(--risky)" },
                  ].map((t) => (
                    <div key={t.range} className="flex items-center gap-2.5 text-[0.74rem]">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ background: t.c }}
                      />
                      <span className="tnum w-14" style={{ color: "var(--ink-faint)" }}>
                        {t.range}
                      </span>
                      <span style={{ color: "var(--ink-soft)" }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Sources & methodology footer ────────────────── */}
        <SectionHead num="07" title="Sources & Methodology" />
        <div className="card p-6">
          <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <p
                key={s.n}
                className="flex gap-2 text-[0.78rem] leading-relaxed"
                style={{ color: "var(--ink-soft)" }}
              >
                <span
                  className="tnum flex-shrink-0 font-semibold"
                  style={{ color: "var(--accent-deep)" }}
                >
                  {s.n}.
                </span>
                {s.text}
              </p>
            ))}
          </div>
          <p
            className="mt-5 border-t pt-4 text-[0.74rem] leading-relaxed"
            style={{ borderColor: "var(--hairline)", color: "var(--ink-faint)" }}
          >
            The Composite Safety Index weights each signal by its evidentiary strength and
            recency, then normalizes to a 0–100 scale against all countries assessed.
            IsMyTripSafe.com reports are informational and do not constitute official
            travel advice; always consult your government’s current advisory before
            departure.
          </p>
        </div>
      </main>

      {/* ── Site footer ─────────────────────────────────── */}
      <footer
        className="border-t py-8"
        style={{ borderColor: "var(--hairline)", background: "var(--paper-deep)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: "var(--ink-faint)" }} />
            <span className="wordmark text-[0.95rem]">
              IsMyTripSafe
              <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
            </span>
          </div>
          <p className="text-[0.74rem]" style={{ color: "var(--ink-faint)" }}>
            One destination, one click, one report · Report № MX-CDMX-2026-0702 ·
            © 2026 IsMyTripSafe
          </p>
        </div>
      </footer>
    </div>
  )
}
