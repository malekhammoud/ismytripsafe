import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Fraunces } from "next/font/google"
import { SITE_URL } from "@/lib/site"
import { BetaRibbon, IS_BETA } from "@/components/beach/BetaRibbon"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
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
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <BetaRibbon />
        {children}
      </body>
    </html>
  )
}
