import {
  ShieldCheck,
  Siren,
  HeartPulse,
  Sparkles,
  Landmark,
  Flag,
  MapPin,
  CheckCircle2,
  XCircle,
  Lightbulb,
  BookOpen,
  ExternalLink,
  Wind,
  Activity,
  Scale,
  Car,
  Bug,
} from "lucide-react"

/* ────────────────────────────────────────────────────────────────
   IsMyTripSafe.com — UI mockup #3 · "Quadrant Hub"
   Four evidence quadrants, a central verdict medallion overlapping
   the grid intersection, and a pennant-styled news rail.
   Static mockup — hardcoded sample data (Mexico City).
   ──────────────────────────────────────────────────────────────── */

const SCORE = 47
const RING_R = 84
const RING_C = 2 * Math.PI * RING_R

type Signal = { label: string; value: string; score: number; source: string }

const crimeSignals: Signal[] = [
  { label: "Homicide rate", value: "24.9 /100k", score: 26, source: "World Bank, 2023" },
  { label: "Political stability", value: "28/100", score: 28, source: "WGI, 2024" },
  { label: "Rule of law", value: "31/100", score: 31, source: "WGI, 2024" },
  { label: "Control of corruption", value: "22/100", score: 22, source: "WGI, 2024" },
]

const healthSignals: Signal[] = [
  { label: "Air quality", value: "US AQI 72 · Moderate", score: 78, source: "Open-Meteo, live" },
  { label: "Road traffic deaths", value: "12.7 /100k", score: 59, source: "World Bank, 2021" },
  { label: "Health notices", value: "2 notices · max Alert", score: 60, source: "CDC" },
  { label: "Recent earthquakes", value: "3 quakes · max M5.8", score: 62, source: "USGS, 90 days" },
]

const comparison = [
  { name: "Japan", v: 0.2 },
  { name: "Switzerland", v: 0.5 },
  { name: "United States", v: 5.7 },
  { name: "World avg", v: 5.8 },
  { name: "Brazil", v: 21.3 },
  { name: "Mexico", v: 24.9, self: true },
  { name: "South Africa", v: 41.9 },
]

const news = [
  "Tourist areas saw increased National Guard patrols in June 2026",
  "Pickpocketing spike reported on Metro Line 2",
  "No major unrest in the capital in the past 90 days",
]

const tips = [
  "Use Uber or authorized taxi stands, never street-hail",
  "Keep phones off café tables in crowded areas",
  "Carry a photocopy of your passport, not the original",
  "Avoid Metro at rush hour with luggage",
]

const resources = [
  { title: "U.S. State Dept — Mexico Travel Advisory", meta: "travel.state.gov · updated Jun 2026" },
  { title: "UK FCDO — Mexico Foreign Travel Advice", meta: "gov.uk · updated Jun 2026" },
  { title: "CDC Traveler Health Notices — Mexico", meta: "wwwnc.cdc.gov · 2 active notices" },
  { title: "Full methodology — how the 47/100 is computed", meta: "IsMyTripSafe.com/methodology" },
]

function scoreColor(score: number) {
  if (score >= 75) return "var(--safe)"
  if (score >= 55) return "var(--moderate)"
  if (score >= 40) return "var(--caution)"
  return "var(--risky)"
}

