"use client"

import { useState } from "react"
import { MapPin, ShieldQuestion } from "lucide-react"
import { CityAutocomplete } from "./CityAutocomplete"
import type { SafetyQuery, GeoPoint } from "@/lib/types"

interface SearchBarProps {
  onSubmit: (q: SafetyQuery) => void
  loading: boolean
}

export function SearchBar({ onSubmit, loading }: SearchBarProps) {
  const [place, setPlace] = useState("")
  const [placeGeo, setPlaceGeo] = useState<GeoPoint | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!place.trim()) return
    onSubmit({ place, placeGeo })
  }

  return (
    <form onSubmit={submit} className="card p-3 sm:p-3.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
        <div className="flex-1">
          <CityAutocomplete
            value={place}
            onChange={setPlace}
            onSelectPlace={setPlaceGeo}
            placeholder="Any city or country — “Is it safe?”"
            icon={<MapPin size={16} style={{ color: "var(--accent)" }} />}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !place.trim()}
          className="btn flex items-center justify-center gap-2 px-6 py-3 sm:py-0"
        >
          {loading ? (
            <>
              <span className="spin inline-block h-4 w-4 rounded-full border-2 border-[var(--paper)]/30 border-t-[var(--paper)]" />
              Checking…
            </>
          ) : (
            <>
              <ShieldQuestion size={17} /> Check safety
            </>
          )}
        </button>
      </div>
    </form>
  )
}
