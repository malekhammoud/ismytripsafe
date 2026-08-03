// ─────────────────────────────────────────────────────────────────────
// Postcard artwork: hand-authored SVG beach scenes in a mid-century
// travel-poster style — flat colour blocks, a low sun, long shadows and
// people who read as people at 300px wide without pretending to be
// photographs.
//
// Two rules keep these honest:
//
//  1. **Deterministic.** Scene and palette are picked from a hash of the
//     destination slug, never from Math.random(), so the server and the
//     client agree and a given city always gets the same card.
//  2. **No text inside the art.** Captions live in the postcard's white
//     deckle (see Postcard.tsx), so one scene can serve any destination.
// ─────────────────────────────────────────────────────────────────────

export interface Palette {
  key: string
  skyTop: string
  skyLow: string
  sun: string
  sunGlow: string
  seaFar: string
  seaMid: string
  seaNear: string
  foam: string
  sandWet: string
  sand: string
  sandShade: string
  shadow: string
  /** Figure fills — deliberately three tones so groups don't read as clones. */
  skin: [string, string, string]
  cloth: [string, string, string]
  ink: string
}

export const PALETTES: Palette[] = [
  {
    key: "noon",
    skyTop: "#8fd8e8",
    skyLow: "#d8f1f2",
    sun: "#fff0c2",
    sunGlow: "#ffe08a",
    seaFar: "#1a7f97",
    seaMid: "#17a1ae",
    seaNear: "#4ec6c8",
    foam: "#e9f8f5",
    sandWet: "#e2cfa6",
    sand: "#f3e2bd",
    sandShade: "#e6cf9f",
    shadow: "rgba(13, 59, 77, 0.17)",
    skin: ["#8a5a3b", "#c98f62", "#5e3a26"],
    cloth: ["#f2704a", "#ffc857", "#0d6d7d"],
    ink: "#0d3b4d",
  },
  {
    key: "golden",
    skyTop: "#ffcf8e",
    skyLow: "#ffeacb",
    sun: "#fff3d0",
    sunGlow: "#ffb765",
    seaFar: "#16697f",
    seaMid: "#1d8d9b",
    seaNear: "#59b7ba",
    foam: "#fdf3df",
    sandWet: "#e5c99a",
    sand: "#f6e3b8",
    sandShade: "#e3c894",
    shadow: "rgba(13, 59, 77, 0.2)",
    skin: ["#7d4f33", "#c58a5d", "#4f3020"],
    cloth: ["#e2553a", "#fff0c4", "#116b7c"],
    ink: "#0d3b4d",
  },
  {
    key: "sunset",
    skyTop: "#f2814f",
    skyLow: "#ffd9a3",
    sun: "#fff1c9",
    sunGlow: "#ff8f52",
    seaFar: "#0e4a63",
    seaMid: "#1a6b83",
    seaNear: "#3f97a3",
    foam: "#ffe9c9",
    sandWet: "#d9b98a",
    sand: "#eed6ab",
    sandShade: "#d8bd8c",
    shadow: "rgba(11, 45, 61, 0.28)",
    skin: ["#6d422a", "#b57a4e", "#43281a"],
    cloth: ["#d8492a", "#ffd489", "#0b5c72"],
    ink: "#0b2d3d",
  },
  {
    key: "dawn",
    skyTop: "#bfd8ef",
    skyLow: "#fbe6e2",
    sun: "#fff6e4",
    sunGlow: "#ffc3b0",
    seaFar: "#2a6f8c",
    seaMid: "#3a92a5",
    seaNear: "#78bfc4",
    foam: "#f2fbfa",
    sandWet: "#ded0b1",
    sand: "#f2e6cd",
    sandShade: "#e0d0ae",
    shadow: "rgba(13, 59, 77, 0.15)",
    skin: ["#845436", "#c6885c", "#563322"],
    cloth: ["#ee7a5c", "#8fd0d6", "#12546b"],
    ink: "#123c4e",
  },
]

