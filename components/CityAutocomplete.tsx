"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { GeoPoint } from "@/lib/types"

/**
 * A suggestion from the server engine (/api/search → lib/search.ts): a
 * country or a city we already have a report for, or a geocoder long-tail
 * hit. Mirrors SearchHit in lib/search.ts.
 */
interface Suggestion {
  type: "country" | "city"
  name: string
  country: string
  countryCode: string
  region?: string
  lat: number
  lon: number
  population: number | null
  flag: string
  tier: number
  hasReport: boolean
  path?: string
  quality: number
  inCountry?: boolean
  resolvedFrom?: string
}

interface CityAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelectPlace?: (place: GeoPoint | null) => void
  placeholder?: string
  icon: React.ReactNode
  required?: boolean
  compact?: boolean
}

// ISO2 country code → flag emoji
function flagOf(cc: string): string {
  if (!cc || cc.length !== 2) return ""
  return String.fromCodePoint(
    ...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

const DEBOUNCE_MS = 220
// The AI long tail only fires when the local engine found nothing — and then
// only after the traveller has stopped typing for a beat.
const RESOLVE_IDLE_MS = 550
const RESOLVE_MIN_LEN = 4

export function CityAutocomplete({
  value,
  onChange,
  onSelectPlace,
  placeholder,
  icon,
  required,
  compact = false,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [bestGuess, setBestGuess] = useState<Suggestion | null>(null)
  const [guessVisible, setGuessVisible] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const justSelected = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)

  const fetchSuggestions = useCallback(async (q: string) => {
    const term = q.trim()
    if (term.length < 2) {
      setSuggestions([])
      setOpen(false)
      setBestGuess(null)
      setGuessVisible(false)
      return
    }
    const myReq = ++reqId.current
    setLoading(true)
    let raw: Response
    try {
      raw = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`)
    } catch {
      // Engine unreachable — fall back to the direct geocoder so the box is
      // never dead. Best-effort; the server engine is the real path.
      try {
        raw = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            term
          )}&count=6&language=en&format=json`
        )
      } catch {
        if (myReq === reqId.current) {
          setSuggestions([])
          setLoading(false)
        }
        return
      }
    }
    try {
      const data = await raw.json()
      if (myReq !== reqId.current) return // stale response
      const direct = !/^\/api\/search/.test(raw.url ?? "")
      const results: Suggestion[] = (
        direct ? (data.results ?? []) : (data.hits ?? [])
      ).map((r: Record<string, unknown>) => {
        if (direct) {
          return {
            type: "city",
            name: String(r.name ?? ""),
            country: String(r.country ?? ""),
            countryCode: String(r.country_code ?? ""),
            region: r.admin1 ? String(r.admin1) : undefined,
            lat: Number(r.latitude),
            lon: Number(r.longitude),
            population: r.population == null ? null : Number(r.population),
            flag: "",
            tier: 0,
            hasReport: false,
            quality: 40,
          }
        }
        return r as unknown as Suggestion
      })
      setSuggestions(results)
      setOpen(results.length > 0)
      setActive(-1)
      if (myReq === reqId.current) setLoading(false)

      // AI long tail: the engine drew a blank. Ask the resolver (bounded,
      // cached server-side) only after the traveller pauses.
      if (!direct && results.length === 0 && term.length >= RESOLVE_MIN_LEN) {
        if (resolveRef.current) clearTimeout(resolveRef.current)
        resolveRef.current = setTimeout(async () => {
          if (reqId.current !== myReq) return
          try {
            const res = await fetch("/api/resolve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ q: term }),
            })
            const data = await res.json()
            if (reqId.current !== myReq) return
            if (data?.hit) {
              setBestGuess(data.hit as Suggestion)
              setGuessVisible(true)
              setOpen(true)
              setActive(-1)
            } else {
              setGuessVisible(false)
            }
          } catch {
            // silent — the box simply shows nothing
          }
        }, RESOLVE_IDLE_MS)
      } else if (resolveRef.current) {
        clearTimeout(resolveRef.current)
        setGuessVisible(false)
      }
    } catch {
      if (myReq === reqId.current) {
        setSuggestions([])
        setLoading(false)
      }
    }
  }, [])

  // Debounced fetch on value change
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (resolveRef.current) clearTimeout(resolveRef.current)
    }
  }, [value, fetchSuggestions])

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const select = (s: Suggestion) => {
    const isCountry = s.type === "country"
    const label = isCountry ? s.name : `${s.name}, ${s.country}`
    justSelected.current = true
    onChange(label)
    onSelectPlace?.({
      city: s.name,
      lat: s.lat,
      lon: s.lon,
      countryCode: s.countryCode,
      country: s.country,
      timezone: "",
      population: s.population,
    })
    setOpen(false)
    setSuggestions([])
    setBestGuess(null)
    setGuessVisible(false)
    setActive(-1)
  }

  // When the user edits the text manually, invalidate any resolved place
  const handleType = (v: string) => {
    onChange(v)
    onSelectPlace?.(null)
  }

  const list = [...(guessVisible && bestGuess ? [bestGuess] : []), ...suggestions]

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || list.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => (a + 1) % list.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a <= 0 ? list.length - 1 : a - 1))
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault()
        select(list[active])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <span className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 ${compact ? "left-3" : "left-4"}`}>
        {icon}
      </span>
      <input
        className={`field w-full bg-transparent font-medium ${
          compact
            ? "pl-10 pr-3 py-2.5 text-base sm:text-lg"
            : "pl-12 pr-4 py-3.5 text-lg sm:text-xl"
        }`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => list.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && list.length > 0 && (
        <ul
          className="glass-float absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-auto rounded-2xl p-1.5"
          role="listbox"
        >
          {guessVisible && bestGuess && (
            <li className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Best guess · {bestGuess.resolvedFrom ?? value.trim()}
            </li>
          )}
          {list.map((s, i) => {
            const isGuess = guessVisible && bestGuess && i === 0 && suggestions.length > 0
            const isCountry = s.type === "country"
            return (
              <li key={s.type + ":" + s.name + ":" + s.countryCode + ":" + s.lat} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(s)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: i === active ? "rgba(15,155,171,0.1)" : "transparent",
                  }}
                >
                  <span className="text-lg leading-none">{s.flag || flagOf(s.countryCode)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--ink)]">
                      {s.name}
                    </span>
                    <span className="block truncate text-[0.72rem] text-[var(--ink-faint)]">
                      {isCountry
                        ? [s.region, "Country"].filter(Boolean).join(" · ")
                        : s.country}
                    </span>
                  </span>
                  {(isGuess || s.tier === 1) && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider"
                      style={{
                        background: "rgba(15,155,171,0.12)",
                        color: "var(--accent-deep)",
                      }}
                    >
                      {isGuess ? "Best guess" : "Popular"}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {loading && list.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-[var(--ink-faint)]">Searching…</li>
          )}
        </ul>
      )}
    </div>
  )
}