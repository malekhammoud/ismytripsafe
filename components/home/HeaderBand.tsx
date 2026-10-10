"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { SearchBar } from "@/components/SearchBar"
import { scoreColor } from "@/lib/safety-display"
import type { SafetyQuery } from "@/lib/types"

/**
 * The sun-washed hero — the home page's first screen, rebuilt around one
 * job: make the visitor feel welcomed, get the value in five seconds, and
 * leave exactly one thing to do (type a city).
 *
 *  · **One promise, one H1.** "Is your next trip safe?" — the question the
 *    visitor got here with, not a slogan about databases.
 *  · **One search bar.** No secondary search banner, no competing panel.
 *  · **Proof under the box, not theory beside it.** A row of real, live
 *    scores for famous cities (computed server-side from the report store —
 *    the numbers are whatever this minute's reports say), so the value lands
 *    before any click.
 *  · **Trust in one line.** "Official government advisories · 15+ databases"
 *    within arm's reach of the action, phrased as facts, not adjectives.
 *  · **Three postcards scattered at the flanks** (desktop only) so the
 *    composition feels like a pile of holiday cards, not a dashboard.
 */

export interface HeroChip {
  city: string
  path: string
  score: number
}

export function HeaderBand({
  chips,
  onSearch,
  loading,
}: {
  chips: HeroChip[]
  onSearch: (q: SafetyQuery) => void
  loading: boolean
}) {
  return (
    <header className="sh-hero">
      {/* Three real postcards, scattered and turned for the feel of a table
          of holiday mail. The same transport photos the marquee uses. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/photos/postcards/00000110-PHOTO-2026-08-04-23-38-18.jpg" alt="" aria-hidden className="sh-photo sh-photo--1" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/photos/postcards/00000111-PHOTO-2026-08-04-23-38-18.jpg" alt="" aria-hidden className="sh-photo sh-photo--2" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/photos/postcards/00000113-PHOTO-2026-08-04-23-38-18.jpg" alt="" aria-hidden className="sh-photo sh-photo--3" />

      <div className="sh-inner">
        <p className="sh-eyebrow">Your trip · One honest answer</p>
        <h1 className="sh-h1">Is your next trip safe?</h1>
        <p className="sh-sub">
          Type any city and get one honest 0–100 safety score for 1,100+ destinations —
          built from official government advisories and 15+ real databases, updated
          regularly. Free, in seconds.
        </p>

        <div className="sh-search">
          <SearchBar onSubmit={onSearch} loading={loading} />
        </div>
        <p className="sh-trust">Official government advisories · 15+ databases · Re-checked regularly</p>

        <div className="sh-chips">
          <span className="sh-chip sh-chip--free">
            <Sparkles size={13} />
            Free · no sign-up
          </span>
          {chips.map((c) => (
            <Link key={c.path} href={c.path} className="sh-chip">
              {c.city}
              <b style={{ color: scoreColor(c.score) }}>{c.score}</b>
              <span aria-hidden style={{ color: "var(--ink-faint)" }}>/100</span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}