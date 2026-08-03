"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { GeoPoint } from "@/lib/types"

interface Suggestion {
  id: number
  name: string
  admin1?: string
  country: string
  countryCode: string
  lat: number
  lon: number
  timezone: string
  population: number | null
}

interface CityAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelectPlace?: (place: GeoPoint | null) => void
  placeholder?: string
  icon: React.ReactNode
  required?: boolean
}

// ISO2 country code → flag emoji
function flagOf(cc: string): string {
  if (!cc || cc.length !== 2) return ""
  return String.fromCodePoint(
    ...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

export function CityAutocomplete({
  value,
  onChange,
  onSelectPlace,
  placeholder,
  icon,
  required,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const justSelected = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)

  const fetchSuggestions = useCallback(async (q: string) => {
    const term = q.trim()
    if (term.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const myReq = ++reqId.current
    setLoading(true)
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          term
        )}&count=6&language=en&format=json`
      )
      const data = await res.json()
      if (myReq !== reqId.current) return // stale response
      const results: Suggestion[] = (data.results ?? []).map(
        (r: {
          id: number
          name: string
          admin1?: string
          country: string
          country_code: string
          latitude: number
          longitude: number
          timezone: string
          population?: number
        }) => ({
          id: r.id,
          name: r.name,
          admin1: r.admin1,
          country: r.country,
          countryCode: r.country_code,
          lat: r.latitude,
          lon: r.longitude,
          timezone: r.timezone,
          population: r.population ?? null,
        })
      )
      setSuggestions(results)
      setOpen(results.length > 0)
      setActive(-1)
    } catch {
      setSuggestions([])
    } finally {
      if (myReq === reqId.current) setLoading(false)
    }
  }, [])

  // Debounced fetch on value change
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 220)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
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
    const label = `${s.name}, ${s.country}`
    justSelected.current = true
    onChange(label)
    onSelectPlace?.({
      city: s.name,
      lat: s.lat,
      lon: s.lon,
      countryCode: s.countryCode,
      country: s.country,
      timezone: s.timezone,
      population: s.population,
    })
    setOpen(false)
    setSuggestions([])
    setActive(-1)
  }

  // When the user edits the text manually, invalidate any resolved place
  const handleType = (v: string) => {
    onChange(v)
    onSelectPlace?.(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => (a + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1))
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault()
        select(suggestions[active])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
        {icon}
      </span>
      <input
        className="field w-full bg-transparent px-9 py-3 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && (
        <ul
          className="glass-float absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-auto rounded-2xl p-1.5"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
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
                <span className="text-lg leading-none">{flagOf(s.countryCode)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--ink)]">
                    {s.name}
                  </span>
                  <span className="block truncate text-[0.72rem] text-[var(--ink-faint)]">
                    {[s.admin1, s.country].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-[var(--ink-faint)]">Searching…</li>
          )}
        </ul>
      )}
    </div>
  )
}
