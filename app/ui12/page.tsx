"use client";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 12: "The Versus Report"
   A head-to-head duel. Mexico City (assessed, fixed left)
   versus a user-chosen benchmark city (right). Switching the
   benchmark re-tweens the medallions, collapses the tug-of-war
   bars to the center axis, then re-extends them toward the
   new values while verdicts and the wins tally recompute.
   ──────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import {
  Trophy,
  Swords,
  ShieldCheck,
  TriangleAlert,
  HeartPulse,
  MapPin,
  Ban,
  CircleCheck,
  Newspaper,
  Lightbulb,
  Landmark,
  Scale,
  Equal,
  Database,
} from "lucide-react";

/* ═══ Verdict scale ══════════════════════════════════════════ */

type Verdict = { label: string; color: string };

function verdictOf(score: number): Verdict {
  if (score >= 80) return { label: "Very safe", color: "var(--safe)" };
  if (score >= 66) return { label: "Safe", color: "var(--safe)" };
  if (score >= 50) return { label: "Moderate", color: "var(--moderate)" };
  if (score >= 34) return { label: "Caution", color: "var(--caution)" };
  return { label: "High risk", color: "var(--risky)" };
}

/* ═══ Data ═══════════════════════════════════════════════════ */

const SIGNAL_LABELS = [
  "Homicide rate",
  "Road traffic deaths",
  "Political stability",
  "Rule of law",
  "Control of corruption",
  "Air quality",
  "Health notices",
  "Govt advisory (US)",
] as const;

type Sig = { display: string; score: number };

const MEXICO = {
  name: "Mexico City",
  country: "Mexico",
  flag: "🇲🇽",
  index: 47,
  verdictNote: "Caution advised",
  percentile: "Safer than ~38% of countries",
  advisory: { badge: "Level 2", note: "Exercise increased caution" },
  signals: [
    { display: "24.9 per 100k", score: 26 },
    { display: "12.7 per 100k", score: 59 },
    { display: "28 of 100", score: 28 },
    { display: "31 of 100", score: 31 },
    { display: "22 of 100", score: 22 },
    { display: "US AQI 72", score: 78 },
    { display: "2 active · max Alert", score: 60 },
    { display: "Level 2", score: 70 },
  ] as Sig[],
};

type Benchmark = {
  id: string;
  name: string;
  flag: string;
  index: number;
  blurb: string;
  advisory: { badge: string; note: string };
  signals: Sig[];
};