/** Stable 32-bit hash — same value on the server and in the browser. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const W = 400
const H = 267
const HORIZON = 128
const SHORE = 176
const SAND = 188

// ─── Shared scenery ──────────────────────────────────────────────────

/** Sky, sun, sea bands and sand — every scene opens with this. */
function Backdrop({ p, sunX = 306, w = W }: { p: Palette; sunX?: number; w?: number }) {
  return (
    <>
      <rect x="0" y="0" width={w} height={HORIZON} fill={`url(#sky-${p.key})`} />

      {/* Low sun with a soft halo */}
      <circle cx={sunX} cy={HORIZON - 52} r="46" fill={p.sunGlow} opacity="0.28" />
      <circle cx={sunX} cy={HORIZON - 52} r="27" fill={p.sun} />

      {/* Sea, in three flat bands — the poster shorthand for depth */}
      <rect x="0" y={HORIZON} width={w} height={SHORE - HORIZON} fill={p.seaFar} />
      <rect x="0" y={HORIZON + 17} width={w} height={SHORE - HORIZON - 17} fill={p.seaMid} />
      <rect x="0" y={HORIZON + 34} width={w} height={SHORE - HORIZON - 34} fill={p.seaNear} />

      {/* Sun glitter on the water */}
      <g fill={p.foam} opacity="0.72">
        <rect x={sunX - 34} y={HORIZON + 5} width="68" height="2.5" rx="1.25" />
        <rect x={sunX - 22} y={HORIZON + 13} width="44" height="2.5" rx="1.25" />
        <rect x={sunX - 30} y={HORIZON + 23} width="60" height="3" rx="1.5" />
        <rect x={sunX - 16} y={HORIZON + 33} width="32" height="3" rx="1.5" />
      </g>

      {/* Broken swell lines */}
      <g fill={p.foam} opacity="0.5">
        <rect x="18" y={HORIZON + 9} width="52" height="2" rx="1" />
        <rect x="96" y={HORIZON + 20} width="38" height="2" rx="1" />
        <rect x="24" y={HORIZON + 31} width="70" height="2.5" rx="1.25" />
        <rect x="150" y={HORIZON + 14} width="30" height="2" rx="1" />
      </g>

      {/* Surf line + wet sand */}
      <path
        className="drift-slow"
        d={`M0 ${SHORE} q 40 -7 80 0 ${"t 80 0 ".repeat(Math.ceil(w / 80))}V${SAND} H0 Z`}
        fill={p.foam}
      />
      <path
        d={`M0 ${SAND - 3} q 46 6 92 0 ${"t 92 0 ".repeat(Math.ceil(w / 92))}V${H} H0 Z`}
        fill={p.sandWet}
      />
      <rect x="0" y={SAND + 8} width={w} height={H - SAND - 8} fill={p.sand} />

      {/* Sand grain + a couple of ripple lines so the beach isn't a flat slab */}
      <g fill={p.sandShade} opacity="0.62">
        <path d={`M0 ${SAND + 26} q 60 7 120 0 ${"t 120 0 ".repeat(Math.ceil(w / 120))}v4 ${"t -120 0 ".repeat(Math.ceil(w / 120))}Z`} />
        <path d={`M0 ${SAND + 52} q 80 8 160 0 ${"t 160 0 ".repeat(Math.ceil(w / 160))}v5 ${"t -160 0 ".repeat(Math.ceil(w / 160))}Z`} opacity="0.7" />
      </g>
    </>
  )
}

/** The flat elliptical shadow every standing figure casts toward the viewer. */
function Shade({ x, y, rx, p }: { x: number; y: number; rx: number; p: Palette }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.3} fill={p.shadow} />
}

// ─── Figure primitives ───────────────────────────────────────────────

/**
 * A standing person, built from a head, a tapered body and two legs.
 * `dir` flips them; `hair` picks one of three simple silhouettes so a
 * crowd doesn't look stamped from one mould.
 */
function Standing({
  x,
  groundY,
  scale = 1,
  skin,
  cloth,
  hair = 0,
  dir = 1,
  p,
}: {
  x: number
  groundY: number
  scale?: number
  skin: string
  cloth: string
  hair?: 0 | 1 | 2
  dir?: 1 | -1
  p: Palette
}) {
  const s = scale
  return (
    <g transform={`translate(${x} ${groundY}) scale(${dir * s} ${s})`}>
      {/* legs */}
      <path d="M-5 0 L-4.5 -22 L-1 -22 L-1.5 0 Z" fill={skin} />
      <path d="M1.5 0 L1 -22 L4.5 -22 L5 0 Z" fill={skin} />
      {/* swimsuit / shorts */}
      <path d="M-6 -20 L6 -20 L5.5 -30 L-5.5 -30 Z" fill={cloth} />
      {/* torso */}
      <path d="M-5.5 -29 L5.5 -29 L4.5 -46 L-4.5 -46 Z" fill={skin} />
      {/* arms, relaxed at the sides */}
      <path d="M-5 -45 q -4 9 -3 18" stroke={skin} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M5 -45 q 4 9 3 18" stroke={skin} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* neck + head */}
      <rect x="-1.5" y="-50" width="3" height="5" fill={skin} />
      <circle cx="0" cy="-55" r="5.4" fill={skin} />
      {/* hair */}
      {hair === 0 && <path d="M-5.6 -56 a5.6 5.6 0 0 1 11.2 0 q -5.6 -3.5 -11.2 0 Z" fill={p.ink} />}
      {hair === 1 && (
        <path d="M-5.8 -55 a5.8 5.8 0 0 1 11.6 0 q 0 7 -3 8 q 1.5 -6 -2 -7 q -3.5 -1 -6.6 -1 Z" fill={p.ink} />
      )}
      {hair === 2 && (
        <>
          <path d="M-5.6 -56 a5.6 5.6 0 0 1 11.2 0 q -5.6 -4 -11.2 0 Z" fill={p.ink} />
          <circle cx="5.5" cy="-58.5" r="3.2" fill={p.ink} />
        </>
      )}
    </g>
  )
}

