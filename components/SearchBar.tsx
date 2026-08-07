"use client"

import { useState } from "react"
import { MapPin, ShieldQuestion } from "lucide-react"
import { CityAutocomplete } from "./CityAutocomplete"
import type { SafetyQuery, GeoPoint } from "@/lib/types"

interface SearchBarProps {
  onSubmit: (q: SafetyQuery) => void
  loading: boolean
  /**
   * The header's pill: one line, with the button reduced to its magnifier.
   * A labelled button inside a third of a header column leaves about ninety
   * pixels for the thing you are meant to type into.
   */
  compact?: boolean
}

export function SearchBar({ onSubmit, loading, compact = false }: SearchBarProps) {
  const [place, setPlace] = useState("")
  const [placeGeo, setPlaceGeo] = useState<GeoPoint | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!place.trim()) return
    onSubmit({ place, placeGeo })
  }

  return (
    <form onSubmit={submit} className={compact ? "card p-1.5" : "card p-3 sm:p-3.5"}>
      <div
        className={
          compact
            ? "flex items-stretch gap-1.5"
            : "flex flex-col gap-2.5 sm:flex-row sm:items-stretch"
        }
      >
        <div className="min-w-0 flex-1">
          <CityAutocomplete
            value={place}
            onChange={setPlace}
            onSelectPlace={setPlaceGeo}
            placeholder={compact ? "e.g. Barcelona, Spain" : "Any city or country — “Is it safe?”"}
            icon={<MapPin size={16} style={{ color: "var(--accent)" }} />}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !place.trim()}
          aria-label="Check safety"
          className={
            compact
              ? "btn flex shrink-0 items-center justify-center px-3.5"
              : "btn flex items-center justify-center gap-2 px-6 py-3 sm:py-0"
          }
        >
          {loading ? (
            <>
              <span className="spin inline-block h-4 w-4 rounded-full border-2 border-[var(--paper)]/30 border-t-[var(--paper)]" />
              {!compact && "Checking…"}
            </>
          ) : (
            <>
              <ShieldQuestion size={17} />
              {!compact && " Check safety"}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
