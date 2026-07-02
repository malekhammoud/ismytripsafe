"use client";

/* ────────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 8: "Your Trip, Your Score"
   Live personalization: the composite recomputes as you describe
   your trip. Same evidence, reweighted — honestly.
   Fully self-contained; hardcoded sample data (Mexico City).
   ──────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  User,
  Users,
  Baby,
  Briefcase,
  Moon,
  TrainFront,
  Wind,
  Compass,
  ShieldAlert,
  Landmark,
  Stethoscope,
  Newspaper,
  MapPin,
  Lightbulb,
  Sparkles,
  Scale,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Info,
  ExternalLink,
  CircleCheck,
  Ban,
  SlidersHorizontal,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

type SignalKey =
  | "homicide"
  | "road"
  | "battle"
  | "stability"
  | "rule_of_law"
  | "corruption"
  | "gov_effectiveness"
  | "seismic"
  | "air_quality"
  | "health"
  | "advisory";

type Profile = "solo" | "couple" | "family" | "business";

type Flags = {
  dark: boolean;
  transit: boolean;
  air: boolean;
  beyond: boolean;
};

type Signal = {
  key: SignalKey;
  label: string;
  value: string;
  score: number;
  source: string;
  year: string;
  baseWeight: number;
};

/* ── Sample data (shared across mockups) ────────────────────── */

const SIGNALS: Signal[] = [
  { key: "homicide", label: "Homicide rate", value: "24.9 per 100k", score: 26, source: "World Bank", year: "2023", baseWeight: 0.22 },
  { key: "stability", label: "Political stability", value: "28 of 100", score: 28, source: "WGI", year: "2024", baseWeight: 0.16 },
  { key: "battle", label: "Armed-conflict deaths", value: "None reported", score: 100, source: "World Bank", year: "2023", baseWeight: 0.12 },
  { key: "rule_of_law", label: "Rule of law", value: "31 of 100", score: 31, source: "WGI", year: "2024", baseWeight: 0.1 },
  { key: "advisory", label: "Government travel advisory", value: "Level 2 — Increased Caution", score: 70, source: "U.S. State Dept", year: "2026", baseWeight: 0.1 },
  { key: "corruption", label: "Control of corruption", value: "22 of 100", score: 22, source: "WGI", year: "2024", baseWeight: 0.07 },
  { key: "gov_effectiveness", label: "Government effectiveness", value: "45 of 100", score: 45, source: "WGI", year: "2024", baseWeight: 0.06 },
  { key: "road", label: "Road traffic deaths", value: "12.7 per 100k", score: 59, source: "World Bank", year: "2021", baseWeight: 0.06 },
  { key: "seismic", label: "Recent earthquakes", value: "3 quakes · max M5.8", score: 62, source: "USGS", year: "last 90 days", baseWeight: 0.05 },
  { key: "health", label: "Travel health notices", value: "2 notices · max Alert", score: 60, source: "CDC", year: "live", baseWeight: 0.05 },
  { key: "air_quality", label: "Air quality", value: "US AQI 72 · Moderate", score: 78, source: "Open-Meteo", year: "live", baseWeight: 0.03 },
];

const PROFILE_WEIGHTS: Record<Profile, Partial<Record<SignalKey, number>>> = {
  solo: { homicide: 1.3, rule_of_law: 1.3 },
  couple: {},
  family: { health: 1.5, air_quality: 1.5, road: 1.5 },
  business: { stability: 1.3, gov_effectiveness: 1.3 },
};

const PROFILE_META: { id: Profile; label: string; icon: typeof User; blurb: string }[] = [
  { id: "solo", label: "Solo", icon: User, blurb: "Personal-safety signals weigh more" },
  { id: "couple", label: "Couple", icon: Users, blurb: "Baseline weighting" },
  { id: "family", label: "Family", icon: Baby, blurb: "Health, roads & air weigh more" },
  { id: "business", label: "Business", icon: Briefcase, blurb: "Stability & institutions weigh more" },
];

