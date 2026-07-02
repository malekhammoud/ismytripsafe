"use client";

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI Direction 11: "The Safety Map"
   Spatial exploration. A hand-drawn, tourist-map-style SVG of
   Mexico City is the hero: ten organic district zones tinted
   by safety level, layered overlays (metro hotspots, seismic,
   patrols), hover tooltips and a click-driven District Brief
   panel. The report data supports the map, not vice-versa.
   ──────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Shield,
  ShieldCheck,
  TriangleAlert,
  TrainFront,
  Activity,
  Layers,
  Newspaper,
  HeartPulse,
  Lightbulb,
  Landmark,
  X,
  CircleAlert,
  Eye,
} from "lucide-react";

/* ═══ Types & palette ════════════════════════════════════════ */

type Level = "safe" | "moderate" | "caution" | "risky" | "park";

const LEVEL_META: Record<
  Level,
  { fill: string; stroke: string; text: string; name: string; chipBg: string }
> = {
  safe: { fill: "#d5eadf", stroke: "#7cbfa0", text: "#1e7a52", name: "Safe", chipBg: "rgba(47,158,111,0.13)" },
  moderate: { fill: "#efe3c9", stroke: "#cbab6d", text: "#8f6a23", name: "Moderate", chipBg: "rgba(200,151,63,0.15)" },
  caution: { fill: "#f4ddc5", stroke: "#d9a06a", text: "#a35c17", name: "Caution", chipBg: "rgba(224,138,59,0.15)" },
  risky: { fill: "#f2d3cc", stroke: "#d98476", text: "#a8352a", name: "Avoid", chipBg: "rgba(212,80,58,0.13)" },
  park: { fill: "#cfe6ce", stroke: "#8bbc8d", text: "#2c6e3f", name: "Park", chipBg: "rgba(74,145,88,0.14)" },
};

const NEUTRAL_FILL = "#e7ebf1";
const NEUTRAL_STROKE = "#c3ccd8";

interface Zone {
  id: string;
  name: string;
  level: Level;
  note: string;
  advice: string[];
  path: string;
  label: { x: number; y: number };
}

/* ═══ Hand-authored map geometry (viewBox 0 0 760 640) ══════ */