function SignalRow({ s }: { s: Signal }) {
  return (
    <div className="py-2.5 border-b last:border-b-0" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8rem] font-medium" style={{ color: "var(--ink-soft)" }}>
          {s.label}
        </span>
        <span className="tnum text-[0.8rem] font-semibold whitespace-nowrap" style={{ color: "var(--ink)" }}>
          {s.value}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <div className="h-[5px] flex-1 rounded-full overflow-hidden" style={{ background: "var(--paper-deep)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${s.score}%`, background: scoreColor(s.score) }}
          />
        </div>
        <span className="tnum text-[0.72rem] font-bold w-6 text-right" style={{ color: scoreColor(s.score) }}>
          {s.score}
        </span>
        <span className="text-[0.62rem] w-[7.2rem] text-right truncate" style={{ color: "var(--ink-faint)" }}>
          {s.source}
        </span>
      </div>
    </div>
  )
}

function QuadrantHead({
  icon,
  title,
  note,
  tint,
}: {
  icon: React.ReactNode
  title: string
  note: string
  tint: string
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${tint} 12%, white)`, color: tint }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-[1.05rem] leading-tight" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        <p className="text-[0.68rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
          {note}
        </p>
      </div>
    </div>
  )
}

export default function UI3Page() {
  return (
    <div className="relative z-10 min-h-screen">
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "var(--glass-strong)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-5 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <ShieldCheck size={17} strokeWidth={2.2} />
            </div>
            <span className="wordmark text-[1.15rem]" style={{ color: "var(--ink)" }}>
              IsMyTripSafe
              <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
            </span>
          </div>
          <p className="hidden md:block text-[0.78rem] italic font-display" style={{ color: "var(--ink-soft)" }}>
            One destination, one click, one report
          </p>
          <span
            className="text-[0.68rem] font-semibold px-3 py-1.5 rounded-full tnum"
            style={{
              background: "color-mix(in srgb, var(--accent) 10%, white)",
              color: "var(--accent-deep)",
              border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            }}
          >
            Report · 2 Jul 2026
          </span>
        </div>
      </header>

      {/* Slogan banner (mobile) */}
      <div
        className="md:hidden text-center py-2 text-[0.72rem] italic font-display"
        style={{ color: "var(--ink-soft)", borderBottom: "1px solid var(--hairline)" }}
      >
        One destination, one click, one report
      </div>

      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 pb-20">
        {/* ── Destination strip ─────────────────────────────── */}
        <div className="rise-in flex flex-wrap items-end justify-between gap-3 pt-8 pb-6">
          <div>
            <p className="eyebrow mb-2">Safety Report</p>
            <h1 className="display-lg" style={{ color: "var(--ink)" }}>
              Mexico City, Mexico <span className="text-[0.7em] align-middle">🇲🇽</span>
            </h1>
          </div>
          <p className="text-[0.78rem] tnum pb-1" style={{ color: "var(--ink-faint)" }}>
            Assessed 2 Jul 2026 · Safer than ~38% of countries
          </p>
        </div>

        {/* ── Hub: quadrant grid + medallion + news pennant ─── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_290px] items-start">
          {/* Quadrant grid with overlapping medallion */}
          <div className="relative">
            <div className="grid md:grid-cols-2 gap-4 md:gap-5">
              {/* Medallion — in normal flow on mobile, absolute-centered on md+ */}
              <div className="md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:z-20 flex justify-center md:block order-first md:order-none md:col-auto col-span-full scale-in">
                <div
                  className="relative w-[228px] h-[228px] rounded-full flex flex-col items-center justify-center text-center"
                  style={{
                    background: "var(--glass-strong)",
                    backdropFilter: "blur(24px) saturate(1.5)",
                    WebkitBackdropFilter: "blur(24px) saturate(1.5)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--shadow-float)",
                  }}
                >
                  {/* ring gauge */}
                  <svg
                    viewBox="0 0 200 200"
                    className="absolute inset-0 w-full h-full -rotate-90"
                    aria-hidden="true"
                  >
                    <circle cx="100" cy="100" r={RING_R} fill="none" stroke="var(--paper-deep)" strokeWidth="9" />
                    <circle
                      cx="100"
                      cy="100"
                      r={RING_R}
                      fill="none"
                      stroke="var(--caution)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={`${(SCORE / 100) * RING_C} ${RING_C}`}
                    />
                  </svg>
                  <p className="eyebrow" style={{ letterSpacing: "0.18em" }}>
                    Safety Index
                  </p>
                  <p className="tnum font-display leading-none mt-1" style={{ fontSize: "4rem", fontWeight: 550, color: "var(--ink)" }}>
                    47
                    <span className="text-[1.1rem] font-sans font-medium" style={{ color: "var(--ink-faint)" }}>
                      /100
                    </span>
                  </p>
                  <p
                    className="mt-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] px-3 py-1 rounded-full"
                    style={{
                      color: "#fff",
                      background: "var(--caution)",
                      boxShadow: "0 4px 12px -3px color-mix(in srgb, var(--caution) 60%, transparent)",
                    }}
                  >
                    Caution advised
                  </p>
                  <p className="mt-2 text-[0.7rem] font-medium flex items-center gap-1" style={{ color: "var(--ink-soft)" }}>
                    <MapPin size={11} /> Mexico City, MX
                  </p>
                </div>
              </div>

              {/* Q1 — Crime (top-left) */}
              <section className="card p-5 md:pb-24 rise-in" style={{ borderLeft: "3px solid var(--risky)", animationDelay: "0.05s" }}>
                <QuadrantHead
                  icon={<Siren size={17} />}
                  title="Crime"
                  note="Violent crime & institutional strength"
                  tint="var(--risky)"
                />
                {crimeSignals.map((s) => (
                  <SignalRow key={s.label} s={s} />
                ))}
              </section>

              {/* Q2 — Health & Air (top-right) */}
              <section className="card p-5 md:pb-24 rise-in" style={{ borderLeft: "3px solid var(--safe)", animationDelay: "0.1s" }}>
                <QuadrantHead
                  icon={<HeartPulse size={17} />}
                  title="Health & Air"
                  note="Environment, disease & hazards"
                  tint="var(--safe)"
                />
                {healthSignals.map((s) => (
                  <SignalRow key={s.label} s={s} />
                ))}
              </section>

              {/* Q3 — AI Knowledge (bottom-left) */}
              <section className="card p-5 md:pt-24 rise-in" style={{ borderLeft: "3px solid var(--accent)", animationDelay: "0.15s" }}>
                <QuadrantHead
                  icon={<Sparkles size={17} />}
                  title="AI Knowledge"
                  note="Synthesized research briefing"
                  tint="var(--accent)"
                />
                <p className="text-[0.86rem] leading-[1.75]" style={{ color: "var(--ink-soft)" }}>
                  Mexico City is <strong style={{ color: "var(--ink)" }}>manageable for informed travelers</strong> who
                  stay in well-trodden districts, but the country-level data shows serious violent-crime and
                  rule-of-law weaknesses. Stick to Polanco, Roma Norte, Condesa and Coyoacán, use Uber rather than
                  street taxis, and keep valuables out of sight.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Polanco", "Roma Norte", "Condesa", "Coyoacán"].map((n) => (
                    <span
                      key={n}
                      className="text-[0.68rem] font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: "color-mix(in srgb, var(--safe) 11%, white)",
                        color: "#1e7a52",
                        border: "1px solid color-mix(in srgb, var(--safe) 25%, transparent)",
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </section>

              {/* Q4 — Gov Advisories (bottom-right) */}
              <section className="card p-5 md:pt-24 rise-in" style={{ borderLeft: "3px solid var(--risky)", animationDelay: "0.2s" }}>
                <QuadrantHead
                  icon={<Landmark size={17} />}
                  title="Gov Advisories"
                  note="Official government travel guidance"
                  tint="var(--risky)"
                />
                <div className="space-y-3">
                  <div className="rounded-xl p-3.5" style={{ background: "color-mix(in srgb, var(--moderate) 8%, white)", border: "1px solid color-mix(in srgb, var(--moderate) 22%, transparent)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.72rem] font-bold" style={{ color: "var(--ink)" }}>
                        U.S. Department of State
                      </p>
                      <span className="text-[0.64rem] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--moderate)", color: "#fff" }}>
                        Level 2
                      </span>
                    </div>
                    <p className="text-[0.78rem] mt-1.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                      “Exercise increased caution due to crime and kidnapping. Some areas have increased risk.”
                    </p>
                    <p className="text-[0.62rem] mt-1.5" style={{ color: "var(--ink-faint)" }}>
                      Exercise Increased Caution · updated Jun 2026
                    </p>
                  </div>
                  <div className="rounded-xl p-3.5" style={{ background: "color-mix(in srgb, var(--risky) 7%, white)", border: "1px solid color-mix(in srgb, var(--risky) 22%, transparent)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.72rem] font-bold" style={{ color: "var(--ink)" }}>
                        UK Foreign Office (FCDO)
                      </p>
                      <span className="text-[0.64rem] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--risky)", color: "#fff" }}>
                        Level 3
                      </span>
                    </div>
                    <p className="text-[0.78rem] mt-1.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                      “FCDO advises against all but essential travel to parts of Mexico. Your travel insurance could
                      be invalidated if you travel against advice.”
                    </p>
                    <p className="text-[0.62rem] mt-1.5" style={{ color: "var(--ink-faint)" }}>
                      Against all-but-essential travel to parts · updated Jun 2026
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* ── News pennant rail ─────────────────────────────── */}
          <aside className="rise-in space-y-4" style={{ animationDelay: "0.25s" }}>
            {/* pennant flag header */}
            <div className="relative">
              <div
                className="relative text-white px-4 py-3 flex items-center gap-2.5"
                style={{
                  background: "linear-gradient(135deg, var(--accent-deep), var(--accent))",
                  clipPath: "polygon(0 0, 100% 0, calc(100% - 18px) 50%, 100% 100%, 0 100%)",
                  borderRadius: "10px 0 0 10px",
                  boxShadow: "0 8px 20px -8px color-mix(in srgb, var(--accent) 55%, transparent)",
                }}
              >
                <Flag size={15} />
                <div>
                  <p className="text-[0.82rem] font-bold leading-tight">Recent News</p>
                  <p className="text-[0.62rem] opacity-80">On-the-ground signals · last 90 days</p>
                </div>
              </div>
              {/* flagpole */}
              <div
                className="absolute -left-[3px] -top-1 -bottom-4 w-[3px] rounded-full"
                style={{ background: "var(--ink-faint)" }}
              />
            </div>

            <div className="card p-4 space-y-3.5 ml-2">
              {news.map((n, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span
                    className="mt-[5px] w-2 h-2 rounded-full shrink-0"
                    style={{ background: i === 1 ? "var(--caution)" : "var(--accent)" }}
                  />
                  <p className="text-[0.8rem] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
                    {n}
                  </p>
                </div>
              ))}
            </div>

            {/* CDC notices */}
            <div className="card p-4 ml-2">
              <p className="label mb-3 flex items-center gap-1.5">
                <Bug size={12} /> CDC Health Notices
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--caution)", color: "#fff" }}>
                    ALERT
                  </span>
                  <p className="text-[0.76rem]" style={{ color: "var(--ink-soft)" }}>
                    Rocky Mountain Spotted Fever in Mexico
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--moderate)", color: "#fff" }}>
                    WATCH
                  </span>
                  <p className="text-[0.76rem]" style={{ color: "var(--ink-soft)" }}>
                    Salmonella Newport in Mexico
                  </p>
                </div>
              </div>
            </div>

            {/* comparison mini-chart */}
            <div className="card p-4 ml-2">
              <p className="label mb-3 flex items-center gap-1.5">
                <Activity size={12} /> Homicide /100k · Compared
              </p>
              <div className="space-y-2">
                {comparison.map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span
                      className="text-[0.68rem] w-[5.6rem] shrink-0 truncate"
                      style={{ color: c.self ? "var(--ink)" : "var(--ink-faint)", fontWeight: c.self ? 700 : 500 }}
                    >
                      {c.name}
                    </span>
                    <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: "var(--paper-deep)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(c.v / 41.9) * 100}%`,
                          background: c.self ? "var(--caution)" : "var(--sand)",
                          minWidth: 3,
                        }}
                      />
                    </div>
                    <span className="tnum text-[0.66rem] w-8 text-right font-semibold" style={{ color: c.self ? "var(--caution)" : "var(--ink-faint)" }}>
                      {c.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ── Neighborhoods ─────────────────────────────────── */}
        <div className="section-head mt-12 mb-4">
          <span className="section-num">01</span>
          <span className="section-title">Neighborhoods</span>
          <span className="section-rule" />
          <span className="section-note">local granularity</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5" style={{ borderTop: "3px solid var(--safe)" }}>
            <p className="label mb-3 flex items-center gap-1.5" style={{ color: "#1e7a52" }}>
              <CheckCircle2 size={13} /> Generally Safe
            </p>
            <div className="flex flex-wrap gap-2">
              {["Polanco", "Roma Norte", "Condesa", "Coyoacán"].map((n) => (
                <span
                  key={n}
                  className="text-[0.82rem] font-medium px-3.5 py-1.5 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--safe) 10%, white)",
                    color: "#1e7a52",
                    border: "1px solid color-mix(in srgb, var(--safe) 26%, transparent)",
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
            <p className="text-[0.74rem] mt-3" style={{ color: "var(--ink-faint)" }}>
              Well-patrolled districts with strong tourist infrastructure and nightlife.
            </p>
          </div>
          <div className="card p-5" style={{ borderTop: "3px solid var(--risky)" }}>
            <p className="label mb-3 flex items-center gap-1.5" style={{ color: "var(--risky)" }}>
              <XCircle size={13} /> Avoid
            </p>
            <div className="flex flex-wrap gap-2">
              {["Tepito", "Doctores (after dark)", "Iztapalapa"].map((n) => (
                <span
                  key={n}
                  className="text-[0.82rem] font-medium px-3.5 py-1.5 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--risky) 8%, white)",
                    color: "var(--risky)",
                    border: "1px solid color-mix(in srgb, var(--risky) 24%, transparent)",
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
            <p className="text-[0.74rem] mt-3" style={{ color: "var(--ink-faint)" }}>
              Elevated street-crime rates; avoid on foot, especially after dark.
            </p>
          </div>
        </div>

        {/* ── Safety Tips ───────────────────────────────────── */}
        <div className="section-head mt-10 mb-4">
          <span className="section-num">02</span>
          <span className="section-title">Safety Tips</span>
          <span className="section-rule" />
          <span className="section-note">4 field-tested rules</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tips.map((t, i) => (
            <div key={i} className="card p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--gold) 14%, white)", color: "#a9762f" }}
                >
                  {i === 0 ? <Car size={14} /> : i === 3 ? <Wind size={14} /> : <Lightbulb size={14} />}
                </div>
                <span className="tnum text-[0.66rem] font-bold" style={{ color: "var(--ink-faint)" }}>
                  TIP {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="text-[0.82rem] leading-[1.6] font-medium" style={{ color: "var(--ink-soft)" }}>
                {t}
              </p>
            </div>
          ))}
        </div>

        {/* ── Additional Resources ──────────────────────────── */}
        <div className="section-head mt-10 mb-4">
          <span className="section-num">03</span>
          <span className="section-title">Additional Resources</span>
          <span className="section-rule" />
          <span className="section-note">primary sources</span>
        </div>
        <div className="card divide-y" style={{ borderColor: "var(--hairline)" }}>
          {resources.map((r) => (
            <a
              key={r.title}
              href="#"
              className="flex items-center justify-between gap-4 px-5 py-4 group"
              style={{ borderColor: "var(--hairline)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen size={15} style={{ color: "var(--accent)" }} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-[0.86rem] font-semibold truncate group-hover:underline" style={{ color: "var(--ink)" }}>
                    {r.title}
                  </p>
                  <p className="text-[0.7rem] truncate" style={{ color: "var(--ink-faint)" }}>
                    {r.meta}
                  </p>
                </div>
              </div>
              <ExternalLink size={14} style={{ color: "var(--ink-faint)" }} className="shrink-0" />
            </a>
          ))}
        </div>

        {/* methodology note */}
        <p className="mt-8 text-[0.72rem] leading-relaxed flex items-start gap-2" style={{ color: "var(--ink-faint)" }}>
          <Scale size={13} className="mt-[1px] shrink-0" />
          Composite index blends 10 evidence signals from the World Bank, WGI, USGS, CDC, Open-Meteo and official
          government advisories. Scores are directional guidance, not a guarantee of personal safety.
        </p>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--hairline)", background: "rgba(255,255,255,0.5)" }}>
        <div className="max-w-[1200px] mx-auto px-5 lg:px-8 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} style={{ color: "var(--accent)" }} />
            <span className="wordmark text-[0.95rem]" style={{ color: "var(--ink)" }}>
              IsMyTripSafe<span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
            </span>
          </div>
          <p className="text-[0.72rem] italic font-display" style={{ color: "var(--ink-soft)" }}>
            One destination, one click, one report
          </p>
          <p className="text-[0.7rem] tnum" style={{ color: "var(--ink-faint)" }}>
            © 2026 · Data refreshed 2 Jul 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
