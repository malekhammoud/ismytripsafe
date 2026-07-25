import { ImageResponse } from "next/og"
import { getCityReport } from "@/lib/reports"
import { computeCategories, LEVELS, type CategoryScore } from "@/lib/safety-display"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Travel safety score card"

function tint(score: number): string {
  if (score >= 70) return "#2f9e6f"
  if (score >= 55) return "#c8973f"
  if (score >= 40) return "#e08a3b"
  return "#d4503a"
}

/**
 * One category score in the pyramid strip.
 *
 * Every div carries an explicit `display` — Satori (the renderer behind
 * ImageResponse) refuses to lay out a div with more than one child node
 * otherwise, and fails the whole card rather than that one element.
 */
function Tile({ cat, lead }: { cat: CategoryScore; lead: boolean }) {
  const color = cat.score != null ? tint(cat.score) : "#8a8f98"
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        gap: 6,
        padding: lead ? "14px 20px" : "11px 16px",
        borderRadius: 12,
        background: "rgba(238,242,248,0.07)",
        border: "1px solid rgba(238,242,248,0.16)",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: lead ? 19 : 17,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "rgba(238,242,248,0.62)",
        }}
      >
        {cat.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ display: "flex", fontSize: lead ? 40 : 32, fontWeight: 700, color: "#eef2f8", lineHeight: 1 }}>
          {cat.score ?? "—"}
        </div>
        <div style={{ display: "flex", fontSize: 15, color: "rgba(238,242,248,0.4)" }}>/100</div>
      </div>
      {/* score bar — the pyramid reads at a glance even in a small preview */}
      <div style={{ display: "flex", height: 5, borderRadius: 3, background: "rgba(238,242,248,0.14)" }}>
        <div
          style={{
            display: "flex",
            width: `${Math.max(0, Math.min(100, cat.score ?? 0))}%`,
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  )
}

export default async function Image({
  params,
}: {
  params: Promise<{ country: string; city: string }>
}) {
  const { country, city } = await params
  const hit = await getCityReport(country.toLowerCase(), city.toLowerCase())
  const cityName = hit?.meta.city ?? decodeURIComponent(city)
  const countryName = hit?.meta.country ?? decodeURIComponent(country)
  const score = hit?.meta.score ?? null
  const answer = hit ? LEVELS[hit.meta.level].answer : "Safety report"
  const color = score != null ? tint(score) : "#8a8f98"

  const categories = hit
    ? computeCategories(hit.report.bundle.safety.signals, hit.report.enrichment)
    : []
  const tier1 = categories.filter((c) => c.tier === 1)
  const tier2 = categories.filter((c) => c.tier === 2)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141922",
          padding: "44px 56px",
          color: "#eef2f8",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="30" height="30" viewBox="0 0 64 64">
              <path
                d="M32 4 C 20 4 9 8 9 8 L 9 28 C 9 44.5 19.5 55 32 61 C 44.5 55 55 44.5 55 28 L 55 8 C 55 8 44 4 32 4 Z"
                fill="#2b8ae6"
              />
              <path
                d="M19.5 32.5 L28 41 L45 21.5"
                fill="none"
                stroke="#f4f7fb"
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ fontSize: 26, letterSpacing: 1, color: "rgba(238,242,248,0.75)" }}>
              IsMyTripSafe.com
            </div>
          </div>
          <div style={{ fontSize: 22, color: "rgba(238,242,248,0.5)" }}>Safety Report</div>
        </div>

        {/* apex: the headline score beside the verdict */}
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 95,
              border: `12px solid ${color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(238,242,248,0.06)",
            }}
          >
            <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1 }}>
              {score != null ? String(score) : "?"}
            </div>
            <div style={{ fontSize: 22, color: "rgba(238,242,248,0.6)" }}>/ 100</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.1 }}>
              {`Is ${cityName} safe?`}
            </div>
            <div style={{ fontSize: 26, marginTop: 10, color: "rgba(238,242,248,0.7)" }}>
              {countryName}
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 27,
                fontWeight: 700,
                color: "#141922",
                background: color,
                padding: "10px 24px",
                borderRadius: 999,
                alignSelf: "flex-start",
              }}
            >
              {answer}
            </div>
          </div>
        </div>

        {/* base: the same score pyramid the page shows */}
        {categories.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {tier1.map((c) => (
                <Tile key={c.key} cat={c} lead />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {tier2.map((c) => (
                <Tile key={c.key} cat={c} lead={false} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 22, color: "rgba(238,242,248,0.5)" }}>
            Advisories · crime data · governance · health · live hazards — 15+ sources, one score
          </div>
        )}
      </div>
    ),
    size
  )
}
