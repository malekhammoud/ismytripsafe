"use client";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 9: "The Guided Verdict"
   A scroll-driven editorial narrative. Six chapters, each
   staged by IntersectionObserver; numbers count up once,
   bars grow once, verdict lands at the end.
   ──────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  ChevronDown,
  CircleCheck,
  Ban,
  TriangleAlert,
  HeartPulse,
  Newspaper,
  Database,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

/* ═══ Data ═══════════════════════════════════════════════════ */

type Level = "safe" | "moderate" | "caution" | "risky";

const LEVEL_COLOR: Record<Level, string> = {
  safe: "var(--safe)",
  moderate: "var(--moderate)",
  caution: "var(--caution)",
  risky: "var(--risky)",
};

function levelOf(score: number): Level {
  if (score >= 70) return "safe";
  if (score >= 55) return "moderate";
  if (score >= 35) return "caution";
  return "risky";
}

const SCORE = 47;

const SIGNALS = [
  { label: "Homicide rate", value: "24.9 per 100k", score: 26, source: "World Bank", year: "2023" },
  { label: "Road traffic deaths", value: "12.7 per 100k", score: 59, source: "World Bank", year: "2021" },
  { label: "Armed-conflict deaths", value: "None reported", score: 100, source: "World Bank", year: "2023" },
  { label: "Political stability", value: "28 of 100", score: 28, source: "WGI", year: "2024" },
  { label: "Rule of law", value: "31 of 100", score: 31, source: "WGI", year: "2024" },
  { label: "Control of corruption", value: "22 of 100", score: 22, source: "WGI", year: "2024" },
  { label: "Government effectiveness", value: "45 of 100", score: 45, source: "WGI", year: "2024" },
  { label: "Recent earthquakes", value: "3 quakes · max M5.8", score: 62, source: "USGS", year: "last 90 days" },
  { label: "Air quality", value: "US AQI 72 · Moderate", score: 78, source: "Open-Meteo", year: "live" },
  { label: "Travel health notices", value: "2 notices · max Alert", score: 60, source: "CDC", year: "2026" },
];

const COMPARE = [
  { name: "Japan", value: 0.2 },
  { name: "Switzerland", value: 0.5 },
  { name: "United States", value: 5.7 },
  { name: "World average", value: 5.8 },
  { name: "Brazil", value: 21.3 },
  { name: "Mexico", value: 24.9, target: true },
  { name: "South Africa", value: 41.9 },
];
const COMPARE_MAX = 41.9;

const ADVISORIES = [
  {
    org: "US State Department",
    level: "Level 2 of 4",
    badge: "2",
    color: "var(--moderate)",
    headline: "Exercise Increased Caution",
    detail: "Crime and kidnapping. Some states carry higher advisories; Mexico City itself sits at Level 2.",
    date: "Jun 2026",
  },
  {
    org: "UK Foreign Office (FCDO)",
    level: "Level 3 of 4",
    badge: "3",
    color: "var(--caution)",
    headline: "Advises against all-but-essential travel to parts",
    detail: "Your travel insurance could be invalidated if you travel against advice.",
    date: "Jun 2026",
  },
];

const SAFE_AREAS = ["Polanco", "Roma Norte", "Condesa", "Coyoacán"];
const AVOID_AREAS = ["Tepito", "Doctores (after dark)", "Iztapalapa"];

const CDC_NOTICES = [
  { level: "Alert", title: "Rocky Mountain Spotted Fever in Mexico", color: "var(--caution)" },
  { level: "Watch", title: "Salmonella Newport in Mexico", color: "var(--moderate)" },
];

const NEWS = [
  "Increased National Guard patrols in tourist areas (Jun 2026)",
  "Pickpocketing spike on Metro Line 2",
  "No major unrest in past 90 days",
];

const TIPS = [
  "Use Uber or authorized taxi stands, never street-hail",
  "Keep phones off café tables",
  "Carry a passport photocopy, not the original",
  "Avoid Metro at rush hour with luggage",
];

const AI_SUMMARY =
  "Mexico City is manageable for informed travelers who stay in well-trodden districts, but the country-level data shows serious violent-crime and rule-of-law weaknesses. Stick to Polanco, Roma Norte, Condesa and Coyoacán, use Uber rather than street taxis, and keep valuables out of sight.";

