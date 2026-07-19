// ─── Site identity (one place, used by metadata, JSON-LD, sitemap) ───

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ismytripsafe.com"
).replace(/\/$/, "")

export const SITE_NAME = "IsMyTripSafe"

export const SITE_TAGLINE =
  "One honest safety verdict for any city or country, backed by 15+ real databases."

export function absUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

/** "July 2026" — used in answer capsules and titles. */
export function monthYear(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  const valid = Number.isFinite(d.getTime()) ? d : new Date()
  return valid.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/** "18 July 2026" — visible last-updated dates. */
export function humanDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  const valid = Number.isFinite(d.getTime()) ? d : new Date()
  return valid.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}
