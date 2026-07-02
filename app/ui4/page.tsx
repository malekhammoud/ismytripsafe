import {
  ShieldAlert,
  Gavel,
  HeartPulse,
  Newspaper,
  MapPin,
  Wind,
  Activity,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react"

/* ────────────────────────────────────────────────────────────
   IsMyTripSafe — UI mockup 4: "Traffic-Light Report"
   Static design mockup. All data hardcoded; no API calls.
   ──────────────────────────────────────────────────────────── */

type LampColor = "green" | "amber" | "red"

const LAMP: Record<
  LampColor,
  { core: string; mid: string; rim: string; glow: string; label: string }
> = {
  green: {
    core: "#7fe0b0",
    mid: "#2f9e6f",
    rim: "#1a6c48",
    glow: "rgba(47, 158, 111, 0.55)",
    label: "Clear",
  },
  amber: {
    core: "#ffd98f",
    mid: "#e0a23b",
    rim: "#9a6b1e",
    glow: "rgba(224, 162, 59, 0.55)",
    label: "Caution",
  },
  red: {
    core: "#ff9d8a",
    mid: "#d4503a",
    rim: "#8f2c1c",
    glow: "rgba(212, 80, 58, 0.55)",
    label: "Alert",
  },
}

/* ── Signal lamp: dark housing + glowing lens ── */
function TrafficLamp({
  color,
  side,
}: {
  color: LampColor
  side: "left" | "right"
}) {
  const c = LAMP[color]
  return (
    <div
      className={`flex-col items-center gap-2 self-center ${
        side === "right" ? "hidden lg:flex" : "hidden sm:flex"
      }`}
      aria-hidden={side === "right"}
    >
      {/* Housing */}
      <div
        className="relative flex h-[84px] w-[84px] items-center justify-center rounded-[22px]"
        style={{
          background: "linear-gradient(160deg, #2a303c 0%, #181c25 55%, #10131a 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 6px rgba(0,0,0,0.55), 0 2px 4px rgba(20,30,48,0.25), 0 14px 30px -10px rgba(20,30,48,0.45)",
          border: "1px solid rgba(0,0,0,0.5)",
        }}
      >
        {/* Recessed socket */}
        <div
          className="flex h-[58px] w-[58px] items-center justify-center rounded-full"
          style={{
            background: "#0b0e13",
            boxShadow: "inset 0 3px 8px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Lens */}
          <div
            className="relative h-[46px] w-[46px] rounded-full"
            style={{
              background: `radial-gradient(circle at 38% 32%, ${c.core} 0%, ${c.mid} 48%, ${c.rim} 100%)`,
              boxShadow: `0 0 18px 4px ${c.glow}, 0 0 44px 10px ${c.glow.replace("0.55", "0.25")}, inset 0 -4px 8px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.35)`,
            }}
          >
            {/* Gloss highlight */}
            <div
              className="absolute left-[8px] top-[5px] h-[12px] w-[20px] rounded-full"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0))",
                transform: "rotate(-18deg)",
                filter: "blur(0.5px)",
              }}
            />
          </div>
        </div>
      </div>
      <span
        className="text-[0.6rem] font-semibold uppercase tracking-[0.18em]"
        style={{ color: c.mid }}
      >
        {c.label}
      </span>
    </div>
  )
}

/* ── Small inline lamp for mobile headers ── */
function LampDot({ color }: { color: LampColor }) {
  const c = LAMP[color]
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full sm:hidden"
      style={{
        background: `radial-gradient(circle at 38% 32%, ${c.core}, ${c.mid} 60%, ${c.rim})`,
        boxShadow: `0 0 8px 2px ${c.glow}`,
      }}
    />
  )
}