const ZONES: Zone[] = [
  {
    id: "polanco",
    name: "Polanco",
    level: "safe",
    note: "Embassy district, well patrolled — the safest base",
    advice: [
      "Best neighborhood to book a hotel; walkable day and night.",
      "Authorized taxi stands at Av. Presidente Masaryk hotels.",
    ],
    path: "M118 132 C112 100 136 76 176 68 C220 59 262 66 282 88 C300 108 296 136 278 156 C256 180 214 192 172 188 C138 185 123 162 118 132 Z",
    label: { x: 200, y: 128 },
  },
  {
    id: "chapultepec",
    name: "Chapultepec",
    level: "park",
    note: "Major park — busy weekends, fine daylight hours",
    advice: [
      "Castle and museums close by 5 pm; plan a daytime visit.",
      "Stick to main paths; the park empties quickly at dusk.",
    ],
    path: "M70 258 C62 222 86 198 124 192 C160 187 196 200 210 228 C226 258 222 300 200 330 C178 360 136 372 102 356 C72 342 78 296 70 258 Z",
    label: { x: 143, y: 278 },
  },
  {
    id: "condesa",
    name: "Condesa",
    level: "safe",
    note: "Walkable, busy evenings, popular with visitors",
    advice: [
      "Parque México café strips stay lively — and watched — late.",
      "Keep bags zipped on busy terrace rows along Tamaulipas.",
    ],
    path: "M240 296 C238 268 258 250 288 246 C318 242 344 254 350 282 C356 312 348 348 324 370 C300 390 262 386 248 360 C238 340 242 320 240 296 Z",
    label: { x: 295, y: 316 },
  },
  {
    id: "roma",
    name: "Roma Norte",
    level: "safe",
    note: "Tourist-friendly, lively and watched at night",
    advice: [
      "Well lit along Álvaro Obregón; fine to walk before midnight.",
      "Use app-hailed rides for the trip back after dinner.",
    ],
    path: "M368 288 C364 260 382 240 412 236 C444 231 470 244 476 272 C482 302 476 340 454 364 C432 386 394 384 380 358 C370 336 372 314 368 288 Z",
    label: { x: 422, y: 308 },
  },
  {
    id: "juarez",
    name: "Juárez · Zona Rosa",
    level: "moderate",
    note: "Busy nightlife strip — watch drinks and phones",
    advice: [
      "Never leave a drink unattended in Zona Rosa bars.",
      "Phones off tables; snatch-and-run thefts cluster here.",
    ],
    path: "M306 172 C304 150 322 136 350 132 C384 127 424 132 442 150 C458 166 454 192 434 208 C410 226 362 232 332 220 C310 211 308 192 306 172 Z",
    label: { x: 378, y: 180 },
  },
  {
    id: "centro",
    name: "Centro Histórico",
    level: "moderate",
    note: "Fine by day around the Zócalo, thins out late",
    advice: [
      "Sightsee before 7 pm; streets empty fast after close.",
      "Pickpockets work the Zócalo crowds — front pockets only.",
    ],
    path: "M470 168 C468 142 490 126 522 122 C560 117 606 126 622 150 C636 172 630 202 608 224 C582 250 532 258 500 244 C474 232 472 196 470 168 Z",
    label: { x: 548, y: 172 },
  },
  {
    id: "doctores",
    name: "Doctores",
    level: "caution",
    note: "Muggings reported — avoid after dark",
    advice: [
      "Lucha libre at Arena México? Arrive and leave by car.",
      "Do not walk here after sunset, even in a group.",
    ],
    path: "M490 300 C488 276 508 260 538 256 C570 251 598 262 606 288 C614 316 606 352 584 374 C562 394 524 392 508 368 C496 348 492 324 490 300 Z",
    label: { x: 548, y: 322 },
  },
  {
    id: "tepito",
    name: "Tepito",
    level: "risky",
    note: "Street-crime hotspot — skip entirely",
    advice: [
      "No tourist sights justify the risk — stay out.",
      "If a market stall 'deal' leads here, walk away.",
    ],
    path: "M548 96 C546 74 566 60 596 56 C630 51 668 58 682 80 C694 100 688 126 666 142 C642 160 598 164 572 150 C552 140 550 116 548 96 Z",
    label: { x: 617, y: 106 },
  },
  {
    id: "coyoacan",
    name: "Coyoacán",
    level: "safe",
    note: "Quiet colonial south — daytime destination",
    advice: [
      "Frida Kahlo museum sells out — book timed entry ahead.",
      "Head back north before evening; it is a long ride.",
    ],
    path: "M302 512 C298 482 322 460 360 454 C404 446 452 456 468 484 C482 510 472 544 444 566 C414 588 358 592 328 572 C306 558 306 536 302 512 Z",
    label: { x: 386, y: 520 },
  },
  {
    id: "iztapalapa",
    name: "Iztapalapa",
    level: "risky",
    note: "High crime rates — no tourist draw",
    advice: [
      "Nothing on a visitor itinerary requires coming here.",
      "If transiting by metro, stay on the train.",
    ],
    path: "M556 462 C552 434 576 414 614 408 C656 401 702 412 716 440 C728 464 720 498 694 520 C666 544 610 548 582 528 C562 514 560 486 556 462 Z",
    label: { x: 637, y: 470 },
  },
];

/* Overlay geometry */
const METRO_LINE2 = "M628 66 C606 130 588 176 572 214 C552 262 536 302 520 344 C502 392 472 456 436 516";
const METRO_HOTSPOTS = [
  { x: 585, y: 182, name: "Bellas Artes", spike: false },
  { x: 566, y: 228, name: "Zócalo stn", spike: true },
  { x: 528, y: 322, name: "Chabacano", spike: false },
  { x: 468, y: 458, name: "Portales", spike: false },
];
const SEISMIC = [
  { x: 646, y: 498, mag: "M5.8", major: true },
  { x: 340, y: 560, mag: "M4.2", major: false },
  { x: 180, y: 430, mag: "M3.9", major: false },
];
const PATROLS = [
  { x: 232, y: 100 },
  { x: 316, y: 350 },
  { x: 444, y: 276 },
  { x: 560, y: 202 },
  { x: 420, y: 490 },
];

/* ═══ Report data ════════════════════════════════════════════ */

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

