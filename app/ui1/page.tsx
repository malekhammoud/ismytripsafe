import {
  ShieldAlert,
  Landmark,
  Siren,
  HeartPulse,
  Newspaper,
  MapPin,
  Ban,
  Wind,
  Activity,
  ArrowRight,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe.com — UI mockup #1: "Stacked Signal Bands"
   Full-width color bands, saturated edges → pale center,
   one band per report section, verdict color per section.
   ──────────────────────────────────────────────────────────── */

type Tone = "safe" | "moderate" | "caution" | "risky";

const TONES: Record<Tone, string> = {
  safe: "var(--safe)",
  moderate: "var(--moderate)",
  caution: "var(--caution)",
  risky: "var(--risky)",
};

function bandGradient(tone: Tone) {
  const c = TONES[tone];
  return `linear-gradient(90deg,
    ${c} 0%,
    color-mix(in srgb, ${c} 55%, var(--paper)) 7%,
    color-mix(in srgb, ${c} 14%, #fdfdfc) 20%,
    color-mix(in srgb, ${c} 8%, #fdfdfc) 50%,
    color-mix(in srgb, ${c} 14%, #fdfdfc) 80%,
    color-mix(in srgb, ${c} 55%, var(--paper)) 93%,
    ${c} 100%)`;
}

/* ── Shared band scaffold ─────────────────────────────────── */

function Band({
  tone,
  num,
  kicker,
  title,
  status,
  children,
  delay,
}: {
  tone: Tone;
  num: string;
  kicker: string;
  title: string;
  status: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <section
      className="relative border-t-2 first:border-t-0 rise-in"
      style={{
        background: bandGradient(tone),
        borderColor: "rgba(20, 25, 34, 0.75)",
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 py-12 md:px-10 md:py-14">
        <header className="mb-7 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span
            className="tnum text-[0.72rem] font-bold tracking-[0.16em]"
            style={{ color: TONES[tone] }}
          >
            {num}
          </span>
          <h2 className="font-display text-2xl font-medium tracking-tight text-[var(--ink)] md:text-[1.7rem]">
            {title}
          </h2>
          <span className="hidden h-px min-w-8 flex-1 sm:block" style={{ background: "var(--hairline)" }} />
          <span
            className="rounded-full px-3 py-1 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-white"
            style={{ background: TONES[tone] }}
          >
            {status}
          </span>
          <p className="label w-full !text-[0.64rem]" style={{ color: "var(--ink-faint)" }}>
            {kicker}
          </p>
        </header>
        {children}
      </div>
    </section>
  );
}

/* ── Small pieces ─────────────────────────────────────────── */

function scoreTone(score: number): Tone {
  if (score >= 70) return "safe";
  if (score >= 50) return "moderate";
  if (score >= 35) return "caution";
  return "risky";
}

function SignalBar({
  label,
  value,
  score,
  source,
}: {
  label: string;
  value: string;
  score: number;
  source: string;
}) {
  const tone = scoreTone(score);
  return (
    <div className="rounded-xl border bg-white/75 px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{label}</span>
        <span className="tnum text-[0.82rem] font-bold" style={{ color: TONES[tone] }}>
          {score}
          <span className="font-normal text-[var(--ink-faint)]">/100</span>
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-3">
        <span className="text-[0.72rem] text-[var(--ink-soft)]">{value}</span>
        <span className="text-[0.62rem] text-[var(--ink-faint)]">{source}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(20,25,34,0.08)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: TONES[tone] }}
        />
      </div>
    </div>
  );
}

/* ── Data (hardcoded sample) ──────────────────────────────── */

const CRIME_SIGNALS = [
  { label: "Homicide rate", value: "24.9 /100k", score: 26, source: "World Bank, 2023" },
  { label: "Political stability", value: "28/100", score: 28, source: "WGI, 2024" },
  { label: "Rule of law", value: "31/100", score: 31, source: "WGI, 2024" },
  { label: "Control of corruption", value: "22/100", score: 22, source: "WGI, 2024" },
  { label: "Government effectiveness", value: "45/100", score: 45, source: "WGI, 2024" },
  { label: "Road traffic deaths", value: "12.7 /100k", score: 59, source: "World Bank, 2021" },
  { label: "Armed-conflict deaths", value: "None reported", score: 100, source: "World Bank, 2023" },
];

const HEALTH_SIGNALS = [
  { label: "Air quality", value: "US AQI 72 · Moderate", score: 78, source: "Open-Meteo, live" },
  { label: "Travel health notices", value: "2 notices · max Alert", score: 60, source: "CDC" },
  { label: "Recent earthquakes", value: "3 quakes · max M5.8", score: 62, source: "USGS, last 90 days" },
];

const COMPARISON = [
  { name: "Japan", v: 0.2 },
  { name: "Switzerland", v: 0.5 },
  { name: "United States", v: 5.7 },
  { name: "World average", v: 5.8 },
  { name: "Brazil", v: 21.3 },
  { name: "Mexico", v: 24.9, self: true },
  { name: "South Africa", v: 41.9 },
];

const NEWS = [
  "Tourist areas saw increased National Guard patrols in June 2026",
  "Pickpocketing spike reported on Metro Line 2",
  "No major unrest in the capital in the past 90 days",
];

const SAFE_AREAS = ["Polanco", "Roma Norte", "Condesa", "Coyoacán"];
const AVOID_AREAS = ["Tepito", "Doctores (after dark)", "Iztapalapa"];

/* ── Page ─────────────────────────────────────────────────── */

export default function UI1Page() {
  return (
    <main className="relative z-10 min-h-screen">
      {/* ── Brand header ── */}
      <header
        className="border-b"
        style={{ borderColor: "rgba(20,25,34,0.75)", borderBottomWidth: 2, background: "var(--paper)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg text-white"
              style={{ background: "var(--accent)" }}
            >
              <ShieldAlert size={18} strokeWidth={2.2} />
            </span>
            <span className="wordmark text-xl text-[var(--ink)]">
              IsMyTripSafe
              <span className="text-[var(--ink-faint)]">.com</span>
            </span>
          </div>
          <p className="eyebrow !tracking-[0.18em]">
            One destination, one click, one report
          </p>
        </div>
        {/* Destination strip */}
        <div className="border-t" style={{ borderColor: "var(--hairline)", background: "#fff" }}>
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4 md:px-10">
            <h1 className="font-display text-[1.5rem] font-medium tracking-tight text-[var(--ink)] md:text-[1.8rem]">
              Mexico City, Mexico <span aria-hidden>🇲🇽</span>
            </h1>
            <p className="tnum text-[0.78rem] text-[var(--ink-faint)]">
              Safety report · Assessed 2 Jul 2026
            </p>
          </div>
        </div>
      </header>

      {/* ── Band 1 · Composite rating ── */}
      <Band
        tone="caution"
        num="01"
        kicker="Composite Safety Index · weighted blend of 10 evidence signals"
        title="Overall Rating"
        status="Caution"
        delay={0}
      >
        <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
          <div className="flex items-baseline gap-2">
            <span
              className="display-xl tnum !text-[5rem] md:!text-[6.5rem]"
              style={{ color: "var(--caution)" }}
            >
              47
            </span>
            <span className="font-display text-2xl text-[var(--ink-faint)]">/100</span>
          </div>
          <div className="max-w-md flex-1 text-center md:text-left">
            <p className="font-display text-xl font-medium text-[var(--ink)] md:text-2xl">
              Caution advised
            </p>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
              Mexico scores in the lower-middle of the index — safer than roughly{" "}
              <strong className="tnum">38%</strong> of countries assessed. Go informed, not alarmed.
            </p>
            {/* Verdict scale */}
            <div className="mt-5">
              <div className="relative h-2.5 rounded-full" style={{
                background: "linear-gradient(90deg, var(--risky), var(--caution), var(--moderate), var(--safe))",
              }}>
                <span
                  className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md"
                  style={{ left: "47%", background: "var(--caution)" }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                <span>Risky</span>
                <span>Caution</span>
                <span>Moderate</span>
                <span>Safe</span>
              </div>
            </div>
          </div>
        </div>
      </Band>

      {/* ── Band 2 · Advisories ── */}
      <Band
        tone="risky"
        num="02"
        kicker="Official government guidance · worst active source: UK FCDO Level 3"
        title="Travel Advisories"
        status="Elevated"
        delay={90}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              source: "U.S. Department of State",
              level: "Level 2",
              verdict: "Exercise Increased Caution",
              tone: "caution" as Tone,
              quote:
                "Exercise increased caution due to crime and kidnapping. Some areas have increased risk.",
              updated: "Updated Jun 2026",
            },
            {
              source: "UK Foreign Office (FCDO)",
              level: "Level 3",
              verdict: "Against all-but-essential travel to parts",
              tone: "risky" as Tone,
              quote:
                "FCDO advises against all but essential travel to parts of Mexico. Your travel insurance could be invalidated if you travel against advice.",
              updated: "Updated Jun 2026",
            },
          ].map((a) => (
            <article
              key={a.source}
              className="card !rounded-2xl p-5"
              style={{ borderLeft: `4px solid ${TONES[a.tone]}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                    <Landmark size={12} /> {a.source}
                  </p>
                  <p className="mt-1.5 font-display text-lg font-medium leading-snug text-[var(--ink)]">
                    {a.verdict}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-md px-2.5 py-1 text-[0.68rem] font-bold text-white"
                  style={{ background: TONES[a.tone] }}
                >
                  {a.level}
                </span>
              </div>
              <p className="mt-3 border-l-2 pl-3 text-[0.82rem] italic leading-relaxed text-[var(--ink-soft)]" style={{ borderColor: "var(--hairline)" }}>
                “{a.quote}”
              </p>
              <p className="tnum mt-3 text-[0.66rem] text-[var(--ink-faint)]">{a.updated}</p>
            </article>
          ))}
        </div>
      </Band>

      {/* ── Band 3 · Crime & governance ── */}
      <Band
        tone="moderate"
        num="03"
        kicker="Country-level crime and institutional strength · 0–100, higher is safer"
        title="Crime Index"
        status="Weak signals"
        delay={180}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CRIME_SIGNALS.map((s) => (
            <SignalBar key={s.label} {...s} />
          ))}
          {/* Comparison mini-chart occupies the last cells */}
          <div
            className="rounded-xl border bg-white/75 px-4 py-3 sm:col-span-2 lg:col-span-2"
            style={{ borderColor: "var(--hairline)" }}
          >
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
              <Siren size={12} /> Homicide per 100k — in context
            </p>
            <div className="mt-3 space-y-1.5">
              {COMPARISON.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span
                    className={`w-28 shrink-0 text-[0.7rem] ${c.self ? "font-bold text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}
                  >
                    {c.name}
                  </span>
                  <div className="h-2 flex-1 rounded-full" style={{ background: "rgba(20,25,34,0.06)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.v / 41.9) * 100}%`,
                        background: c.self ? "var(--risky)" : "var(--sand)",
                      }}
                    />
                  </div>
                  <span className={`tnum w-10 shrink-0 text-right text-[0.7rem] ${c.self ? "font-bold" : "text-[var(--ink-faint)]"}`}>
                    {c.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Band>

      {/* ── Band 4 · Health & environment ── */}
      <Band
        tone="safe"
        num="04"
        kicker="Air, disease and seismic conditions · mostly favourable right now"
        title="Health & Air Quality"
        status="Good"
        delay={270}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            {HEALTH_SIGNALS.map((s) => (
              <SignalBar key={s.label} {...s} />
            ))}
          </div>
          <div className="card !rounded-2xl p-5">
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
              <HeartPulse size={12} /> CDC travel health notices
            </p>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-white"
                  style={{ background: "var(--caution)" }}
                >
                  Alert
                </span>
                <span className="text-[0.86rem] text-[var(--ink-soft)]">
                  Rocky Mountain Spotted Fever in Mexico
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-white"
                  style={{ background: "var(--moderate)" }}
                >
                  Watch
                </span>
                <span className="text-[0.86rem] text-[var(--ink-soft)]">
                  Salmonella Newport in Mexico
                </span>
              </li>
            </ul>
            <div className="hairline my-4" />
            <p className="flex items-center gap-2 text-[0.8rem] text-[var(--ink-soft)]">
              <Wind size={14} className="shrink-0 text-[var(--safe)]" />
              Live air quality is Moderate (US AQI 72) — fine for most travelers; sensitive groups may
              limit prolonged outdoor exertion.
            </p>
            <p className="mt-2 flex items-center gap-2 text-[0.8rem] text-[var(--ink-soft)]">
              <Activity size={14} className="shrink-0 text-[var(--safe)]" />
              3 earthquakes in the last 90 days (max M5.8) — normal background seismicity for the region.
            </p>
          </div>
        </div>
      </Band>

      {/* ── Band 5 · Local intelligence ── */}
      <Band
        tone="safe"
        num="05"
        kicker="AI-synthesized brief · recent reporting and neighborhood guidance"
        title="Recent News & Local Intelligence"
        status="Stable"
        delay={360}
      >
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="card !rounded-2xl p-6 lg:col-span-3">
            <p className="eyebrow !text-[0.62rem]">Analyst brief</p>
            <p className="mt-3 font-display text-[1.12rem] font-normal leading-[1.65] text-[var(--ink)]">
              “Mexico City is manageable for informed travelers who stay in well-trodden districts, but
              the country-level data shows serious violent-crime and rule-of-law weaknesses. Stick to
              Polanco, Roma Norte, Condesa and Coyoacán, use Uber rather than street taxis, and keep
              valuables out of sight.”
            </p>
            <div className="hairline my-5" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--safe)" }}>
                  <MapPin size={12} /> Favour
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SAFE_AREAS.map((a) => (
                    <span
                      key={a}
                      className="rounded-full px-2.5 py-1 text-[0.72rem] font-medium"
                      style={{
                        background: "rgba(47,158,111,0.1)",
                        color: "#1e7a52",
                        border: "1px solid rgba(47,158,111,0.25)",
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--risky)" }}>
                  <Ban size={12} /> Avoid
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AVOID_AREAS.map((a) => (
                    <span
                      key={a}
                      className="rounded-full px-2.5 py-1 text-[0.72rem] font-medium"
                      style={{
                        background: "rgba(212,80,58,0.08)",
                        color: "#a83a28",
                        border: "1px solid rgba(212,80,58,0.22)",
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-white/75 p-6 lg:col-span-2" style={{ borderColor: "var(--hairline)" }}>
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
              <Newspaper size={12} /> On the ground · last 90 days
            </p>
            <ul className="mt-4 space-y-4">
              {NEWS.map((n, i) => (
                <li key={n} className="flex gap-3">
                  <span
                    className="tnum mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.62rem] font-bold text-white"
                    style={{ background: "var(--safe)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[0.85rem] leading-relaxed text-[var(--ink-soft)]">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      {/* ── Footer ── */}
      <footer
        className="border-t-2"
        style={{ borderColor: "rgba(20,25,34,0.75)", background: "var(--ink)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-8 md:px-10">
          <div>
            <p className="wordmark text-lg text-white">
              IsMyTripSafe<span className="text-white/40">.com</span>
            </p>
            <p className="mt-1 text-[0.72rem] text-white/50">
              One destination, one click, one report.
            </p>
          </div>
          <p className="max-w-sm text-[0.68rem] leading-relaxed text-white/40">
            Sources: U.S. State Dept, UK FCDO, World Bank, WGI, USGS, CDC, Open-Meteo. Informational
            only — not a substitute for official government guidance.
          </p>
          <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-white/70">
            Check another destination <ArrowRight size={13} />
          </p>
        </div>
      </footer>
    </main>
  );
}