/* ── Full-width section row flanked by lamps ── */
function SignalRow({
  color,
  icon,
  title,
  note,
  delay,
  children,
}: {
  color: LampColor
  icon: React.ReactNode
  title: string
  note: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <section
      className="rise-in flex items-stretch gap-5 md:gap-8"
      style={{ animationDelay: `${delay}ms` }}
    >
      <TrafficLamp color={color} side="left" />
      <div className="card min-w-0 flex-1 overflow-hidden">
        <header
          className="flex items-center gap-3 border-b px-5 py-4 sm:px-7"
          style={{ borderColor: "var(--hairline)" }}
        >
          <LampDot color={color} />
          <span style={{ color: LAMP[color].mid }}>{icon}</span>
          <h2 className="font-display text-lg" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
          <span className="ml-auto hidden text-xs sm:block" style={{ color: "var(--ink-faint)" }}>
            {note}
          </span>
        </header>
        <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
      <TrafficLamp color={color} side="right" />
    </section>
  )
}

/* ── Evidence signal bar ── */
function SignalBar({
  label,
  value,
  score,
  source,
}: {
  label: string
  value: string
  score: number
  source: string
}) {
  const tone =
    score >= 70 ? "var(--safe)" : score >= 45 ? "var(--moderate)" : "var(--risky)"
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5 py-2.5">
      <div className="min-w-0">
        <span className="text-[0.85rem] font-medium" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        <span className="ml-2 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
          {source}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
          {value}
        </span>
        <span className="tnum w-8 text-right text-[0.85rem] font-semibold" style={{ color: tone }}>
          {score}
        </span>
      </div>
      <div
        className="col-span-2 h-[5px] overflow-hidden rounded-full"
        style={{ background: "var(--paper-deep)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${tone}bb, ${tone})`,
          }}
        />
      </div>
    </div>
  )
}

/* ── Data ── */
const SIGNALS = [
  { label: "Homicide rate", value: "24.9 /100k", score: 26, source: "World Bank · 2023" },
  { label: "Road traffic deaths", value: "12.7 /100k", score: 59, source: "World Bank · 2021" },
  { label: "Armed-conflict deaths", value: "None reported", score: 100, source: "World Bank · 2023" },
  { label: "Political stability", value: "28/100", score: 28, source: "WGI · 2024" },
  { label: "Rule of law", value: "31/100", score: 31, source: "WGI · 2024" },
  { label: "Control of corruption", value: "22/100", score: 22, source: "WGI · 2024" },
  { label: "Government effectiveness", value: "45/100", score: 45, source: "WGI · 2024" },
]

const COMPARISON = [
  { name: "Japan", v: 0.2 },
  { name: "Switzerland", v: 0.5 },
  { name: "US", v: 5.7 },
  { name: "World avg", v: 5.8 },
  { name: "Brazil", v: 21.3 },
  { name: "Mexico", v: 24.9, self: true },
  { name: "South Africa", v: 41.9 },
]

const NEWS = [
  { text: "Tourist areas saw increased National Guard patrols in June 2026", tone: "good" },
  { text: "Pickpocketing spike reported on Metro Line 2", tone: "warn" },
  { text: "No major unrest in the capital in the past 90 days", tone: "good" },
]

