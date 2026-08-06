import type { Metadata } from "next"
import { Instrument_Serif } from "next/font/google"
import { Newsreader } from "next/font/google"
import { Azeret_Mono } from "next/font/google"
import { SITE_URL } from "@/lib/site"
import { BetaRibbon, IS_BETA } from "@/components/beach/BetaRibbon"
import "./globals.css"

// Three faces, and each one has a job it never leaves.
//
// The product is two things at once — a daydream about going somewhere, and a
// measurement of whether you should. So the type is split down that seam and
// never blurred:
//
//   · **Instrument Serif** carries the feeling. The headline, the name of a
//     city on a postcard, the score on a report. High contrast, tight, and it
//     has the kind of italic you want the word "safe" set in.
//   · **Newsreader** carries the reading. It is a text serif drawn for
//     screens, with an optical-size axis, so a page of prose about street
//     crime in Budapest reads like a briefing rather than like a dashboard.
//   · **Azeret Mono** carries the measurement. Every number, every category
//     label, every date and source line. Nothing that is a fact is set in the
//     same face as something that is a mood, which is the whole rule.
//
// The variables are suffixed `-src` because `app/globals.css` composes the
// final tokens from them with fallback stacks. Naming both halves the same
// thing made the token reference itself, which silently killed the
// size-adjusted fallback metrics next/font generates to prevent layout shift.
const display = Instrument_Serif({
  variable: "--font-display-src",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
})

const text = Newsreader({
  variable: "--font-text-src",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
})

const mono = Azeret_Mono({
  variable: "--font-mono-src",
  subsets: ["latin"],
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
      className={`${display.variable} ${text.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <BetaRibbon />
        {children}
      </body>
    </html>
  )
}