/** A person lying on a towel, propped on one elbow. */
function Lying({
  x,
  groundY,
  scale = 1,
  skin,
  cloth,
  towel,
  dir = 1,
  p,
}: {
  x: number
  groundY: number
  scale?: number
  skin: string
  cloth: string
  towel: string
  dir?: 1 | -1
  p: Palette
}) {
  return (
    <g transform={`translate(${x} ${groundY}) scale(${dir * scale} ${scale})`}>
      {/* towel, in perspective */}
      <path d="M-30 0 L34 0 L29 -8 L-25 -8 Z" fill={towel} />
      <path d="M-30 0 L34 0 L33 2 L-29 2 Z" fill={p.shadow} opacity="0.5" />
      {/* legs, ankles crossed */}
      <path d="M-22 -9 L8 -9 L8 -14 L-22 -13 Z" fill={skin} />
      <path d="M-24 -13 q -4 -1 -5 -4 q 3 -2 6 -1 Z" fill={skin} />
      {/* swimsuit */}
      <rect x="4" y="-16" width="11" height="8" rx="2" fill={cloth} />
      {/* torso rising to the propped shoulder */}
      <path d="M13 -8 L26 -8 L24 -24 L14 -18 Z" fill={skin} />
      {/* supporting arm */}
      <path d="M22 -22 q 6 6 6 14" stroke={skin} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {/* head + hair */}
      <circle cx="27" cy="-29" r="5.2" fill={skin} />
      <path d="M22 -30 a5.2 5.2 0 0 1 10.4 -1 q -3 4 -10.4 1 Z" fill={p.ink} />
      <path d="M31 -32 q 6 2 7 8 q -5 -4 -8 -4 Z" fill={p.ink} />
    </g>
  )
}

/** Head and shoulders above the waterline, with an arm raised. */
function Swimmer({ x, y, scale = 1, skin, p }: { x: number; y: number; scale?: number; skin: string; p: Palette }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="1" rx="13" ry="3.4" fill={p.foam} opacity="0.85" />
      <path d="M-6 0 q 6 -9 12 0 Z" fill={skin} />
      <circle cx="0" cy="-7" r="4.6" fill={skin} />
      <path d="M-4.7 -8 a4.7 4.7 0 0 1 9.4 0 q -4.7 -3.5 -9.4 0 Z" fill={p.ink} />
      <path d="M5 -5 q 7 -3 8 -11" stroke={skin} strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </g>
  )
}

/** Palm tree — trunk leaning off the vertical, six fronds. */
function Palm({ x, groundY, h = 90, dir = 1, p }: { x: number; groundY: number; h?: number; dir?: 1 | -1; p: Palette }) {
  const top = -h
  return (
    <g transform={`translate(${x} ${groundY}) scale(${dir} 1)`}>
      <Shade x={4} y={0} rx={16} p={p} />
      <path
        d={`M-4 0 q 3 ${top * 0.5} ${h * 0.17} ${top}`}
        stroke="#6b4a2f"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <g transform={`translate(${h * 0.17} ${top})`} fill="#2f7d5c">
        <path d="M0 0 q -22 -13 -40 -2 q 20 -3 40 6 Z" />
        <path d="M0 0 q -16 -22 -36 -24 q 18 8 34 22 Z" />
        <path d="M0 0 q 4 -25 -8 -38 q 6 20 4 38 Z" />
        <path d="M0 0 q 20 -20 40 -18 q -22 4 -37 21 Z" fill="#3c9068" />
        <path d="M0 0 q 26 -6 38 8 q -22 -8 -37 4 Z" fill="#3c9068" />
        <path d="M0 0 q 14 12 12 26 q -6 -16 -15 -22 Z" fill="#276b4e" />
      </g>
      <circle cx={h * 0.17 - 3} cy={top + 4} r="3" fill="#8a6b3a" />
      <circle cx={h * 0.17 + 3} cy={top + 6} r="2.6" fill="#8a6b3a" />
    </g>
  )
}

/** Beach parasol with alternating panels. */
function Parasol({ x, groundY, p }: { x: number; groundY: number; p: Palette }) {
  return (
    <g transform={`translate(${x} ${groundY})`}>
      <Shade x={0} y={0} rx={26} p={p} />
      <rect x="-1.5" y="-84" width="3" height="84" fill="#7d5a37" />
      <g>
        <path d="M-52 -84 q 26 -26 52 -26 q 26 0 52 26 Z" fill={p.cloth[1]} />
        <path d="M-52 -84 q 13 -20 26 -23 l 0 23 Z" fill={p.cloth[0]} />
        <path d="M0 -110 l 0 26 26 0 q -10 -21 -26 -26 Z" fill={p.cloth[0]} />
        <path d="M-52 -84 q 52 10 104 0 l 0 3 q -52 10 -104 0 Z" fill={p.shadow} opacity="0.35" />
      </g>
      <circle cx="0" cy="-112" r="3" fill="#7d5a37" />
    </g>
  )
}