export default function UI4Page() {
  return (
    <div className="relative z-10 min-h-screen">
      {/* ── Brand header ── */}
      <header
        className="border-b"
        style={{ borderColor: "var(--hairline)", background: "var(--glass-strong)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            {/* mini traffic-light mark */}
            <div
              className="flex h-8 w-4 flex-col items-center justify-center gap-[3px] rounded-[6px]"
              style={{
                background: "linear-gradient(160deg, #2a303c, #10131a)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(20,30,48,0.3)",
              }}
            >
              {(["red", "amber", "green"] as LampColor[]).map((c) => (
                <span
                  key={c}
                  className="h-[6px] w-[6px] rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${LAMP[c].core}, ${LAMP[c].mid})`,
                    boxShadow: `0 0 4px 1px ${LAMP[c].glow}`,
                  }}
                />
              ))}
            </div>
            <span className="wordmark text-xl" style={{ color: "var(--ink)" }}>
              IsMyTripSafe
              <span style={{ color: "var(--ink-faint)" }}>.com</span>
            </span>
          </div>
          <p className="hidden text-[0.82rem] italic sm:block" style={{ color: "var(--ink-soft)" }}>
            One destination, one click, one report
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8">
        {/* ── Destination masthead ── */}
        <div className="rise-in text-center" style={{ animationDelay: "0ms" }}>
          <p className="eyebrow mb-3">Safety Report · Assessed 2 Jul 2026</p>
          <h1 className="display-lg" style={{ color: "var(--ink)" }}>
            Mexico City, Mexico{" "}
            <span className="align-middle text-[0.6em]">🇲🇽</span>
          </h1>
        </div>

        {/* ── Rating banner ── */}
        <div
          className="rise-in mx-auto mt-8 flex max-w-2xl items-center justify-center gap-4 rounded-2xl border px-6 py-3.5"
          style={{
            animationDelay: "80ms",
            background: "linear-gradient(180deg, rgba(224,138,59,0.14), rgba(224,138,59,0.08))",
            borderColor: "rgba(224,138,59,0.35)",
          }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--caution)" }} />
          <p className="text-center">
            <span className="tnum font-display text-2xl font-semibold" style={{ color: "var(--caution)" }}>
              Rating 47<span className="text-base font-normal" style={{ color: "var(--ink-faint)" }}>/100</span>
            </span>
            <span className="mx-3 hidden sm:inline" style={{ color: "var(--hairline)" }}>|</span>
            <span className="block text-[0.85rem] sm:inline" style={{ color: "var(--ink-soft)" }}>
              <strong style={{ color: "var(--caution)" }}>Caution advised</strong> · Safer than ~38% of countries
            </span>
          </p>
        </div>

        {/* ── Executive summary ── */}
        <div className="rise-in mx-auto mt-12 max-w-2xl text-center" style={{ animationDelay: "160ms" }}>
          <h2 className="font-display text-xl" style={{ color: "var(--ink)" }}>
            Executive Summary
          </h2>
          <div className="hairline mx-auto my-4 w-24" />
          <p className="text-[0.98rem] leading-[1.85]" style={{ color: "var(--ink-soft)" }}>
            Mexico City is manageable for informed travelers who stay in well-trodden
            districts, but the country-level data shows serious violent-crime and
            rule-of-law weaknesses. Stick to <strong style={{ color: "var(--ink)" }}>Polanco</strong>,{" "}
            <strong style={{ color: "var(--ink)" }}>Roma Norte</strong>,{" "}
            <strong style={{ color: "var(--ink)" }}>Condesa</strong> and{" "}
            <strong style={{ color: "var(--ink)" }}>Coyoacán</strong>, use Uber rather than
            street taxis, and keep valuables out of sight.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[0.75rem]">
            <span className="label">Safe areas</span>
            {["Polanco", "Roma Norte", "Condesa", "Coyoacán"].map((a) => (
              <span
                key={a}
                className="rounded-full border px-2.5 py-0.5 font-medium"
                style={{
                  background: "rgba(47,158,111,0.1)",
                  borderColor: "rgba(47,158,111,0.28)",
                  color: "#1e7a52",
                }}
              >
                {a}
              </span>
            ))}
            <span className="label ml-2">Avoid</span>
            {["Tepito", "Doctores (after dark)", "Iztapalapa"].map((a) => (
              <span
                key={a}
                className="rounded-full border px-2.5 py-0.5 font-medium"
                style={{
                  background: "rgba(212,80,58,0.08)",
                  borderColor: "rgba(212,80,58,0.25)",
                  color: "#a33325",
                }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* ── Signal rows ── */}
        <div className="mt-14 flex flex-col gap-8">
          {/* 1 · Travel Advisories — RED */}
          <SignalRow
            color="red"
            icon={<ShieldAlert className="h-[18px] w-[18px]" />}
            title="Travel Advisories"
            note="2 official government sources"
            delay={240}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <article
                className="rounded-xl border p-4"
                style={{ borderColor: "rgba(200,151,63,0.35)", background: "rgba(200,151,63,0.06)" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="label" style={{ color: "var(--ink-soft)" }}>
                    U.S. Department of State
                  </span>
                  <span
                    className="tnum rounded-md px-2 py-0.5 text-[0.7rem] font-bold"
                    style={{ background: "var(--moderate)", color: "#fff" }}
                  >
                    LEVEL 2
                  </span>
                </div>
                <h3 className="mb-1.5 text-[0.92rem] font-semibold" style={{ color: "var(--ink)" }}>
                  Exercise Increased Caution
                </h3>
                <p className="text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  &ldquo;Exercise increased caution due to crime and kidnapping. Some areas
                  have increased risk.&rdquo;
                </p>
                <p className="mt-2.5 flex items-center gap-1 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                  Updated Jun 2026 <ExternalLink className="h-3 w-3" />
                </p>
              </article>
              <article
                className="rounded-xl border p-4"
                style={{ borderColor: "rgba(212,80,58,0.35)", background: "rgba(212,80,58,0.05)" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="label" style={{ color: "var(--ink-soft)" }}>
                    UK Foreign Office (FCDO)
                  </span>
                  <span
                    className="tnum rounded-md px-2 py-0.5 text-[0.7rem] font-bold"
                    style={{ background: "var(--risky)", color: "#fff" }}
                  >
                    LEVEL 3
                  </span>
                </div>
                <h3 className="mb-1.5 text-[0.92rem] font-semibold" style={{ color: "var(--ink)" }}>
                  Against all-but-essential travel to parts
                </h3>
                <p className="text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  &ldquo;FCDO advises against all but essential travel to parts of Mexico.
                  Your travel insurance could be invalidated if you travel against
                  advice.&rdquo;
                </p>
                <p className="mt-2.5 flex items-center gap-1 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                  Updated Jun 2026 <ExternalLink className="h-3 w-3" />
                </p>
              </article>
            </div>
          </SignalRow>

          {/* 2 · Crime Index — AMBER */}
          <SignalRow
            color="amber"
            icon={<Gavel className="h-[18px] w-[18px]" />}
            title="Crime Index"
            note="World Bank · Worldwide Governance Indicators"
            delay={320}
          >
            <div className="divide-y divide-[rgba(20,30,48,0.07)]">
              {SIGNALS.map((s) => (
                <SignalBar key={s.label} {...s} />
              ))}
            </div>

            {/* Comparison scale */}
            <div className="mt-7">
              <p className="label mb-6">Homicide rate vs. other countries · per 100k</p>
              <div className="relative mx-1 mb-1 h-[6px] rounded-full" style={{ background: "linear-gradient(90deg, rgba(47,158,111,0.5), rgba(200,151,63,0.5), rgba(212,80,58,0.5))" }}>
                {COMPARISON.map((c, i) => (
                  <div
                    key={c.name}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${(c.v / 45) * 100}%` }}
                  >
                    <span
                      className="block rounded-full border-2 border-white"
                      style={{
                        width: c.self ? 16 : 10,
                        height: c.self ? 16 : 10,
                        background: c.self ? "var(--risky)" : "var(--ink-faint)",
                        boxShadow: c.self ? "0 0 0 3px rgba(212,80,58,0.25)" : "none",
                      }}
                    />
                    <span
                      className={`tnum absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.62rem] ${
                        i % 2 === 0 ? "top-[16px]" : "bottom-[16px]"
                      } ${c.self ? "font-bold" : ""}`}
                      style={{ color: c.self ? "var(--risky)" : "var(--ink-faint)" }}
                    >
                      {c.name} {c.v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-8" />
            </div>
          </SignalRow>

          {/* 3 · Health & Air Quality — GREEN */}
          <SignalRow
            color="green"
            icon={<HeartPulse className="h-[18px] w-[18px]" />}
            title="Health & Air Quality"
            note="CDC · Open-Meteo · USGS"
            delay={400}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--hairline)" }}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Wind className="h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
                  <span className="label">Air Quality</span>
                </div>
                <p className="tnum font-display text-2xl" style={{ color: "var(--moderate)" }}>
                  AQI 72
                </p>
                <p className="text-[0.75rem]" style={{ color: "var(--ink-soft)" }}>
                  Moderate · US scale · live
                </p>
                <p className="mt-1 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                  Open-Meteo · score 78/100
                </p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--hairline)" }}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
                  <span className="label">Seismic</span>
                </div>
                <p className="tnum font-display text-2xl" style={{ color: "var(--moderate)" }}>
                  3 quakes
                </p>
                <p className="text-[0.75rem]" style={{ color: "var(--ink-soft)" }}>
                  Max M5.8 · last 90 days
                </p>
                <p className="mt-1 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                  USGS · score 62/100
                </p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--hairline)" }}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
                  <span className="label">Health Notices</span>
                </div>
                <p className="tnum font-display text-2xl" style={{ color: "var(--moderate)" }}>
                  2 notices
                </p>
                <p className="text-[0.75rem]" style={{ color: "var(--ink-soft)" }}>
                  Max level: Alert
                </p>
                <p className="mt-1 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                  CDC · score 60/100
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              <li
                className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[0.85rem]"
                style={{ borderColor: "rgba(224,138,59,0.3)", background: "rgba(224,138,59,0.06)", color: "var(--ink-soft)" }}
              >
                <span
                  className="tnum shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider"
                  style={{ background: "var(--caution)", color: "#fff" }}
                >
                  Alert
                </span>
                Rocky Mountain Spotted Fever in Mexico
              </li>
              <li
                className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[0.85rem]"
                style={{ borderColor: "var(--hairline)", background: "rgba(20,30,48,0.02)", color: "var(--ink-soft)" }}
              >
                <span
                  className="tnum shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider"
                  style={{ background: "var(--ink-faint)", color: "#fff" }}
                >
                  Watch
                </span>
                Salmonella Newport in Mexico
              </li>
            </ul>
          </SignalRow>

          {/* 4 · Recent News — GREEN */}
          <SignalRow
            color="green"
            icon={<Newspaper className="h-[18px] w-[18px]" />}
            title="Recent News"
            note="Past 90 days"
            delay={480}
          >
            <ul className="space-y-3.5">
              {NEWS.map((n) => (
                <li key={n.text} className="flex items-start gap-3 text-[0.9rem]" style={{ color: "var(--ink-soft)" }}>
                  {n.tone === "good" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--safe)" }} />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--caution)" }} />
                  )}
                  {n.text}
                </li>
              ))}
            </ul>
          </SignalRow>
        </div>

        {/* ── CTA ── */}
        <div className="rise-in mt-14 text-center" style={{ animationDelay: "560ms" }}>
          <a href="#" className="btn inline-flex items-center gap-2 px-6 py-3">
            Check another destination <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="wordmark text-sm" style={{ color: "var(--ink)" }}>
              IsMyTripSafe<span style={{ color: "var(--ink-faint)" }}>.com</span>
            </p>
            <p className="mt-1 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
              One destination, one click, one report
            </p>
          </div>
          <p className="max-w-md text-[0.7rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
            Sources: U.S. State Dept, UK FCDO, World Bank, WGI, USGS, CDC, Open-Meteo.
            Informational only — not a substitute for official government guidance.
          </p>
          <p className="flex items-center gap-1 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
            <MapPin className="h-3 w-3" /> Report generated 2 Jul 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