const BENCHMARKS: Benchmark[] = [
  {
    id: "tokyo",
    name: "Tokyo",
    flag: "🇯🇵",
    index: 86,
    blurb: "one of the safest cities we track",
    advisory: { badge: "Level 1", note: "Exercise normal precautions" },
    signals: [
      { display: "0.2 per 100k", score: 98 },
      { display: "3.7 per 100k", score: 91 },
      { display: "88 of 100", score: 88 },
      { display: "90 of 100", score: 90 },
      { display: "91 of 100", score: 91 },
      { display: "US AQI 42", score: 92 },
      { display: "0 active", score: 100 },
      { display: "Level 1", score: 95 },
    ],
  },
  {
    id: "paris",
    name: "Paris",
    flag: "🇫🇷",
    index: 74,
    blurb: "a clear step up in overall safety",
    advisory: { badge: "Level 2", note: "Exercise increased caution" },
    signals: [
      { display: "1.1 per 100k", score: 90 },
      { display: "4.9 per 100k", score: 86 },
      { display: "60 of 100", score: 60 },
      { display: "82 of 100", score: 82 },
      { display: "84 of 100", score: 84 },
      { display: "US AQI 55", score: 88 },
      { display: "0 active", score: 100 },
      { display: "Level 2", score: 70 },
    ],
  },
  {
    id: "nyc",
    name: "New York",
    flag: "🇺🇸",
    index: 68,
    blurb: "safer on most measures, closer on roads",
    advisory: { badge: "Home country", note: "No US advisory issued" },
    signals: [
      { display: "5.7 per 100k", score: 65 },
      { display: "12.8 per 100k", score: 58 },
      { display: "46 of 100", score: 46 },
      { display: "86 of 100", score: 86 },
      { display: "83 of 100", score: 83 },
      { display: "US AQI 48", score: 91 },
      { display: "0 active", score: 100 },
      { display: "Home country", score: 70 },
    ],
  },
  {
    id: "bangkok",
    name: "Bangkok",
    flag: "🇹🇭",
    index: 58,
    blurb: "safer overall, with its own road-safety caveats",
    advisory: { badge: "Level 1", note: "Exercise normal precautions" },
    signals: [
      { display: "2.6 per 100k", score: 81 },
      { display: "32.2 per 100k", score: 13 },
      { display: "30 of 100", score: 30 },
      { display: "55 of 100", score: 55 },
      { display: "38 of 100", score: 38 },
      { display: "US AQI 89", score: 62 },
      { display: "1 active · Watch", score: 84 },
      { display: "Level 1", score: 95 },
    ],
  },
  {
    id: "rio",
    name: "Rio de Janeiro",
    flag: "🇧🇷",
    index: 42,
    blurb: "similar caution applies",
    advisory: { badge: "Level 2", note: "Exercise increased caution" },
    signals: [
      { display: "21.3 per 100k", score: 29 },
      { display: "15.9 per 100k", score: 48 },
      { display: "35 of 100", score: 35 },
      { display: "47 of 100", score: 47 },
      { display: "43 of 100", score: 43 },
      { display: "US AQI 51", score: 90 },
      { display: "1 active · Alert", score: 60 },
      { display: "Level 2", score: 70 },
    ],
  },
];

const OFFICIAL_ADVISORIES = [
  {
    org: "US State Department",
    badge: "Level 2",
    color: "var(--moderate)",
    text: "Exercise Increased Caution — crime and kidnapping",
    date: "Jun 2026",
  },
  {
    org: "UK FCDO",
    badge: "Level 3",
    color: "var(--caution)",
    text: "Advises against all-but-essential travel to parts",
    date: "Jun 2026",
  },
];

const CDC_NOTICES = [
  { tag: "Alert", color: "var(--caution)", text: "Rocky Mountain Spotted Fever" },
  { tag: "Watch", color: "var(--moderate)", text: "Salmonella Newport" },
];

const SAFE_AREAS = ["Polanco", "Roma Norte", "Condesa", "Coyoacán"];
const AVOID_AREAS = ["Tepito", "Doctores (after dark)", "Iztapalapa"];

const NEWS = [
  "Increased National Guard patrols in tourist areas",
  "Pickpocketing spike on Metro Line 2",
  "No major unrest in past 90 days",
];

const TIPS = [
  "Use Uber or authorized taxi stands",
  "Keep phones off café tables",
  "Carry a passport photocopy",
  "Avoid Metro at rush hour with luggage",
];

/* ═══ Hooks ══════════════════════════════════════════════════ */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Tween an integer toward `target` with ease-out cubic on every change. */
function useTween(target: number, reduced: boolean, duration = 750) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (reduced || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (target - from) * eased);
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, reduced, duration]);
  return value;
}

/* ═══ Small pieces ═══════════════════════════════════════════ */