const TOGGLE_META: { id: keyof Flags; label: string; sub: string; icon: typeof Moon }[] = [
  { id: "dark", label: "Out after dark", sub: "Crime-linked signals scored ×0.85", icon: Moon },
  { id: "transit", label: "Using public transit", sub: "Road & street-crime relevance up", icon: TrainFront },
  { id: "air", label: "Sensitive to air quality / asthma", sub: "Air quality weight ×2.5", icon: Wind },
  { id: "beyond", label: "Visiting beyond tourist zones", sub: "Rule-of-law & corruption ×1.4", icon: Compass },
];

/* ── Scoring engine (pure) ──────────────────────────────────── */

type ComputedRow = {
  signal: Signal;
  effWeight: number;
  effScore: number;
  scoreAdjusted: boolean;
  weightMult: number;
  share: number; // effWeight / totalWeight
  impact: number; // share × (100 − effScore): what drags the score
};

function computeReport(profile: Profile, flags: Flags) {
  const rows: ComputedRow[] = SIGNALS.map((s) => {
    let mult = PROFILE_WEIGHTS[profile][s.key] ?? 1;
    if (flags.transit && s.key === "road") mult *= 1.5;
    if (flags.transit && s.key === "homicide") mult *= 1.15;
    if (flags.air && s.key === "air_quality") mult *= 2.5;
    if (flags.beyond && (s.key === "rule_of_law" || s.key === "corruption")) mult *= 1.4;

    const scoreAdjusted = flags.dark && (s.key === "homicide" || s.key === "advisory");
    const effScore = scoreAdjusted ? s.score * 0.85 : s.score;
    const effWeight = s.baseWeight * mult;
    return { signal: s, effWeight, effScore, scoreAdjusted, weightMult: mult, share: 0, impact: 0 };
  });

  const totalWeight = rows.reduce((a, r) => a + r.effWeight, 0);
  for (const r of rows) {
    r.share = r.effWeight / totalWeight;
    r.impact = r.share * (100 - r.effScore);
  }
  // Rounded down on purpose — when in doubt, we err cautious.
  const composite = Math.floor(rows.reduce((a, r) => a + r.effScore * r.effWeight, 0) / totalWeight);
  const ranked = [...rows].sort((a, b) => b.impact - a.impact);
  return { rows, ranked, composite, totalWeight };
}

type Band = { name: string; verdict: string; color: string };

function bandOf(score: number): Band {
  if (score >= 80) return { name: "VERY SAFE", verdict: "Very safe for travel", color: "var(--safe)" };
  if (score >= 66) return { name: "SAFE", verdict: "Broadly safe", color: "var(--safe)" };
  if (score >= 50) return { name: "MODERATE", verdict: "Stay aware", color: "var(--moderate)" };
  if (score >= 34) return { name: "CAUTION", verdict: "Caution advised", color: "var(--caution)" };
  return { name: "HIGH RISK", verdict: "High risk — reconsider", color: "var(--risky)" };
}

/* ── Hooks ──────────────────────────────────────────────────── */

