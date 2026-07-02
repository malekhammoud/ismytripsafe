import type { CSSProperties, ReactNode } from "react";
import {
  ShieldAlert,
  Landmark,
  HeartPulse,
  Newspaper,
  Gauge,
  MapPin,
  ArrowUpRight,
  Wind,
  Activity,
  CircleCheck,
  CircleAlert,
} from "lucide-react";

/* ————————————————————————————————————————————————————————————
   UI-2 · "Traffic-light strip" — one narrow column, full-bleed
   solid status blocks, readable from the colors alone.
   ———————————————————————————————————————————————————————————— */

const INK = "#141922";
const RULE = "rgba(20, 25, 34, 0.4)"; // thin dark border between blocks

type Tone = "caution" | "risky" | "moderate" | "safe";

const TONES: Record<
  Tone,
  { fill: string; deep: string; strong: string; track: string; name: string }
> = {
  caution: {
    fill: "color-mix(in oklab, #e08a3b 26%, #f7f3ec)",
    deep: "#8a4d14",
    strong: "#c06e22",
    track: "rgba(138, 77, 20, 0.16)",
    name: "Caution",
  },
  risky: {
    fill: "color-mix(in oklab, #d4503a 22%, #f8f1ef)",
    deep: "#8c2b1c",
    strong: "#bc4231",
    track: "rgba(140, 43, 28, 0.15)",
    name: "Elevated",
  },
  moderate: {
    fill: "color-mix(in oklab, #c8973f 25%, #f8f4ea)",
    deep: "#77571a",
    strong: "#a97e2d",
    track: "rgba(119, 87, 26, 0.16)",
    name: "Moderate",
  },
  safe: {
    fill: "color-mix(in oklab, #2f9e6f 20%, #eff6f1)",
    deep: "#1a5e41",
    strong: "#27835c",
    track: "rgba(26, 94, 65, 0.15)",
    name: "Stable",
  },
};

/* ————— shared primitives ————— */

function Block({
  tone,
  eyebrow,
  title,
  icon,
  statusWord,
  children,
  delay = 0,
}: {
  tone: Tone;
  eyebrow: string;
  title: string;
  icon: ReactNode;
  statusWord: string;
  children: ReactNode;
  delay?: number;
}) {
  const t = TONES[tone];
  return (
    <section
      className="rise-in px-7 py-8 sm:px-9"
      style={{
        background: t.fill,
        borderTop: `1px solid ${RULE}`,
        animationDelay: `${delay}ms`,
      }}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p
            className="eyebrow"
            style={{ color: t.deep, opacity: 0.75, letterSpacing: "0.2em" }}
          >
            {eyebrow}
          </p>
          <h2
            className="font-display mt-1 text-[1.45rem] font-medium tracking-tight"
            style={{ color: INK }}
          >
            {title}
          </h2>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: t.deep,
            border: `1px solid ${t.deep}55`,
            background: "rgba(255,255,255,0.35)",
          }}
        >
          <span style={{ color: t.strong }}>{icon}</span>
          {statusWord}
        </div>
      </header>
      {children}
    </section>
  );
}

