import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Fraunces } from "next/font/google"
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
  title: "Is It Safe? — Travel Safety Intelligence",
  description:
    "One honest safety verdict for any city or country, backed by 10+ real databases: crime, governance, health, air quality, nearby hospitals, weather and government advisory data.",
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
      <body className="min-h-full">{children}</body>
    </html>
  )
}