function useTweenedNumber(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      current.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ── Small building blocks ──────────────────────────────────── */

function SectionHead({ num, title, note }: { num: string; title: string; note?: string }) {
  return (
    <div className="section-head">
      <span className="section-num">{num}</span>
      <span className="section-title">{title}</span>
      <span className="section-rule" />
      {note && <span className="section-note">{note}</span>}
    </div>
  );
}

/* Big animated gauge — 240° arc, tweened value, band-colored */
function ScoreGauge({ score }: { score: number }) {
  const tweened = useTweenedNumber(score);
  const band = bandOf(score);
  const R = 84;
  const CIRC = 2 * Math.PI * R;
  const ARC = CIRC * (240 / 360);
  const frac = Math.max(0, Math.min(100, tweened)) / 100;
  return (
    <div className="relative w-[232px] h-[196px] mx-auto select-none">
      <svg viewBox="0 0 200 200" className="w-[232px] h-[232px] -mt-2 rotate-[150deg]">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--paper-deep)" strokeWidth="13"
          strokeLinecap="round" strokeDasharray={`${ARC} ${CIRC}`} />
        <circle cx="100" cy="100" r={R} fill="none" stroke={band.color} strokeWidth="13"
          strokeLinecap="round" strokeDasharray={`${ARC * frac} ${CIRC}`}
          style={{ transition: "stroke 0.5s ease", filter: `drop-shadow(0 2px 8px ${band.color}44)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
        <div className="font-display tnum leading-none" style={{ fontSize: "4.6rem", fontWeight: 550, color: band.color, transition: "color 0.5s ease" }}>
          {Math.round(tweened)}
        </div>
        <div className="text-[0.78rem] font-semibold tracking-[0.18em] text-[var(--ink-faint)] mt-1">OUT OF 100</div>
      </div>
    </div>
  );
}

/* One reorderable signal row (absolutely positioned, rank-translated) */
const ROW_H = 76;

function SignalRow({ row, rank, maxImpact }: { row: ComputedRow; rank: number; maxImpact: number }) {
  const band = bandOf(row.effScore);
  const displayScore = Math.round(row.effScore);
  const weighted = row.weightMult !== 1;
  const impactFrac = maxImpact > 0 ? row.impact / maxImpact : 0;
  return (
    <div
      className="absolute inset-x-0"
      style={{
        height: ROW_H,
        transform: `translateY(${rank * ROW_H}px)`,
        transition: "transform 0.55s cubic-bezier(0.3, 0.9, 0.3, 1)",
        zIndex: 30 - rank,
      }}
    >
      <div className="h-full flex items-center gap-3 border-b border-[var(--hairline)] px-1">
        {/* rank marker — dot sized by impact */}
        <div className="hidden sm:flex w-6 justify-center shrink-0">
          <span
            className="rounded-full"
            style={{
              width: 8 + impactFrac * 8,
              height: 8 + impactFrac * 8,
              background: band.color,
              opacity: 0.35 + impactFrac * 0.65,
              transition: "all 0.5s ease",
            }}
          />
        </div>
        {/* label + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[0.86rem] font-semibold text-[var(--ink)] truncate">{row.signal.label}</span>
            <span className="text-[0.72rem] text-[var(--ink-faint)] truncate hidden md:inline">{row.signal.value}</span>
            {row.scoreAdjusted && (
              <span className="text-[0.62rem] font-semibold px-1.5 py-px rounded-full shrink-0"
                style={{ background: "rgba(31,116,207,0.1)", color: "var(--accent-deep)" }}>
                night-adj ×0.85
              </span>
            )}
          </div>
          <div className="mt-1.5 h-[7px] rounded-full bg-[var(--paper-deep)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${row.effScore}%`,
                background: band.color,
                transition: "width 0.6s cubic-bezier(0.3,0.9,0.3,1), background 0.5s ease",
              }}
            />
          </div>
          <div className="mt-1 text-[0.62rem] text-[var(--ink-faint)] tnum">
            {row.signal.source}, {row.signal.year}
          </div>
        </div>
        {/* live weight chip — grows/shrinks with share */}
        <div className="shrink-0 text-right w-[92px]">
          <div
            className="inline-flex items-center gap-1 rounded-full tnum font-semibold"
            style={{
              padding: `${2 + row.share * 10}px ${9 + row.share * 26}px`,
              fontSize: `${0.62 + row.share * 0.5}rem`,
              background: weighted ? "rgba(31,116,207,0.12)" : "rgba(20,25,34,0.05)",
              color: weighted ? "var(--accent-deep)" : "var(--ink-soft)",
              border: `1px solid ${weighted ? "rgba(31,116,207,0.3)" : "var(--hairline)"}`,
              transition: "all 0.5s cubic-bezier(0.3,0.9,0.3,1)",
            }}
            title={`Effective weight share: ${(row.share * 100).toFixed(1)}%`}
          >
            {(row.share * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-[0.62rem] tnum" style={{ color: weighted ? "var(--accent)" : "var(--ink-faint)", fontWeight: weighted ? 700 : 500, transition: "color 0.4s" }}>
            {weighted ? `weight ×${(Math.round(row.weightMult * 100) / 100).toFixed(2).replace(/0$/, "")}` : "base weight"}
            <span className="hidden sm:inline"> · {displayScore}/100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Static report pieces ───────────────────────────────────── */

function AdvisoryCard({ flag, agency, level, text, date, color }: { flag: string; agency: string; level: string; text: string; date: string; color: string }) {
  return (
    <div className="card p-5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{flag}</span>
          <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{agency}</span>
        </div>
        <span className="text-[0.66rem] font-bold tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: `color-mix(in srgb, ${color} 13%, white)`, color, border: `1px solid color-mix(in srgb, ${color} 32%, white)` }}>
          {level}
        </span>
      </div>
      <p className="text-[0.86rem] leading-relaxed text-[var(--ink-soft)]">“{text}”</p>
      <div className="flex items-center justify-between text-[0.68rem] text-[var(--ink-faint)]">
        <span>Updated {date}</span>
        <span className="inline-flex items-center gap-1">Source <ExternalLink size={11} /></span>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function Page() {
  const [profile, setProfile] = useState<Profile>("couple");
  const [flags, setFlags] = useState<Flags>({ dark: false, transit: false, air: false, beyond: false });
  const [change, setChange] = useState<{ msg: string; delta: number; n: number } | null>(null);
  const changeCount = useRef(0);

  const report = useMemo(() => computeReport(profile, flags), [profile, flags]);
  const band = bandOf(report.composite);
  const isBaseline = profile === "couple" && !flags.dark && !flags.transit && !flags.air && !flags.beyond;

  const narrate = (msg: string, nextProfile: Profile, nextFlags: Flags) => {
    const next = computeReport(nextProfile, nextFlags).composite;
    const delta = next - report.composite;
    changeCount.current += 1;
    setChange({ msg, delta, n: changeCount.current });
  };

  const pickProfile = (p: Profile) => {
    if (p === profile) return;
    const msgs: Record<Profile, string> = {
      solo: "Solo travel: homicide & rule-of-law now weigh ×1.3 — personal safety matters more when no one's watching your back",
      couple: "Back to baseline weighting for a couple",
      family: "Family trip: health, road-safety & air-quality now weigh ×1.5 — kid-relevant risks rise",
      business: "Business trip: political stability & government effectiveness now weigh ×1.3",
    };
    narrate(msgs[p], p, flags);
    setProfile(p);
  };

  const flip = (k: keyof Flags) => {
    const nextFlags = { ...flags, [k]: !flags[k] };
    const on = nextFlags[k];
    const msgs: Record<keyof Flags, [string, string]> = {
      dark: [
        "Out after dark: homicide & advisory signals now scored ×0.85 — night exposure discounts crime-linked scores",
        "Night-time adjustment removed — crime signals back to full daytime scores",
      ],
      transit: [
        "Public transit: road weight ×1.5 and street-crime relevance ×1.15 — Metro and roads matter more",
        "Transit adjustment removed — road & street-crime back to base weight",
      ],
      air: [
        "Air quality now weighs ×2.5 because of your asthma flag",
        "Asthma flag removed — air quality back to its base 3% weight",
      ],
      beyond: [
        "Beyond tourist zones: rule-of-law & corruption weight ×1.4 — institutions matter more off the beaten path",
        "Off-path adjustment removed — rule-of-law & corruption back to base weight",
      ],
    };
    narrate(msgs[k][on ? 0 : 1], profile, nextFlags);
    setFlags(nextFlags);
  };

  const maxImpact = report.ranked[0]?.impact ?? 1;

  return (
    <div className="relative z-10 min-h-screen">
      {/* ── Masthead ── */}
      <header className="border-b border-[var(--hairline)] bg-[var(--glass)] backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="wordmark text-[1.28rem] text-[var(--ink)] whitespace-nowrap">
              IsMyTripSafe<span className="text-[var(--ink-faint)] font-normal">.com</span>
            </span>
            <span className="hidden md:inline text-[0.74rem] text-[var(--ink-faint)] italic font-display truncate">
              One destination, one click, one report
            </span>
          </div>
          <div className="flex items-center gap-2 text-[0.72rem] text-[var(--ink-soft)] whitespace-nowrap">
            <span className="tnum hidden sm:inline">Assessed 2 Jul 2026</span>
            <span
              className="tnum font-bold px-2.5 py-1 rounded-full"
              style={{ background: `color-mix(in srgb, ${band.color} 14%, white)`, color: band.color, border: `1px solid color-mix(in srgb, ${band.color} 35%, white)`, transition: "all 0.5s ease" }}
            >
              {report.composite}/100 · {band.name}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 pb-20">
        {/* ── Destination hero line ── */}
        <div className="pt-8 pb-6 rise-in">
          <div className="eyebrow mb-2">Travel-safety report · personalized</div>
          <h1 className="display-lg text-[var(--ink)]">
            Mexico City, Mexico <span className="align-middle text-[0.6em]">🇲🇽</span>
          </h1>
          <p className="mt-2 text-[0.9rem] text-[var(--ink-soft)] max-w-xl">
            Baseline composite <strong className="tnum">47/100</strong> — safer than ~38% of countries.
            Describe your trip on the left and watch the score reweight for <em>you</em>.
          </p>
        </div>

        <div className="grid lg:grid-cols-[318px_1fr] gap-6 items-start">
          {/* ═══ Control rail ═══ */}
          <aside className="lg:sticky lg:top-[76px] space-y-4 rise-in" style={{ animationDelay: "0.08s" }}>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal size={15} className="text-[var(--accent)]" />
                <span className="label !text-[var(--ink-soft)]">Who&rsquo;s traveling?</span>
              </div>

              {/* Profile segmented control */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--paper-deep)]">
                {PROFILE_META.map((p) => {
                  const active = profile === p.id;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickProfile(p.id)}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg text-[0.68rem] font-semibold cursor-pointer"
                      style={{
                        background: active ? "#fff" : "transparent",
                        color: active ? "var(--accent-deep)" : "var(--ink-faint)",
                        boxShadow: active ? "0 2px 8px rgba(20,30,48,0.12)" : "none",
                        transition: "all 0.25s ease",
                      }}
                    >
                      <Icon size={16} strokeWidth={active ? 2.4 : 2} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[0.72rem] text-[var(--ink-faint)] leading-snug min-h-[2em]">
                {PROFILE_META.find((p) => p.id === profile)!.blurb}
              </p>

              <div className="hairline my-4" />

              {/* Toggles */}
              <div className="space-y-1">
                {TOGGLE_META.map((t) => {
                  const on = flags[t.id];
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => flip(t.id)}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left cursor-pointer group"
                      style={{ background: on ? "rgba(31,116,207,0.07)" : "transparent", transition: "background 0.25s ease" }}
                    >
                      <Icon size={16} style={{ color: on ? "var(--accent)" : "var(--ink-faint)", transition: "color 0.25s" }} className="shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[0.8rem] font-semibold" style={{ color: on ? "var(--ink)" : "var(--ink-soft)" }}>
                          {t.label}
                        </span>
                        <span className="block text-[0.66rem] text-[var(--ink-faint)] truncate">{t.sub}</span>
                      </span>
                      {/* switch */}
                      <span
                        className="relative shrink-0 rounded-full"
                        style={{ width: 36, height: 20, background: on ? "var(--accent)" : "var(--sand)", transition: "background 0.25s ease" }}
                      >
                        <span
                          className="absolute top-[2px] rounded-full bg-white shadow"
                          style={{ width: 16, height: 16, left: on ? 18 : 2, transition: "left 0.25s cubic-bezier(0.3,0.9,0.3,1)" }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Honesty note */}
            <div className="px-4 py-3 rounded-xl border border-dashed border-[var(--hairline)] bg-white/50 text-[0.7rem] leading-relaxed text-[var(--ink-faint)] flex gap-2">
              <Scale size={14} className="shrink-0 mt-px text-[var(--ink-faint)]" />
              <span>
                Same data, reweighted for your trip — the underlying evidence never changes. Reset by choosing <strong>Couple</strong> and clearing all toggles.
              </span>
            </div>
          </aside>

          {/* ═══ Live report ═══ */}
          <div className="space-y-8 min-w-0">
            {/* Score hero */}
            <section className="card p-6 md:p-8 rise-in" style={{ animationDelay: "0.14s" }}>
              <div className="grid md:grid-cols-[248px_1fr] gap-6 items-center">
                <ScoreGauge score={report.composite} />
                <div>
                  <div className="eyebrow mb-2">{isBaseline ? "Baseline composite" : "Your personalized composite"}</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[0.86rem] font-bold"
                      style={{
                        background: `color-mix(in srgb, ${band.color} 14%, white)`,
                        color: band.color,
                        border: `1.5px solid color-mix(in srgb, ${band.color} 40%, white)`,
                        transition: "all 0.5s ease",
                      }}
                    >
                      <ShieldAlert size={15} /> {band.verdict}
                    </span>
                    {!isBaseline && (
                      <span className="tnum text-[0.78rem] font-semibold text-[var(--ink-faint)]">
                        baseline 47 → yours {report.composite}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--ink-soft)] max-w-md">
                    Weighted blend of {SIGNALS.length} independent signals. Your profile changes how much
                    each signal counts — never what the evidence says.
                  </p>

                  {/* What-changed strip */}
                  <div className="mt-4 min-h-[52px]">
                    {change ? (
                      <div
                        key={change.n}
                        className="scale-in flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                        style={{ background: "rgba(31,116,207,0.07)", border: "1px solid rgba(31,116,207,0.18)" }}
                      >
                        {change.delta < 0 ? (
                          <ArrowDownRight size={16} className="shrink-0 mt-px" style={{ color: "var(--risky)" }} />
                        ) : change.delta > 0 ? (
                          <ArrowUpRight size={16} className="shrink-0 mt-px" style={{ color: "var(--safe)" }} />
                        ) : (
                          <Minus size={16} className="shrink-0 mt-px text-[var(--ink-faint)]" />
                        )}
                        <span className="text-[0.78rem] leading-snug text-[var(--ink-soft)]">
                          <strong className="text-[var(--ink)]">What changed:</strong> {change.msg} —{" "}
                          <span className="tnum font-bold" style={{ color: change.delta < 0 ? "var(--risky)" : change.delta > 0 ? "var(--safe)" : "var(--ink-faint)" }}>
                            {change.delta === 0 ? "score held" : `score ${change.delta < 0 ? "dropped" : "rose"} ${Math.abs(change.delta)} point${Math.abs(change.delta) === 1 ? "" : "s"}`}
                          </span>
                          .
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-[var(--hairline)] text-[0.76rem] text-[var(--ink-faint)]">
                        <Sparkles size={14} /> Flip a switch on the left — this strip narrates every recalculation.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Signals — live-reordering ledger */}
            <section className="rise-in" style={{ animationDelay: "0.2s" }}>
              <SectionHead num="01" title="What matters for your trip" note="ranked by weighted impact · live" />
              <div className="card px-4 md:px-5 py-2 mt-3 overflow-hidden">
                <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
                  <span className="label">Signal · evidence</span>
                  <span className="label">Weight share</span>
                </div>
                <div className="relative" style={{ height: SIGNALS.length * ROW_H }}>
                  {report.rows.map((row) => {
                    const rank = report.ranked.findIndex((r) => r.signal.key === row.signal.key);
                    return <SignalRow key={row.signal.key} row={row} rank={rank} maxImpact={maxImpact} />;
                  })}
                </div>
                <p className="py-2.5 text-[0.66rem] text-[var(--ink-faint)] flex items-center gap-1.5">
                  <Info size={11} /> Rows ranked by weight × risk — what&rsquo;s dragging <em>your</em> score sits on top. Bars show each signal&rsquo;s 0–100 score.
                </p>
              </div>
            </section>

            {/* AI brief */}
            <section className="rise-in" style={{ animationDelay: "0.26s" }}>
              <SectionHead num="02" title="Analyst brief" note="AI-generated summary" />
              <div className="card p-6 mt-3">
                <p className="prose-brief !mb-0 text-[0.95rem]">
                  Mexico City is manageable for informed travelers who stay in well-trodden districts, but the
                  country-level data shows serious violent-crime and rule-of-law weaknesses. Stick to{" "}
                  <strong>Polanco, Roma Norte, Condesa and Coyoacán</strong>, use Uber rather than street taxis,
                  and keep valuables out of sight.
                </p>
              </div>
            </section>

            {/* Official advisories */}
            <section className="rise-in" style={{ animationDelay: "0.3s" }}>
              <SectionHead num="03" title="Official advisories" note="2 governments · Jun 2026" />
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <AdvisoryCard flag="🇺🇸" agency="U.S. State Department" level="LEVEL 2 · INCREASED CAUTION" color="var(--caution)"
                  text="Exercise Increased Caution — crime and kidnapping" date="Jun 2026" />
                <AdvisoryCard flag="🇬🇧" agency="UK FCDO" level="LEVEL 3 · PARTIAL AVOID" color="var(--risky)"
                  text="Advises against all-but-essential travel to parts" date="Jun 2026" />
              </div>
            </section>

            {/* CDC */}
            <section className="rise-in" style={{ animationDelay: "0.34s" }}>
              <SectionHead num="04" title="Health notices" note="CDC · live" />
              <div className="card divide-y divide-[var(--hairline)] mt-3">
                {[
                  { tier: "ALERT", color: "var(--caution)", text: "Rocky Mountain Spotted Fever in Mexico" },
                  { tier: "WATCH", color: "var(--moderate)", text: "Salmonella Newport in Mexico" },
                ].map((n) => (
                  <div key={n.text} className="flex items-center gap-3 px-5 py-3.5">
                    <Stethoscope size={15} style={{ color: n.color }} className="shrink-0" />
                    <span className="text-[0.64rem] font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `color-mix(in srgb, ${n.color} 14%, white)`, color: n.color }}>
                      {n.tier}
                    </span>
                    <span className="text-[0.84rem] text-[var(--ink-soft)]">{n.text}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Neighborhoods */}
            <section className="rise-in" style={{ animationDelay: "0.38s" }}>
              <SectionHead num="05" title="On the ground" note="neighborhood guidance" />
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CircleCheck size={15} style={{ color: "var(--safe)" }} />
                    <span className="label !text-[var(--ink-soft)]">Stay &amp; wander</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Polanco", "Roma Norte", "Condesa", "Coyoacán"].map((n) => (
                      <span key={n} className="text-[0.78rem] font-medium px-3 py-1.5 rounded-full"
                        style={{ background: "rgba(47,158,111,0.1)", color: "#1e7a52", border: "1px solid rgba(47,158,111,0.25)" }}>
                        <MapPin size={11} className="inline -mt-px mr-1" />{n}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Ban size={15} style={{ color: "var(--risky)" }} />
                    <span className="label !text-[var(--ink-soft)]">Steer clear</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Tepito", "Doctores (after dark)", "Iztapalapa"].map((n) => (
                      <span key={n} className="text-[0.78rem] font-medium px-3 py-1.5 rounded-full"
                        style={{ background: "rgba(212,80,58,0.09)", color: "var(--risky)", border: "1px solid rgba(212,80,58,0.24)" }}>
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* News + tips */}
            <section className="rise-in" style={{ animationDelay: "0.42s" }}>
              <SectionHead num="06" title="Recent signals & field tips" />
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Newspaper size={15} className="text-[var(--accent)]" />
                    <span className="label !text-[var(--ink-soft)]">In the news</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Increased National Guard patrols in tourist areas (Jun 2026)",
                      "Pickpocketing spike on Metro Line 2",
                      "No major unrest in past 90 days",
                    ].map((n) => (
                      <li key={n} className="text-[0.82rem] leading-snug text-[var(--ink-soft)] flex gap-2">
                        <span className="mt-[7px] w-1 h-1 rounded-full bg-[var(--accent)] shrink-0" />{n}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={15} style={{ color: "var(--gold)" }} />
                    <span className="label !text-[var(--ink-soft)]">Field tips</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Use Uber or authorized taxi stands, never street-hail",
                      "Keep phones off café tables",
                      "Carry a passport photocopy, not the original",
                      "Avoid Metro at rush hour with luggage",
                    ].map((t) => (
                      <li key={t} className="text-[0.82rem] leading-snug text-[var(--ink-soft)] flex gap-2">
                        <span className="mt-[7px] w-1 h-1 rounded-full bg-[var(--gold)] shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Methodology */}
            <details className="disclosure rise-in" style={{ animationDelay: "0.46s" }}>
              <summary>
                <span className="flex items-center gap-2"><Landmark size={14} /> How personalization works — and what it doesn&rsquo;t do</span>
                <span className="text-[var(--ink-faint)]">＋</span>
              </summary>
              <div className="disclosure-body">
                <p className="mb-3">
                  The composite is a weighted average of {SIGNALS.length} public signals:
                  composite = Σ(score × weight) ÷ Σ(weight), rounded down — when in doubt, we err on the side of caution.
                  Base weights: homicide 0.22, political stability 0.16, armed conflict 0.12, rule of law 0.10,
                  advisory 0.10, corruption 0.07, government effectiveness 0.06, road safety 0.06, seismic 0.05,
                  health 0.05, air quality 0.03.
                </p>
                <p className="mb-3">
                  Your trip profile multiplies weights (e.g. a family trip weighs health, road safety and air quality ×1.5;
                  an asthma flag weighs air quality ×2.5) and the &ldquo;out after dark&rdquo; flag scores crime-linked signals ×0.85 to reflect
                  higher night-time exposure. <strong>Same data, reweighted for your trip — the underlying evidence never changes.</strong>{" "}
                  Personalization changes emphasis, never facts; a dangerous place does not become safe because of who you are.
                </p>
                <p>
                  Sources: World Bank, Worldwide Governance Indicators, USGS, Open-Meteo, CDC, U.S. State Department, UK FCDO.
                  Country-level indicators may not reflect conditions in specific neighborhoods.
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--hairline)] bg-white/60">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="wordmark text-[1.05rem] text-[var(--ink)]">
              IsMyTripSafe<span className="text-[var(--ink-faint)] font-normal">.com</span>
            </div>
            <div className="text-[0.74rem] text-[var(--ink-faint)] italic font-display mt-0.5">
              One destination, one click, one report
            </div>
          </div>
          <div className="text-[0.68rem] text-[var(--ink-faint)] leading-relaxed max-w-md">
            Informational only — not a guarantee of safety. Verify with your government&rsquo;s official advisory
            before travel. © 2026 IsMyTripSafe.
          </div>
        </div>
      </footer>
    </div>
  );
}
