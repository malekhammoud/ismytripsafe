"use client";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 7: "The Explorable Score"
   The report IS the visualization: a weighted score wheel you
   can hover, click, and arrow-key through. All data hardcoded;
   all components + hooks inline. No API calls.
   ──────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Lightbulb,
  Newspaper,
  Stethoscope,
  Landmark,
  Info,
  Globe,
  Database,
  TriangleAlert,
  CircleCheck,
  Ban,
  ExternalLink,
} from "lucide-react";

/* ─── Data ─────────────────────────────────────────────────── */

type Level = "safe" | "moderate" | "caution" | "risky";

const LEVEL_COLOR: Record<Level, string> = {
  safe: "var(--safe)",
  moderate: "var(--moderate)",
  caution: "var(--caution)",
  risky: "var(--risky)",
};

const levelOf = (score: number): Level =>
  score >= 70 ? "safe" : score >= 55 ? "moderate" : score >= 40 ? "caution" : "risky";

type Signal = {
  key: string;
  label: string;
  value: string;
  score: number;
  source: string;
  year: string;
  weight: number;
  measures: string;
  note: string;
};

/* Ordered by weight (descending) — arc order around the wheel. */
const SIGNALS: Signal[] = [
  {
    key: "homicide",
    label: "Homicide rate",
    value: "24.9 per 100k",
    score: 26,
    source: "World Bank",
    year: "2023",
    weight: 0.22,
    measures:
      "Intentional homicides per 100,000 people — the single most reliable cross-country proxy for violent crime.",
    note: "Mexico's rate is roughly four times the world average. Violence is concentrated regionally, but the national figure weighs heavily on the composite.",
  },
  {
    key: "stability",
    label: "Political stability",
    value: "28 of 100",
    score: 28,
    source: "WGI",
    year: "2024",
    weight: 0.16,
    measures:
      "World Governance Indicators percentile: likelihood of political instability or politically motivated violence.",
    note: "A low percentile — organized-crime pressure on institutions keeps this score depressed even in calm periods.",
  },
  {
    key: "battle",
    label: "Armed-conflict deaths",
    value: "None reported",
    score: 100,
    source: "World Bank",
    year: "2023",
    weight: 0.12,
    measures: "Battle-related deaths from state-based armed conflict, per year.",
    note: "No active armed conflict. This is not a war zone — the risks here are criminal, not military.",
  },
  {
    key: "rule_of_law",
    label: "Rule of law",
    value: "31 of 100",
    score: 31,
    source: "WGI",
    year: "2024",
    weight: 0.1,
    measures:
      "Confidence in contract enforcement, property rights, police, and courts — WGI percentile rank.",
    note: "Weak courts and low prosecution rates mean crimes against travelers are rarely resolved. Prevention beats recourse here.",
  },
  {
    key: "advisory",
    label: "Government travel advisory",
    value: "Level 2 — Increased Caution",
    score: 70,
    source: "U.S. State Dept",
    year: "2026",
    weight: 0.1,
    measures:
      "The official U.S. State Department advisory tier for the destination country (1 = normal, 4 = do not travel).",
    note: "Level 2 of 4 — the same tier as France or the UK. Some individual states carry higher levels; Mexico City itself sits at Level 2.",
  },
  {
    key: "corruption",
    label: "Control of corruption",
    value: "22 of 100",
    score: 22,
    source: "WGI",
    year: "2024",
    weight: 0.07,
    measures:
      "WGI percentile: extent to which public power is exercised for private gain, including petty bribery.",
    note: "Petty corruption can touch travelers directly — insist on official channels and receipts for any fine or fee.",
  },
  {
    key: "road",
    label: "Road traffic deaths",
    value: "12.7 per 100k",
    score: 59,
    source: "World Bank",
    year: "2021",
    weight: 0.06,
    measures: "Estimated road traffic fatalities per 100,000 people per year.",
    note: "Middling by global standards. Ride-hailing apps with vetted drivers meaningfully reduce your exposure.",
  },
  {
    key: "gov_effectiveness",
    label: "Government effectiveness",
    value: "45 of 100",
    score: 45,
    source: "WGI",
    year: "2024",
    weight: 0.06,
    measures:
      "Quality of public services, civil service, and policy implementation — WGI percentile rank.",
    note: "Mid-table capacity: emergency services exist and function in the capital, but response quality varies by district.",
  },
  {
    key: "seismic",
    label: "Recent earthquakes",
    value: "3 quakes · max M5.8",
    score: 62,
    source: "USGS",
    year: "last 90 days",
    weight: 0.05,
    measures:
      "Count and maximum magnitude of earthquakes near the destination in the trailing 90 days (USGS feed).",
    note: "Mexico City sits on a drained lakebed that amplifies shaking. Know your hotel's evacuation route; alerts sound ~60s before arrival.",
  },
  {
    key: "health",
    label: "Travel health notices",
    value: "2 notices · max Alert",
    score: 60,
    source: "CDC",
    year: "2026",
    weight: 0.05,
    measures:
      "Active CDC travel health notices for the destination, weighted by tier (Watch → Warning).",
    note: "Two active notices, neither trip-stopping. Routine vaccinations plus food-and-water discipline cover most of it.",
  },
  {
    key: "air_quality",
    label: "Air quality",
    value: "US AQI 72 · Moderate",
    score: 78,
    source: "Open-Meteo",
    year: "live",
    weight: 0.03,
    measures: "Live US AQI reading from the Open-Meteo air-quality model.",
    note: "Moderate today. High-altitude ozone spikes on hot afternoons — sensitive travelers should check daily.",
  },
];

