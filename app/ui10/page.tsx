"use client";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 10: "Ask the Report"
   A question-driven interview with the data. The traveler
   assembles their own report one question at a time: a wall
   of question chips, each click appends a substantial answer
   card to a growing thread. Ask order = report order.
   ──────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Moon,
  Landmark,
  Droplets,
  MapPin,
  ChartBar,
  TriangleAlert,
  Wind,
  Activity,
  Newspaper,
  SlidersHorizontal,
  X,
  Check,
  Sparkles,
  CircleCheck,
  Ban,
  Info,
  type LucideIcon,
} from "lucide-react";

/* ═══ Data ═══════════════════════════════════════════════════ */

const DEST = {
  city: "Mexico City",
  country: "Mexico",
  flag: "🇲🇽",
  assessed: "2 Jul 2026",
  score: 47,
  verdict: "Caution advised",
  percentile: 38,
};

const SIGNALS = [
  { label: "Homicide rate", value: "24.9 per 100k", score: 26, source: "World Bank, 2023" },
  { label: "Road traffic deaths", value: "12.7 per 100k", score: 59, source: "World Bank, 2021" },
  { label: "Armed-conflict deaths", value: "None reported", score: 100, source: "World Bank, 2023" },
  { label: "Political stability", value: "28 of 100", score: 28, source: "WGI, 2024" },
  { label: "Rule of law", value: "31 of 100", score: 31, source: "WGI, 2024" },
  { label: "Control of corruption", value: "22 of 100", score: 22, source: "WGI, 2024" },
  { label: "Government effectiveness", value: "45 of 100", score: 45, source: "WGI, 2024" },
  { label: "Recent earthquakes", value: "3 quakes · max M5.8", score: 62, source: "USGS, last 90 days" },
  { label: "Air quality", value: "US AQI 72 · Moderate", score: 78, source: "Open-Meteo, live" },
  { label: "Travel health notices", value: "2 notices · max Alert", score: 60, source: "CDC" },
];

const WEIGHTS = [
  { factor: "Homicide rate", pct: 22 },
  { factor: "Political stability", pct: 16 },
  { factor: "Armed conflict", pct: 12 },
  { factor: "Rule of law", pct: 10 },
  { factor: "Official advisories", pct: 10 },
  { factor: "Control of corruption", pct: 7 },
  { factor: "Government effectiveness", pct: 6 },
  { factor: "Road safety", pct: 6 },
  { factor: "Seismic activity", pct: 5 },
  { factor: "Health notices", pct: 5 },
  { factor: "Air quality", pct: 3 },
];

const HOMICIDE_COMPARE = [
  { name: "Japan", rate: 0.2 },
  { name: "Switzerland", rate: 0.5 },
  { name: "United States", rate: 5.7 },
  { name: "World average", rate: 5.8 },
  { name: "Brazil", rate: 21.3 },
  { name: "Mexico", rate: 24.9, target: true },
  { name: "South Africa", rate: 41.9 },
];

const SAFE_AREAS = [
  { name: "Polanco", note: "embassy district, well patrolled" },
  { name: "Roma Norte", note: "tourist-friendly, lively at night" },
  { name: "Condesa", note: "walkable, busy evenings" },
  { name: "Coyoacán", note: "quiet, daytime destination" },
];

const AVOID_AREAS = [
  { name: "Tepito", note: "street crime hotspot" },
  { name: "Doctores after dark", note: "muggings reported" },
  { name: "Iztapalapa", note: "high crime rates" },
];

const SCAMS = [
  { scam: "Fake taxi overcharging", fix: "use Uber or sitio stands" },
  { scam: "Card skimming at street ATMs", fix: "use bank-lobby ATMs" },
  { scam: "“Free” bracelet vendors near Zócalo", fix: "keep walking — the bracelet isn’t free" },
  { scam: "Distraction pickpocketing on the Metro", fix: "front pockets, bag zipped and forward" },
];

