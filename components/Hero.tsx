"use client"

import { useState } from "react"
import { MapPin, ShieldCheck, ShieldAlert } from "lucide-react"
import type { GeoPoint, SafetyReport } from "@/lib/types"
import { LEVELS } from "@/lib/safety-display"

interface HeroProps {
  place: GeoPoint
  safety: SafetyReport | null
  heroImage: string | null
  flag?: string
}

export function Hero({ place, safety, heroImage, flag }: HeroProps) {
  const [loaded, setLoaded] = useState(false)
  const cfg = safety ? LEVELS[safety.level] : null
  const safe = safety ? safety.index >= 66 : true

  return (
    <div
      className="relative w-full overflow-hidden rounded-[28px] shadow-[var(--shadow-float)]"
      style={{ height: "min(60vh, 540px)" }}
    >
      {heroImage && (
        <img
          src={heroImage}
          alt={place.city}
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loaded ? "opacity-100 kenburns" : "opacity-0"}`}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: heroImage
            ? "none"
            : "linear-gradient(135deg, #149ba8 0%, #1f74cf 55%, #14538f 100%)",
          opacity: loaded && heroImage ? 0 : 1,
          transition: "opacity 0.7s",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(16,20,28,0.9) 0%, rgba(16,20,28,0.4) 42%, rgba(16,20,28,0.05) 62%, rgba(16,20,28,0.3) 100%)",
        }}
      />

      {/* Top meta */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-6">
        <div className="chip flex items-center gap-1.5 px-3 py-1.5 text-xs">
          <MapPin size={12} />
          {flag} {place.country}
        </div>
        {safety && (
          <div className="chip px-3 py-1.5 text-xs font-medium">
            Safety {safety.index}/100
          </div>
        )}
      </div>

      {/* Bottom — the verdict */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-9">
        <p className="mb-1 text-sm font-medium tracking-wide text-white/70 rise-in">
          Is it safe to visit
        </p>
        <h1 className="display-xl text-white drop-shadow-sm rise-in" style={{ animationDelay: "0.05s" }}>
          {place.city}?
        </h1>

        {cfg && (
          <div
            className="mt-4 inline-flex items-center gap-3 rounded-2xl px-4 py-3 rise-in"
            style={{
              animationDelay: "0.2s",
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(14px) saturate(1.3)",
              WebkitBackdropFilter: "blur(14px) saturate(1.3)",
              border: `1px solid ${cfg.color}88`,
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: cfg.color }}
            >
              {safe ? (
                <ShieldCheck size={22} className="text-white" />
              ) : (
                <ShieldAlert size={22} className="text-white" />
              )}
            </div>
            <div>
              <div className="text-lg font-bold leading-tight text-white">
                {cfg.answer}
              </div>
              {safety?.saferThanPct != null && (
                <div className="text-xs text-white/75">
                  Safer than ~{safety.saferThanPct}% of countries
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