const TOTAL_WEIGHT = SIGNALS.reduce((s, x) => s + x.weight, 0);

const COMPOSITE = 47;
const VERDICT = "Caution advised";
const PERCENTILE = "Safer than ~38% of countries";

const HOMICIDE_COMPARE: { country: string; value: number; target?: boolean }[] = [
  { country: "Japan", value: 0.2 },
  { country: "Switzerland", value: 0.5 },
  { country: "United States", value: 5.7 },
  { country: "World average", value: 5.8 },
  { country: "Brazil", value: 21.3 },
  { country: "Mexico", value: 24.9, target: true },
  { country: "South Africa", value: 41.9 },
];

const ADVISORIES = [
  {
    issuer: "U.S. State Department",
    flag: "🇺🇸",
    level: "Level 2 of 4",
    headline: "Exercise Increased Caution",
    detail: "Exercise increased caution due to crime and kidnapping.",
    date: "Jun 2026",
    tone: "caution" as Level,
  },
  {
    issuer: "UK FCDO",
    flag: "🇬🇧",
    level: "Level 3",
    headline: "All-but-essential travel",
    detail: "Advises against all-but-essential travel to parts of the country.",
    date: "Jun 2026",
    tone: "risky" as Level,
  },
];

const CDC_NOTICES = [
  {
    tier: "Alert",
    tone: "caution" as Level,
    title: "Rocky Mountain Spotted Fever in Mexico",
    body: "Tick-borne bacterial disease reported in several states. Use insect repellent and check for ticks after outdoor activity.",
  },
  {
    tier: "Watch",
    tone: "moderate" as Level,
    title: "Salmonella Newport in Mexico",
    body: "Practice usual food and water precautions: eat food that is cooked and served hot, drink bottled or purified water.",
  },
];

const SAFE_AREAS = [
  { name: "Polanco", note: "Embassy district, well patrolled." },
  { name: "Roma Norte", note: "Tourist-friendly, lively at night." },
  { name: "Condesa", note: "Walkable, busy evenings." },
  { name: "Coyoacán", note: "Quiet, daytime destination." },
];

const AVOID_AREAS = [
  { name: "Tepito", note: "Street crime hotspot." },
  { name: "Doctores after dark", note: "Muggings reported." },
  { name: "Iztapalapa", note: "High crime rates." },
];

const AI_SUMMARY =
  "Mexico City is manageable for informed travelers who stay in well-trodden districts, but the country-level data shows serious violent-crime and rule-of-law weaknesses. Stick to Polanco, Roma Norte, Condesa and Coyoacán, use Uber rather than street taxis, and keep valuables out of sight.";

const TIPS = [
  "Use Uber or authorized taxi stands, never street-hail",
  "Keep phones off café tables",
  "Carry a passport photocopy, not the original",
  "Avoid Metro at rush hour with luggage",
];