const NEWS = [
  { item: "Increased National Guard patrols in tourist areas", tag: "Jun 2026", tone: "safe" as const },
  { item: "Pickpocketing spike on Metro Line 2", tag: "Watch", tone: "caution" as const },
  { item: "No major unrest in past 90 days", tag: "90 days", tone: "safe" as const },
];

/* ═══ Helpers ════════════════════════════════════════════════ */

type Tone = "safe" | "moderate" | "caution" | "risky";

const toneColor = (t: Tone) => `var(--${t})`;

const scoreTone = (s: number): Tone =>
  s >= 75 ? "safe" : s >= 55 ? "moderate" : s >= 35 ? "caution" : "risky";

const ordinal = (n: number) =>
  `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/* ═══ Small shared pieces ════════════════════════════════════ */

function ScoreRing({ size = 52, stroke = 5 }: { size?: number; stroke?: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = DEST.score / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--caution)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn ? c * (1 - frac) : c}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tnum font-display leading-none" style={{ fontSize: size * 0.34, fontWeight: 600 }}>
          {DEST.score}
        </span>
      </div>
    </div>
  );
}

function SourceLine({ sources }: { sources: string }) {
  return (
    <div
      className="mt-5 pt-3 flex items-center gap-1.5 text-[0.68rem]"
      style={{ borderTop: "1px solid var(--hairline)", color: "var(--ink-faint)" }}
    >
      <Info size={11} strokeWidth={2} className="shrink-0" />
      <span>Sources: {sources}</span>
    </div>
  );
}

function TonePill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold"
      style={{
        color: toneColor(tone),
        background: `color-mix(in srgb, ${toneColor(tone)} 11%, transparent)`,
        border: `1px solid color-mix(in srgb, ${toneColor(tone)} 30%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

/* ═══ Answer bodies ══════════════════════════════════════════ */

function NightBody() {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-4 py-3.5 text-[0.92rem] leading-relaxed"
        style={{
          background: "color-mix(in srgb, var(--accent) 5%, transparent)",
          borderLeft: "3px solid var(--accent)",
          color: "var(--ink-soft)",
        }}
      >
        Roma Norte and Condesa stay lively and patrolled until late; avoid empty streets after
        midnight, use Uber door-to-door, skip Doctores and Tepito entirely after dark.
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { ok: true, text: "Stay in lively corridors — Roma Norte, Condesa" },
          { ok: true, text: "Uber door-to-door after dark, never hail on the street" },
          { ok: false, text: "Empty streets after midnight, anywhere" },
          { ok: false, text: "Doctores and Tepito after dark — no exceptions" },
        ].map((r) => (
          <div
            key={r.text}
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[0.85rem]"
            style={{ border: "1px solid var(--hairline)", background: "rgba(255,255,255,0.6)" }}
          >
            {r.ok ? (
              <CircleCheck size={16} className="mt-0.5 shrink-0" style={{ color: "var(--safe)" }} />
            ) : (
              <Ban size={16} className="mt-0.5 shrink-0" style={{ color: "var(--risky)" }} />
            )}
            <span style={{ color: "var(--ink-soft)" }}>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvisoryBody() {
  const advisories = [
    {
      gov: "United States — State Department",
      level: "Level 2 of 4",
      tone: "moderate" as const,
      title: "Exercise Increased Caution",
      detail: "Crime and kidnapping cited as principal risks for travelers.",
      date: "Jun 2026",
    },
    {
      gov: "United Kingdom — FCDO",
      level: "Level 3 of 4",
      tone: "caution" as const,
      title: "Against all-but-essential travel to parts",
      detail:
        "Your travel insurance could be invalidated if you travel against advice.",
      date: "Jun 2026",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {advisories.map((a) => (
        <div
          key={a.gov}
          className="rounded-xl p-4"
          style={{ border: "1px solid var(--hairline)", background: "rgba(255,255,255,0.6)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="label">{a.gov}</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <TonePill tone={a.tone}>{a.level}</TonePill>
            <span className="text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
              updated {a.date}
            </span>
          </div>
          <p className="font-display mt-2.5 text-[1.05rem] leading-snug" style={{ color: "var(--ink)" }}>
            “{a.title}”
          </p>
          <p className="mt-1.5 text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            {a.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function HealthBody() {
  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3.5"
        style={{
          background: "color-mix(in srgb, var(--risky) 6%, transparent)",
          border: "1px solid color-mix(in srgb, var(--risky) 22%, transparent)",
        }}
      >
        <Droplets size={18} className="mt-0.5 shrink-0" style={{ color: "var(--risky)" }} />
        <div>
          <p className="text-[0.88rem] font-semibold" style={{ color: "var(--ink)" }}>
            Tap water: not recommended for visitors
          </p>
          <p className="mt-0.5 text-[0.82rem]" style={{ color: "var(--ink-soft)" }}>
            Drink bottled water — including for brushing teeth if you have a sensitive stomach.
          </p>
        </div>
      </div>
      {[
        {
          tone: "caution" as const,
          badge: "Alert",
          title: "Rocky Mountain Spotted Fever in Mexico",
          note: "Tick-borne; use repellent and check for ticks after outdoor time.",
        },
        {
          tone: "moderate" as const,
          badge: "Watch",
          title: "Salmonella Newport in Mexico",
          note: "Practice usual food-safety caution with street food and raw produce.",
        },
      ].map((n) => (
        <div
          key={n.title}
          className="flex items-start gap-3 rounded-xl px-4 py-3.5"
          style={{ border: "1px solid var(--hairline)", background: "rgba(255,255,255,0.6)" }}
        >
          <TonePill tone={n.tone}>{n.badge}</TonePill>
          <div>
            <p className="text-[0.88rem] font-semibold" style={{ color: "var(--ink)" }}>
              {n.title}
            </p>
            <p className="mt-0.5 text-[0.82rem]" style={{ color: "var(--ink-soft)" }}>
              {n.note}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AreasBody() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="label mb-2" style={{ color: "var(--safe)" }}>
          Stay here
        </p>
        <div className="space-y-2">
          {SAFE_AREAS.map((a) => (
            <div
              key={a.name}
              className="flex items-baseline gap-2 rounded-xl px-3.5 py-2.5"
              style={{
                background: "color-mix(in srgb, var(--safe) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--safe) 20%, transparent)",
              }}
            >
              <span className="text-[0.87rem] font-semibold" style={{ color: "var(--ink)" }}>
                {a.name}
              </span>
              <span className="text-[0.75rem]" style={{ color: "var(--ink-soft)" }}>
                {a.note}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2" style={{ color: "var(--risky)" }}>
          Skip these
        </p>
        <div className="space-y-2">
          {AVOID_AREAS.map((a) => (
            <div
              key={a.name}
              className="flex items-baseline gap-2 rounded-xl px-3.5 py-2.5"
              style={{
                background: "color-mix(in srgb, var(--risky) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--risky) 20%, transparent)",
              }}
            >
              <span className="text-[0.87rem] font-semibold" style={{ color: "var(--ink)" }}>
                {a.name}
              </span>
              <span className="text-[0.75rem]" style={{ color: "var(--ink-soft)" }}>
                {a.note}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.75rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
          Book accommodation in the left column; the score assumes you follow it.
        </p>
      </div>
    </div>
  );
}

function CompareBody() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, []);
  const max = Math.max(...HOMICIDE_COMPARE.map((c) => c.rate));
  return (
    <div>
      <p className="label mb-3">Homicides per 100,000 people</p>
      <div className="space-y-2.5">
        {HOMICIDE_COMPARE.map((c, i) => (
          <div key={c.name} className="grid items-center gap-3" style={{ gridTemplateColumns: "7.5rem 1fr 3rem" }}>
            <span
              className="truncate text-right text-[0.8rem]"
              style={{
                color: c.target ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: c.target ? 700 : 400,
              }}
            >
              {c.target ? `${DEST.flag} ` : ""}
              {c.name}
            </span>
            <div className="h-[14px] overflow-hidden rounded-full" style={{ background: "var(--paper-deep)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: grown ? `${Math.max((c.rate / max) * 100, 1.5)}%` : "0%",
                  background: c.target ? "var(--caution)" : "var(--sand)",
                  transition: `width 0.9s cubic-bezier(0.2,0.8,0.2,1) ${i * 90}ms`,
                }}
              />
            </div>
            <span
              className="tnum text-[0.8rem]"
              style={{ color: c.target ? "var(--caution)" : "var(--ink-faint)", fontWeight: c.target ? 700 : 500 }}
            >
              {c.rate.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        Mexico’s national rate is roughly <strong style={{ color: "var(--ink)" }}>4.4× the US</strong> and{" "}
        <strong style={{ color: "var(--ink)" }}>4.3× the world average</strong> — but violence is highly
        localized, and the tourist corridors of Mexico City sit well below the national figure.
      </p>
    </div>
  );
}

function ScamsBody() {
  return (
    <div className="space-y-2">
      {SCAMS.map((s, i) => (
        <div
          key={s.scam}
          className="flex items-start gap-3.5 rounded-xl px-4 py-3"
          style={{ border: "1px solid var(--hairline)", background: "rgba(255,255,255,0.6)" }}
        >
          <span
            className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
            style={{
              background: "color-mix(in srgb, var(--caution) 12%, transparent)",
              color: "var(--caution)",
            }}
          >
            {i + 1}
          </span>
          <div>
            <p className="text-[0.88rem] font-semibold" style={{ color: "var(--ink)" }}>
              {s.scam}
            </p>
            <p className="mt-0.5 text-[0.8rem]" style={{ color: "var(--ink-soft)" }}>
              <span className="font-semibold" style={{ color: "var(--safe)" }}>
                Counter:
              </span>{" "}
              {s.fix}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AirBody() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, []);
  const aqi = 72;
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <span className="tnum font-display text-4xl font-semibold" style={{ color: "var(--moderate)" }}>
            {aqi}
          </span>
          <span className="ml-2 text-[0.8rem]" style={{ color: "var(--ink-faint)" }}>
            US AQI · live
          </span>
        </div>
        <TonePill tone="moderate">Moderate</TonePill>
      </div>
      <div className="relative mt-3 h-[10px] overflow-hidden rounded-full" style={{ background: "var(--paper-deep)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: grown ? `${(aqi / 200) * 100}%` : "0%",
            background: "linear-gradient(90deg, var(--safe), var(--moderate))",
            transition: "width 0.9s cubic-bezier(0.2,0.8,0.2,1)",
          }}
        />
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
        <span>0 · Good</span>
        <span>100 · Moderate</span>
        <span>200 · Unhealthy</span>
      </div>
      <p className="mt-4 text-[0.85rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        Fine for most travelers; sensitive groups should limit prolonged outdoor exertion,
        especially in winter inversion months when the valley traps pollution.
      </p>
    </div>
  );
}

function QuakeBody() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { k: "3", l: "quakes over M4.5, last 90 days" },
          { k: "M5.8", l: "strongest, within 300 km" },
          { k: "62/100", l: "seismic signal score" },
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-xl px-4 py-3.5 text-center"
            style={{ border: "1px solid var(--hairline)", background: "rgba(255,255,255,0.6)" }}
          >
            <div className="tnum font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>
              {s.k}
            </div>
            <div className="mt-1 text-[0.7rem] leading-snug" style={{ color: "var(--ink-faint)" }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>
      <div
        className="rounded-xl px-4 py-3.5 text-[0.85rem] leading-relaxed"
        style={{
          background: "color-mix(in srgb, var(--accent) 5%, transparent)",
          borderLeft: "3px solid var(--accent)",
          color: "var(--ink-soft)",
        }}
      >
        CDMX sits in an active seismic zone with a public early-warning system (
        <strong style={{ color: "var(--ink)" }}>SASMEX</strong>) — sirens give up to a minute of
        warning. Know the drill: move to open ground when they sound.
      </div>
    </div>
  );
}

function NewsBody() {
  return (
    <div className="space-y-2">
      {NEWS.map((n) => (
        <div
          key={n.item}
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ border: "1px solid var(--hairline)", background: "rgba(255,255,255,0.6)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: toneColor(n.tone) }}
            />
            <span className="text-[0.87rem]" style={{ color: "var(--ink-soft)" }}>
              {n.item}
            </span>
          </div>
          <span className="tnum shrink-0 text-[0.68rem] font-semibold" style={{ color: "var(--ink-faint)" }}>
            {n.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

function MethodBody() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-5">
      <div>
        <p className="label mb-2.5">Signal weights</p>
        <div className="space-y-1.5">
          {WEIGHTS.map((w, i) => (
            <div key={w.factor} className="grid items-center gap-3" style={{ gridTemplateColumns: "10.5rem 1fr 2.4rem" }}>
              <span className="truncate text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
                {w.factor}
              </span>
              <div className="h-[8px] overflow-hidden rounded-full" style={{ background: "var(--paper-deep)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: grown ? `${(w.pct / 22) * 100}%` : "0%",
                    background: "var(--accent)",
                    opacity: 0.4 + 0.6 * (w.pct / 22),
                    transition: `width 0.8s cubic-bezier(0.2,0.8,0.2,1) ${i * 55}ms`,
                  }}
                />
              </div>
              <span className="tnum text-right text-[0.75rem] font-semibold" style={{ color: "var(--ink-faint)" }}>
                {w.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2.5">This destination’s signals</p>
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--hairline)" }}>
          <table className="w-full text-[0.78rem]" style={{ minWidth: "26rem" }}>
            <tbody>
              {SIGNALS.map((s, i) => (
                <tr key={s.label} style={{ borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                  <td className="px-3.5 py-2 font-medium" style={{ color: "var(--ink)" }}>
                    {s.label}
                  </td>
                  <td className="px-3.5 py-2" style={{ color: "var(--ink-soft)" }}>
                    {s.value}
                  </td>
                  <td className="tnum px-3.5 py-2 text-right font-bold" style={{ color: toneColor(scoreTone(s.score)) }}>
                    {s.score}
                  </td>
                  <td className="hidden px-3.5 py-2 text-right sm:table-cell" style={{ color: "var(--ink-faint)" }}>
                    {s.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[0.8rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Each signal is normalized to 0–100, multiplied by its weight, and summed. Mexico City’s
          weak spots — homicide (26), corruption (22), stability (28) — carry the heaviest weights,
          which is why strong scores on conflict and air quality still land the composite at{" "}
          <strong style={{ color: "var(--ink)" }}>47</strong>.
        </p>
      </div>
    </div>
  );
}

/* ═══ Question registry ══════════════════════════════════════ */

type Question = {
  id: string;
  icon: LucideIcon;
  chip: string;
  heading: string;
  oneLiner: ReactNode;
  body: () => ReactNode;
  sources: string;
};

const QUESTIONS: Question[] = [
  {
    id: "night",
    icon: Moon,
    chip: "Is it safe at night?",
    heading: "Is it safe at night?",
    oneLiner: "In the right neighborhoods, yes — with door-to-door transport and a curfew instinct after midnight.",
    body: () => <NightBody />,
    sources: "US State Dept advisory (Jun 2026); local incident reporting",
  },
  {
    id: "gov",
    icon: Landmark,
    chip: "What do governments say?",
    heading: "What do governments say?",
    oneLiner: "Two major governments advise heightened caution — the UK goes further than the US.",
    body: () => <AdvisoryBody />,
    sources: "US Department of State; UK Foreign, Commonwealth & Development Office — both Jun 2026",
  },
  {
    id: "health",
    icon: Droplets,
    chip: "Can I drink the water / any health risks?",
    heading: "Can I drink the water — and what health risks are active?",
    oneLiner: "No — bottled water only. Two CDC notices are active, the higher one at Alert level.",
    body: () => <HealthBody />,
    sources: "CDC Travel Health Notices (signal score 60/100)",
  },
  {
    id: "areas",
    icon: MapPin,
    chip: "Which neighborhoods should I stay in?",
    heading: "Which neighborhoods should I stay in?",
    oneLiner: "Polanco, Roma Norte, or Condesa — and treat three districts as off the itinerary.",
    body: () => <AreasBody />,
    sources: "Aggregated embassy district guidance and local crime reporting",
  },
  {
    id: "compare",
    icon: ChartBar,
    chip: "How does it compare to home?",
    heading: "How does it compare to home?",
    oneLiner: "Mexico’s homicide rate is 24.9 per 100k — over four times the US, but half of South Africa’s.",
    body: () => <CompareBody />,
    sources: "World Bank homicide data, 2023",
  },
  {
    id: "scams",
    icon: TriangleAlert,
    chip: "What scams should I know?",
    heading: "What scams should I know about?",
    oneLiner: "Four are worth memorizing — all avoidable with a minute of preparation.",
    body: () => <ScamsBody />,
    sources: "Consular incident reports; traveler advisories",
  },
  {
    id: "air",
    icon: Wind,
    chip: "Is the air quality okay?",
    heading: "Is the air quality okay?",
    oneLiner: "US AQI 72 (Moderate) right now — fine for most travelers.",
    body: () => <AirBody />,
    sources: "Open-Meteo air-quality API, live reading (signal score 78/100)",
  },
  {
    id: "quake",
    icon: Activity,
    chip: "Earthquakes — should I worry?",
    heading: "Earthquakes — should I worry?",
    oneLiner: "Be aware, not afraid: 3 quakes over M4.5 in 90 days, and the city has a public early-warning system.",
    body: () => <QuakeBody />,
    sources: "USGS earthquake catalog, last 90 days (signal score 62/100)",
  },
  {
    id: "news",
    icon: Newspaper,
    chip: "What’s in the news right now?",
    heading: "What’s in the news right now?",
    oneLiner: "More patrols, one pickpocketing spike, no unrest — a quiet 90 days overall.",
    body: () => <NewsBody />,
    sources: "Curated local and international news monitoring, Jun–Jul 2026",
  },
  {
    id: "method",
    icon: SlidersHorizontal,
    chip: "How is this score calculated?",
    heading: "How is the 47/100 calculated?",
    oneLiner: "Eleven weighted signals from public institutions — crime and governance dominate.",
    body: () => <MethodBody />,
    sources: "World Bank; WGI; USGS; CDC; Open-Meteo; national advisories — IsMyTripSafe methodology v3",
  },
];

const Q_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/* ═══ Page ═══════════════════════════════════════════════════ */

export default function Ui10() {
  const [asked, setAsked] = useState<string[]>([]);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [askingAll, setAskingAll] = useState(false);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const ask = useCallback(
    (id: string) => {
      setAsked((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setScrollTarget(id);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setAsked((prev) => prev.filter((x) => x !== id));
  }, []);

  const askEverything = useCallback(() => {
    setAskingAll(true);
    const remaining = QUESTIONS.map((q) => q.id).filter((id) => !asked.includes(id));
    remaining.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => {
          setAsked((prev) => (prev.includes(id) ? prev : [...prev, id]));
          if (i === 0) setScrollTarget(id);
          if (i === remaining.length - 1) setAskingAll(false);
        }, i * 420)
      );
    });
  }, [asked]);

  /* Smooth-scroll to the newest card after it mounts */
  useEffect(() => {
    if (!scrollTarget) return;
    const el = cardRefs.current[scrollTarget];
    if (el) {
      const t = setTimeout(
        () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
        60
      );
      setScrollTarget(null);
      return () => clearTimeout(t);
    }
    setScrollTarget(null);
  }, [scrollTarget, asked]);

  const remainingCount = QUESTIONS.length - asked.length;
  const threadEmpty = asked.length === 0;

  return (
    <div className="relative z-10 min-h-screen">
      {/* ── Masthead ── */}
      <header className="mx-auto flex max-w-4xl items-baseline justify-between px-5 pb-2 pt-7">
        <div className="flex items-baseline gap-3">
          <span className="wordmark text-[1.25rem]">
            IsMyTripSafe
            <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
          </span>
        </div>
        <span className="hidden text-[0.78rem] italic sm:block" style={{ color: "var(--ink-faint)" }}>
          One destination, one click, one report
        </span>
      </header>

      {/* ── Pinned essentials ── */}
      <div className="sticky top-0 z-40 px-5 pt-2">
        <div className="glass-float mx-auto flex max-w-4xl items-center gap-4 rounded-2xl px-4 py-3 sm:px-5">
          <ScoreRing />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="font-display truncate text-[1.15rem] font-semibold leading-tight sm:text-[1.3rem]">
                {DEST.city}, {DEST.country} {DEST.flag}
              </span>
              <span className="tnum hidden text-[0.68rem] sm:inline" style={{ color: "var(--ink-faint)" }}>
                Assessed {DEST.assessed}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <TonePill tone="caution">
                <TriangleAlert size={11} strokeWidth={2.5} />
                {DEST.verdict}
              </TonePill>
              <span className="hidden text-[0.72rem] md:inline" style={{ color: "var(--ink-faint)" }}>
                Safer than ~{DEST.percentile}% of countries
              </span>
            </div>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <div className="tnum text-[0.72rem] font-semibold" style={{ color: "var(--ink-soft)" }}>
              answered {asked.length} of {QUESTIONS.length}
            </div>
            <div className="mt-1.5 h-[4px] w-24 overflow-hidden rounded-full" style={{ background: "var(--paper-deep)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(asked.length / QUESTIONS.length) * 100}%`,
                  background: "var(--accent)",
                  transition: "width 0.5s cubic-bezier(0.2,0.8,0.2,1)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-5 pb-10">
        {/* ── Intro ── */}
        <section className="pb-2 pt-10 sm:pt-14">
          <p className="eyebrow rise-in">Interactive report · Interview the data</p>
          <h1 className="display-lg rise-in mt-3 max-w-2xl" style={{ animationDelay: "80ms" }}>
            You have questions.
            <br />
            <span style={{ color: "var(--accent-deep)" }}>The data will answer.</span>
          </h1>
          <p
            className="rise-in mt-4 max-w-xl text-[0.95rem] leading-relaxed"
            style={{ color: "var(--ink-soft)", animationDelay: "160ms" }}
          >
            Tap any question below. Each answer is appended to your thread — in your order — until
            you’ve assembled the report <em>you</em> actually need.
          </p>
        </section>

        {/* ── Question wall ── */}
        <section className="rise-in mt-6" style={{ animationDelay: "240ms" }}>
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="label">Ask the report</span>
              <button
                onClick={askEverything}
                disabled={remainingCount === 0 || askingAll}
                className="btn flex items-center gap-1.5 px-3.5 py-1.5 text-[0.75rem]"
              >
                <Sparkles size={13} />
                {remainingCount === 0
                  ? "All answered"
                  : askingAll
                    ? "Asking…"
                    : `Ask everything (${remainingCount})`}
              </button>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {QUESTIONS.map((q) => {
                const done = asked.includes(q.id);
                const Icon = q.icon;
                return (
                  <button
                    key={q.id}
                    onClick={() =>
                      done
                        ? cardRefs.current[q.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
                        : ask(q.id)
                    }
                    title={done ? "Answered — jump to it" : "Ask this question"}
                    className="group flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.8rem] font-medium transition-all duration-200"
                    style={
                      done
                        ? {
                            background: "var(--paper-deep)",
                            border: "1px solid transparent",
                            color: "var(--ink-faint)",
                          }
                        : {
                            background: "#fff",
                            border: "1px solid var(--hairline)",
                            color: "var(--ink-soft)",
                            boxShadow: "0 1px 2px rgba(20,30,48,0.05)",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!done) {
                        e.currentTarget.style.borderColor = "var(--accent)";
                        e.currentTarget.style.color = "var(--accent-deep)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!done) {
                        e.currentTarget.style.borderColor = "var(--hairline)";
                        e.currentTarget.style.color = "var(--ink-soft)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    {done ? (
                      <Check size={13} strokeWidth={2.5} style={{ color: "var(--safe)" }} />
                    ) : (
                      <Icon size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
                    )}
                    {q.chip}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Thread ── */}
        <section className="mt-10">
          {threadEmpty ? (
            <div
              className="rounded-2xl px-6 py-12 text-center"
              style={{ border: "1.5px dashed var(--hairline)" }}
            >
              <p className="font-display text-[1.15rem]" style={{ color: "var(--ink-faint)" }}>
                Your report is empty — for now.
              </p>
              <p className="mt-1.5 text-[0.82rem]" style={{ color: "var(--ink-faint)" }}>
                Ask a question above and the first answer card will land here.
              </p>
            </div>
          ) : (
            <>
              <div className="section-head mb-5">
                <span className="section-num tnum">YOUR THREAD</span>
                <span className="section-rule" />
                <span className="section-note">
                  {asked.length} answer{asked.length === 1 ? "" : "s"} · in the order you asked
                </span>
              </div>
              <div className="space-y-5">
                {asked.map((id, idx) => {
                  const q = Q_BY_ID[id];
                  const Icon = q.icon;
                  return (
                    <article
                      key={id}
                      ref={(el) => {
                        cardRefs.current[id] = el;
                      }}
                      className="card rise-in relative p-5 sm:p-6"
                      style={{ scrollMarginTop: "6.5rem" }}
                    >
                      <button
                        onClick={() => dismiss(id)}
                        aria-label={`Dismiss “${q.chip}”`}
                        className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                        style={{ color: "var(--ink-faint)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--paper-deep)";
                          e.currentTarget.style.color = "var(--ink)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--ink-faint)";
                        }}
                      >
                        <X size={15} />
                      </button>

                      <div className="flex items-center gap-2.5 pr-8">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                            color: "var(--accent-deep)",
                          }}
                        >
                          <Icon size={15} strokeWidth={2} />
                        </span>
                        <span className="label" style={{ letterSpacing: "0.1em" }}>
                          You asked {ordinal(idx + 1)}
                        </span>
                      </div>

                      <h2 className="font-display mt-3 text-[1.45rem] font-semibold leading-tight sm:text-[1.6rem]">
                        {q.heading}
                      </h2>
                      <p
                        className="mt-2 text-[0.95rem] font-medium leading-relaxed"
                        style={{ color: "var(--accent-deep)" }}
                      >
                        {q.oneLiner}
                      </p>

                      <div className="mt-5">{q.body()}</div>

                      <SourceLine sources={q.sources} />
                    </article>
                  );
                })}
              </div>
              {remainingCount > 0 && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={askEverything}
                    disabled={askingAll}
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.82rem] font-semibold transition-all"
                    style={{
                      border: "1px solid var(--hairline)",
                      background: "#fff",
                      color: "var(--accent-deep)",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <Sparkles size={14} />
                    {askingAll ? "Asking…" : `${remainingCount} question${remainingCount === 1 ? "" : "s"} left — ask them all`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-6" style={{ borderTop: "1px solid var(--hairline)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <span className="wordmark text-[0.95rem]">
                IsMyTripSafe<span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>.com</span>
              </span>
              <p className="mt-1 text-[0.72rem] italic" style={{ color: "var(--ink-faint)" }}>
                One destination, one click, one report
              </p>
            </div>
            <p className="max-w-md text-[0.68rem] leading-relaxed sm:text-right" style={{ color: "var(--ink-faint)" }}>
              Composite index from World Bank, WGI, USGS, CDC, Open-Meteo, and official government
              advisories. Assessed {DEST.assessed}. Informational only — not a guarantee of safety.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