const ADVISORIES = [
  { org: "US State Department", level: "Level 2", tone: "moderate" as Level, text: "Exercise Increased Caution — crime and kidnapping", date: "Jun 2026" },
  { org: "UK FCDO", level: "Level 3", tone: "caution" as Level, text: "Advises against all-but-essential travel to parts", date: "Jun 2026" },
];

const CDC_NOTICES = [
  { badge: "Alert", tone: "caution" as Level, text: "Rocky Mountain Spotted Fever in Mexico" },
  { badge: "Watch", tone: "moderate" as Level, text: "Salmonella Newport in Mexico" },
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

function scoreLevel(score: number): Level {
  if (score >= 70) return "safe";
  if (score >= 55) return "moderate";
  if (score >= 35) return "caution";
  return "risky";
}

/* ═══ Layer toggles ══════════════════════════════════════════ */

type LayerId = "safety" | "metro" | "seismic" | "patrols";

const LAYERS: { id: LayerId; label: string; icon: React.ReactNode }[] = [
  { id: "safety", label: "Safety zones", icon: <Layers size={13} strokeWidth={2.2} /> },
  { id: "metro", label: "Metro pickpocket hotspots", icon: <TrainFront size={13} strokeWidth={2.2} /> },
  { id: "seismic", label: "Seismic", icon: <Activity size={13} strokeWidth={2.2} /> },
  { id: "patrols", label: "Patrols", icon: <Shield size={13} strokeWidth={2.2} /> },
];

/* ═══ Small shared pieces ════════════════════════════════════ */

function LevelChip({ level, text }: { level: Level; text?: string }) {
  const m = LEVEL_META[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.12em]"
      style={{ background: m.chipBg, color: m.text, border: `1px solid ${m.stroke}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.text }} />
      {text ?? m.name}
    </span>
  );
}

function ShieldDot({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="ui11-pop" style={{ animationDelay: `${delay}ms` }}>
      <circle r={9.5} fill="#fff" stroke="var(--accent)" strokeWidth={1.2} opacity={0.95} />
      <path
        d="M0 -4.6 C2.6 -3.6 4.4 -3.4 4.4 -1.4 C4.4 1.8 2.2 4 0 5 C-2.2 4 -4.4 1.8 -4.4 -1.4 C-4.4 -3.4 -2.6 -3.6 0 -4.6 Z"
        fill="var(--accent)"
      />
    </g>
  );
}

/* ═══ The Map ════════════════════════════════════════════════ */

function CityMap({
  layers,
  selected,
  onSelect,
  hovered,
  onHover,
}: {
  layers: Record<LayerId, boolean>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });

  const hoveredZone = ZONES.find((z) => z.id === hovered) ?? null;

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={(e) => {
        const r = wrapRef.current?.getBoundingClientRect();
        if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
    >
      <svg
        viewBox="0 0 760 640"
        role="img"
        aria-label="Stylized safety map of Mexico City districts"
        className="block w-full select-none"
        style={{ filter: "drop-shadow(0 18px 30px rgba(20,30,48,0.14)) drop-shadow(0 2px 6px rgba(20,30,48,0.08))" }}
      >
        <defs>
          <pattern id="ui11-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.9" fill="rgba(20,30,48,0.07)" />
          </pattern>
          <pattern id="ui11-trees" width="26" height="24" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="7" r="2.4" fill="rgba(44,110,63,0.22)" />
            <circle cx="19" cy="17" r="2" fill="rgba(44,110,63,0.16)" />
          </pattern>
          <path id="ui11-reforma" d="M118 358 C200 316 264 268 336 224 C400 186 470 156 556 138" fill="none" />
        </defs>

        {/* Map plate */}
        <rect x="14" y="14" width="732" height="612" rx="26" fill="#f6f8fb" stroke="var(--hairline)" strokeWidth="1" />
        <rect x="14" y="14" width="732" height="612" rx="26" fill="url(#ui11-dots)" />

        {/* Compass rose */}
        <g transform="translate(700 66)" opacity="0.55">
          <circle r="15" fill="none" stroke="var(--ink-faint)" strokeWidth="1" />
          <path d="M0 -12 L3.5 3 L0 0.5 L-3.5 3 Z" fill="var(--ink-soft)" />
          <text y="-20" textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontWeight="700" letterSpacing="1">
            N
          </text>
        </g>

        {/* Avenues (under zones so zones read as fabric, gutters as streets) */}
        <g opacity="0.9">
          <path d="M340 44 C348 190 356 330 350 440 C346 520 342 568 346 616" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
          <path d="M340 44 C348 190 356 330 350 440 C346 520 342 568 346 616" fill="none" stroke="#d7dee8" strokeWidth="1.4" strokeDasharray="7 6" />
        </g>
        <g opacity="0.95">
          <path d="M118 358 C200 316 264 268 336 224 C400 186 470 156 556 138" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
          <path d="M118 358 C200 316 264 268 336 224 C400 186 470 156 556 138" fill="none" stroke="#cfd8e4" strokeWidth="1.6" strokeDasharray="9 7" />
        </g>

        {/* District zones */}
        <g>
          {ZONES.map((z) => {
            const m = LEVEL_META[z.level];
            const isSel = selected === z.id;
            const colored = layers.safety;
            return (
              <g key={z.id}>
                <path
                  d={z.path}
                  className="ui11-zone"
                  fill={colored ? m.fill : NEUTRAL_FILL}
                  stroke={isSel ? "var(--ink)" : colored ? m.stroke : NEUTRAL_STROKE}
                  strokeWidth={isSel ? 2.6 : 1.4}
                  tabIndex={0}
                  role="button"
                  aria-label={`${z.name}: ${z.note}`}
                  onMouseEnter={() => onHover(z.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(isSel ? null : z.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(isSel ? null : z.id);
                    }
                  }}
                />
                {z.id === "chapultepec" && (
                  <path d={z.path} fill="url(#ui11-trees)" pointerEvents="none" />
                )}
              </g>
            );
          })}
        </g>

        {/* Chapultepec lake */}
        <ellipse cx="128" cy="316" rx="22" ry="11" fill="#bcd7e8" stroke="#93bcd6" strokeWidth="1" pointerEvents="none" />

        {/* Zócalo */}
        <g pointerEvents="none">
          <rect x="552" y="196" width="20" height="20" rx="2.5" fill="#fff" stroke="var(--ink-soft)" strokeWidth="1.3" />
          <rect x="558" y="202" width="8" height="8" rx="1" fill="var(--ink-faint)" />
          <text x="562" y="234" textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)" fontWeight="600" letterSpacing="1.5">
            ZÓCALO
          </text>
        </g>

        {/* Zone labels */}
        <g pointerEvents="none">
          {ZONES.map((z) => (
            <text
              key={z.id}
              x={z.label.x}
              y={z.label.y}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="650"
              letterSpacing="1.6"
              fill="var(--ink-soft)"
              style={{ textTransform: "uppercase" as const, paintOrder: "stroke", stroke: "rgba(255,255,255,0.75)", strokeWidth: 3 }}
            >
              {z.name.toUpperCase()}
            </text>
          ))}
          <text fontSize="9" fontWeight="600" letterSpacing="2.2" fill="var(--ink-faint)">
            <textPath href="#ui11-reforma" startOffset="14%">
              PASEO DE LA REFORMA
            </textPath>
          </text>
        </g>

        {/* ── Overlay: Metro pickpocket hotspots ── */}
        <g className={`ui11-layer ${layers.metro ? "ui11-layer-on" : "ui11-layer-off"}`} pointerEvents="none">
          <path d={METRO_LINE2} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeDasharray="1 8" strokeLinecap="round" opacity="0.7" />
          {METRO_HOTSPOTS.map((h, i) => (
            <g key={h.name} transform={`translate(${h.x} ${h.y})`} className="ui11-pop" style={{ animationDelay: `${i * 90}ms` }}>
              <circle r={h.spike ? 20 : 15} fill="rgba(31,116,207,0.08)" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" className="ui11-slow-spin" />
              <circle r="3.4" fill="var(--accent)" />
              <text y={h.spike ? 34 : 28} textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1" fill="var(--accent-deep)" style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.85)", strokeWidth: 3 }}>
                {h.name.toUpperCase()}
              </text>
              {h.spike && (
                <g transform="translate(0 -34)">
                  <rect x="-58" y="-11" width="116" height="19" rx="9.5" fill="var(--accent-deep)" />
                  <text y="2.5" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.6" fill="#fff">
                    LINE 2 · THEFT SPIKE
                  </text>
                </g>
              )}
            </g>
          ))}
        </g>

        {/* ── Overlay: Seismic ── */}
        <g className={`ui11-layer ${layers.seismic ? "ui11-layer-on" : "ui11-layer-off"}`} pointerEvents="none">
          {SEISMIC.map((s, i) => (
            <g key={s.mag} transform={`translate(${s.x} ${s.y})`} className="ui11-pop" style={{ animationDelay: `${i * 110}ms` }}>
              <circle r={s.major ? 30 : 20} fill="none" stroke="var(--risky)" strokeWidth="1" opacity="0.3" className="ui11-ripple" />
              <circle r={s.major ? 19 : 13} fill="none" stroke="var(--risky)" strokeWidth="1.2" opacity="0.5" />
              <circle r={s.major ? 9 : 6.5} fill="rgba(212,80,58,0.14)" stroke="var(--risky)" strokeWidth="1.4" />
              <circle r="2.6" fill="var(--risky)" />
              {s.major ? (
                <g transform="translate(0 -42)">
                  <rect x="-26" y="-11" width="52" height="19" rx="9.5" fill="var(--risky)" />
                  <text y="2.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff">
                    {s.mag}
                  </text>
                </g>
              ) : (
                <text y={s.major ? 44 : 34} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--risky)" style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.85)", strokeWidth: 3 }}>
                  {s.mag}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* ── Overlay: Patrols ── */}
        <g className={`ui11-layer ${layers.patrols ? "ui11-layer-on" : "ui11-layer-off"}`} pointerEvents="none">
          {PATROLS.map((p, i) => (
            <ShieldDot key={i} x={p.x} y={p.y} delay={i * 70} />
          ))}
        </g>

        {/* Scale bar */}
        <g transform="translate(48 596)" opacity="0.7" pointerEvents="none">
          <line x1="0" y1="0" x2="70" y2="0" stroke="var(--ink-soft)" strokeWidth="1.4" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--ink-soft)" strokeWidth="1.4" />
          <line x1="70" y1="-4" x2="70" y2="4" stroke="var(--ink-soft)" strokeWidth="1.4" />
          <text x="35" y="-8" textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontWeight="600" letterSpacing="1">
            ≈ 3 KM
          </text>
        </g>
      </svg>

      {/* Floating tooltip */}
      {hoveredZone && (
        <div
          className="pointer-events-none absolute z-20 max-w-[240px] rounded-xl border border-[var(--hairline)] bg-white/95 px-3.5 py-2.5 shadow-[var(--shadow-float)] backdrop-blur"
          style={{
            left: Math.min(tip.x + 16, (wrapRef.current?.clientWidth ?? 400) - 250),
            top: Math.max(tip.y - 64, 8),
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="font-display text-[0.92rem] font-semibold text-[var(--ink)]">{hoveredZone.name}</span>
            <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_META[hoveredZone.level].text }} />
          </div>
          <p className="text-[0.74rem] leading-snug text-[var(--ink-soft)]">{hoveredZone.note}</p>
          <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Click for district brief</p>
        </div>
      )}
    </div>
  );
}

/* ═══ Legend (tracks active layers) ══════════════════════════ */

function Legend({ layers }: { layers: Record<LayerId, boolean> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pt-4 text-[0.68rem] font-medium text-[var(--ink-soft)]">
      <span className="label">Legend</span>
      {layers.safety &&
        (["safe", "moderate", "caution", "risky", "park"] as Level[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px]" style={{ background: LEVEL_META[l].fill, border: `1px solid ${LEVEL_META[l].stroke}` }} />
            {LEVEL_META[l].name}
          </span>
        ))}
      {!layers.safety && (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px]" style={{ background: NEUTRAL_FILL, border: `1px solid ${NEUTRAL_STROKE}` }} />
          Districts (colors off)
        </span>
      )}
      {layers.metro && (
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-dashed border-[var(--accent)]" />
          Pickpocket hotspot
        </span>
      )}
      {layers.seismic && (
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--risky)]">
            <span className="h-1 w-1 rounded-full bg-[var(--risky)]" />
          </span>
          Epicenter (90 days)
        </span>
      )}
      {layers.patrols && (
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-[var(--accent)]" />
          Guard patrol presence
        </span>
      )}
    </div>
  );
}

/* ═══ District brief panel ═══════════════════════════════════ */

function DistrictBrief({ zone, onClose }: { zone: Zone | null; onClose: () => void }) {
  if (!zone) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--hairline)] bg-white">
          <MapPin size={18} className="text-[var(--ink-faint)]" />
        </div>
        <p className="text-[0.84rem] leading-relaxed text-[var(--ink-faint)]">
          Select a district on the map to open its brief — safety level, field note, and what to do about it.
        </p>
      </div>
    );
  }
  const m = LEVEL_META[zone.level];
  return (
    <div key={zone.id} className="ui11-swap flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">District brief</p>
          <h3 className="font-display text-[1.5rem] font-semibold leading-tight text-[var(--ink)]">{zone.name}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close district brief"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)] transition hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-3">
        <LevelChip level={zone.level} text={zone.level === "park" ? "Park · daylight" : undefined} />
      </div>
      <div className="mt-4 rounded-xl border-l-[3px] px-4 py-3" style={{ borderColor: m.text, background: m.chipBg }}>
        <p className="text-[0.86rem] font-medium leading-relaxed" style={{ color: m.text }}>
          “{zone.note}”
        </p>
      </div>
      <p className="label mt-5 mb-2.5">On the ground</p>
      <ul className="space-y-2.5">
        {zone.advice.map((a) => (
          <li key={a} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-[var(--ink-soft)]">
            <Eye size={14} className="mt-[3px] shrink-0 text-[var(--ink-faint)]" />
            {a}
          </li>
        ))}
      </ul>
      <div className="hairline mt-auto pt-4" />
      <p className="pt-3 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        Zone rating · IsMyTripSafe district model
      </p>
    </div>
  );
}

/* ═══ Verdict ring ═══════════════════════════════════════════ */

function VerdictRing({ mounted }: { mounted: boolean }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const score = 47;
  return (
    <div className="relative h-[116px] w-[116px] shrink-0">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={R} fill="none" stroke="var(--paper-deep)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={R}
          fill="none"
          stroke="var(--caution)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={mounted ? C * (1 - score / 100) : C}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.2,0.8,0.2,1) 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-display text-[1.9rem] font-semibold leading-none text-[var(--ink)]">{score}</span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">/ 100</span>
      </div>
    </div>
  );
}

/* ═══ Page ═══════════════════════════════════════════════════ */

export default function SafetyMapPage() {
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    safety: true,
    metro: false,
    seismic: false,
    patrols: false,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const selectedZone = useMemo(() => ZONES.find((z) => z.id === selected) ?? null, [selected]);

  return (
    <div className="relative z-[1] min-h-screen">
      <style>{`
        .ui11-zone {
          cursor: pointer;
          transition: fill 0.45s ease, stroke 0.3s ease, stroke-width 0.2s ease, filter 0.25s ease;
          outline: none;
        }
        .ui11-zone:hover, .ui11-zone:focus-visible {
          filter: brightness(1.055) saturate(1.25);
          stroke-width: 2.4;
        }
        .ui11-layer {
          transition: opacity 0.45s cubic-bezier(0.2,0.8,0.2,1), transform 0.45s cubic-bezier(0.2,0.8,0.2,1);
          transform-origin: 380px 320px;
        }
        .ui11-layer-on { opacity: 1; transform: scale(1); }
        .ui11-layer-off { opacity: 0; transform: scale(0.97); pointer-events: none; }
        .ui11-pop {
          transform-box: fill-box;
          transform-origin: center;
          animation: ui11pop 0.5s cubic-bezier(0.2,0.9,0.3,1.2) both;
        }
        @keyframes ui11pop {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        .ui11-ripple {
          transform-box: fill-box;
          transform-origin: center;
          animation: ui11ripple 2.6s ease-out infinite;
        }
        @keyframes ui11ripple {
          0% { transform: scale(0.55); opacity: 0.55; }
          70% { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        .ui11-slow-spin {
          transform-box: fill-box;
          transform-origin: center;
          animation: ui11spin 26s linear infinite;
        }
        @keyframes ui11spin { to { transform: rotate(360deg); } }
        .ui11-swap { animation: ui11swap 0.4s cubic-bezier(0.2,0.8,0.2,1) both; }
        @keyframes ui11swap {
          from { opacity: 0; transform: translateX(14px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .ui11-bar { transition: width 1.1s cubic-bezier(0.2,0.8,0.2,1); }
        .ui11-toggle { transition: background 0.25s, color 0.25s, border-color 0.25s, box-shadow 0.25s; }
      `}</style>

      {/* ── Masthead ── */}
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 pb-5 pt-7 sm:px-8">
        <div className="flex items-baseline gap-4">
          <span className="wordmark text-[1.28rem] text-[var(--ink)]">
            IsMyTripSafe<span className="text-[var(--ink-faint)]">.com</span>
          </span>
          <span className="hidden text-[0.76rem] italic text-[var(--ink-faint)] sm:inline">
            One destination, one click, one report
          </span>
        </div>
        <span className="label">Report № 0247 · Assessed 2 Jul 2026</span>
      </header>
      <div className="hairline mx-auto max-w-[1240px]" />

      <main className="mx-auto max-w-[1240px] px-5 pb-16 sm:px-8">
        {/* ── Destination line ── */}
        <div className="rise-in flex flex-wrap items-end justify-between gap-4 pb-6 pt-8">
          <div>
            <p className="eyebrow mb-2 flex items-center gap-2">
              <MapPin size={12} /> Destination safety map
            </p>
            <h1 className="display-lg text-[var(--ink)]">
              Mexico City, <span className="italic text-[var(--ink-soft)]">Mexico</span>{" "}
              <span className="align-middle text-[1.6rem]">🇲🇽</span>
            </h1>
          </div>
          <p className="max-w-[340px] text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">
            The city is not one risk level — it is a patchwork. Explore the fabric district by district, then read
            the evidence underneath.
          </p>
        </div>

        {/* ── HERO: map + brief panel ── */}
        <section className="rise-in grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ animationDelay: "0.1s" }}>
          <div className="card overflow-hidden">
            {/* Layer toggles */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline)] bg-white/60 px-4 py-3 sm:px-5">
              <span className="label mr-1">Layers</span>
              {LAYERS.map((l) => {
                const on = layers[l.id];
                return (
                  <button
                    key={l.id}
                    onClick={() => setLayers((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                    aria-pressed={on}
                    className={`ui11-toggle flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_4px_14px_-4px_rgba(31,116,207,0.55)]"
                        : "border-[var(--hairline)] bg-white text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
                    }`}
                  >
                    {l.icon}
                    {l.label}
                  </button>
                );
              })}
            </div>

            <div className="p-3 sm:p-5">
              <CityMap layers={layers} selected={selected} onSelect={setSelected} hovered={hovered} onHover={setHovered} />
              <Legend layers={layers} />
            </div>
          </div>

          {/* Side panel — becomes a bottom-sheet-style block on mobile */}
          <aside className="flex flex-col gap-5">
            <div className="card min-h-[300px] flex-1 overflow-hidden rounded-t-[22px] lg:rounded-t-[16px]">
              <DistrictBrief zone={selectedZone} onClose={() => setSelected(null)} />
            </div>

            {/* Compact verdict */}
            <div className="card p-5">
              <p className="eyebrow mb-3">Composite verdict</p>
              <div className="flex items-center gap-4">
                <VerdictRing mounted={mounted} />
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em]"
                    style={{ background: LEVEL_META.caution.chipBg, color: LEVEL_META.caution.text, border: `1px solid ${LEVEL_META.caution.stroke}66` }}
                  >
                    <TriangleAlert size={11} /> Caution advised
                  </span>
                  <p className="tnum mt-2 text-[0.78rem] leading-relaxed text-[var(--ink-soft)]">
                    Safer than <strong className="text-[var(--ink)]">~38%</strong> of countries in our index.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* ── Advisories + CDC ── */}
        <section className="rise-in pt-10" style={{ animationDelay: "0.2s" }}>
          <div className="section-head">
            <span className="section-num">01</span>
            <h2 className="section-title">Official advisories</h2>
            <span className="section-rule" />
            <span className="section-note">2 governments · 2 CDC notices</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {ADVISORIES.map((a) => {
              const m = LEVEL_META[a.tone];
              return (
                <div key={a.org} className="card flex gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: m.chipBg }}>
                    <Landmark size={17} style={{ color: m.text }} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.86rem] font-semibold text-[var(--ink)]">{a.org}</span>
                      <LevelChip level={a.tone} text={a.level} />
                    </div>
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[var(--ink-soft)]">“{a.text}”</p>
                    <p className="mt-1 text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ink-faint)]">{a.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CDC_NOTICES.map((n) => {
              const m = LEVEL_META[n.tone];
              return (
                <div key={n.text} className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-white/70 px-4 py-3">
                  <HeartPulse size={15} className="shrink-0 text-[var(--ink-faint)]" />
                  <span
                    className="rounded-md px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em]"
                    style={{ background: m.chipBg, color: m.text }}
                  >
                    {n.badge}
                  </span>
                  <span className="text-[0.8rem] text-[var(--ink-soft)]">{n.text}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Signals ── */}
        <section className="rise-in pt-10" style={{ animationDelay: "0.3s" }}>
          <div className="section-head">
            <span className="section-num">02</span>
            <h2 className="section-title">The ten signals</h2>
            <span className="section-rule" />
            <span className="section-note">Weighted into the 47 / 100 composite</span>
          </div>
          <div className="card mt-4 divide-y divide-[var(--hairline)]">
            {SIGNALS.map((s, i) => {
              const lvl = scoreLevel(s.score);
              return (
                <div key={s.label} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_44px] items-center gap-3 px-4 py-2.5 sm:grid-cols-[220px_150px_minmax(0,1fr)_150px_44px] sm:px-5">
                  <span className="truncate text-[0.82rem] font-medium text-[var(--ink)]">{s.label}</span>
                  <span className="tnum hidden text-[0.78rem] text-[var(--ink-soft)] sm:block">{s.value}</span>
                  <div className="h-[7px] overflow-hidden rounded-full bg-[var(--paper-deep)]">
                    <div
                      className="ui11-bar h-full rounded-full"
                      style={{
                        width: mounted ? `${s.score}%` : "0%",
                        background: LEVEL_META[lvl].text,
                        transitionDelay: `${0.15 + i * 0.06}s`,
                      }}
                    />
                  </div>
                  <span className="hidden truncate text-right text-[0.68rem] text-[var(--ink-faint)] sm:block">{s.source}</span>
                  <span className="tnum text-right text-[0.84rem] font-semibold" style={{ color: LEVEL_META[lvl].text }}>
                    {s.score}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── News + tips ── */}
        <section className="rise-in grid gap-5 pt-10 md:grid-cols-2" style={{ animationDelay: "0.4s" }}>
          <div className="card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <Newspaper size={16} className="text-[var(--ink-faint)]" />
              <h3 className="font-display text-[1.02rem] font-medium text-[var(--ink)]">On the wire</h3>
            </div>
            <ul className="space-y-3">
              {NEWS.map((n) => (
                <li key={n} className="flex gap-3 text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <Lightbulb size={16} className="text-[var(--ink-faint)]" />
              <h3 className="font-display text-[1.02rem] font-medium text-[var(--ink)]">Field craft</h3>
            </div>
            <ul className="space-y-3">
              {TIPS.map((t, i) => (
                <li key={t} className="flex gap-3 text-[0.84rem] leading-relaxed text-[var(--ink-soft)]">
                  <span className="tnum mt-[1px] shrink-0 text-[0.72rem] font-bold text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Methodology ── */}
        <section className="rise-in pt-10" style={{ animationDelay: "0.5s" }}>
          <details className="disclosure">
            <summary>
              <span className="flex items-center gap-2">
                <CircleAlert size={14} className="text-[var(--ink-faint)]" /> Methodology & sources
              </span>
              <span className="text-[var(--ink-faint)]">＋</span>
            </summary>
            <div className="disclosure-body">
              The Composite Safety Index blends ten public signals — World Bank crime and conflict series, Worldwide
              Governance Indicators, USGS seismic activity, Open-Meteo air quality, and CDC travel health notices —
              normalized to a 0–100 scale and weighted toward violent-crime exposure for visitors. District zone
              ratings are editorial, drawn from official advisories and local reporting; boundaries on this map are
              stylized and not geographically precise. This page is an informational summary, not a guarantee of
              personal safety.
            </div>
          </details>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--hairline)] bg-white/50">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
          <span className="wordmark text-[0.95rem] text-[var(--ink)]">
            IsMyTripSafe<span className="text-[var(--ink-faint)]">.com</span>
          </span>
          <span className="text-[0.74rem] italic text-[var(--ink-faint)]">One destination, one click, one report</span>
          <span className="label">Data refreshed 2 Jul 2026 · UI Direction 11 — “The Safety Map”</span>
        </div>
      </footer>
    </div>
  );
}
