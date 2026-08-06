import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Bodoni_Moda } from "next/font/google"
import { SITE_URL } from "@/lib/site"
import { BetaRibbon, IS_BETA } from "@/components/beach/BetaRibbon"
import "./globals.css"

// Two faces, and only two.
//
// Bodoni Moda for anything that carries the brand's voice — the headline, city
// names, scores. It is the face River's comps were set in, and a Didone reads
// like a masthead rather than a landing page, which is the register this site
// needs. Its optical-size axis is the reason it's this Bodoni and not another:
// hairline serifs are what usually make Didones fall apart below ~20px, and the
// axis thickens them automatically as the type gets smaller.
//
// Inter for everything else. Nothing about it is exciting, which is the point —
// it has real tabular figures for the score tables and it never draws attention
// away from the numbers.
//
// The variables are suffixed `-src` because `app/globals.css` composes the final
// `--font-display` / `--font-sans` from them with a fallback stack. Naming both
// the same thing made the token reference itself, which silently killed the
// size-adjusted fallback metrics next/font generates to prevent layout shift.
const inter = Inter({
  variable: "--font-sans-src",
  subsets: ["latin"],
  display: "swap",
})

const bodoni = Bodoni_Moda({
  variable: "--font-display-src",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "IsMyTripSafe — Is It Safe to Travel There? Data-Backed Safety Reports",
    template: "%s | IsMyTripSafe",
  },
  description:
    "One honest safety verdict for any city or country, backed by 15+ real databases: crime, governance, health, air quality, natural hazards, weather and official government advisories.",
  openGraph: {
    siteName: "IsMyTripSafe",
    type: "website",
  },
  // Beta is a second copy of the same 1000+ reports on a second hostname —
  // it must never be indexed. Belt and braces with app/robots.ts.
  robots: IS_BETA
    ? { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
    : { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bodoni.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <BetaRibbon />
        {children}
      </body>
    </html>
  )
}
