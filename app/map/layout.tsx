import type { Metadata } from "next"

// The map view is keyed entirely by ?place= query params and duplicates the
// report's zone data — keep crawlers on the canonical report pages instead.
export const metadata: Metadata = {
  title: "Safety Map",
  robots: { index: false, follow: true },
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children
}