function VerdictPill({ score, small }: { score: number; small?: boolean }) {
  const v = verdictOf(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-[0.12em] transition-colors duration-500 ${
        small ? "px-2.5 py-0.5 text-[0.58rem]" : "px-3.5 py-1 text-[0.66rem]"
      }`}
      style={{
        color: v.color,
        background: `color-mix(in srgb, ${v.color} 12%, white)`,
        border: `1px solid color-mix(in srgb, ${v.color} 35%, transparent)`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: v.color }}
      />
      {v.label}
    </span>
  );
}

/** Score medallion with animated ring gauge. */
function Medallion({
  flag,
  name,
  sub,
  index,
  align,
  reduced,
  fading,
}: {
  flag: string;
  name: string;
  sub: string;
  index: number;
  align: "left" | "right";
  reduced: boolean;
  fading: boolean;
}) {
  const shown = useTween(index, reduced);
  const v = verdictOf(index);
  const R = 64;
  const C = 2 * Math.PI * R;
  return (
    <div
      className={`flex flex-col items-center gap-3 ${
        align === "left" ? "md:items-end" : "md:items-start"
      }`}
    >
      <div
        className={`flex items-baseline gap-2 duel-fade ${fading ? "opacity-0" : "opacity-100"} ${
          align === "left" ? "md:flex-row-reverse" : ""
        }`}
      >
        <span className="text-xl leading-none">{flag}</span>
        <div className={align === "left" ? "md:text-right" : ""}>
          <div className="font-display text-xl leading-tight" style={{ color: "var(--ink)" }}>
            {name}
          </div>
          <div className="text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
            {sub}
          </div>
        </div>
      </div>

      <div className="relative h-[168px] w-[168px]">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth="10"
          />
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={v.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - index / 100)}
            className="duel-ring"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display tnum text-[3.1rem] leading-none transition-colors duration-500"
            style={{ color: v.color, fontWeight: 550 }}
          >
            {shown}
          </span>
          <span className="label mt-1" style={{ letterSpacing: "0.18em" }}>
            of 100
          </span>
        </div>
      </div>

      <VerdictPill score={index} />
    </div>
  );
}

/** One tug-of-war row of the duel table. */
function DuelRow({
  label,
  left,
  right,
  collapsed,
  delayIdx,
}: {
  label: string;
  left: Sig;
  right: Sig;
  collapsed: boolean;
  delayIdx: number;
}) {
  const lv = verdictOf(left.score);
  const rv = verdictOf(right.score);
  const tie = left.score === right.score;
  const leftWins = left.score > right.score;

  const barStyle = (score: number, color: string, dir: 90 | 270): React.CSSProperties => ({
    width: collapsed ? "0%" : `${score}%`,
    background: `linear-gradient(${dir}deg, color-mix(in srgb, ${color} 55%, white), ${color})`,
    transitionDelay: collapsed ? "0ms" : `${delayIdx * 45}ms`,
  });

  return (
    <div className="grid grid-cols-2 items-center gap-y-1.5 py-3 sm:grid-cols-[1fr_11rem_1fr] sm:gap-y-0 sm:py-0 sm:h-[52px]">
      {/* Signal label — centered on desktop, full-width heading on mobile */}
      <div className="col-span-2 flex items-center justify-center sm:order-2 sm:col-span-1">
        <span
          className="text-[0.72rem] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--ink-soft)" }}
        >
          {label}
        </span>
      </div>

      {/* Left bar — Mexico City, grows leftward from the center axis */}
      <div
        className="flex items-center justify-end gap-2 pr-3 sm:order-1"
        style={{ borderRight: "2px solid var(--hairline)" }}
      >
        {leftWins && !tie && (
          <Trophy
            size={12}
            className={`shrink-0 duel-fade ${collapsed ? "opacity-0" : "opacity-100"}`}
            style={{ color: "var(--gold)" }}
            aria-label="Mexico City leads on this measure"
          />
        )}
        <span
          className={`tnum whitespace-nowrap text-[0.72rem] font-medium duel-fade ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
          style={{ color: "var(--ink-soft)" }}
        >
          {left.display}
        </span>
        <div
          className="duel-bar h-[9px] rounded-l-full"
          style={barStyle(left.score, lv.color, 270)}
        />
      </div>

      {/* Right bar — benchmark, grows rightward from the center axis */}
      <div className="flex items-center justify-start gap-2 pl-3 sm:order-3">
        <div
          className="duel-bar h-[9px] rounded-r-full"
          style={barStyle(right.score, rv.color, 90)}
        />
        <span
          className={`tnum whitespace-nowrap text-[0.72rem] font-medium duel-fade ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
          style={{ color: "var(--ink-soft)" }}
        >
          {right.display}
        </span>
        {!leftWins && !tie && (
          <Trophy
            size={12}
            className={`shrink-0 duel-fade ${collapsed ? "opacity-0" : "opacity-100"}`}
            style={{ color: "var(--gold)" }}
            aria-label="Benchmark leads on this measure"
          />
        )}
        {tie && (
          <Equal
            size={12}
            className={`shrink-0 duel-fade ${collapsed ? "opacity-0" : "opacity-100"}`}
            style={{ color: "var(--ink-faint)" }}
            aria-label="Tied on this measure"
          />
        )}
      </div>
    </div>
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
      <span className="section-title">{title}</span>
      <span className="section-rule" />
      {note && <span className="section-note">{note}</span>}
    </div>
  );
}

/* ═══ Page ═══════════════════════════════════════════════════ */

export default function VersusReport() {
  const reduced = useReducedMotion();

  const [activeId, setActiveId] = useState("tokyo"); // what the user picked
  const [shownId, setShownId] = useState("tokyo"); // what the duel currently renders
  const [collapsed, setCollapsed] = useState(false); // bars pulled back to the axis

  const shown = BENCHMARKS.find((b) => b.id === shownId)!;

  const pick = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    if (reduced) {
      setShownId(id);
    } else {
      setCollapsed(true);
    }
  };

  useEffect(() => {
    if (!collapsed) return;
    const t = setTimeout(() => {
      setShownId(activeId);
      setCollapsed(false);
    }, 320);
    return () => clearTimeout(t);
  }, [collapsed, activeId]);

  /* Wins tally */
  const mexWins = MEXICO.signals.filter((s, i) => s.score > shown.signals[i].score).length;
  const benchWins = MEXICO.signals.filter((s, i) => s.score < shown.signals[i].score).length;
  const ties = SIGNAL_LABELS.length - mexWins - benchWins;
  const tallyLeader =
    benchWins > mexWins
      ? `${shown.name} leads ${benchWins} of ${SIGNAL_LABELS.length} measures`
      : mexWins > benchWins
        ? `Mexico City leads ${mexWins} of ${SIGNAL_LABELS.length} measures`
        : `Even at ${mexWins}–${benchWins}`;

  /* Delta statement */
  const diff = shown.index - MEXICO.index;
  const deltaStatement =
    diff === 0
      ? `${shown.name} scores the same — ${shown.blurb}`
      : `${shown.name} scores ${Math.abs(diff)} points ${diff > 0 ? "higher" : "lower"} — ${shown.blurb}`;

  return (
    <div className="relative z-10 min-h-screen">
      {/* Page-scoped motion styles */}
      <style>{`
        .duel-bar {
          transition: width 0.55s cubic-bezier(0.22, 0.9, 0.3, 1);
        }
        .duel-ring {
          transition: stroke-dashoffset 0.85s cubic-bezier(0.22, 0.9, 0.3, 1), stroke 0.5s ease;
        }
        .duel-fade {
          transition: opacity 0.28s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .duel-bar, .duel-ring, .duel-fade { transition: none !important; }
          .rise-in { animation-duration: 0.01ms !important; }
        }
      `}</style>

      {/* ── Masthead ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--glass-strong)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[10px]"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              <ShieldCheck size={17} />
            </span>
            <span className="wordmark text-lg" style={{ color: "var(--ink)" }}>
              IsMyTripSafe
              <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
            </span>
          </div>
          <span className="hidden text-[0.74rem] italic sm:block" style={{ color: "var(--ink-faint)" }}>
            One destination, one click, one report
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8">
        {/* ── Report header + benchmark picker ─────────────────── */}
        <div className="rise-in flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow mb-3 flex items-center gap-2">
              <Swords size={13} style={{ color: "var(--accent)" }} />
              Versus report · Assessed 2 Jul 2026
            </p>
            <h1 className="display-lg" style={{ color: "var(--ink)" }}>
              Mexico City,{" "}
              <em style={{ color: "var(--accent-deep)" }}>compared.</em>
            </h1>
            <p className="mt-3 max-w-md text-[0.92rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              &ldquo;Is it safe?&rdquo; usually means &ldquo;…compared to where?&rdquo; Pick a
              benchmark city and watch every measure square off.
            </p>
          </div>

          {/* Benchmark picker */}
          <div>
            <p className="label mb-2.5">Benchmark against</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a benchmark city">
              {BENCHMARKS.map((b) => {
                const active = b.id === activeId;
                return (
                  <button
                    key={b.id}
                    onClick={() => pick(b.id)}
                    aria-pressed={active}
                    className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.8rem] font-semibold transition-all duration-200"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--hairline)",
                      background: active ? "var(--accent)" : "rgba(255,255,255,0.7)",
                      color: active ? "#fff" : "var(--ink-soft)",
                      boxShadow: active ? "0 6px 18px -6px rgba(31,116,207,0.55)" : "none",
                    }}
                  >
                    <span aria-hidden>{b.flag}</span>
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Hero: medallion face-off ─────────────────────────── */}
        <section
          className="card rise-in mt-9 px-6 py-9 sm:px-10"
          style={{ animationDelay: "0.08s" }}
        >
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto_1fr] md:gap-4">
            <Medallion
              flag={MEXICO.flag}
              name={MEXICO.name}
              sub="Assessed destination"
              index={MEXICO.index}
              align="left"
              reduced={reduced}
              fading={false}
            />

            {/* Center delta */}
            <div className="flex flex-col items-center gap-4 text-center md:max-w-[230px]">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-semibold"
                style={{
                  background: "var(--ink)",
                  color: "var(--paper)",
                  boxShadow: "var(--shadow-card)",
                }}
                aria-hidden
              >
                vs
              </span>
              <p
                className={`text-[0.92rem] leading-relaxed duel-fade ${collapsed ? "opacity-0" : "opacity-100"}`}
                style={{ color: "var(--ink-soft)" }}
                aria-live="polite"
              >
                <strong className="tnum" style={{ color: "var(--ink)" }}>
                  {deltaStatement.split(" — ")[0]}
                </strong>
                {" — "}
                {deltaStatement.split(" — ")[1]}
              </p>
              <p className="text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                {MEXICO.percentile}
              </p>
            </div>

            <Medallion
              flag={shown.flag}
              name={shown.name}
              sub="Your benchmark"
              index={shown.index}
              align="right"
              reduced={reduced}
              fading={collapsed}
            />
          </div>

          {/* Advisory face-off strip */}
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {[
              { city: MEXICO.name, flag: MEXICO.flag, a: MEXICO.advisory, fade: false },
              { city: shown.name, flag: shown.flag, a: shown.advisory, fade: collapsed },
            ].map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 duel-fade ${
                  row.fade ? "opacity-0" : "opacity-100"
                }`}
                style={{ borderColor: "var(--hairline)", background: "rgba(255,255,255,0.6)" }}
              >
                <div className="flex items-center gap-2.5">
                  <Landmark size={15} style={{ color: "var(--ink-faint)" }} />
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-faint)" }}>
                      US State Dept · {row.flag} {row.city}
                    </p>
                    <p className="text-[0.8rem] font-medium" style={{ color: "var(--ink-soft)" }}>
                      {row.a.note}
                    </p>
                  </div>
                </div>
                <span
                  className="tnum rounded-lg px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                  style={{
                    background:
                      row.a.badge === "Level 1"
                        ? "color-mix(in srgb, var(--safe) 13%, white)"
                        : row.a.badge === "Level 2"
                          ? "color-mix(in srgb, var(--moderate) 15%, white)"
                          : "color-mix(in srgb, var(--sand) 60%, white)",
                    color:
                      row.a.badge === "Level 1"
                        ? "var(--safe)"
                        : row.a.badge === "Level 2"
                          ? "var(--moderate)"
                          : "var(--ink-soft)",
                  }}
                >
                  {row.a.badge}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── The duel table ───────────────────────────────────── */}
        <section className="rise-in mt-12" style={{ animationDelay: "0.16s" }}>
          <SectionHead num="01" title="The duel" note="8 measures · higher score is safer" />

          {/* Wins tally chip */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.78rem] font-semibold duel-fade ${
                collapsed ? "opacity-0" : "opacity-100"
              }`}
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                boxShadow: "var(--shadow-card)",
              }}
              aria-live="polite"
            >
              <Trophy size={13} style={{ color: "var(--gold)" }} />
              {tallyLeader}
            </span>
            {ties > 0 && (
              <span className={`text-[0.72rem] duel-fade ${collapsed ? "opacity-0" : "opacity-100"}`} style={{ color: "var(--ink-faint)" }}>
                {ties} tied
              </span>
            )}
          </div>

          <div className="card mt-4 overflow-hidden">
            {/* Column headers */}
            <div
              className="grid grid-cols-2 border-b px-4 py-3 sm:grid-cols-[1fr_11rem_1fr] sm:px-6"
              style={{ borderColor: "var(--hairline)", background: "rgba(238,242,248,0.55)" }}
            >
              <div className="flex items-center justify-end gap-2 sm:order-1">
                <span className="text-[0.74rem] font-bold" style={{ color: "var(--ink)" }}>
                  {MEXICO.flag} Mexico City
                </span>
              </div>
              <div className="hidden items-center justify-center sm:order-2 sm:flex">
                <span className="label">Signal</span>
              </div>
              <div className="flex items-center justify-start gap-2 sm:order-3">
                <span
                  className={`text-[0.74rem] font-bold duel-fade ${collapsed ? "opacity-0" : "opacity-100"}`}
                  style={{ color: "var(--ink)" }}
                >
                  {shown.flag} {shown.name}
                </span>
              </div>
            </div>

            <div className="divide-y px-4 py-2 sm:px-6" style={{ borderColor: "var(--hairline)" }}>
              {SIGNAL_LABELS.map((label, i) => (
                <DuelRow
                  key={label}
                  label={label}
                  left={MEXICO.signals[i]}
                  right={shown.signals[i]}
                  collapsed={collapsed}
                  delayIdx={i}
                />
              ))}
            </div>

            <div
              className="border-t px-4 py-3 text-center text-[0.68rem] sm:px-6"
              style={{ borderColor: "var(--hairline)", color: "var(--ink-faint)" }}
            >
              Bars extend outward from the center axis · longer is safer ·{" "}
              <Trophy size={10} className="mb-0.5 inline" style={{ color: "var(--gold)" }} /> marks
              the side that leads each measure
            </div>
          </div>
        </section>

        {/* ── Mexico City supporting report ─────────────────────── */}
        <section className="rise-in mt-14" style={{ animationDelay: "0.24s" }}>
          <SectionHead num="02" title="The full Mexico City file" note="Compact report" />

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {/* Official advisories */}
            <div className="card p-5">
              <p className="label mb-3.5 flex items-center gap-2">
                <Landmark size={13} /> Official advisories
              </p>
              <div className="flex flex-col gap-3">
                {OFFICIAL_ADVISORIES.map((a) => (
                  <div
                    key={a.org}
                    className="rounded-xl border p-3.5"
                    style={{
                      borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
                      background: `color-mix(in srgb, ${a.color} 6%, white)`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[0.72rem] font-bold" style={{ color: "var(--ink)" }}>
                        {a.org}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide"
                        style={{ background: `color-mix(in srgb, ${a.color} 16%, white)`, color: a.color }}
                      >
                        {a.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[0.82rem] leading-snug" style={{ color: "var(--ink-soft)" }}>
                      {a.text}
                    </p>
                    <p className="mt-1 text-[0.66rem]" style={{ color: "var(--ink-faint)" }}>
                      Updated {a.date}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CDC + news */}
            <div className="flex flex-col gap-4">
              <div className="card p-5">
                <p className="label mb-3.5 flex items-center gap-2">
                  <HeartPulse size={13} /> CDC health notices
                </p>
                <div className="flex flex-col gap-2.5">
                  {CDC_NOTICES.map((n) => (
                    <div key={n.text} className="flex items-center gap-3">
                      <span
                        className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide"
                        style={{ background: `color-mix(in srgb, ${n.color} 15%, white)`, color: n.color }}
                      >
                        {n.tag}
                      </span>
                      <span className="text-[0.84rem]" style={{ color: "var(--ink-soft)" }}>
                        {n.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card flex-1 p-5">
                <p className="label mb-3.5 flex items-center gap-2">
                  <Newspaper size={13} /> Recent signals
                </p>
                <ul className="flex flex-col gap-2.5">
                  {NEWS.map((n) => (
                    <li key={n} className="flex items-start gap-2.5 text-[0.84rem]" style={{ color: "var(--ink-soft)" }}>
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

            {/* Neighborhoods */}
            <div className="card p-5">
              <p className="label mb-3.5 flex items-center gap-2">
                <MapPin size={13} /> Neighborhood guidance
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: "var(--safe)" }}>
                    <CircleCheck size={12} /> Generally safe
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {SAFE_AREAS.map((n) => (
                      <li key={n} className="text-[0.84rem]" style={{ color: "var(--ink-soft)" }}>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: "var(--risky)" }}>
                    <Ban size={12} /> Use caution
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {AVOID_AREAS.map((n) => (
                      <li key={n} className="text-[0.84rem]" style={{ color: "var(--ink-soft)" }}>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="card p-5">
              <p className="label mb-3.5 flex items-center gap-2">
                <Lightbulb size={13} /> Traveler tips
              </p>
              <div className="flex flex-wrap gap-2">
                {TIPS.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border px-3 py-1.5 text-[0.78rem]"
                    style={{
                      borderColor: "var(--hairline)",
                      background: "rgba(255,255,255,0.7)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl p-3" style={{ background: "var(--paper-deep)" }}>
                <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: "var(--caution)" }} />
                <p className="text-[0.74rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  Petty crime is the dominant tourist risk — most incidents are theft, not
                  violence, and cluster on transit and in crowds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Methodology ──────────────────────────────────────── */}
        <details className="disclosure rise-in mt-10" style={{ animationDelay: "0.3s" }}>
          <summary>
            <span className="flex items-center gap-2">
              <Database size={14} style={{ color: "var(--ink-faint)" }} />
              Methodology & benchmark caveats
            </span>
            <Scale size={14} style={{ color: "var(--ink-faint)" }} />
          </summary>
          <div className="disclosure-body">
            Safety indices combine eight weighted signals from the World Bank, WHO,
            Worldwide Governance Indicators, US State Department, UK FCDO, and CDC,
            normalized to a 0–100 scale where higher is safer. Benchmark-city figures are{" "}
            <strong>country-level data from the same databases</strong>, so a benchmark
            reflects its country&rsquo;s profile rather than city-precise measurement. The wins
            tally counts signals where one side&rsquo;s normalized score exceeds the
            other&rsquo;s; it is a comparison aid, not a substitute for the composite index.
          </div>
        </details>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--hairline)", background: "rgba(255,255,255,0.5)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-8 text-center sm:px-8">
          <span className="wordmark text-base" style={{ color: "var(--ink)" }}>
            IsMyTripSafe
            <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
          </span>
          <p className="text-[0.76rem] italic" style={{ color: "var(--ink-faint)" }}>
            One destination, one click, one report
          </p>
          <p className="mt-2 max-w-lg text-[0.68rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
            Informational only — not a guarantee of safety. Verify current advisories with
            your government before travel. © 2026 IsMyTripSafe.com
          </p>
        </div>
      </footer>
    </div>
  );
}