const CHAPTERS = [
  { id: "verdict", short: "Verdict", color: "var(--caution)" },
  { id: "governments", short: "Advisories", color: "var(--moderate)" },
  { id: "data", short: "The data", color: "var(--accent)" },
  { id: "compare", short: "Compared", color: "var(--risky)" },
  { id: "ground", short: "On the ground", color: "var(--safe)" },
  { id: "closing", short: "Bottom line", color: "var(--caution)" },
];

/* ═══ Hooks ══════════════════════════════════════════════════ */

function useReducedMotion(): boolean {
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

/** Fires once when the element enters the viewport, then disconnects. */
function useInView<T extends HTMLElement>(threshold = 0.35, rootMargin = "0px 0px -8% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);
  return [ref, inView] as const;
}

/** rAF count-up that runs exactly once when `run` first becomes true. */
function useCountUp(target: number, run: boolean, duration = 1600): number {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!run || started.current) return;
    started.current = true;
    if (duration <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return value;
}

/** Tracks which chapter section is currently centered in the viewport. */
function useActiveChapter(ids: string[]): [number, (i: number) => void] {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = ids.indexOf(e.target.id);
            if (i >= 0) setActive(i);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);
  const goTo = useCallback(
    (i: number) => {
      document.getElementById(ids[i])?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [ids]
  );
  return [active, goTo];
}

/** 0–1 document scroll progress. */
function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

/* ═══ Shared bits ════════════════════════════════════════════ */

function Reveal({
  children,
  delay = 0,
  from = "up",
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  from?: "up" | "left" | "right" | "scale";
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const on = inView || reduce;
  const hidden: Record<string, string> = {
    up: "translateY(28px)",
    left: "translateX(-36px)",
    right: "translateX(36px)",
    scale: "scale(0.82)",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "none" : hidden[from],
        transition: reduce
          ? "none"
          : `opacity 0.7s cubic-bezier(0.2,0.8,0.2,1) ${delay}ms, transform 0.7s cubic-bezier(0.2,0.8,0.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ChapterHead({ num, title, kicker }: { num: string; title: string; kicker: string }) {
  return (
    <Reveal>
      <p className="eyebrow" style={{ color: "var(--accent)" }}>
        Chapter {num} — {kicker}
      </p>
      <h2 className="display-lg mt-3" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
    </Reveal>
  );
}

/* ═══ Chapter 1 — Opening & the verdict gauge ═══════════════ */

function RingGauge({ reduce }: { reduce: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const on = inView || reduce;
  const shown = useCountUp(SCORE, on, reduce ? 0 : 1800);
  const R = 86;
  const C = 2 * Math.PI * R;
  const offset = on ? C * (1 - SCORE / 100) : C;
  return (
    <div ref={ref} className="relative mx-auto" style={{ width: 260, height: 260 }}>
      <svg width={260} height={260} viewBox="0 0 260 260" className="-rotate-90">
        <circle cx={130} cy={130} r={R} fill="none" stroke="var(--hairline)" strokeWidth={14} />
        <circle
          cx={130}
          cy={130}
          r={R}
          fill="none"
          stroke="var(--caution)"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{
            transition: reduce ? "none" : "stroke-dashoffset 1.8s cubic-bezier(0.3,0.8,0.3,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display-xl tnum" style={{ color: "var(--caution)", fontSize: "4.4rem" }}>
          {Math.round(shown)}
        </span>
        <span className="label mt-1">out of 100</span>
      </div>
    </div>
  );
}

function ChapterOpening({ reduce }: { reduce: boolean }) {
  const [pillRef, pillIn] = useInView<HTMLDivElement>(0.6);
  const pillOn = pillIn || reduce;
  return (
    <section id="verdict" className="relative">
      {/* Full-viewport hero */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
        <div className="rise-in" style={{ animationDelay: "0.05s" }}>
          <p className="wordmark text-xl" style={{ color: "var(--ink)" }}>
            IsMyTripSafe<span style={{ color: "var(--ink-faint)" }}>.com</span>
          </p>
          <p className="label mt-1.5" style={{ letterSpacing: "0.18em" }}>
            One destination, one click, one report
          </p>
        </div>
        <h1 className="display-xl mt-12 max-w-4xl rise-in" style={{ animationDelay: "0.25s" }}>
          Is Mexico City{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent-deep)" }}>safe</em>?
        </h1>
        <p
          className="mt-6 text-base rise-in"
          style={{ color: "var(--ink-soft)", animationDelay: "0.45s" }}
        >
          Mexico City, Mexico 🇲🇽 · Assessed 2 Jul 2026 · 10 evidence signals, 2 official
          advisories
        </p>
        <div
          className="absolute bottom-10 flex flex-col items-center gap-2 rise-in"
          style={{ animationDelay: "0.8s" }}
        >
          <span className="label">Scroll for the verdict</span>
          <ChevronDown
            size={20}
            style={{ color: "var(--ink-faint)" }}
            className={reduce ? "" : "gv-bob"}
          />
        </div>
      </div>

      {/* The answer materializes */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-24 text-center">
        <Reveal>
          <p className="eyebrow" style={{ color: "var(--accent)" }}>
            The short answer
          </p>
        </Reveal>
        <div className="mt-10">
          <RingGauge reduce={reduce} />
        </div>
        <div
          ref={pillRef}
          className="mt-8 inline-flex items-center gap-2.5 rounded-full px-6 py-2.5"
          style={{
            background: "rgba(224,138,59,0.12)",
            border: "1px solid rgba(224,138,59,0.35)",
            color: "#a05a1c",
            opacity: pillOn ? 1 : 0,
            transform: pillOn ? "scale(1)" : "scale(0.85)",
            transition: reduce
              ? "none"
              : "opacity 0.5s ease 1.2s, transform 0.5s cubic-bezier(0.2,0.8,0.2,1) 1.2s",
          }}
        >
          <ShieldAlert size={17} />
          <span className="font-semibold tracking-wide text-sm uppercase" style={{ letterSpacing: "0.12em" }}>
            Caution advised
          </span>
        </div>
        <Reveal delay={reduce ? 0 : 1500}>
          <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Composite Safety Index <strong className="tnum">47 / 100</strong> — safer than
            roughly <strong className="tnum">38%</strong> of countries. Here is how we got
            there.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══ Chapter 2 — Government advisories ══════════════════════ */

function AdvisoryCard({ a, i, reduce }: { a: (typeof ADVISORIES)[0]; i: number; reduce: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const on = inView || reduce;
  const d = i * 220;
  return (
    <div
      ref={ref}
      className="card p-7 relative overflow-hidden"
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "none" : "translateY(36px)",
        transition: reduce
          ? "none"
          : `opacity 0.7s cubic-bezier(0.2,0.8,0.2,1) ${d}ms, transform 0.7s cubic-bezier(0.2,0.8,0.2,1) ${d}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label" style={{ color: "var(--ink-faint)" }}>
            {a.org}
          </p>
          <h3 className="font-display text-[1.35rem] mt-2 leading-snug" style={{ fontWeight: 500 }}>
            “{a.headline}”
          </h3>
        </div>
        {/* Level badge stamps in */}
        <div
          className="shrink-0 flex flex-col items-center justify-center rounded-2xl tnum"
          style={{
            width: 64,
            height: 64,
            background: a.color,
            color: "#fff",
            opacity: on ? 1 : 0,
            transform: on ? "scale(1) rotate(0deg)" : "scale(1.6) rotate(-6deg)",
            transition: reduce
              ? "none"
              : `opacity 0.45s ease ${d + 420}ms, transform 0.45s cubic-bezier(0.2,1.2,0.3,1) ${d + 420}ms`,
          }}
        >
          <span className="text-2xl font-bold leading-none">{a.badge}</span>
          <span className="text-[0.58rem] font-semibold tracking-widest mt-1">OF 4</span>
        </div>
      </div>
      <p className="mt-4 text-[0.92rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {a.detail}
      </p>
      <div className="mt-5 flex items-center justify-between">
        <span className="label">{a.level}</span>
        <span className="text-xs tnum" style={{ color: "var(--ink-faint)" }}>
          Updated {a.date}
        </span>
      </div>
    </div>
  );
}

function ChapterGovernments({ reduce }: { reduce: boolean }) {
  return (
    <section id="governments" className="py-32 px-6" style={{ background: "#ffffff" }}>
      <div className="max-w-3xl mx-auto">
        <ChapterHead num="02" kicker="Official positions" title="What the governments say" />
        <Reveal delay={120}>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Two of the most-watched foreign offices weigh in — and they don’t quite agree.
            The US permits travel with heightened awareness; the UK draws a harder line on
            parts of the country.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {ADVISORIES.map((a, i) => (
            <AdvisoryCard key={a.org} a={a} i={i} reduce={reduce} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ Chapter 3 — Evidence signals ═══════════════════════════ */

function SignalRow({ s, i, reduce }: { s: (typeof SIGNALS)[0]; i: number; reduce: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const on = inView || reduce;
  const lvl = levelOf(s.score);
  const d = i * 90;
  return (
    <div
      ref={ref}
      className="py-4"
      style={{
        borderBottom: "1px solid var(--hairline)",
        opacity: on ? 1 : 0,
        transition: reduce ? "none" : `opacity 0.5s ease ${d}ms`,
      }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.92rem] font-medium" style={{ color: "var(--ink)" }}>
          {s.label}
        </span>
        <span className="text-[0.85rem] tnum shrink-0" style={{ color: "var(--ink-soft)" }}>
          {s.value}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <div
          className="h-[7px] flex-1 rounded-full overflow-hidden"
          style={{ background: "var(--paper-deep)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: on ? `${s.score}%` : "0%",
              background: LEVEL_COLOR[lvl],
              transition: reduce
                ? "none"
                : `width 1.1s cubic-bezier(0.3,0.8,0.3,1) ${d + 150}ms`,
            }}
          />
        </div>
        <span
          className="text-[0.8rem] font-semibold tnum w-8 text-right"
          style={{ color: LEVEL_COLOR[lvl] }}
        >
          {s.score}
        </span>
      </div>
      <p className="mt-1.5 text-[0.7rem] tnum" style={{ color: "var(--ink-faint)" }}>
        {s.source} · {s.year}
      </p>
    </div>
  );
}

function ChapterData({ reduce }: { reduce: boolean }) {
  return (
    <section id="data" className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <ChapterHead num="03" kicker="Ten signals" title="What the data shows" />
        <Reveal delay={120}>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Each signal is scored 0–100 against global distributions — higher is safer.
            Violent crime and governance drag the composite down; conflict, air and roads
            hold it up.
          </p>
        </Reveal>
        <div className="mt-10 card px-7 py-3">
          {SIGNALS.map((s, i) => (
            <SignalRow key={s.label} s={s} i={i} reduce={reduce} />
          ))}
          <div className="py-3.5 flex items-center justify-between">
            <span className="label">Composite (weighted)</span>
            <span className="text-[0.95rem] font-bold tnum" style={{ color: "var(--caution)" }}>
              47 / 100
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ Chapter 4 — Comparison ═════════════════════════════════ */

function CompareChart({ reduce }: { reduce: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const on = inView || reduce;
  return (
    <div ref={ref} className="card p-7">
      <p className="label mb-6">Intentional homicides · per 100,000 people</p>
      <div className="flex flex-col gap-4">
        {COMPARE.map((c, i) => {
          const pct = Math.max(1.5, (c.value / COMPARE_MAX) * 100);
          const d = i * 260;
          return (
            <div key={c.name} className="grid items-center gap-3" style={{ gridTemplateColumns: "8.5rem 1fr 3rem" }}>
              <span
                className="text-[0.85rem] text-right truncate"
                style={{
                  color: c.target ? "var(--ink)" : "var(--ink-soft)",
                  fontWeight: c.target ? 700 : 400,
                }}
              >
                {c.name}
              </span>
              <div className="h-[18px] rounded-md overflow-hidden" style={{ background: "var(--paper-deep)" }}>
                <div
                  className={c.target && !reduce ? "gv-target-pulse h-full rounded-md" : "h-full rounded-md"}
                  style={{
                    width: on ? `${pct}%` : "0%",
                    background: c.target ? "var(--risky)" : "var(--sand)",
                    transition: reduce
                      ? "none"
                      : `width 0.9s cubic-bezier(0.3,0.8,0.3,1) ${d}ms`,
                  }}
                />
              </div>
              <span
                className="text-[0.85rem] tnum"
                style={{
                  color: c.target ? "var(--risky)" : "var(--ink-faint)",
                  fontWeight: c.target ? 700 : 500,
                  opacity: on ? 1 : 0,
                  transition: reduce ? "none" : `opacity 0.4s ease ${d + 700}ms`,
                }}
              >
                {c.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterCompare({ reduce }: { reduce: boolean }) {
  return (
    <section
      id="compare"
      className="py-32 px-6"
      style={{ background: "rgba(212,80,58,0.045)" }}
    >
      <div className="max-w-3xl mx-auto">
        <ChapterHead num="04" kicker="Global context" title="How it compares" />
        <Reveal delay={120}>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            One number explains most of the caution: the homicide rate. Watch where Mexico
            lands against countries you might use as a mental benchmark.
          </p>
        </Reveal>
        <div className="mt-12">
          <CompareChart reduce={reduce} />
        </div>
        <Reveal delay={reduce ? 0 : 1900}>
          <p
            className="mt-8 font-display text-[1.35rem] text-center"
            style={{ color: "var(--risky)", fontWeight: 500 }}
          >
            More than <span className="tnum">4×</span> the world average — and{" "}
            <span className="tnum">125×</span> Japan.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══ Chapter 5 — On the ground ══════════════════════════════ */

function AreaChip({
  name,
  good,
  i,
  reduce,
}: {
  name: string;
  good: boolean;
  i: number;
  reduce: boolean;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  const on = inView || reduce;
  const d = i * 130;
  return (
    <span
      ref={ref}
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.85rem] font-medium"
      style={{
        background: good ? "rgba(47,158,111,0.1)" : "rgba(212,80,58,0.08)",
        border: `1px solid ${good ? "rgba(47,158,111,0.3)" : "rgba(212,80,58,0.28)"}`,
        color: good ? "#1e7a52" : "#a83a29",
        opacity: on ? 1 : 0,
        transform: on ? "none" : `translateX(${good ? -44 : 44}px)`,
        transition: reduce
          ? "none"
          : `opacity 0.55s ease ${d}ms, transform 0.55s cubic-bezier(0.2,0.8,0.2,1) ${d}ms`,
      }}
    >
      {good ? <CircleCheck size={14} /> : <Ban size={14} />}
      {name}
    </span>
  );
}

function ChapterGround({ reduce }: { reduce: boolean }) {
  return (
    <section id="ground" className="py-32 px-6" style={{ background: "#ffffff" }}>
      <div className="max-w-3xl mx-auto">
        <ChapterHead num="05" kicker="Street level" title="On the ground" />
        <Reveal delay={120}>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Country statistics blur what neighborhoods sharpen. The capital’s risk map is
            starkly uneven — a few districts do most of the damage to the average.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div>
            <p className="label flex items-center gap-2" style={{ color: "var(--safe)" }}>
              <MapPin size={13} /> Generally safe
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {SAFE_AREAS.map((n, i) => (
                <AreaChip key={n} name={n} good i={i} reduce={reduce} />
              ))}
            </div>
          </div>
          <div>
            <p className="label flex items-center gap-2" style={{ color: "var(--risky)" }}>
              <TriangleAlert size={13} /> Exercise avoidance
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {AVOID_AREAS.map((n, i) => (
                <AreaChip key={n} name={n} good={false} i={i} reduce={reduce} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal delay={100}>
            <div className="card p-6 h-full">
              <p className="label flex items-center gap-2 mb-4">
                <HeartPulse size={13} /> CDC health notices
              </p>
              <div className="flex flex-col gap-3">
                {CDC_NOTICES.map((n) => (
                  <div key={n.title} className="flex items-start gap-3">
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-widest uppercase"
                      style={{ background: n.color, color: "#fff" }}
                    >
                      {n.level}
                    </span>
                    <span className="text-[0.88rem] leading-snug" style={{ color: "var(--ink-soft)" }}>
                      {n.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <div className="card p-6 h-full">
              <p className="label flex items-center gap-2 mb-4">
                <Newspaper size={13} /> Recent signals
              </p>
              <ul className="flex flex-col gap-2.5">
                {NEWS.map((n, i) => (
                  <Reveal key={n} delay={400 + i * 200}>
                    <li className="flex items-start gap-2.5 text-[0.88rem] leading-snug" style={{ color: "var(--ink-soft)" }}>
                      <span
                        className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: "var(--accent)" }}
                      />
                      {n}
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ═══ Chapter 6 — Closing verdict ════════════════════════════ */

function ChapterClosing({ reduce }: { reduce: boolean }) {
  return (
    <section
      id="closing"
      className="min-h-screen flex flex-col justify-center py-32 px-6"
      style={{ background: "rgba(224,138,59,0.05)" }}
    >
      <div className="max-w-3xl mx-auto w-full">
        <ChapterHead num="06" kicker="The bottom line" title="Go — but go informed." />

        <Reveal delay={150}>
          <div
            className="mt-10 card p-8 relative"
            style={{ borderLeft: "4px solid var(--caution)" }}
          >
            <p className="label flex items-center gap-2 mb-4">
              <Sparkles size={13} style={{ color: "var(--accent)" }} /> AI summary
            </p>
            <p
              className="font-display text-[1.25rem] leading-relaxed"
              style={{ color: "var(--ink)", fontWeight: 450 }}
            >
              {AI_SUMMARY}
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TIPS.map((t, i) => (
            <Reveal key={t} delay={250 + i * 180} from="up">
              <div className="card p-5 h-full flex gap-4">
                <span
                  className="font-display shrink-0 text-2xl tnum leading-none mt-0.5"
                  style={{ color: "var(--accent)", fontWeight: 600 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[0.9rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {t}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Methodology / source strip */}
        <Reveal delay={reduce ? 0 : 1000}>
          <div
            className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-5"
            style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}
          >
            <span className="label flex items-center gap-1.5">
              <Database size={12} /> Sources
            </span>
            {["World Bank", "WGI", "USGS", "Open-Meteo", "CDC", "US State Dept", "UK FCDO"].map((s) => (
              <span key={s} className="text-[0.75rem] tnum" style={{ color: "var(--ink-faint)" }}>
                {s}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={reduce ? 0 : 1200}>
          <footer className="mt-12 text-center">
            <p className="wordmark text-lg" style={{ color: "var(--ink)" }}>
              IsMyTripSafe<span style={{ color: "var(--ink-faint)" }}>.com</span>
            </p>
            <p className="label mt-1.5">One destination, one click, one report</p>
            <p className="mt-6 text-[0.72rem] max-w-md mx-auto leading-relaxed" style={{ color: "var(--ink-faint)" }}>
              Informational only — not a guarantee of personal safety. Scores are computed
              from public datasets against global distributions and refreshed daily.
              © 2026 IsMyTripSafe.
            </p>
          </footer>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══ Chrome — progress bar & dot nav ════════════════════════ */

function ProgressBar({ color }: { color: string }) {
  const p = useScrollProgress();
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px]" style={{ background: "transparent" }}>
      <div
        className="h-full"
        style={{
          width: `${p * 100}%`,
          background: color,
          transition: "background 0.5s ease",
        }}
      />
    </div>
  );
}

function DotNav({
  active,
  goTo,
}: {
  active: number;
  goTo: (i: number) => void;
}) {
  return (
    <nav
      aria-label="Chapters"
      className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-4"
    >
      {CHAPTERS.map((c, i) => {
        const isActive = i === active;
        return (
          <button
            key={c.id}
            onClick={() => goTo(i)}
            aria-label={c.short}
            className="group relative flex items-center justify-center"
            style={{ width: 18, height: 18 }}
          >
            <span
              className="rounded-full block"
              style={{
                width: isActive ? 12 : 7,
                height: isActive ? 12 : 7,
                background: isActive ? c.color : "var(--ink-faint)",
                opacity: isActive ? 1 : 0.5,
                transition: "all 0.3s cubic-bezier(0.2,0.8,0.2,1)",
              }}
            />
            <span
              className="absolute right-6 whitespace-nowrap rounded-md px-2.5 py-1 text-[0.68rem] font-semibold tracking-wide opacity-0 group-hover:opacity-100 pointer-events-none"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                transition: "opacity 0.2s ease",
              }}
            >
              {c.short}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ═══ Page ═══════════════════════════════════════════════════ */

export default function GuidedVerdictPage() {
  const reduce = useReducedMotion();
  const [active, goTo] = useActiveChapter(CHAPTERS.map((c) => c.id));

  return (
    <main className="relative z-10">
      <style>{`
        @keyframes gvBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(7px); }
        }
        .gv-bob { animation: gvBob 1.8s ease-in-out infinite; }
        @keyframes gvTargetPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,80,58,0.35); }
          50% { box-shadow: 0 0 0 6px rgba(212,80,58,0); }
        }
        .gv-target-pulse { animation: gvTargetPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .gv-bob, .gv-target-pulse, .rise-in { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      <ProgressBar color={CHAPTERS[active].color} />
      <DotNav active={active} goTo={goTo} />

      <ChapterOpening reduce={reduce} />
      <ChapterGovernments reduce={reduce} />
      <ChapterData reduce={reduce} />
      <ChapterCompare reduce={reduce} />
      <ChapterGround reduce={reduce} />
      <ChapterClosing reduce={reduce} />

    </main>
  );
}
