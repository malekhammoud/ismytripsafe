import countries from "world-countries"
import type { CountryFacts } from "../types"

interface RawCountry {
  cca2: string
  cca3?: string
  region: string
  flag: string
  capital?: string[]
  currencies?: Record<string, { name: string; symbol?: string }>
  languages?: Record<string, string>
  name?: { common?: string; official?: string }
  altSpellings?: string[]
}

const byCode = new Map<string, RawCountry>(
  (countries as RawCountry[]).map((c) => [c.cca2, c])
)

const nameByCode = new Map<string, string>(
  (countries as Array<RawCountry & { name?: { common?: string } }>).map((c) => [
    c.cca2,
    c.name?.common ?? c.cca2,
  ])
)

/** Clean English country name from an ISO2 code (e.g. "BJ" → "Benin"). */
export function englishCountryName(iso2: string): string | null {
  return nameByCode.get(iso2.toUpperCase()) ?? null
}

/** ISO3 code from an ISO2 code (e.g. "MX" → "MEX") — OWID/WHO key on ISO3. */
export function iso3Code(iso2: string): string | null {
  return byCode.get(iso2.toUpperCase())?.cca3 ?? null
}

/** Normalize a country name for fuzzy matching across data sources. */
export function normalizeCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals
    .replace(/[^a-z\s]/g, " ") // drop punctuation
    .replace(/\b(the|republic|of|democratic|people|s|state|states|kingdom)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * All normalized name variants for an ISO2 code (common, official, alt
 * spellings, ISO3) — used to match free-text country names from external
 * feeds (e.g. the US State Department RSS) back to a country.
 */
/**
 * Raw (non-normalized) country names for substring matching against free
 * text — e.g. finding "Colombia" inside a CDC notice title. Only names longer
 * than 3 chars, to avoid spurious hits.
 */
export function countryMatchNames(iso2: string): string[] {
  const c = byCode.get(iso2.toUpperCase()) as
    | (RawCountry & { name?: { common?: string; official?: string } })
    | undefined
  if (!c) return []
  const names = new Set<string>()
  const add = (n?: string) => {
    if (n && n.length > 3) names.add(n)
  }
  add(c.name?.common)
  add(c.name?.official)
  c.altSpellings?.forEach(add)
  return Array.from(names)
}

export function countryNameVariants(iso2: string): Set<string> {
  const c = byCode.get(iso2.toUpperCase()) as
    | (RawCountry & { name?: { common?: string; official?: string } })
    | undefined
  const out = new Set<string>()
  if (!c) return out
  const add = (n?: string) => {
    if (!n) return
    const norm = normalizeCountryName(n)
    if (norm) out.add(norm)
  }
  add(c.name?.common)
  add(c.name?.official)
  c.altSpellings?.forEach(add)
  return out
}

/**
 * Static ISO country facts (currency, languages, region, flag) from the
 * bundled `world-countries` dataset — replaces the deprecated REST Countries
 * API. Synchronous, 100% reliable, no network.
 */
export function getCountryFacts(iso2: string): CountryFacts | null {
  const c = byCode.get(iso2)
  if (!c) return null

  let currency = "—"
  let currencySymbol = ""
  if (c.currencies) {
    const code = Object.keys(c.currencies)[0]
    if (code) {
      const cur = c.currencies[code]
      currency = `${cur.name} (${code})`
      currencySymbol = cur.symbol ?? ""
    }
  }

  return {
    currency,
    currencySymbol,
    languages: c.languages ? Object.values(c.languages) : [],
    region: c.region ?? "",
    flag: c.flag ?? "",
    capital: c.capital?.[0] ?? null,
  }
}