// ─── The scenes ──────────────────────────────────────────────────────

type Scene = (p: Palette) => React.ReactNode

/** 1 — Two people under a parasol, the classic postcard front. */
const sceneParasol: Scene = (p) => (
  <>
    <Backdrop p={p} sunX={318} />
    <Palm x={40} groundY={252} h={104} dir={-1} p={p} />
    <Parasol x={148} groundY={236} p={p} />
    <Lying x={196} groundY={240} scale={1.05} skin={p.skin[1]} cloth={p.cloth[0]} towel={p.cloth[2]} dir={-1} p={p} />
    <Lying x={120} groundY={252} scale={1.15} skin={p.skin[0]} cloth={p.cloth[1]} towel={p.cloth[0]} p={p} />
    {/* a cool box and two sandals, because nobody packs light */}
    <g transform="translate(258 246)">
      <Shade x={6} y={2} rx={16} p={p} />
      <rect x="-12" y="-16" width="30" height="16" rx="2.5" fill={p.cloth[2]} />
      <rect x="-14" y="-20" width="34" height="5" rx="2.5" fill="#fffdf6" />
    </g>
    <g fill={p.ink} opacity="0.55">
      <ellipse cx="292" cy="252" rx="7" ry="3" />
      <ellipse cx="304" cy="257" rx="7" ry="3" />
    </g>
    <Standing x={340} groundY={244} scale={0.9} skin={p.skin[2]} cloth={p.cloth[1]} hair={1} dir={-1} p={p} />
    <Shade x={340} y={244} rx={11} p={p} />
  </>
)

/** 2 — A surfer walking their board down to the water. */
const sceneSurfer: Scene = (p) => (
  <>
    <Backdrop p={p} sunX={92} />
    {/* a wave breaking behind them */}
    <path
      className="drift"
      d={`M180 ${HORIZON + 30} q 34 -22 70 -6 q 26 12 52 2 q -20 18 -60 16 q -44 -2 -62 -12 Z`}
      fill={p.foam}
      opacity="0.9"
    />
    <Swimmer x={268} y={HORIZON + 40} scale={0.8} skin={p.skin[1]} p={p} />
    <g transform="translate(150 246)">
      <Shade x={10} y={0} rx={30} p={p} />
      {/* the board, carried under one arm */}
      <g transform="rotate(-9)">
        <ellipse cx="18" cy="-42" rx="12" ry="52" fill="#fffdf6" />
        <ellipse cx="18" cy="-42" rx="12" ry="52" fill="none" stroke={p.ink} strokeWidth="1.2" opacity="0.35" />
        <rect x="16.4" y="-88" width="3.2" height="92" rx="1.6" fill={p.cloth[0]} opacity="0.85" />
        <path d="M18 -94 q 9 22 0 40 q -9 -18 0 -40 Z" fill={p.cloth[1]} opacity="0.9" />
      </g>
      {/* the surfer, mid-stride */}
      <path d="M-8 0 L-12 -24 L-8 -25 L-2 -2 Z" fill={p.skin[0]} />
      <path d="M2 0 L2 -25 L6 -25 L8 -1 Z" fill={p.skin[0]} />
      <path d="M-9 -23 L8 -23 L7 -35 L-8 -35 Z" fill={p.cloth[2]} />
      <path d="M-8 -34 L7 -34 L5 -52 L-6 -52 Z" fill={p.skin[0]} />
      <path d="M5 -50 q 9 5 10 12" stroke={p.skin[0]} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M-6 -50 q -7 8 -5 16" stroke={p.skin[0]} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <rect x="-1.6" y="-56" width="3.2" height="5" fill={p.skin[0]} />
      <circle cx="0" cy="-61" r="5.6" fill={p.skin[0]} />
      <path d="M-5.8 -62 a5.8 5.8 0 0 1 11.6 0 q 0 8 -4 9 q 2 -7 -2 -8 q -3 -1 -5.6 -1 Z" fill={p.ink} />
    </g>
    <Palm x={366} groundY={250} h={96} p={p} />
  </>
)