const NEWS = [
  "Increased National Guard patrols in tourist areas (Jun 2026)",
  "Pickpocketing spike on Metro Line 2",
  "No major unrest in past 90 days",
];

/* ─── Hooks ────────────────────────────────────────────────── */

/** Flips true one frame after mount — lets CSS transitions "grow in". */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return mounted;
}

/* ─── Wheel geometry ───────────────────────────────────────── */

const C = 210; // svg center
const R = 152; // arc radius
const GAP_DEG = 2.4; // gap between arcs

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
}

function arcPath(startDeg: number, endDeg: number, radius: number): string {
  const [x1, y1] = polar(startDeg, radius);
  const [x2, y2] = polar(endDeg, radius);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

type Arc = { signal: Signal; start: number; end: number; mid: number };

const ARCS: Arc[] = (() => {
  const arcs: Arc[] = [];
  let cursor = 0;
  for (const signal of SIGNALS) {
    const span = (signal.weight / TOTAL_WEIGHT) * 360;
    arcs.push({
      signal,
      start: cursor + GAP_DEG / 2,
      end: cursor + span - GAP_DEG / 2,
      mid: cursor + span / 2,
    });
    cursor += span;
  }
  return arcs;
})();

/* ─── Score wheel ──────────────────────────────────────────── */

type TooltipState = { x: number; y: number; signal: Signal } | null;

function ScoreWheel({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const mounted = useMounted();
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveTooltip = useCallback((e: React.MouseEvent, signal: Signal) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, signal });
  }, []);

  const cycle = useCallback(
    (fromKey: string, dir: 1 | -1) => {
      const i = SIGNALS.findIndex((s) => s.key === fromKey);
      const next = SIGNALS[(i + dir + SIGNALS.length) % SIGNALS.length];
      onSelect(next.key);
    },
    [onSelect],
  );

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[440px] select-none">
      <svg
        viewBox="0 0 420 420"
        className="block w-full"
        role="group"
        aria-label="Composite safety score wheel — each arc is one evidence signal, sized by its weight"
      >
        {/* faint full track */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--hairline)" strokeWidth={1} />
        <circle cx={C} cy={C} r={R - 34} fill="none" stroke="var(--hairline)" strokeWidth={1} />

        {ARCS.map(({ signal, start, end }, i) => {
          const isSel = selected === signal.key;
          const isHover = hovered === signal.key;
          const dimmed = (selected !== null && !isSel && !isHover) || (hovered !== null && !isHover && !isSel);
          return (
            <path
              key={signal.key}
              d={arcPath(start, end, R)}
              fill="none"
              stroke={LEVEL_COLOR[levelOf(signal.score)]}
              strokeWidth={mounted ? (isSel ? 46 : isHover ? 42 : 30) : 2}
              strokeLinecap="butt"
              opacity={mounted ? (dimmed ? 0.38 : 1) : 0}
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={`${signal.label}: ${signal.value}, score ${signal.score} of 100, weight ${Math.round(
                (signal.weight / TOTAL_WEIGHT) * 100,
              )} percent. Source ${signal.source}, ${signal.year}.`}
              style={{
                cursor: "pointer",
                outline: "none",
                transition: `stroke-width 0.25s cubic-bezier(0.2,0.8,0.2,1), opacity 0.6s ease ${
                  mounted ? "0s" : `${i * 60}ms`
                }`,
              }}
              onMouseEnter={(e) => {
                setHovered(signal.key);
                moveTooltip(e, signal);
              }}
              onMouseMove={(e) => moveTooltip(e, signal)}
              onMouseLeave={() => {
                setHovered(null);
                setTooltip(null);
              }}
              onFocus={() => setHovered(signal.key)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelect(isSel ? null : signal.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(isSel ? null : signal.key);
                } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  cycle(signal.key, 1);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  cycle(signal.key, -1);
                } else if (e.key === "Escape") {
                  onSelect(null);
                }
              }}
            />
          );
        })}

      </svg>

      {/* center readout */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="eyebrow" style={{ letterSpacing: "0.18em" }}>
          Safety index
        </div>
        <div className="font-display tnum mt-1 leading-none" style={{ fontSize: "4.6rem", fontWeight: 500 }}>
          {COMPOSITE}
          <span className="text-2xl" style={{ color: "var(--ink-faint)" }}>
            /100
          </span>
        </div>
        <div
          className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: "rgba(224,138,59,0.14)", color: "var(--caution)" }}
        >
          <ShieldAlert size={15} strokeWidth={2.2} />
          {VERDICT}
        </div>
        <div className="mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
          {PERCENTILE}
        </div>
      </div>

      {/* floating tooltip */}
      {tooltip && (
        <div
          className="card pointer-events-none absolute z-20 px-3.5 py-2.5"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            minWidth: 190,
            boxShadow: "var(--shadow-float)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-[0.8rem] font-semibold" style={{ color: "var(--ink)" }}>
              {tooltip.signal.label}
            </span>
            <span
              className="tnum rounded-md px-1.5 py-0.5 text-[0.72rem] font-bold text-white"
              style={{ background: LEVEL_COLOR[levelOf(tooltip.signal.score)] }}
            >
              {tooltip.signal.score}
            </span>
          </div>
          <div className="tnum mt-0.5 text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
            {tooltip.signal.value}
          </div>
          <div className="mt-1 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
            {tooltip.signal.source} · {tooltip.signal.year} · weight{" "}
            {Math.round((tooltip.signal.weight / TOTAL_WEIGHT) * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared: animated score bar ───────────────────────────── */

function ScoreBar({
  score,
  grow,
  delayMs = 0,
  height = 6,
}: {
  score: number;
  grow: boolean;
  delayMs?: number;
  height?: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ background: "var(--paper-deep)", height }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: grow ? `${score}%` : "0%",
          background: LEVEL_COLOR[levelOf(score)],
          transition: `width 0.9s cubic-bezier(0.2,0.8,0.2,1) ${delayMs}ms`,
        }}
      />
    </div>
  );
}

/* ─── Detail panel: all-signals ranked list ────────────────── */

function AllSignalsPanel({ onSelect }: { onSelect: (key: string) => void }) {
  const mounted = useMounted();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg" style={{ fontWeight: 500 }}>
          All eleven signals
        </h3>
        <span className="label">ranked by weight</span>
      </div>
      <p className="mt-1 text-[0.8rem]" style={{ color: "var(--ink-faint)" }}>
        Arc length on the wheel = weight in the composite. Click any arc — or any row — to drill in.
      </p>
      <ol className="mt-4 space-y-1">
        {SIGNALS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              className="group grid w-full grid-cols-[1.4rem_minmax(0,1fr)_5.2rem_2.2rem] items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--paper)]"
            >
              <span className="tnum text-[0.7rem] font-bold" style={{ color: "var(--ink-faint)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.86rem] font-medium transition-colors group-hover:text-[var(--accent-deep)]">
                  {s.label}
                </span>
                <span className="tnum block text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
                  {s.value}
                </span>
              </span>
              <ScoreBar score={s.score} grow={mounted} delayMs={i * 55} />
              <span
                className="tnum text-right text-[0.86rem] font-semibold"
                style={{ color: LEVEL_COLOR[levelOf(s.score)] }}
              >
                {s.score}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─── Detail panel: single signal drill-down ───────────────── */

function HomicideCompareChart() {
  const mounted = useMounted();
  const max = Math.max(...HOMICIDE_COMPARE.map((d) => d.value));
  return (
    <div className="mt-5 rounded-xl border p-4" style={{ borderColor: "var(--hairline)" }}>
      <div className="label mb-3">How Mexico compares · homicides per 100k</div>
      <div className="space-y-2">
        {HOMICIDE_COMPARE.map((d, i) => (
          <div key={d.country} className="grid grid-cols-[6.4rem_minmax(0,1fr)_2.6rem] items-center gap-2.5">
            <span
              className="truncate text-[0.74rem]"
              style={{
                color: d.target ? "var(--ink)" : "var(--ink-faint)",
                fontWeight: d.target ? 700 : 500,
              }}
            >
              {d.country}
            </span>
            <div className="h-[9px] overflow-hidden rounded-full" style={{ background: "var(--paper-deep)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: mounted ? `${(d.value / max) * 100}%` : "0%",
                  background: d.target ? "var(--risky)" : "var(--sand)",
                  transition: `width 0.85s cubic-bezier(0.2,0.8,0.2,1) ${120 + i * 70}ms`,
                }}
              />
            </div>
            <span
              className="tnum text-right text-[0.74rem] font-semibold"
              style={{ color: d.target ? "var(--risky)" : "var(--ink-soft)" }}
            >
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalDetailPanel({ signal, onBack }: { signal: Signal; onBack: () => void }) {
  const mounted = useMounted();
  const level = levelOf(signal.score);
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[0.78rem] font-semibold transition-colors hover:text-[var(--accent-deep)]"
        style={{ color: "var(--accent)" }}
      >
        ← All signals
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl" style={{ fontWeight: 500 }}>
            {signal.label}
          </h3>
          <div className="tnum mt-0.5 text-[0.95rem]" style={{ color: "var(--ink-soft)" }}>
            {signal.value}
          </div>
        </div>
        <div className="text-right">
          <div className="tnum font-display leading-none" style={{ fontSize: "2.3rem", color: LEVEL_COLOR[level] }}>
            {signal.score}
          </div>
          <div className="label mt-0.5">score / 100</div>
        </div>
      </div>

      <div className="mt-3">
        <ScoreBar score={signal.score} grow={mounted} height={8} />
        <div className="mt-1.5 flex justify-between text-[0.66rem]" style={{ color: "var(--ink-faint)" }}>
          <span>0 · risky</span>
          <span>100 · safe</span>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-[0.86rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        <p>
          <strong style={{ color: "var(--ink)" }}>What it measures.</strong> {signal.measures}
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>What it means for you.</strong> {signal.note}
        </p>
      </div>

      {signal.key === "homicide" && <HomicideCompareChart />}

      <div
        className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[0.72rem]"
        style={{ borderColor: "var(--hairline)", color: "var(--ink-faint)" }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Database size={12} /> Source: {signal.source}, {signal.year}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Info size={12} /> Weight in composite: {Math.round((signal.weight / TOTAL_WEIGHT) * 100)}%
        </span>
      </div>
    </div>
  );
}

/* ─── Tabs ─────────────────────────────────────────────────── */

const TABS = ["Official Advisories", "Health Notices", "Neighborhoods", "Briefing"] as const;
type Tab = (typeof TABS)[number];

function AdvisoriesTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ADVISORIES.map((a) => (
        <article
          key={a.issuer}
          className="rounded-xl border p-4 transition-shadow hover:shadow-[var(--shadow-card)]"
          style={{ borderColor: "var(--hairline)", background: "#fff" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{a.flag}</span>
              <span className="text-[0.82rem] font-semibold">{a.issuer}</span>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-white"
              style={{ background: LEVEL_COLOR[a.tone] }}
            >
              {a.level}
            </span>
          </div>
          <h4 className="font-display mt-3 text-lg" style={{ fontWeight: 500 }}>
            “{a.headline}”
          </h4>
          <p className="mt-1.5 text-[0.84rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            {a.detail}
          </p>
          <div
            className="mt-3 flex items-center gap-1.5 text-[0.7rem]"
            style={{ color: "var(--ink-faint)" }}
          >
            <Landmark size={12} /> Issued {a.date}
            <ExternalLink size={11} className="ml-auto" />
          </div>
        </article>
      ))}
    </div>
  );
}

function HealthTab() {
  return (
    <div className="space-y-3">
      {CDC_NOTICES.map((n) => (
        <article
          key={n.title}
          className="flex items-start gap-3.5 rounded-xl border p-4"
          style={{ borderColor: "var(--hairline)", background: "#fff" }}
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: LEVEL_COLOR[n.tone] }}
          >
            <Stethoscope size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider"
                style={{
                  background: `color-mix(in srgb, ${LEVEL_COLOR[n.tone]} 14%, transparent)`,
                  color: LEVEL_COLOR[n.tone],
                }}
              >
                {n.tier}
              </span>
              <h4 className="text-[0.88rem] font-semibold">{n.title}</h4>
            </div>
            <p className="mt-1 text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              {n.body}
            </p>
          </div>
        </article>
      ))}
      <p className="flex items-center gap-1.5 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
        <Database size={11} /> Source: CDC Travel Health Notices, retrieved 2 Jul 2026
      </p>
    </div>
  );
}

function NeighborhoodsTab() {
  const [hovered, setHovered] = useState<{ group: "safe" | "avoid"; name: string; note: string } | null>(null);
  const groups: {
    id: "safe" | "avoid";
    title: string;
    icon: React.ReactNode;
    tone: Level;
    areas: { name: string; note: string }[];
  }[] = [
    {
      id: "safe",
      title: "Generally safe for visitors",
      icon: <CircleCheck size={15} />,
      tone: "safe",
      areas: SAFE_AREAS,
    },
    {
      id: "avoid",
      title: "Exercise particular caution",
      icon: <Ban size={15} />,
      tone: "risky",
      areas: AVOID_AREAS,
    },
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.id}>
          <div
            className="mb-3 flex items-center gap-2 text-[0.8rem] font-semibold"
            style={{ color: LEVEL_COLOR[g.tone] }}
          >
            {g.icon} {g.title}
          </div>
          <div className="flex flex-wrap gap-2">
            {g.areas.map((a) => {
              const active = hovered?.group === g.id && hovered.name === a.name;
              return (
                <button
                  key={a.name}
                  type="button"
                  onMouseEnter={() => setHovered({ group: g.id, name: a.name, note: a.note })}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered({ group: g.id, name: a.name, note: a.note })}
                  onBlur={() => setHovered(null)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition-all duration-200"
                  style={{
                    borderColor: active
                      ? LEVEL_COLOR[g.tone]
                      : `color-mix(in srgb, ${LEVEL_COLOR[g.tone]} 30%, transparent)`,
                    background: active
                      ? `color-mix(in srgb, ${LEVEL_COLOR[g.tone]} 13%, #fff)`
                      : "#fff",
                    color: active ? LEVEL_COLOR[g.tone] : "var(--ink-soft)",
                    transform: active ? "translateY(-2px)" : "none",
                    boxShadow: active ? "var(--shadow-card)" : "none",
                  }}
                >
                  <MapPin size={13} />
                  {a.name}
                </button>
              );
            })}
          </div>
          <div
            className="mt-3 min-h-[2.4rem] rounded-lg px-3 py-2 text-[0.78rem] leading-snug transition-colors duration-200"
            style={{
              background: hovered?.group === g.id ? "var(--paper)" : "transparent",
              color: hovered?.group === g.id ? "var(--ink-soft)" : "var(--ink-faint)",
            }}
          >
            {hovered?.group === g.id ? (
              <span className="fade-in inline-block">
                <strong style={{ color: "var(--ink)" }}>{hovered.name}</strong> — {hovered.note}
              </span>
            ) : (
              <span className="italic">Hover a district for the field note.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BriefingTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div>
        <div className="label mb-2 flex items-center gap-1.5">
          <Globe size={12} /> AI field briefing
        </div>
        <p className="font-display text-[1.06rem] leading-[1.7]" style={{ color: "var(--ink-soft)", fontWeight: 400 }}>
          {AI_SUMMARY}
        </p>
        <div className="mt-5">
          <div className="label mb-2 flex items-center gap-1.5">
            <Newspaper size={12} /> Recent signals
          </div>
          <ul className="space-y-2">
            {NEWS.map((n) => (
              <li
                key={n}
                className="flex items-start gap-2.5 text-[0.84rem] leading-relaxed"
                style={{ color: "var(--ink-soft)" }}
              >
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--hairline)", background: "#fff" }}>
        <div className="label mb-3 flex items-center gap-1.5">
          <Lightbulb size={12} /> Traveler tips
        </div>
        <ul className="space-y-2.5">
          {TIPS.map((t, i) => (
            <li key={t} className="flex items-start gap-2.5 text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              <span
                className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[0.64rem] font-bold"
                style={{ background: "var(--paper-deep)", color: "var(--accent-deep)" }}
              >
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TabbedPanel() {
  const [tab, setTab] = useState<Tab>("Official Advisories");
  return (
    <section className="card mt-6 overflow-hidden">
      <div
        role="tablist"
        aria-label="Report sections"
        className="flex gap-1 overflow-x-auto border-b px-3 pt-3"
        style={{ borderColor: "var(--hairline)" }}
      >
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className="relative whitespace-nowrap rounded-t-lg px-4 py-2.5 text-[0.82rem] font-semibold transition-colors"
              style={{ color: active ? "var(--ink)" : "var(--ink-faint)" }}
            >
              {t}
              <span
                className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full transition-all duration-300"
                style={{
                  background: "var(--accent)",
                  opacity: active ? 1 : 0,
                  transform: active ? "scaleX(1)" : "scaleX(0.4)",
                }}
              />
            </button>
          );
        })}
      </div>
      <div key={tab} role="tabpanel" className="fade-in p-5 sm:p-6">
        {tab === "Official Advisories" && <AdvisoriesTab />}
        {tab === "Health Notices" && <HealthTab />}
        {tab === "Neighborhoods" && <NeighborhoodsTab />}
        {tab === "Briefing" && <BriefingTab />}
      </div>
    </section>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */

export default function ExplorableScorePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSignal = SIGNALS.find((s) => s.key === selected) ?? null;

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Masthead */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-3">
          <span className="wordmark text-xl">
            IsMyTripSafe
            <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
          </span>
          <ShieldCheck size={16} style={{ color: "var(--accent)", transform: "translateY(2px)" }} />
        </div>
        <span className="eyebrow" style={{ letterSpacing: "0.18em" }}>
          One destination, one click, one report
        </span>
      </header>
      <div className="hairline mt-4" />

      {/* Report head */}
      <section className="rise-in mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <div className="eyebrow">Safety report · No. 2026-0702</div>
          <h1 className="display-lg mt-2">
            Mexico City, Mexico <span aria-hidden="true">🇲🇽</span>
          </h1>
          <p className="mt-2 text-[0.84rem]" style={{ color: "var(--ink-faint)" }}>
            Assessed 2 Jul 2026 · 11 evidence signals · 7 independent sources
          </p>
        </div>
        <div className="flex items-center gap-2 text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
          {(["safe", "moderate", "caution", "risky"] as Level[]).map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5 capitalize">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
              {l}
            </span>
          ))}
        </div>
      </section>

      {/* The explorable score */}
      <section
        className="card rise-in mt-6 grid items-start gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]"
        style={{ animationDelay: "0.12s" }}
      >
        <div>
          <ScoreWheel selected={selected} onSelect={setSelected} />
          <p
            className="mx-auto mt-4 max-w-[380px] text-center text-[0.72rem] leading-relaxed"
            style={{ color: "var(--ink-faint)" }}
          >
            Each arc is one evidence signal — its length is the signal&apos;s weight in the
            composite, its color the signal&apos;s score. Hover to inspect, click to drill down.
            Keyboard: Tab to an arc, arrows to walk the wheel, Enter to open.
          </p>
        </div>

        <div key={selected ?? "all"} className="scale-in min-w-0" style={{ animationDuration: "0.35s" }}>
          {selectedSignal ? (
            <SignalDetailPanel signal={selectedSignal} onBack={() => setSelected(null)} />
          ) : (
            <AllSignalsPanel onSelect={setSelected} />
          )}
        </div>
      </section>

      {/* Tabbed evidence */}
      <div className="rise-in" style={{ animationDelay: "0.24s" }}>
        <TabbedPanel />
      </div>

      {/* Footer */}
      <footer className="mt-12">
        <div className="hairline" />
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[0.72rem]"
          style={{ color: "var(--ink-faint)" }}
        >
          <span>
            <span className="wordmark" style={{ color: "var(--ink-soft)" }}>
              IsMyTripSafe
            </span>
            <span>.com</span> — one destination, one click, one report.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlert size={11} />
            Guidance, not a guarantee. Verify advisories with your government before departure.
          </span>
          <span>
            Sources: World Bank · WGI · U.S. State Dept · UK FCDO · CDC · USGS · Open-Meteo
          </span>
        </div>
      </footer>
    </div>
  );
}
