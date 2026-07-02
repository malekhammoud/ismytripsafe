import {
  ShieldCheck,
  ShieldAlert,
  HeartPulse,
  Landmark,
  Siren,
  Newspaper,
  MapPin,
  Lightbulb,
  Database,
  Globe,
  Stethoscope,
  TriangleAlert,
  CircleCheck,
  Ban,
  Info,
  ExternalLink,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 6: "The Flight-Deck Scorecard"
   Static mockup. All data hardcoded; all components inline.
   ──────────────────────────────────────────────────────────── */

type Level = "safe" | "moderate" | "caution" | "risky";

const LEVEL_COLOR: Record<Level, string> = {
  safe: "var(--safe)",
  moderate: "var(--moderate)",
  caution: "var(--caution)",
  risky: "var(--risky)",
};

const LEVEL_LABEL: Record<Level, string> = {
  safe: "Good",
  moderate: "Fair",
  caution: "Caution",
  risky: "Elevated",
};

function levelOf(score: number): Level {
  if (score >= 70) return "safe";
  if (score >= 55) return "moderate";
  if (score >= 35) return "caution";
  return "risky";
}

/* ── Data ─────────────────────────────────────────────────── */

const SUBSCORES = [
  {
    label: "Advisories",
    score: 42,
    icon: Globe,
    note: "2 gov notices active",
    spark: [55, 50, 48, 44, 46, 43, 42],
  },
  {
    label: "Crime",
    score: 31,
    icon: Siren,
    note: "Homicide 24.9 /100k",
    spark: [36, 34, 33, 30, 32, 31, 31],
  },
  {
    label: "Health & Air",
    score: 71,
    icon: HeartPulse,
    note: "AQI 72 · 2 CDC notices",
    spark: [64, 66, 69, 72, 70, 73, 71],
  },
  {
    label: "Stability",
    score: 32,
    icon: Landmark,
    note: "WGI governance basket",
    spark: [35, 34, 33, 33, 31, 32, 32],
  },
];

const SIGNALS = [
  { label: "Homicide rate", value: "24.9 /100k", score: 26, source: "World Bank, 2023" },
  { label: "Road traffic deaths", value: "12.7 /100k", score: 59, source: "World Bank, 2021" },
  { label: "Armed-conflict deaths", value: "None reported", score: 100, source: "World Bank, 2023" },
  { label: "Political stability", value: "28/100", score: 28, source: "WGI, 2024" },
  { label: "Rule of law", value: "31/100", score: 31, source: "WGI, 2024" },
  { label: "Control of corruption", value: "22/100", score: 22, source: "WGI, 2024" },
  { label: "Government effectiveness", value: "45/100", score: 45, source: "WGI, 2024" },
  { label: "Recent earthquakes", value: "3 quakes · max M5.8", score: 62, source: "USGS, last 90 days" },
  { label: "Air quality", value: "US AQI 72 · Moderate", score: 78, source: "Open-Meteo, live" },
  { label: "Travel health notices", value: "2 notices · max Alert", score: 60, source: "CDC" },
];

const COMPARISON = [
  { name: "Japan", value: 0.2 },
  { name: "Switzerland", value: 0.5 },
  { name: "United States", value: 5.7 },
  { name: "World average", value: 5.8 },
  { name: "Brazil", value: 21.3 },
  { name: "Mexico", value: 24.9, highlight: true },
  { name: "South Africa", value: 41.9 },
];
const COMPARISON_MAX = 41.9;

const NEWS = [
  "Tourist areas saw increased National Guard patrols in June 2026",
  "Pickpocketing spike reported on Metro Line 2",
  "No major unrest in the capital in the past 90 days",
];

const TIPS = [
  "Use Uber or authorized taxi stands, never street-hail",
  "Keep phones off café tables in crowded areas",
  "Carry a photocopy of your passport, not the original",
  "Avoid Metro at rush hour with luggage",
];

const DATABASES = [
  "U.S. State Dept.",
  "UK FCDO",
  "CDC Travel Health",
  "World Bank WDI",
  "Worldwide Governance Indicators",
  "USGS Earthquakes",
  "Open-Meteo Air Quality",
];

/* ── Gauge geometry ───────────────────────────────────────── */
// Semicircle r=104 → arc length = π·104 ≈ 326.73
const GAUGE_R = 104;
const GAUGE_LEN = Math.PI * GAUGE_R; // 326.7256
const SCORE = 47;
const GAUGE_TARGET_OFFSET = GAUGE_LEN * (1 - SCORE / 100);

/* ── Small pieces ─────────────────────────────────────────── */

function StatusPill({ level, text }: { level: Level; text?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold tracking-wide"
      style={{
        color: LEVEL_COLOR[level],
        background: `color-mix(in srgb, ${LEVEL_COLOR[level]} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${LEVEL_COLOR[level]} 30%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: LEVEL_COLOR[level] }}
      />
      {text ?? LEVEL_LABEL[level]}
    </span>
  );
}

function SectionHead({
  num,
  title,
  note,
}: {
  num: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="section-head">
      <span className="section-num">{num}</span>
      <h2 className="section-title">{title}</h2>
      <span className="section-rule" />
      {note ? <span className="section-note">{note}</span> : null}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function FlightDeckScorecard() {
  return (
    <div className="relative z-10 min-h-screen">
      <style>{`
        @keyframes gaugeFill {
          from { stroke-dashoffset: ${GAUGE_LEN.toFixed(2)}; }
          to   { stroke-dashoffset: ${GAUGE_TARGET_OFFSET.toFixed(2)}; }
        }
        .gauge-arc {
          stroke-dasharray: ${GAUGE_LEN.toFixed(2)};
          stroke-dashoffset: ${GAUGE_TARGET_OFFSET.toFixed(2)};
          animation: gaugeFill 1.4s cubic-bezier(0.3, 0.9, 0.3, 1) 0.25s both;
        }
        @keyframes barGrow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .bar-grow {
          transform-origin: left center;
          animation: barGrow 0.9s cubic-bezier(0.25, 0.9, 0.3, 1) both;
        }
        .deck-tile {
          transition: transform 0.18s ease, box-shadow 0.22s ease;
        }
        .deck-tile:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-float);
        }
      `}</style>

      {/* ── Masthead ──────────────────────────────────────── */}
      <header className="border-b" style={{ borderColor: "var(--hairline)" }}>
        <div
          className="w-full py-1.5 text-center text-[0.7rem] font-semibold tracking-[0.18em] uppercase"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          One destination, one click, one report
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <ShieldCheck size={17} strokeWidth={2.2} />
            </span>
            <span className="wordmark text-[1.28rem]">
              IsMyTripSafe
              <span style={{ color: "var(--ink-faint)" }}>.com</span>
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-[0.82rem] font-medium sm:flex" style={{ color: "var(--ink-soft)" }}>
            <span>Destinations</span>
            <span>Methodology</span>
            <span>Alerts</span>
            <span
              className="rounded-full px-4 py-1.5 text-[0.8rem] font-semibold"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              New report
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-10">
        {/* ── Hero band: destination + gauge cockpit ──────── */}
        <section className="card rise-in mt-6 overflow-hidden" style={{ animationDelay: "0.05s" }}>
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_auto_1fr] lg:items-center">
            {/* Destination */}
            <div>
              <p className="eyebrow">Safety report · Assessed 2 Jul 2026</p>
              <h1 className="display-lg mt-2.5">
                Mexico City
                <span className="ml-3 align-middle text-[0.55em]">🇲🇽</span>
              </h1>
              <p className="mt-1 text-[0.95rem]" style={{ color: "var(--ink-faint)" }}>
                United Mexican States · UTC−6 · Report #MX-CDMX-0702
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <StatusPill level="caution" text="Caution advised" />
                <span className="text-[0.8rem]" style={{ color: "var(--ink-soft)" }}>
                  Safer than <strong className="tnum">~38%</strong> of countries
                </span>
              </div>
              <p
                className="mt-5 max-w-md border-l-2 pl-4 text-[0.9rem] leading-relaxed"
                style={{ borderColor: "var(--caution)", color: "var(--ink-soft)" }}
              >
                Manageable for informed travelers who stay in well-trodden
                districts — but country-level data shows serious violent-crime
                and rule-of-law weaknesses.
              </p>
            </div>

            {/* Gauge */}
            <div className="mx-auto w-full max-w-[300px]">
              <svg viewBox="0 0 260 152" className="w-full" role="img" aria-label="Composite safety index 47 out of 100">
                {/* tick marks */}
                {[0, 25, 50, 75, 100].map((t) => {
                  const a = Math.PI * (1 - t / 100);
                  const cx = 130, cy = 134;
                  const x1 = cx + Math.cos(a) * 118;
                  const y1 = cy - Math.sin(a) * 118;
                  const x2 = cx + Math.cos(a) * 124;
                  const y2 = cy - Math.sin(a) * 124;
                  return (
                    <g key={t}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-faint)" strokeWidth="1.5" />
                      <text
                        x={cx + Math.cos(a) * 133}
                        y={cy - Math.sin(a) * 133 + 3}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="600"
                        fill="var(--ink-faint)"
                        className="tnum"
                      >
                        {t}
                      </text>
                    </g>
                  );
                })}
                {/* track */}
                <path
                  d={`M ${130 - GAUGE_R} 134 A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${130 + GAUGE_R} 134`}
                  fill="none"
                  stroke="var(--paper-deep)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* value arc */}
                <path
                  className="gauge-arc"
                  d={`M ${130 - GAUGE_R} 134 A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${130 + GAUGE_R} 134`}
                  fill="none"
                  stroke="var(--caution)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* readout */}
                <text
                  x="130"
                  y="112"
                  textAnchor="middle"
                  className="tnum"
                  style={{ fontFamily: "var(--font-display)" }}
                  fontSize="52"
                  fontWeight="560"
                  fill="var(--ink)"
                >
                  47
                </text>
                <text x="130" y="130" textAnchor="middle" fontSize="10" fontWeight="600" letterSpacing="1.5" fill="var(--ink-faint)">
                  / 100
                </text>
                <text x="130" y="149" textAnchor="middle" fontSize="10.5" fontWeight="700" letterSpacing="2.5" fill="var(--caution)">
                  CAUTION
                </text>
              </svg>
              <p className="mt-2 text-center text-[0.68rem] font-medium tracking-wide" style={{ color: "var(--ink-faint)" }}>
                COMPOSITE SAFETY INDEX
              </p>
            </div>

            {/* Level legend */}
            <div className="hidden lg:block">
              <p className="label mb-3">Index bands</p>
              <ul className="space-y-2.5">
                {(
                  [
                    ["safe", "70–100", "Broadly safe"],
                    ["moderate", "55–69", "Minor concerns"],
                    ["caution", "35–54", "Caution advised"],
                    ["risky", "0–34", "Elevated risk"],
                  ] as [Level, string, string][]
                ).map(([lv, range, desc]) => (
                  <li key={lv} className="flex items-center gap-3 text-[0.82rem]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{
                        background: LEVEL_COLOR[lv],
                        outline: lv === "caution" ? `2px solid color-mix(in srgb, ${LEVEL_COLOR[lv]} 35%, transparent)` : "none",
                        outlineOffset: 2,
                      }}
                    />
                    <span className="tnum w-14 font-semibold" style={{ color: "var(--ink-soft)" }}>
                      {range}
                    </span>
                    <span style={{ color: lv === "caution" ? "var(--ink)" : "var(--ink-faint)", fontWeight: lv === "caution" ? 600 : 400 }}>
                      {desc}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="hairline my-4" />
              <p className="text-[0.72rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
                Weighted blend of 10 signals across advisories, crime, health
                &amp; environment, and governance. Recomputed daily.
              </p>
            </div>
          </div>
        </section>

        {/* ── Subscore tiles ──────────────────────────────── */}
        <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SUBSCORES.map((s, i) => {
            const lv = levelOf(s.score);
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="card deck-tile rise-in relative overflow-hidden p-4 sm:p-5"
                style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              >
                <span
                  className="absolute inset-y-0 left-0 w-[3px]"
                  style={{ background: LEVEL_COLOR[lv] }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon size={15} style={{ color: "var(--ink-faint)" }} strokeWidth={2} />
                    <span className="label !tracking-[0.1em]">{s.label}</span>
                  </div>
                  <StatusPill level={lv} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <span className="tnum font-display text-[2.4rem] leading-none font-medium" style={{ color: "var(--ink)" }}>
                      {s.score}
                    </span>
                    <span className="tnum ml-1 text-[0.78rem] font-medium" style={{ color: "var(--ink-faint)" }}>
                      /100
                    </span>
                  </div>
                  {/* sparkline bars */}
                  <div className="flex h-8 items-end gap-[3px]" aria-hidden>
                    {s.spark.map((v, j) => (
                      <span
                        key={j}
                        className="w-[5px] rounded-t-[2px]"
                        style={{
                          height: `${Math.max(12, v)}%`,
                          background:
                            j === s.spark.length - 1
                              ? LEVEL_COLOR[lv]
                              : `color-mix(in srgb, ${LEVEL_COLOR[lv]} 28%, transparent)`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-2.5 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
                  {s.note}
                </p>
              </div>
            );
          })}
        </section>

        {/* ── Why this score: signal breakdown ────────────── */}
        <section className="rise-in mt-10" style={{ animationDelay: "0.35s" }}>
          <SectionHead num="01" title="Why this score" note="10 signals · weighted composite" />
          <div className="card mt-4 p-5 sm:p-6">
            <ul className="divide-y" style={{ borderColor: "var(--hairline)" }}>
              {SIGNALS.map((sig, i) => {
                const lv = levelOf(sig.score);
                return (
                  <li
                    key={sig.label}
                    className="grid items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[190px_1fr_150px_44px]"
                    style={{ borderColor: "var(--hairline)" }}
                  >
                    <span className="text-[0.84rem] font-medium" style={{ color: "var(--ink)" }}>
                      {sig.label}
                    </span>
                    <div className="h-[9px] overflow-hidden rounded-full" style={{ background: "var(--paper-deep)" }}>
                      <div
                        className="bar-grow h-full rounded-full"
                        style={{
                          width: `${sig.score}%`,
                          background: LEVEL_COLOR[lv],
                          animationDelay: `${0.4 + i * 0.05}s`,
                        }}
                      />
                    </div>
                    <span className="hidden text-right text-[0.74rem] sm:block" style={{ color: "var(--ink-faint)" }}>
                      {sig.value} · <em className="not-italic opacity-80">{sig.source}</em>
                    </span>
                    <span className="tnum text-right text-[0.86rem] font-semibold" style={{ color: LEVEL_COLOR[lv] }}>
                      {sig.score}
                    </span>
                    <span className="text-[0.7rem] sm:hidden" style={{ color: "var(--ink-faint)" }}>
                      {sig.value} · {sig.source}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Advisories + CDC ────────────────────────────── */}
        <section className="rise-in mt-10" style={{ animationDelay: "0.4s" }}>
          <SectionHead num="02" title="Official guidance" note="Updated Jun 2026" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Government advisories */}
            <div className="space-y-4">
              <div className="card deck-tile p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--paper-deep)" }}>
                      <Globe size={15} style={{ color: "var(--ink-soft)" }} />
                    </span>
                    <div>
                      <p className="text-[0.86rem] font-semibold">U.S. Department of State</p>
                      <p className="text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                        travel.state.gov · updated Jun 2026
                      </p>
                    </div>
                  </div>
                  <span
                    className="tnum shrink-0 rounded-lg px-2.5 py-1 text-[0.72rem] font-bold"
                    style={{ background: "color-mix(in srgb, var(--moderate) 14%, transparent)", color: "#96690f", border: "1px solid color-mix(in srgb, var(--moderate) 32%, transparent)" }}
                  >
                    LEVEL 2
                  </span>
                </div>
                <p className="mt-3 text-[0.85rem] font-semibold" style={{ color: "var(--ink)" }}>
                  Exercise Increased Caution
                </p>
                <p className="mt-1 text-[0.83rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  “Exercise increased caution due to crime and kidnapping. Some
                  areas have increased risk.”
                </p>
              </div>

              <div className="card deck-tile p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--paper-deep)" }}>
                      <Globe size={15} style={{ color: "var(--ink-soft)" }} />
                    </span>
                    <div>
                      <p className="text-[0.86rem] font-semibold">UK Foreign Office (FCDO)</p>
                      <p className="text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                        gov.uk/foreign-travel-advice · updated Jun 2026
                      </p>
                    </div>
                  </div>
                  <span
                    className="tnum shrink-0 rounded-lg px-2.5 py-1 text-[0.72rem] font-bold"
                    style={{ background: "color-mix(in srgb, var(--caution) 14%, transparent)", color: "#a85a14", border: "1px solid color-mix(in srgb, var(--caution) 32%, transparent)" }}
                  >
                    LEVEL 3
                  </span>
                </div>
                <p className="mt-3 text-[0.85rem] font-semibold" style={{ color: "var(--ink)" }}>
                  Advises against all-but-essential travel to parts
                </p>
                <p className="mt-1 text-[0.83rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  “FCDO advises against all but essential travel to parts of
                  Mexico. Your travel insurance could be invalidated if you
                  travel against advice.”
                </p>
              </div>
            </div>

            {/* CDC */}
            <div className="card p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--paper-deep)" }}>
                  <Stethoscope size={15} style={{ color: "var(--ink-soft)" }} />
                </span>
                <div>
                  <p className="text-[0.86rem] font-semibold">CDC travel health notices</p>
                  <p className="text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                    wwwnc.cdc.gov/travel · 2 active for Mexico
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3 rounded-xl border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--caution) 35%, transparent)", background: "color-mix(in srgb, var(--caution) 6%, transparent)" }}>
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: "var(--caution)" }} />
                  <div>
                    <p className="text-[0.72rem] font-bold tracking-wider" style={{ color: "var(--caution)" }}>
                      ALERT · LEVEL 2
                    </p>
                    <p className="mt-0.5 text-[0.85rem] font-medium">Rocky Mountain Spotted Fever in Mexico</p>
                    <p className="mt-0.5 text-[0.76rem]" style={{ color: "var(--ink-faint)" }}>
                      Practice enhanced precautions against tick bites.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--moderate) 35%, transparent)", background: "color-mix(in srgb, var(--moderate) 6%, transparent)" }}>
                  <Info size={16} className="mt-0.5 shrink-0" style={{ color: "var(--moderate)" }} />
                  <div>
                    <p className="text-[0.72rem] font-bold tracking-wider" style={{ color: "#96690f" }}>
                      WATCH · LEVEL 1
                    </p>
                    <p className="mt-0.5 text-[0.85rem] font-medium">Salmonella Newport in Mexico</p>
                    <p className="mt-0.5 text-[0.76rem]" style={{ color: "var(--ink-faint)" }}>
                      Follow usual food and water precautions.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="hairline my-4" />
              <p className="flex items-center gap-1.5 text-[0.74rem]" style={{ color: "var(--ink-faint)" }}>
                <ExternalLink size={12} /> Full notice text on the CDC destination page
              </p>
            </div>
          </div>
        </section>

        {/* ── Homicide comparison ─────────────────────────── */}
        <section className="rise-in mt-10" style={{ animationDelay: "0.45s" }}>
          <SectionHead num="03" title="How Mexico compares" note="Intentional homicides · per 100k · World Bank 2023" />
          <div className="card mt-4 p-5 sm:p-6">
            <ul className="space-y-2.5">
              {COMPARISON.map((c, i) => (
                <li key={c.name} className="grid items-center gap-x-4 sm:grid-cols-[130px_1fr_56px] grid-cols-[96px_1fr_50px]">
                  <span
                    className="truncate text-[0.82rem]"
                    style={{
                      color: c.highlight ? "var(--ink)" : "var(--ink-soft)",
                      fontWeight: c.highlight ? 700 : 450,
                    }}
                  >
                    {c.name}
                    {c.highlight ? " ◀" : ""}
                  </span>
                  <div className="h-[14px] overflow-hidden rounded-[4px]" style={{ background: "var(--paper-deep)" }}>
                    <div
                      className="bar-grow h-full rounded-[4px]"
                      style={{
                        width: `${Math.max(1.2, (c.value / COMPARISON_MAX) * 100)}%`,
                        background: c.highlight
                          ? "var(--risky)"
                          : c.value < 6
                            ? "color-mix(in srgb, var(--safe) 55%, transparent)"
                            : "color-mix(in srgb, var(--ink-faint) 45%, transparent)",
                        animationDelay: `${0.5 + i * 0.06}s`,
                      }}
                    />
                  </div>
                  <span
                    className="tnum text-right text-[0.82rem] font-semibold"
                    style={{ color: c.highlight ? "var(--risky)" : "var(--ink-soft)" }}
                  >
                    {c.value.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
              Mexico&apos;s homicide rate is roughly 4.3× the world average — the
              single largest drag on the composite index.
            </p>
          </div>
        </section>

        {/* ── AI brief + neighborhoods ────────────────────── */}
        <section className="rise-in mt-10" style={{ animationDelay: "0.5s" }}>
          <SectionHead num="04" title="On the ground" note="AI brief · neighborhood intel" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            {/* AI summary */}
            <div className="card relative overflow-hidden p-6">
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, var(--accent), var(--teal-bright))" }} />
              <p className="eyebrow">Analyst brief</p>
              <p className="font-display mt-3 text-[1.18rem] leading-[1.55]" style={{ color: "var(--ink)", fontWeight: 450 }}>
                “Mexico City is manageable for informed travelers who stay in
                well-trodden districts, but the country-level data shows serious
                violent-crime and rule-of-law weaknesses. Stick to Polanco, Roma
                Norte, Condesa and Coyoacán, use Uber rather than street taxis,
                and keep valuables out of sight.”
              </p>
              <p className="mt-4 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
                Synthesized from the 10 evidence signals above · 2 Jul 2026
              </p>
            </div>

            {/* Neighborhoods */}
            <div className="card p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-[0.74rem] font-bold tracking-wider" style={{ color: "var(--safe)" }}>
                    <CircleCheck size={14} /> STAY AROUND
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Polanco", "Roma Norte", "Condesa", "Coyoacán"].map((n) => (
                      <span
                        key={n}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium"
                        style={{ background: "color-mix(in srgb, var(--safe) 10%, transparent)", color: "#1e7a52", border: "1px solid color-mix(in srgb, var(--safe) 28%, transparent)" }}
                      >
                        <MapPin size={12} /> {n}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-[0.74rem] font-bold tracking-wider" style={{ color: "var(--risky)" }}>
                    <Ban size={14} /> AVOID
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Tepito", "Doctores (after dark)", "Iztapalapa"].map((n) => (
                      <span
                        key={n}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium"
                        style={{ background: "color-mix(in srgb, var(--risky) 8%, transparent)", color: "#a83a28", border: "1px solid color-mix(in srgb, var(--risky) 26%, transparent)" }}
                      >
                        <ShieldAlert size={12} /> {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hairline my-5" />
              <p className="text-[0.74rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
                Neighborhood guidance reflects tourist-district policing
                density, reported incident clusters, and local advisories — not
                a judgment of residents.
              </p>
            </div>
          </div>
        </section>

        {/* ── News + tips ─────────────────────────────────── */}
        <section className="rise-in mt-10" style={{ animationDelay: "0.55s" }}>
          <SectionHead num="05" title="Latest signals & field tips" note="Last 90 days" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-6">
              <p className="mb-4 flex items-center gap-2 text-[0.78rem] font-semibold" style={{ color: "var(--ink-soft)" }}>
                <Newspaper size={15} style={{ color: "var(--accent)" }} /> Recent developments
              </p>
              <ul className="space-y-3.5">
                {NEWS.map((n) => (
                  <li key={n} className="flex items-start gap-3 text-[0.86rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <p className="mb-4 flex items-center gap-2 text-[0.78rem] font-semibold" style={{ color: "var(--ink-soft)" }}>
                <Lightbulb size={15} style={{ color: "var(--gold)" }} /> Traveler playbook
              </p>
              <ul className="space-y-3">
                {TIPS.map((t, i) => (
                  <li key={t} className="flex items-start gap-3 text-[0.86rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                    <span
                      className="tnum mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[0.68rem] font-bold"
                      style={{ background: "var(--paper-deep)", color: "var(--ink-soft)" }}
                    >
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Methodology strip ───────────────────────────── */}
        <section className="rise-in mt-10" style={{ animationDelay: "0.6s" }}>
          <div
            className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4"
            style={{ background: "var(--glass-strong)" }}
          >
            <span className="flex items-center gap-2 text-[0.74rem] font-bold tracking-wider" style={{ color: "var(--ink-soft)" }}>
              <Database size={14} style={{ color: "var(--accent)" }} /> SOURCES
            </span>
            {DATABASES.map((d) => (
              <span key={d} className="text-[0.76rem]" style={{ color: "var(--ink-faint)" }}>
                {d}
              </span>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row">
          <p className="wordmark text-[0.95rem]">
            IsMyTripSafe<span style={{ color: "var(--ink-faint)" }}>.com</span>
          </p>
          <p className="text-[0.74rem]" style={{ color: "var(--ink-faint)" }}>
            One destination, one click, one report · Informational only — not
            official government advice
          </p>
          <p className="tnum text-[0.74rem]" style={{ color: "var(--ink-faint)" }}>
            © 2026 · Report generated 2 Jul 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