/** 3 — Swimmers out past the break, watched from a towel on the sand. */
const sceneSwim: Scene = (p) => (
  <>
    <Backdrop p={p} sunX={200} />
    <Swimmer x={128} y={HORIZON + 26} scale={0.82} skin={p.skin[0]} p={p} />
    <Swimmer x={196} y={HORIZON + 36} scale={0.95} skin={p.skin[1]} p={p} />
    <Swimmer x={272} y={HORIZON + 28} scale={0.85} skin={p.skin[2]} p={p} />
    {/* an inflatable ring drifting, nobody in it */}
    <g transform={`translate(84 ${HORIZON + 40})`}>
      <ellipse cx="0" cy="0" rx="15" ry="6" fill={p.cloth[0]} />
      <ellipse cx="0" cy="-1" rx="7.5" ry="2.8" fill={p.seaNear} />
    </g>
    {/* two on the sand, one waving back */}
    <Lying x={98} groundY={250} scale={1.2} skin={p.skin[1]} cloth={p.cloth[1]} towel={p.cloth[2]} p={p} />
    <g transform="translate(300 248)">
      <Shade x={0} y={0} rx={12} p={p} />
      <path d="M-5 0 L-4.5 -22 L-1 -22 L-1.5 0 Z" fill={p.skin[2]} />
      <path d="M1.5 0 L1 -22 L4.5 -22 L5 0 Z" fill={p.skin[2]} />
      <path d="M-6 -20 L6 -20 L5.5 -32 L-5.5 -32 Z" fill={p.cloth[0]} />
      <path d="M-5.5 -31 L5.5 -31 L4.5 -48 L-4.5 -48 Z" fill={p.skin[2]} />
      <path d="M-5 -47 q -5 8 -4 17" stroke={p.skin[2]} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* the wave */}
      <path d="M5 -47 q 9 -8 8 -19" stroke={p.skin[2]} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="13.5" cy="-68" r="2.6" fill={p.skin[2]} />
      <rect x="-1.5" y="-52" width="3" height="5" fill={p.skin[2]} />
      <circle cx="0" cy="-57" r="5.4" fill={p.skin[2]} />
      <path d="M-5.6 -58 a5.6 5.6 0 0 1 11.2 0 q -5.6 -4 -11.2 0 Z" fill={p.ink} />
      {/* sun hat */}
      <ellipse cx="0" cy="-61" rx="11" ry="3" fill={p.cloth[1]} />
      <path d="M-6 -61 a6 6 0 0 1 12 0 Z" fill={p.cloth[1]} />
    </g>
  </>
)

/** 4 — Sundowners at a thatched beach bar. */
const sceneBar: Scene = (p) => (
  <>
    <Backdrop p={p} sunX={72} />
    <Palm x={356} groundY={248} h={110} p={p} />
    <g transform="translate(212 250)">
      <Shade x={-6} y={0} rx={60} p={p} />
      {/* posts + thatch */}
      <rect x="-62" y="-58" width="5" height="58" fill="#7d5a37" />
      <rect x="52" y="-58" width="5" height="58" fill="#7d5a37" />
      <path d="M-78 -58 L74 -58 L52 -80 L-56 -80 Z" fill="#c99a52" />
      <g stroke="#a97c3c" strokeWidth="1.4" opacity="0.75">
        <path d="M-70 -58 L-50 -80" />
        <path d="M-48 -58 L-28 -80" />
        <path d="M-26 -58 L-6 -80" />
        <path d="M-4 -58 L16 -80" />
        <path d="M18 -58 L38 -80" />
        <path d="M40 -58 L58 -80" />
      </g>
      {/* counter */}
      <rect x="-66" y="-30" width="126" height="7" rx="2" fill="#8a6238" />
      <rect x="-64" y="-23" width="122" height="23" fill="#6f4e2c" />
      {/* bottles on the back shelf */}
      <g transform="translate(-40 -33)">
        <rect x="0" y="-9" width="5" height="9" rx="1.5" fill={p.cloth[2]} />
        <rect x="8" y="-12" width="5" height="12" rx="1.5" fill={p.cloth[1]} />
        <rect x="16" y="-8" width="5" height="8" rx="1.5" fill={p.cloth[0]} />
      </g>
      {/* two on stools, turned toward each other */}
      <g transform="translate(-30 0)">
        <rect x="-7" y="-14" width="14" height="3" rx="1.5" fill="#7d5a37" />
        <rect x="-1.5" y="-11" width="3" height="11" fill="#7d5a37" />
        <path d="M-7 -14 L7 -14 L6 -28 L-6 -28 Z" fill={p.cloth[0]} />
        <path d="M-6 -27 L6 -27 L5 -42 L-5 -42 Z" fill={p.skin[1]} />
        <path d="M5 -40 q 9 3 11 9" stroke={p.skin[1]} strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="-1.5" y="-46" width="3" height="5" fill={p.skin[1]} />
        <circle cx="0" cy="-51" r="5.2" fill={p.skin[1]} />
        <path d="M-5.4 -52 a5.4 5.4 0 0 1 10.8 0 q 0 9 -4 10 q 2 -8 -2 -9 q -3 -1 -4.8 -1 Z" fill={p.ink} />
      </g>
      <g transform="translate(22 0)">
        <rect x="-7" y="-14" width="14" height="3" rx="1.5" fill="#7d5a37" />
        <rect x="-1.5" y="-11" width="3" height="11" fill="#7d5a37" />
        <path d="M-7 -14 L7 -14 L6 -28 L-6 -28 Z" fill={p.cloth[2]} />
        <path d="M-6 -27 L6 -27 L5 -43 L-5 -43 Z" fill={p.skin[0]} />
        <path d="M-5 -41 q -10 3 -12 9" stroke={p.skin[0]} strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="-1.5" y="-47" width="3" height="5" fill={p.skin[0]} />
        <circle cx="0" cy="-52" r="5.2" fill={p.skin[0]} />
        <path d="M-5.4 -53 a5.4 5.4 0 0 1 10.8 0 q -5.4 -4 -10.8 0 Z" fill={p.ink} />
      </g>
      {/* the two drinks they're reaching for */}
      <g transform="translate(-19 -30)">
        <path d="M-4 0 L4 0 L1.5 -9 L-1.5 -9 Z" fill={p.cloth[1]} opacity="0.9" transform="scale(1 -1)" />
        <circle cx="0" cy="-11" r="2.4" fill={p.cloth[0]} />
      </g>
      <g transform="translate(11 -30)">
        <path d="M-4 0 L4 0 L1.5 -9 L-1.5 -9 Z" fill={p.cloth[0]} opacity="0.9" transform="scale(1 -1)" />
        <rect x="1" y="-13" width="1.6" height="9" fill={p.cloth[2]} transform="rotate(14)" />
      </g>
    </g>
    {/* string lights along the front edge */}
    <path d="M150 172 q 62 16 124 0" stroke={p.ink} strokeWidth="1" fill="none" opacity="0.4" />
    <g fill={p.sun}>
      <circle cx="176" cy="179" r="2.6" className="pulse" />
      <circle cx="212" cy="181" r="2.6" />
      <circle cx="248" cy="179" r="2.6" className="pulse" />
    </g>
  </>
)