function ScoreBar({
  tone,
  value,
  style,
}: {
  tone: Tone;
  value: number;
  style?: CSSProperties;
}) {
  const t = TONES[tone];
  return (
    <div
      className="h-[5px] w-full overflow-hidden rounded-full"
      style={{ background: t.track, ...style }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${value}%`, background: t.strong }}
      />
    </div>
  );
}

function SignalRow({
  tone,
  label,
  value,
  score,
  source,
}: {
  tone: Tone;
  label: string;
  value: string;
  score: number;
  source: string;
}) {
  const t = TONES[tone];
  return (
    <div className="py-2.5" style={{ borderTop: `1px solid ${t.deep}22` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.85rem] font-medium" style={{ color: INK }}>
          {label}
        </p>
        <p
          className="tnum shrink-0 text-[0.82rem]"
          style={{ color: t.deep }}
        >
          {value}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <ScoreBar tone={tone} value={score} />
        <span
          className="tnum w-7 shrink-0 text-right text-[0.72rem] font-semibold"
          style={{ color: t.deep }}
        >
          {score}
        </span>
      </div>
      <p className="mt-1 text-[0.66rem]" style={{ color: `${INK}88` }}>
        {source}
      </p>
    </div>
  );
}

/* ————— page ————— */

export default function Ui2Page() {
  return (
    <main className="relative z-10 min-h-screen pb-16">
      {/* ————— brand header ————— */}
      <header className="mx-auto max-w-[640px] px-6 pt-10 pb-7 text-center sm:px-0">
        <p className="wordmark text-[1.55rem]" style={{ color: INK }}>
          IsMyTripSafe
          <span style={{ color: "var(--ink-faint)" }}>.com</span>
        </p>
        <p
          className="mt-1.5 text-[0.78rem] font-medium tracking-[0.08em]"
          style={{ color: "var(--ink-soft)" }}
        >
          One destination, one click, one report
        </p>
      </header>

      {/* ————— the report column ————— */}
      <div
        className="mx-auto max-w-[640px] overflow-hidden sm:rounded-[3px]"
        style={{
          border: `1px solid ${RULE}`,
          boxShadow: "var(--shadow-float)",
        }}
      >
        {/* masthead — destination */}
        <section
          className="rise-in px-7 py-7 sm:px-9"
          style={{ background: INK, animationDelay: "0ms" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="eyebrow"
                style={{ color: "rgba(238,242,248,0.55)" }}
              >
                Safety Report
              </p>
              <h1
                className="font-display mt-1.5 text-[2rem] font-medium leading-none tracking-tight text-white"
              >
                Mexico City{" "}
                <span className="align-middle text-[1.4rem]">🇲🇽</span>
              </h1>
              <p
                className="mt-2 flex items-center gap-1.5 text-[0.78rem]"
                style={{ color: "rgba(238,242,248,0.6)" }}
              >
                <MapPin size={12} strokeWidth={2} />
                Mexico · Assessed 2 Jul 2026
              </p>
            </div>
            {/* traffic-light legend */}
            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
              <div className="flex gap-1.5">
                {(["risky", "caution", "moderate", "safe"] as Tone[]).map(
                  (k) => (
                    <span
                      key={k}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: TONES[k].strong,
                        outline:
                          k === "caution"
                            ? "2px solid rgba(255,255,255,0.85)"
                            : "none",
                        outlineOffset: 1.5,
                      }}
                    />
                  ),
                )}
              </div>
              <p
                className="text-[0.62rem] uppercase tracking-[0.14em]"
                style={{ color: "rgba(238,242,248,0.5)" }}
              >
                Read the colors
              </p>
            </div>
          </div>
        </section>

        {/* 1 · RATING */}
        <Block
          tone="caution"
          eyebrow="01 · Composite Index"
          title="Rating"
          icon={<Gauge size={13} strokeWidth={2.4} />}
          statusWord="Caution"
          delay={80}
        >
          <div className="flex items-end justify-between gap-6">
            <p
              className="display-xl tnum"
              style={{ color: TONES.caution.deep, fontWeight: 560 }}
            >
              47
              <span
                className="text-[0.34em] font-normal tracking-normal"
                style={{ color: `${TONES.caution.deep}99` }}
              >
                {" "}
                / 100
              </span>
            </p>
            <div className="pb-2 text-right">
              <p
                className="text-[0.95rem] font-semibold"
                style={{ color: INK }}
              >
                Caution advised
              </p>
              <p className="mt-0.5 text-[0.78rem]" style={{ color: `${INK}99` }}>
                Safer than ~38% of countries
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ScoreBar
              tone="caution"
              value={47}
              style={{ height: 8 }}
            />
            <div
              className="mt-1.5 flex justify-between text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
              style={{ color: `${TONES.caution.deep}aa` }}
            >
              <span>High risk</span>
              <span>Very safe</span>
            </div>
          </div>
        </Block>

        {/* 2 · TRAVEL ADVISORIES */}
        <Block
          tone="risky"
          eyebrow="02 · Official Guidance"
          title="Travel Advisories"
          icon={<ShieldAlert size={13} strokeWidth={2.4} />}
          statusWord="Level 3 · UK"
          delay={160}
        >
          <div className="space-y-4">
            {[
              {
                org: "U.S. Department of State",
                level: "Level 2",
                head: "Exercise Increased Caution",
                body: "Exercise increased caution due to crime and kidnapping. Some areas have increased risk.",
                updated: "Updated Jun 2026",
              },
              {
                org: "UK Foreign Office (FCDO)",
                level: "Level 3",
                head: "Against all-but-essential travel to parts",
                body: "FCDO advises against all but essential travel to parts of Mexico. Your travel insurance could be invalidated if you travel against advice.",
                updated: "Updated Jun 2026",
              },
            ].map((a) => (
              <article
                key={a.org}
                className="rounded-[3px] px-4 py-3.5"
                style={{
                  background: "rgba(255,255,255,0.42)",
                  borderLeft: `3px solid ${TONES.risky.strong}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: `${INK}99` }}
                  >
                    {a.org}
                  </p>
                  <span
                    className="tnum shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.08em]"
                    style={{ color: TONES.risky.deep }}
                  >
                    {a.level}
                  </span>
                </div>
                <p
                  className="mt-1 text-[0.92rem] font-semibold"
                  style={{ color: INK }}
                >
                  {a.head}
                </p>
                <p
                  className="mt-1 text-[0.8rem] leading-relaxed"
                  style={{ color: `${INK}b3` }}
                >
                  “{a.body}”
                </p>
                <p
                  className="mt-1.5 text-[0.66rem]"
                  style={{ color: `${INK}77` }}
                >
                  {a.updated}
                </p>
              </article>
            ))}
          </div>
        </Block>

        {/* 3 · CRIME INDEX */}
        <Block
          tone="moderate"
          eyebrow="03 · Evidence Signals"
          title="Crime Index"
          icon={<Landmark size={13} strokeWidth={2.4} />}
          statusWord="Weak signals"
          delay={240}
        >
          <div>
            <SignalRow
              tone="moderate"
              label="Homicide rate"
              value="24.9 /100k"
              score={26}
              source="World Bank, 2023"
            />
            <SignalRow
              tone="moderate"
              label="Political stability"
              value="28/100"
              score={28}
              source="WGI, 2024"
            />
            <SignalRow
              tone="moderate"
              label="Rule of law"
              value="31/100"
              score={31}
              source="WGI, 2024"
            />
            <SignalRow
              tone="moderate"
              label="Control of corruption"
              value="22/100"
              score={22}
              source="WGI, 2024"
            />
            <SignalRow
              tone="moderate"
              label="Government effectiveness"
              value="45/100"
              score={45}
              source="WGI, 2024"
            />
            <SignalRow
              tone="moderate"
              label="Armed-conflict deaths"
              value="None reported"
              score={100}
              source="World Bank, 2023"
            />
          </div>

          {/* comparison */}
          <div
            className="mt-5 rounded-[3px] px-4 py-3.5"
            style={{ background: "rgba(255,255,255,0.42)" }}
          >
            <p
              className="text-[0.66rem] font-semibold uppercase tracking-[0.14em]"
              style={{ color: `${TONES.moderate.deep}bb` }}
            >
              Homicide per 100k · in context
            </p>
            <div className="mt-2.5 space-y-1.5">
              {[
                { c: "Japan", v: 0.2 },
                { c: "Switzerland", v: 0.5 },
                { c: "United States", v: 5.7 },
                { c: "World average", v: 5.8 },
                { c: "Brazil", v: 21.3 },
                { c: "Mexico", v: 24.9, mark: true },
                { c: "South Africa", v: 41.9 },
              ].map((r) => (
                <div key={r.c} className="flex items-center gap-2.5">
                  <span
                    className="w-[6.4rem] shrink-0 text-[0.72rem]"
                    style={{
                      color: r.mark ? TONES.moderate.deep : `${INK}99`,
                      fontWeight: r.mark ? 700 : 400,
                    }}
                  >
                    {r.c}
                  </span>
                  <div className="h-[7px] flex-1">
                    <div
                      className="h-full rounded-r-sm"
                      style={{
                        width: `${(r.v / 41.9) * 100}%`,
                        background: r.mark
                          ? TONES.moderate.deep
                          : `${TONES.moderate.strong}66`,
                      }}
                    />
                  </div>
                  <span
                    className="tnum w-8 shrink-0 text-right text-[0.7rem]"
                    style={{
                      color: r.mark ? TONES.moderate.deep : `${INK}88`,
                      fontWeight: r.mark ? 700 : 400,
                    }}
                  >
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Block>

        {/* 4 · HEALTH & AIR */}
        <Block
          tone="safe"
          eyebrow="04 · Environment"
          title="Health Index & Air Quality"
          icon={<HeartPulse size={13} strokeWidth={2.4} />}
          statusWord="Manageable"
          delay={320}
        >
          <div className="grid grid-cols-3 gap-px" style={{ background: `${TONES.safe.deep}26` }}>
            {[
              {
                icon: <Wind size={14} strokeWidth={2} />,
                k: "Air quality",
                v: "AQI 72",
                s: "Moderate · Open-Meteo, live",
              },
              {
                icon: <Activity size={14} strokeWidth={2} />,
                k: "Road deaths",
                v: "12.7 /100k",
                s: "World Bank, 2021",
              },
              {
                icon: <Activity size={14} strokeWidth={2} />,
                k: "Earthquakes",
                v: "3 · M5.8",
                s: "USGS, last 90 days",
              },
            ].map((c) => (
              <div
                key={c.k}
                className="px-3 py-3"
                style={{ background: TONES.safe.fill }}
              >
                <p
                  className="flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: `${TONES.safe.deep}bb` }}
                >
                  {c.icon}
                  {c.k}
                </p>
                <p
                  className="tnum mt-1.5 text-[1.05rem] font-semibold"
                  style={{ color: INK }}
                >
                  {c.v}
                </p>
                <p className="mt-0.5 text-[0.62rem]" style={{ color: `${INK}88` }}>
                  {c.s}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p
              className="text-[0.66rem] font-semibold uppercase tracking-[0.14em]"
              style={{ color: `${TONES.safe.deep}bb` }}
            >
              CDC travel health notices · 2 active
            </p>
            <div className="mt-2 space-y-2">
              {[
                { lvl: "Alert", txt: "Rocky Mountain Spotted Fever in Mexico" },
                { lvl: "Watch", txt: "Salmonella Newport in Mexico" },
              ].map((n) => (
                <div
                  key={n.txt}
                  className="flex items-center gap-3 rounded-[3px] px-3.5 py-2.5"
                  style={{ background: "rgba(255,255,255,0.45)" }}
                >
                  <span
                    className="shrink-0 rounded-sm px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em]"
                    style={{
                      background:
                        n.lvl === "Alert"
                          ? `${TONES.caution.strong}2b`
                          : `${TONES.safe.strong}26`,
                      color:
                        n.lvl === "Alert"
                          ? TONES.caution.deep
                          : TONES.safe.deep,
                    }}
                  >
                    {n.lvl}
                  </span>
                  <p className="text-[0.82rem]" style={{ color: INK }}>
                    {n.txt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Block>

        {/* 5 · CURRENT NEWS */}
        <Block
          tone="safe"
          eyebrow="05 · On the Ground"
          title="Current News"
          icon={<Newspaper size={13} strokeWidth={2.4} />}
          statusWord="Quiet 90 days"
          delay={400}
        >
          <p
            className="font-display text-[1.02rem] leading-[1.65]"
            style={{ color: `${INK}dd` }}
          >
            “Mexico City is manageable for informed travelers who stay in
            well-trodden districts, but the country-level data shows serious
            violent-crime and rule-of-law weaknesses. Stick to Polanco, Roma
            Norte, Condesa and Coyoacán, use Uber rather than street taxis, and
            keep valuables out of sight.”
          </p>
          <p
            className="mt-1.5 text-[0.64rem] uppercase tracking-[0.14em]"
            style={{ color: `${INK}77` }}
          >
            AI briefing · synthesized from all signals
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div
              className="rounded-[3px] px-4 py-3"
              style={{ background: "rgba(255,255,255,0.45)" }}
            >
              <p
                className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em]"
                style={{ color: TONES.safe.deep }}
              >
                <CircleCheck size={12} strokeWidth={2.4} />
                Stay around
              </p>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed" style={{ color: INK }}>
                Polanco · Roma Norte · Condesa · Coyoacán
              </p>
            </div>
            <div
              className="rounded-[3px] px-4 py-3"
              style={{ background: "rgba(255,255,255,0.45)" }}
            >
              <p
                className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em]"
                style={{ color: TONES.risky.deep }}
              >
                <CircleAlert size={12} strokeWidth={2.4} />
                Avoid
              </p>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed" style={{ color: INK }}>
                Tepito · Doctores (after dark) · Iztapalapa
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-2">
            {[
              "Tourist areas saw increased National Guard patrols in June 2026",
              "Pickpocketing spike reported on Metro Line 2",
              "No major unrest in the capital in the past 90 days",
            ].map((n) => (
              <li
                key={n}
                className="flex items-start gap-2.5 text-[0.84rem] leading-relaxed"
                style={{
                  color: `${INK}cc`,
                  borderTop: `1px solid ${TONES.safe.deep}22`,
                  paddingTop: "0.55rem",
                }}
              >
                <ArrowUpRight
                  size={13}
                  strokeWidth={2.2}
                  className="mt-[3px] shrink-0"
                  style={{ color: TONES.safe.strong }}
                />
                {n}
              </li>
            ))}
          </ul>
        </Block>

        {/* column footer */}
        <footer
          className="rise-in px-7 py-6 sm:px-9"
          style={{
            background: INK,
            borderTop: `1px solid ${RULE}`,
            animationDelay: "480ms",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="wordmark text-[0.95rem] text-white">
              IsMyTripSafe
              <span style={{ color: "rgba(238,242,248,0.45)" }}>.com</span>
            </p>
            <p
              className="text-[0.68rem] tracking-[0.04em]"
              style={{ color: "rgba(238,242,248,0.55)" }}
            >
              Report MEX-CDMX-070226 · Not legal or medical advice
            </p>
          </div>
          <p
            className="mt-3 text-[0.66rem] leading-relaxed"
            style={{ color: "rgba(238,242,248,0.4)" }}
          >
            Sources: U.S. State Dept · UK FCDO · World Bank · WGI · USGS ·
            Open-Meteo · CDC. Composite index recomputed at request time.
          </p>
        </footer>
      </div>

      <p
        className="mx-auto mt-6 max-w-[640px] px-6 text-center text-[0.7rem] sm:px-0"
        style={{ color: "var(--ink-faint)" }}
      >
        One destination, one click, one report — © 2026 IsMyTripSafe.com
      </p>
    </main>
  );
}
