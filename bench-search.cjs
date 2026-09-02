// Runs against the tsc-compiled copy in .searchbench (see bench-search.mts)
const { searchPlace, matchCountryQuery } = require("./.searchbench/search.js")

const queries = [
  "spain", "spa", "mexi", "mexico", "mexico c", "usa", "uk", "holland", "czech republic",
  "barcelona", "barcellona", "is barcelona safe", "barcelona, spain", "bogota, us",
  "thailand", "bkk", "vegas", "la", "nyc", "machu picchu", "koh samui", "capri",
  "seoul", "santiago", "new york", "colombia", "col", "dominic", "dom", "fransisco",
  "venice", "florence italy", "tuscany", "langkawi", "phuket", "maldives",
  "ho chi minh", "hcmc", "sai gon", "istanbul", "reykjavik", "st petersburg",
  "queenstown", "nosara", "punta cana", "cabo", "varkala", "goa",
  "lisbon", "porto", "istanb", "beijing", "bangkok", "santorini", "greek islands",
  "yemen", "afghanistan", "congo", "south sudan", "american samoa", "puerto rico",
  "the maldives", "eiffel tower", "paris hotels", "antigua",
  "san jose", "guadalajara", "monterrey", "tulum", "hvar", "korcula", "milos",
  "kapadokya", "petra", "wadi rum", "agentina", "portugal", "bra",
]

;(async () => {
  const start = Date.now()
  for (const q of queries) {
    const { hits } = await searchPlace(q, 8)
    const top = hits
      .slice(0, 4)
      .map((h) => `${h.type === "country" ? "C" : "·"}${h.name}${h.inCountry ? "*" : ""}${h.tier === 1 ? "!" : ""}[${h.quality}]`)
    console.log(`${q.padEnd(20)} → ${top.join("  ")}`)
    const mc = matchCountryQuery(q)
    if (mc && !hits.some((h) => h.name === mc.name)) console.log(`   [rung0] ${mc.name} (${mc.countryCode})`)
  }
  console.log(`\n${queries.length} queries in ${Date.now() - start}ms`)
})()