/** 5 — A traveller with a suitcase, arriving, taking in the view. */
const sceneArrival: Scene = (p) => (
  <>
    <Backdrop p={p} sunX={286} />
    {/* a small boat on the horizon */}
    <g transform={`translate(96 ${HORIZON + 16})`}>
      <path d="M-11 0 L11 0 L7 5 L-7 5 Z" fill={p.ink} opacity="0.8" />
      <path d="M0 -1 L0 -15 L9 -1 Z" fill="#fffdf6" opacity="0.92" />
    </g>
    <Swimmer x={196} y={HORIZON + 42} scale={0.75} skin={p.skin[1]} p={p} />
    {/* figure seen from behind, facing the water */}
    <g transform="translate(178 254)">
      <Shade x={2} y={0} rx={20} p={p} />
      <path d="M-6 0 L-6 -26 L-2 -26 L-2 0 Z" fill={p.skin[1]} />
      <path d="M2 0 L2 -26 L6 -26 L6 0 Z" fill={p.skin[1]} />
      <path d="M-8 -24 L8 -24 L7 -40 L-7 -40 Z" fill={p.cloth[1]} />
      {/* loose linen shirt */}
      <path d="M-9 -38 L9 -38 L8 -60 L-8 -60 Z" fill="#fffdf6" />
      <path d="M-8 -58 q -6 11 -5 20" stroke="#fffdf6" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M8 -58 q 7 10 8 18" stroke="#fffdf6" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M-4 -37 L4 -37 L4 -34 L-4 -34 Z" fill={p.shadow} opacity="0.4" />
      <rect x="-2" y="-64" width="4" height="5" fill={p.skin[1]} />
      <circle cx="0" cy="-69" r="6" fill={p.skin[1]} />
      {/* hair, gathered up — we're behind them */}
      <path d="M-6 -70 a6 6 0 0 1 12 0 q 0 6 -6 6 q -6 0 -6 -6 Z" fill={p.ink} />
      <circle cx="0" cy="-76" r="3.4" fill={p.ink} />
      {/* straw hat, held down at their side */}
      <g transform="translate(20 -22) rotate(12)">
        <ellipse cx="0" cy="0" rx="10" ry="10" fill={p.cloth[1]} />
        <ellipse cx="0" cy="0" rx="5" ry="5" fill={p.sandShade} />
      </g>
    </g>
    {/* the suitcase, set down in the sand */}
    <g transform="translate(226 254)">
      <Shade x={0} y={0} rx={18} p={p} />
      <rect x="-15" y="-24" width="30" height="24" rx="3" fill={p.cloth[2]} />
      <rect x="-15" y="-14" width="30" height="2.5" fill={p.sand} opacity="0.85" />
      <rect x="-6" y="-29" width="12" height="6" rx="3" fill="none" stroke={p.cloth[2]} strokeWidth="2.4" />
      <rect x="-11" y="-21" width="7" height="5" rx="1" fill={p.cloth[1]} />
    </g>
    <Palm x={54} groundY={254} h={118} dir={-1} p={p} />
  </>
)

