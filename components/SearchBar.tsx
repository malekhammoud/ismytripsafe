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
    <form onSubmit={submit} className={compact ? "card p-2" : "card p-3 sm:p-4"}>
      <div
        className={
          compact
            ? "flex items-stretch gap-2"
            : "flex flex-col gap-3 sm:flex-row sm:items-stretch"
        }
      >
        <div className="min-w-0 flex-1">
          <CityAutocomplete
            value={place}
            onChange={setPlace}
            onSelectPlace={setPlaceGeo}
            placeholder={compact ? "e.g. Barcelona, Spain" : "Any city or country — “Is it safe?”"}
            icon={<MapPin size={compact ? 20 : 22} style={{ color: "var(--accent)" }} />}
            required
            compact={compact}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !place.trim()}
          aria-label="Check safety"
          className={
            compact
              ? "btn flex shrink-0 items-center justify-center px-4 py-2.5 text-base font-semibold"
              : "btn flex items-center justify-center gap-2.5 px-8 py-3.5 text-lg font-semibold sm:py-0"
          }
        >
          {loading ? (
            <>
              <span className="spin inline-block h-5 w-5 rounded-full border-2 border-[var(--paper)]/30 border-t-[var(--paper)]" />
              {!compact && "Checking…"}
            </>
          ) : (
            <>
              <ShieldQuestion size={compact ? 20 : 22} />
              {!compact && " Check safety"}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
