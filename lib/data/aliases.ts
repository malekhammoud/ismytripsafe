// ─────────────────────────────────────────────────────────────────────
// Search aliases: names travellers actually type that are not in
// world-countries' `altSpellings`, a destination's official name, or the
// report index. Demonyns are generated mechanically from world-countries in
// lib/search.ts; this table holds the human-curated irregulars — historical
// names, abbreviations, colloquialisms, and famous landmarks that resolve to
// the city they sit in.
//
// Only strings that would NOT resolve well on their own belong here. Every
// city with a report already matches by its own name; aliasing those would
// only override clean matches (and break country-name matching, e.g. a
// "panama" alias must never shadow the country Panama).
// ─────────────────────────────────────────────────────────────────────

/** ISO2 → extra searchable names. */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  GB: ["Britain", "British", "United Kingdoms", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland", "UK"],
  US: ["America", "USA"],
  AE: ["Emirates", "UAE"],
  NL: ["Holland", "The Netherlands"],
  CZ: ["Republic of Czechia", "Czech Republic"],
  MV: ["The Maldives", "Maldive Islands"],
  BS: ["The Bahamas"],
  MM: ["Burma"],
  LK: ["Ceylon"],
  TH: ["Siam"],
  CI: ["Ivory Coast", "Cote d Ivoire"],
  TL: ["East Timor"],
  SZ: ["Swaziland"],
  MK: ["Macedonia", "Republic of Macedonia"],
  IR: ["Persia"],
  ET: ["Abyssinia"],
  CD: ["Zaire", "DR Congo", "D R Congo", "Congo Kinshasa", "Congo DRC"],
  CG: ["Congo Brazzaville"],
  ZW: ["Rhodesia"],
  TW: ["Formosa"],
  TR: ["Turkey", "Turkiye"],
  BF: ["Upper Volta"],
  CV: ["Cabo Verde"],
  VA: ["Vatican"],
  XK: ["Kosova"],
  MD: ["Moldavia"],
  KN: ["St Kitts", "Saint Kitts"],
  KR: ["South Korea", "Republic of Korea"],
  VN: ["Viet Nam"],
  LA: ["Lao", "Laos", "Lao PDR"],
  BA: ["Bosnia"],
  IL: ["State of Israel"],
  WS: ["Western Samoa"],
  VU: ["New Hebrides"],
  PF: ["Tahiti"],
  GR: ["Hellas"],
  CN: ["PRC"],
}

/**
 * Colloquial / abbreviated / landmark names → the canonical "City, Country"
 * form. Queries that exactly match a key (after normalization) are redirected
 * to the canonical form, which then resolves through the normal index or the
 * geocoder long tail. Kept deliberately small — see the file header.
 */
export const CITY_ALIASES: Record<string, string> = {
  // ── Airport-code-grade short forms ──
  "bkk": "Bangkok, Thailand",
  "hcmc": "Ho Chi Minh City, Vietnam",
  "saigon": "Ho Chi Minh City, Vietnam",
  "sai gon": "Ho Chi Minh City, Vietnam",
  "vegas": "Las Vegas, United States",
  "nyc": "New York, United States",
  "la": "Los Angeles, United States",
  "sf": "San Francisco, United States",
  "philly": "Philadelphia, United States",
  "dc": "Washington, United States",
  "washington dc": "Washington, United States",
  "rio": "Rio de Janeiro, Brazil",
  "cpt": "Cape Town, South Africa",
  "joburg": "Johannesburg, South Africa",
  "kl": "Kuala Lumpur, Malaysia",
  "hk": "Hong Kong, Hong Kong",
  "cuzco": "Cusco, Peru",
  "kiev": "Kyiv, Ukraine",
  "cabo": "Los Cabos, Mexico",
  "pdc": "Playa del Carmen, Mexico",
  "cdmx": "Mexico City, Mexico",
  "munchen": "Munich, Germany",
  "koln": "Cologne, Germany",
  "wien": "Vienna, Austria",
  "prag": "Prague, Czechia",
  "peking": "Beijing, China",
  "marrakech": "Marrakesh, Morocco",
  "casa blanca": "Casablanca, Morocco",
  "st petersburg": "St Petersburg, Russia",
  "saint petersburg": "St Petersburg, Russia",
  "st pete": "St Petersburg, Russia",
  "new york city": "New York, United States",
  // ── Historical / redirecting names ──
  "constantinople": "Istanbul, Turkey",
  "stambul": "Istanbul, Turkey",
  "vatican city": "Vatican, Vatican",
  "monte carlo": "Monte Carlo, Monaco",
  "st barth": "St Barthelemy, St Barthelemy",
  "st barthelemy": "St Barthelemy, St Barthelemy",
  "galapagos islands": "Galapagos, Ecuador",
  "cape verde islands": "Praia, Cape Verde",
  "zanzibar island": "Zanzibar, Tanzania",
  "the maldives island": "Malé, Maldives",
  "santorini islands": "Santorini, Greece",
  "phi phi islands": "Phi Phi Islands, Thailand",
  "andorra la vella": "Andorra la Vella, Andorra",
  "vatican": "Vatican, Vatican",
  "quebec city": "Quebec City, Canada",
  "quebec": "Quebec City, Canada",
  "martinique": "Fort-de-France, Martinique",
  "reunion island": "Saint-Denis, Réunion",
  // ── Famous landmarks → the city they sit in ──
  "eiffel tower": "Paris, France",
  "champs elysees": "Paris, France",
  "louvre": "Paris, France",
  "sagrada familia": "Barcelona, Spain",
  "park guell": "Barcelona, Spain",
  "la rambla": "Barcelona, Spain",
  "tower of london": "London, United Kingdom",
  "big ben": "London, United Kingdom",
  "colosseum": "Rome, Italy",
  "sistine chapel": "Rome, Italy",
  "stonehenge": "Salisbury, United Kingdom",
  "machu picchu": "Cusco, Peru",
  "great barrier reef": "Cairns, Australia",
  "uluru": "Uluru, Australia",
  "ayers rock": "Uluru, Australia",
  "disney world": "Orlando, United States",
  "disneyland": "Anaheim, United States",
  "hollywood": "Los Angeles, United States",
  "strip las vegas": "Las Vegas, United States",
  "westminster": "London, United Kingdom",
  "amalfi coast": "Amalfi, Italy",
  "cinque terre": "Cinque Terre, Italy",
  // ── Popular places the report index does not (yet) cover — they would
  //    otherwise fall to the geocoder with no country hint ──
  "bali": "Bali, Indonesia",
  "goa": "Goa, India",
  "cebu": "Cebu, Philippines",
  "oaxaca": "Oaxaca, Mexico",
  "koh samui": "Koh Samui, Thailand",
  "koh phangan": "Koh Phangan, Thailand",
  "koh tao": "Koh Tao, Thailand",
  "phi phi": "Phi Phi Islands, Thailand",
  "krabi": "Krabi, Thailand",
  "railay beach": "Krabi, Thailand",
  "full moon party": "Koh Phangan, Thailand",
  "capri": "Capri, Italy",
  "tuscany": "Tuscany, Italy",
  "korcula": "Korcula, Croatia",
  "milos": "Milos, Greece",
  "varkala": "Varkala, India",
  "nosara": "Nosara, Costa Rica",
  "goreme": "Goreme, Turkey",
  "kapadokya": "Cappadocia, Turkey",
}