/** 6 — A hammock strung between two palms, one occupant, fast asleep. */
const sceneHammock: Scene = (p) => (
  <>
    <Backdrop p={p} sunX={200} />
    <Palm x={70} groundY={256} h={128} dir={-1} p={p} />
    <Palm x={330} groundY={256} h={122} p={p} />
    {/* hammock slung between the trunks */}
    <g transform="translate(0 0)">
      <path d="M92 148 q 108 62 216 0" stroke={p.ink} strokeWidth="1.6" fill="none" opacity="0.5" />
      <path d="M96 152 q 104 76 208 0 q -104 30 -208 0 Z" fill={p.cloth[1]} />
      <path d="M96 152 q 104 76 208 0 q -104 30 -208 0 Z" fill={p.shadow} opacity="0.22" />
      <g stroke={p.cloth[0]} strokeWidth="1.2" opacity="0.6">
        <path d="M124 160 q 4 22 6 24" />
        <path d="M158 172 q 3 18 4 20" />
        <path d="M200 178 q 1 17 1 19" />
        <path d="M242 172 q -3 18 -4 20" />
        <path d="M276 160 q -4 22 -6 24" />
      </g>
      {/* the sleeper, and one arm hanging out */}
      <g transform="translate(200 168)">
        <path d="M-58 4 q 58 -22 116 0 q -58 14 -116 0 Z" fill={p.skin[1]} />
        <path d="M-14 2 q 30 -12 52 -2 q -26 8 -52 2 Z" fill={p.cloth[2]} />
        <circle cx="-62" cy="-2" r="6.4" fill={p.skin[1]} />
        <path d="M-68.4 -3 a6.4 6.4 0 0 1 12.8 0 q -6.4 -4.5 -12.8 0 Z" fill={p.ink} />
        {/* the hat over the face — the universal sign for "do not disturb" */}
        <ellipse cx="-62" cy="-5" rx="12" ry="4" fill={p.cloth[1]} transform="rotate(-14 -62 -5)" />
        <path d="M-68 -5 a6 6 0 0 1 12 0 Z" fill={p.cloth[1]} transform="rotate(-14 -62 -5)" />
        <path d="M14 6 q 8 14 4 24" stroke={p.skin[1]} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      </g>
    </g>
    {/* a book, face-down in the sand where it was dropped */}
    <g transform="translate(228 250)">
      <Shade x={0} y={2} rx={12} p={p} />
      <path d="M-11 0 L11 -2 L10 -6 L-10 -4 Z" fill={p.cloth[0]} />
      <path d="M-10 -4 L10 -6 L9 -7.5 L-9 -5.5 Z" fill="#fffdf6" />
    </g>
    <g fill={p.ink} opacity="0.5">
      <ellipse cx="150" cy="248" rx="7" ry="3" transform="rotate(-12 150 248)" />
      <ellipse cx="163" cy="253" rx="7" ry="3" transform="rotate(8 163 253)" />
    </g>
  </>
)

export const SCENES: { key: string; label: string; render: Scene }[] = [
  { key: "parasol", label: "Two under a parasol", render: sceneParasol },
  { key: "surfer", label: "Walking the board down", render: sceneSurfer },
  { key: "swim", label: "Out past the break", render: sceneSwim },
  { key: "bar", label: "Sundowners at the beach bar", render: sceneBar },
  { key: "arrival", label: "Just arrived", render: sceneArrival },
  { key: "hammock", label: "Nothing on the agenda", render: sceneHammock },
]

/**
 * The postcard front. `seed` (a destination slug) picks scene + palette
 * deterministically; pass `scene`/`palette` to override for the hero.
 */
export function PosterArt({
  seed = "",
  scene,
  palette,
  className,
}: {
  seed?: string
  scene?: string
  palette?: string
  className?: string
}) {
  const h = hashString(seed || "ismytripsafe")
  const s = SCENES.find((x) => x.key === scene) ?? SCENES[h % SCENES.length]
  const p = PALETTES.find((x) => x.key === palette) ?? PALETTES[(h >>> 8) % PALETTES.length]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`Illustrated beach scene — ${s.label}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`sky-${p.key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyTop} />
          <stop offset="100%" stopColor={p.skyLow} />
        </linearGradient>
      </defs>
      {s.render(p)}
    </svg>
  )
}

// ─── Panorama ────────────────────────────────────────────────────────

const PW = 1200

/**
 * The wide hero band: the same beach, three times as long. Built from the
 * same primitives as the postcards so the homepage and the cards are
 * demonstrably the same world, not two illustrators.
 */
