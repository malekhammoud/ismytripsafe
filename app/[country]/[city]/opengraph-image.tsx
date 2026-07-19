import { ImageResponse } from "next/og"
import { getCityReport } from "@/lib/reports"
import { LEVELS } from "@/lib/safety-display"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Travel safety score card"

function tint(score: number): string {
  if (score >= 70) return "#2f9e6f"
  if (score >= 55) return "#c8973f"
  if (score >= 40) return "#e08a3b"
  return "#d4503a"
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
          padding: 64,
          color: "#eef2f8",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 30, letterSpacing: 1, color: "rgba(238,242,248,0.75)" }}>
            IsMyTripSafe.com
          </div>
          <div style={{ fontSize: 24, color: "rgba(238,242,248,0.5)" }}>Safety Report</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: 130,
              border: `14px solid ${color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(238,242,248,0.06)",
            }}
          >
            <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>
              {score != null ? String(score) : "?"}
            </div>
            <div style={{ fontSize: 26, color: "rgba(238,242,248,0.6)" }}>/ 100</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
              {`Is ${cityName} safe?`}
            </div>
            <div style={{ fontSize: 32, marginTop: 14, color: "rgba(238,242,248,0.7)" }}>
              {countryName}
            </div>
            <div
              style={{
                marginTop: 28,
                fontSize: 32,
                fontWeight: 700,
                color: "#141922",
                background: color,
                padding: "12px 28px",
                borderRadius: 999,
                alignSelf: "flex-start",
              }}
            >
              {answer}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 24, color: "rgba(238,242,248,0.5)" }}>
          Advisories · crime data · governance · health · live hazards — 15+ sources, one score
        </div>
      </div>
    ),
    size
  )
}
