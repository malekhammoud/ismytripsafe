const SOURCE_RULES: Array<{ test: RegExp; url: string }> = [
  { test: /u\.?\s*s\.?\s*department of state|us state dept|travel\.state\.gov/i, url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" },
  { test: /uk foreign office|fcdo|gov\.uk\/foreign-travel-advice/i, url: "https://www.gov.uk/foreign-travel-advice" },
  { test: /government of canada|travel\.gc\.ca/i, url: "https://travel.gc.ca/travelling/advisories" },
  { test: /gdacs/i, url: "https://www.gdacs.org/" },
  { test: /usgs/i, url: "https://earthquake.usgs.gov/earthquakes/map/" },
  { test: /wikivoyage/i, url: "https://en.wikivoyage.org/" },
  { test: /world bank governance indicators|wgi/i, url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators" },
  { test: /world bank|wdi|world bank open data/i, url: "https://data.worldbank.org/" },
  { test: /cdc|travelers'? health/i, url: "https://wwwnc.cdc.gov/travel/notices" },
  { test: /un sdg|sdg global database/i, url: "https://unstats.un.org/sdgs/dataportal" },
  { test: /unodc/i, url: "https://dataunodc.un.org/" },
  { test: /who global health observatory|who gho/i, url: "https://www.who.int/data/gho" },
  { test: /global terrorism database|gtd/i, url: "https://www.start.umd.edu/gtd/" },
  { test: /v-dem/i, url: "https://ourworldindata.org/grapher/rule-of-law-index" },
  { test: /our world in data|owid/i, url: "https://ourworldindata.org/" },
  { test: /numbeo/i, url: "https://www.numbeo.com/crime/" },
  { test: /world bank enterprise/i, url: "https://www.enterprisesurveys.org/" },
  { test: /open-meteo air quality/i, url: "https://open-meteo.com/en/docs/air-quality-api" },
  { test: /open-meteo/i, url: "https://open-meteo.com/en/docs" },
  { test: /openstreetmap|nominatim/i, url: "https://www.openstreetmap.org/" },
]

export function sourceUrlForName(name: string | null | undefined): string | null {
  if (!name) return null
  const hit = SOURCE_RULES.find((r) => r.test.test(name))
  return hit?.url ?? null
}

export function extractSourceLinksFromText(text: string): string[] {
  if (!text) return []
  const links = new Set<string>()
  const markdown = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/gi
  const plain = /(https?:\/\/[^\s)]+)/gi

  let m: RegExpExecArray | null
  while ((m = markdown.exec(text))) links.add(m[1])
  while ((m = plain.exec(text))) links.add(m[1].replace(/[.,;!?]+$/, ""))

  return Array.from(links)
}

export function sourceUrlForSearchQuery(query: string | null | undefined): string | null {
  if (!query) return null
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
}