export function PanoramaArt({
  palette = "golden",
  className,
}: {
  palette?: string
  className?: string
}) {
  const p = PALETTES.find((x) => x.key === palette) ?? PALETTES[1]

  return (
    <svg
      viewBox={`0 0 ${PW} ${H}`}
      className={className}
      role="img"
      aria-label="Illustrated panorama of a beach — swimmers, sunbathers under a parasol, and people walking the shoreline"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id={`sky-pan-${p.key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyTop} />
          <stop offset="100%" stopColor={p.skyLow} />
        </linearGradient>
        <linearGradient id={`sky-${p.key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyTop} />
          <stop offset="100%" stopColor={p.skyLow} />
        </linearGradient>
      </defs>

      <Backdrop p={p} sunX={760} w={PW} />

      {/* Out on the water */}
      <Swimmer x={470} y={HORIZON + 30} scale={0.8} skin={p.skin[0]} p={p} />
      <Swimmer x={556} y={HORIZON + 41} scale={0.9} skin={p.skin[1]} p={p} />
      <Swimmer x={905} y={HORIZON + 34} scale={0.85} skin={p.skin[2]} p={p} />
      <g transform={`translate(660 ${HORIZON + 45})`}>
        <ellipse cx="0" cy="0" rx="16" ry="6" fill={p.cloth[0]} />
        <ellipse cx="0" cy="-1" rx="8" ry="2.8" fill={p.seaNear} />
      </g>
      {/* a small boat, far out */}
      <g transform={`translate(1050 ${HORIZON + 14})`}>
        <path d="M-11 0 L11 0 L7 5 L-7 5 Z" fill={p.ink} opacity="0.75" />
        <path d="M0 -1 L0 -15 L9 -1 Z" fill="#fffdf6" opacity="0.9" />
      </g>

      {/* Left: palms and the parasol camp */}
      <Palm x={62} groundY={258} h={132} dir={-1} p={p} />
      <Palm x={132} groundY={244} h={92} p={p} />
      <Parasol x={280} groundY={238} p={p} />
      <Lying x={330} groundY={242} scale={1.05} skin={p.skin[1]} cloth={p.cloth[0]} towel={p.cloth[2]} dir={-1} p={p} />
      <Lying x={244} groundY={254} scale={1.15} skin={p.skin[0]} cloth={p.cloth[1]} towel={p.cloth[0]} p={p} />

      {/* Middle: three walking the waterline */}
      <Shade x={452} y={248} rx={12} p={p} />
      <Standing x={452} groundY={248} scale={0.95} skin={p.skin[2]} cloth={p.cloth[0]} hair={1} p={p} />
      <Shade x={478} y={252} rx={13} p={p} />
      <Standing x={478} groundY={252} scale={1.02} skin={p.skin[1]} cloth={p.cloth[2]} hair={0} p={p} />
      <Shade x={504} y={247} rx={9} p={p} />
      <Standing x={504} groundY={247} scale={0.7} skin={p.skin[0]} cloth={p.cloth[1]} hair={2} p={p} />

      {/* A ball, mid-bounce, and the footprints leading to it */}
      <g transform="translate(596 224)">
        <circle cx="0" cy="0" r="11" fill="#fffdf6" />
        <path d="M0 -11 a11 11 0 0 1 9.5 5.5 q -9 4 -9.5 5.5 Z" fill={p.cloth[0]} />
        <path d="M0 11 a11 11 0 0 1 -9.5 -5.5 q 9 -4 9.5 -5.5 Z" fill={p.cloth[2]} />
      </g>
      <Shade x={596} y={252} rx={9} p={p} />
      <g fill={p.sandShade} opacity="0.85">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <ellipse cx={540 + i * 13} cy={256 + (i % 2) * 5} rx="4" ry="2" />
            <ellipse cx={546 + i * 13} cy={261 + (i % 2) * 5} rx="4" ry="2" />
          </g>
        ))}
      </g>

      {/* Right: the surfer heading out, board under one arm */}
      <g transform="translate(830 250)">
        <Shade x={10} y={0} rx={28} p={p} />
        <g transform="rotate(-9)">
          <ellipse cx="18" cy="-40" rx="11" ry="48" fill="#fffdf6" />
          <rect x="16.6" y="-84" width="2.8" height="86" rx="1.4" fill={p.cloth[0]} opacity="0.85" />
        </g>
        <path d="M-8 0 L-12 -24 L-8 -25 L-2 -2 Z" fill={p.skin[0]} />
        <path d="M2 0 L2 -25 L6 -25 L8 -1 Z" fill={p.skin[0]} />
        <path d="M-9 -23 L8 -23 L7 -35 L-8 -35 Z" fill={p.cloth[2]} />
        <path d="M-8 -34 L7 -34 L5 -52 L-6 -52 Z" fill={p.skin[0]} />
        <path d="M5 -50 q 9 5 10 12" stroke={p.skin[0]} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M-6 -50 q -7 8 -5 16" stroke={p.skin[0]} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <rect x="-1.6" y="-56" width="3.2" height="5" fill={p.skin[0]} />
        <circle cx="0" cy="-61" r="5.6" fill={p.skin[0]} />
        <path d="M-5.8 -62 a5.8 5.8 0 0 1 11.6 0 q 0 8 -4 9 q 2 -7 -2 -8 q -3 -1 -5.6 -1 Z" fill={p.ink} />
      </g>

      {/* Far right: a pair sitting with a cool box, and the last palm */}
      <Lying x={1000} groundY={256} scale={1.1} skin={p.skin[2]} cloth={p.cloth[1]} towel={p.cloth[2]} dir={-1} p={p} />
      <g transform="translate(1052 250)">
        <Shade x={6} y={2} rx={16} p={p} />
        <rect x="-12" y="-16" width="30" height="16" rx="2.5" fill={p.cloth[2]} />
        <rect x="-14" y="-20" width="34" height="5" rx="2.5" fill="#fffdf6" />
      </g>
      <Palm x={1148} groundY={260} h={126} p={p} />
    </svg>
  )
}
