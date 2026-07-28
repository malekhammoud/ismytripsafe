// The destination work-list for batch report generation.
//
// Three tiers, generated highest-value-first so that if a run is interrupted
// (or the daily free-model quota runs out) the pages that matter most already
// exist:
//
//   1  Major global destinations — what people actually search.
//   2  Every country capital — derived from `world-countries`, so there are no
//      typos and no country is forgotten. Also the fix for thin country hubs:
//      a hub page with one child reads as templated boilerplate to a crawler,
//      and Search Console had been clustering them.
//   3  Secondary cities — long-tail coverage in countries people travel to.
//
// Cities are written "City, Country" because that is exactly what the search
// box takes, so every entry here is a query a real user could type.

import countries from "world-countries"

// ── Tier 1: the destinations with real search volume ────────────────
const TIER1 = [
  // Western Europe
  "Paris, France", "London, United Kingdom", "Rome, Italy", "Barcelona, Spain",
  "Amsterdam, Netherlands", "Berlin, Germany", "Madrid, Spain", "Lisbon, Portugal",
  "Vienna, Austria", "Prague, Czechia", "Venice, Italy", "Florence, Italy",
  "Milan, Italy", "Munich, Germany", "Dublin, Ireland", "Brussels, Belgium",
  "Copenhagen, Denmark", "Stockholm, Sweden", "Oslo, Norway", "Helsinki, Finland",
  "Zurich, Switzerland", "Geneva, Switzerland", "Edinburgh, United Kingdom",
  "Porto, Portugal", "Seville, Spain", "Valencia, Spain", "Naples, Italy",
  "Nice, France", "Lyon, France", "Marseille, France", "Hamburg, Germany",
  "Reykjavik, Iceland", "Athens, Greece", "Santorini, Greece", "Mykonos, Greece",
  // Central & Eastern Europe
  "Budapest, Hungary", "Warsaw, Poland", "Krakow, Poland", "Bucharest, Romania",
  "Sofia, Bulgaria", "Zagreb, Croatia", "Dubrovnik, Croatia", "Split, Croatia",
  "Ljubljana, Slovenia", "Bratislava, Slovakia", "Belgrade, Serbia",
  "Tallinn, Estonia", "Riga, Latvia", "Vilnius, Lithuania", "Kyiv, Ukraine",
  "Moscow, Russia", "Saint Petersburg, Russia", "Istanbul, Turkey",
  "Antalya, Turkey", "Cappadocia, Turkey", "Tbilisi, Georgia", "Yerevan, Armenia",
  // Asia
  "Tokyo, Japan", "Kyoto, Japan", "Osaka, Japan", "Seoul, South Korea",
  "Bangkok, Thailand", "Chiang Mai, Thailand", "Phuket, Thailand",
  "Singapore, Singapore", "Hong Kong, Hong Kong", "Shanghai, China",
  "Beijing, China", "Taipei, Taiwan", "Hanoi, Vietnam", "Ho Chi Minh City, Vietnam",
  "Da Nang, Vietnam", "Siem Reap, Cambodia", "Phnom Penh, Cambodia",
  "Kuala Lumpur, Malaysia", "Bali, Indonesia", "Jakarta, Indonesia",
  "Manila, Philippines", "Cebu, Philippines", "Delhi, India", "Mumbai, India",
  "Jaipur, India", "Goa, India", "Kathmandu, Nepal", "Colombo, Sri Lanka",
  "Malé, Maldives", "Vientiane, Laos", "Luang Prabang, Laos", "Yangon, Myanmar",
  "Ulaanbaatar, Mongolia", "Almaty, Kazakhstan", "Tashkent, Uzbekistan",
  "Samarkand, Uzbekistan",
  // Middle East
  "Dubai, United Arab Emirates", "Abu Dhabi, United Arab Emirates",
  "Doha, Qatar", "Tel Aviv, Israel", "Jerusalem, Israel", "Amman, Jordan",
  "Petra, Jordan", "Muscat, Oman", "Manama, Bahrain", "Riyadh, Saudi Arabia",
  "Jeddah, Saudi Arabia", "Beirut, Lebanon",
  // Africa
  "Cairo, Egypt", "Marrakesh, Morocco", "Casablanca, Morocco", "Fes, Morocco",
  "Cape Town, South Africa", "Johannesburg, South Africa", "Durban, South Africa",
  "Nairobi, Kenya", "Zanzibar, Tanzania", "Dar es Salaam, Tanzania",
  "Addis Ababa, Ethiopia", "Accra, Ghana", "Lagos, Nigeria", "Dakar, Senegal",
  "Tunis, Tunisia", "Kigali, Rwanda", "Victoria Falls, Zimbabwe",
  "Windhoek, Namibia", "Gaborone, Botswana", "Port Louis, Mauritius",
  // North America
  "New York, United States", "Los Angeles, United States", "Chicago, United States",
  "San Francisco, United States", "Las Vegas, United States", "Miami, United States",
  "Orlando, United States", "Boston, United States", "Seattle, United States",
  "Washington, United States", "New Orleans, United States", "Austin, United States",
  "Denver, United States", "San Diego, United States", "Honolulu, United States",
  "Philadelphia, United States", "Atlanta, United States", "Detroit, United States",
  "Toronto, Canada", "Vancouver, Canada", "Montreal, Canada", "Quebec City, Canada",
  "Calgary, Canada", "Mexico City, Mexico", "Cancun, Mexico", "Tulum, Mexico",
  "Guadalajara, Mexico", "Oaxaca, Mexico", "Playa del Carmen, Mexico",
  "Puerto Vallarta, Mexico", "Tijuana, Mexico", "Monterrey, Mexico",
  // Central America & Caribbean
  "Havana, Cuba", "San Juan, Puerto Rico", "Punta Cana, Dominican Republic",
  "Santo Domingo, Dominican Republic", "Kingston, Jamaica", "Montego Bay, Jamaica",
  "Nassau, Bahamas", "Bridgetown, Barbados", "San José, Costa Rica",
  "Panama City, Panama", "Antigua Guatemala, Guatemala", "Guatemala City, Guatemala",
  "San Salvador, El Salvador", "Tegucigalpa, Honduras", "Managua, Nicaragua",
  "Belize City, Belize",
  // South America
  "Rio de Janeiro, Brazil", "Sao Paulo, Brazil", "Salvador, Brazil",
  "Buenos Aires, Argentina", "Mendoza, Argentina", "Bariloche, Argentina",
  "Santiago, Chile", "Valparaiso, Chile", "Lima, Peru", "Cusco, Peru",
  "Bogota, Colombia", "Medellin, Colombia", "Cartagena, Colombia",
  "Quito, Ecuador", "Guayaquil, Ecuador", "La Paz, Bolivia", "Montevideo, Uruguay",
  "Asuncion, Paraguay", "Caracas, Venezuela", "Georgetown, Guyana",
  // Oceania
  "Sydney, Australia", "Melbourne, Australia", "Brisbane, Australia",
  "Perth, Australia", "Adelaide, Australia", "Cairns, Australia",
  "Gold Coast, Australia", "Auckland, New Zealand", "Queenstown, New Zealand",
  "Wellington, New Zealand", "Christchurch, New Zealand", "Suva, Fiji",
  "Nadi, Fiji", "Papeete, French Polynesia", "Port Moresby, Papua New Guinea",
]

// ── Tier 3: secondary cities, by country ────────────────────────────
// Long-tail coverage. Keyed by the country name `world-countries` uses, so the
// "City, Country" query the pipeline geocodes is unambiguous.
const SECONDARY = {
  "France": ["Bordeaux", "Toulouse", "Strasbourg", "Lille", "Nantes", "Montpellier", "Cannes", "Avignon", "Biarritz", "Rennes"],
  "Italy": ["Turin", "Bologna", "Verona", "Palermo", "Genoa", "Pisa", "Siena", "Bari", "Catania", "Amalfi"],
  "Spain": ["Bilbao", "Malaga", "Granada", "Alicante", "Zaragoza", "Cordoba", "San Sebastian", "Palma", "Toledo", "Santiago de Compostela"],
  "Germany": ["Frankfurt", "Cologne", "Dusseldorf", "Stuttgart", "Dresden", "Leipzig", "Nuremberg", "Heidelberg", "Bremen", "Hannover"],
  "United Kingdom": ["Manchester", "Liverpool", "Birmingham", "Glasgow", "Bristol", "Leeds", "Oxford", "Cambridge", "Cardiff", "Belfast", "Newcastle upon Tyne", "Brighton"],
  "Netherlands": ["Rotterdam", "Utrecht", "The Hague", "Eindhoven", "Maastricht", "Groningen"],
  "Portugal": ["Faro", "Coimbra", "Braga", "Funchal", "Sintra", "Albufeira"],
  "Greece": ["Thessaloniki", "Crete", "Rhodes", "Corfu", "Patras", "Heraklion"],
  "Switzerland": ["Basel", "Lausanne", "Lucerne", "Interlaken", "Zermatt", "Lugano"],
  "Austria": ["Salzburg", "Innsbruck", "Graz", "Linz", "Hallstatt"],
  "Belgium": ["Antwerp", "Bruges", "Ghent", "Liege", "Leuven"],
  "Ireland": ["Cork", "Galway", "Limerick", "Killarney"],
  "Sweden": ["Gothenburg", "Malmo", "Uppsala", "Kiruna"],
  "Norway": ["Bergen", "Trondheim", "Stavanger", "Tromso"],
  "Denmark": ["Aarhus", "Odense", "Aalborg"],
  "Finland": ["Tampere", "Turku", "Rovaniemi", "Oulu"],
  "Iceland": ["Akureyri", "Vik"],
  "Poland": ["Gdansk", "Wroclaw", "Poznan", "Lodz", "Katowice", "Zakopane"],
  "Czechia": ["Brno", "Cesky Krumlov", "Ostrava", "Plzen"],
  "Hungary": ["Debrecen", "Szeged", "Pecs"],
  "Romania": ["Cluj-Napoca", "Brasov", "Timisoara", "Sibiu", "Constanta"],
  "Bulgaria": ["Plovdiv", "Varna", "Burgas", "Veliko Tarnovo"],
  "Croatia": ["Zadar", "Rijeka", "Pula", "Hvar", "Rovinj"],
  "Serbia": ["Novi Sad", "Nis"],
  "Slovenia": ["Maribor", "Bled", "Piran"],
  "Slovakia": ["Kosice", "Zilina", "Banska Bystrica"],
  "Estonia": ["Tartu", "Parnu"],
  "Latvia": ["Daugavpils", "Jurmala"],
  "Lithuania": ["Kaunas", "Klaipeda"],
  "Ukraine": ["Lviv", "Odesa", "Kharkiv", "Dnipro"],
  "Russia": ["Kazan", "Sochi", "Novosibirsk", "Yekaterinburg", "Vladivostok"],
  "Turkey": ["Ankara", "Izmir", "Bodrum", "Fethiye", "Bursa", "Trabzon", "Konya"],
  "Georgia": ["Batumi", "Kutaisi"],
  "Albania": ["Tirana", "Sarande", "Shkoder"],
  "Bosnia and Herzegovina": ["Sarajevo", "Mostar", "Banja Luka"],
  "North Macedonia": ["Skopje", "Ohrid"],
  "Montenegro": ["Podgorica", "Kotor", "Budva"],
  "Cyprus": ["Limassol", "Paphos", "Larnaca"],
  "Malta": ["Valletta", "Sliema"],
  "Japan": ["Hiroshima", "Nagoya", "Fukuoka", "Sapporo", "Nara", "Kobe", "Yokohama", "Okinawa", "Kanazawa", "Hakone"],
  "South Korea": ["Busan", "Jeju", "Incheon", "Gyeongju", "Daegu"],
  "China": ["Guangzhou", "Shenzhen", "Chengdu", "Xi'an", "Hangzhou", "Guilin", "Chongqing", "Suzhou", "Qingdao", "Kunming"],
  "Taiwan": ["Kaohsiung", "Taichung", "Tainan", "Hualien"],
  "Thailand": ["Krabi", "Pattaya", "Koh Samui", "Ayutthaya", "Hua Hin", "Chiang Rai"],
  "Vietnam": ["Hoi An", "Nha Trang", "Hue", "Ha Long", "Sapa", "Phu Quoc"],
  "Malaysia": ["Penang", "Langkawi", "Malacca", "Kota Kinabalu", "Johor Bahru"],
  "Indonesia": ["Yogyakarta", "Surabaya", "Bandung", "Lombok", "Medan", "Ubud"],
  "Philippines": ["Boracay", "Palawan", "Davao", "Baguio", "Bohol"],
  "India": ["Bangalore", "Chennai", "Kolkata", "Hyderabad", "Agra", "Udaipur", "Varanasi", "Pune", "Amritsar", "Kochi", "Rishikesh", "Ahmedabad"],
  "Nepal": ["Pokhara", "Chitwan"],
  "Sri Lanka": ["Kandy", "Galle", "Ella", "Sigiriya"],
  "Pakistan": ["Lahore", "Karachi", "Islamabad", "Peshawar"],
  "Bangladesh": ["Dhaka", "Chittagong", "Sylhet"],
  "Cambodia": ["Sihanoukville", "Battambang", "Kampot"],
  "Laos": ["Vang Vieng", "Pakse"],
  "Myanmar": ["Mandalay", "Bagan", "Inle Lake"],
  "Kazakhstan": ["Astana", "Shymkent"],
  "Uzbekistan": ["Bukhara", "Khiva"],
  "United Arab Emirates": ["Sharjah", "Ras Al Khaimah", "Fujairah"],
  "Saudi Arabia": ["Mecca", "Medina", "Dammam", "AlUla"],
  "Israel": ["Haifa", "Eilat", "Nazareth"],
  "Jordan": ["Aqaba", "Wadi Rum", "Dead Sea"],
  "Oman": ["Salalah", "Nizwa"],
  "Qatar": ["Al Wakrah"],
  "Egypt": ["Luxor", "Aswan", "Alexandria", "Sharm El Sheikh", "Hurghada", "Giza"],
  "Morocco": ["Rabat", "Tangier", "Agadir", "Chefchaouen", "Essaouira", "Meknes"],
  "Tunisia": ["Sousse", "Hammamet", "Djerba"],
  "South Africa": ["Pretoria", "Port Elizabeth", "Stellenbosch", "Bloemfontein", "Knysna"],
  "Kenya": ["Mombasa", "Kisumu", "Nakuru", "Malindi"],
  "Tanzania": ["Arusha", "Dodoma", "Moshi"],
  "Ethiopia": ["Lalibela", "Gondar", "Bahir Dar"],
  "Ghana": ["Kumasi", "Cape Coast", "Takoradi"],
  "Nigeria": ["Abuja", "Ibadan", "Port Harcourt", "Kano"],
  "Senegal": ["Saint-Louis", "Saly"],
  "Uganda": ["Kampala", "Entebbe", "Jinja"],
  "Rwanda": ["Musanze", "Gisenyi"],
  "Zimbabwe": ["Harare", "Bulawayo"],
  "Zambia": ["Lusaka", "Livingstone"],
  "Namibia": ["Swakopmund", "Walvis Bay"],
  "Botswana": ["Maun", "Kasane"],
  "Mozambique": ["Maputo", "Beira"],
  "Madagascar": ["Antananarivo", "Nosy Be"],
  "Algeria": ["Algiers", "Oran", "Constantine"],
  "United States": [
    "Houston", "Phoenix", "Dallas", "San Antonio", "San Jose", "Portland",
    "Nashville", "Charlotte", "Baltimore", "Minneapolis", "Sacramento",
    "Salt Lake City", "Pittsburgh", "St. Louis", "Tampa", "Cleveland",
    "Kansas City", "Indianapolis", "Milwaukee", "Albuquerque", "Tucson",
    "Anchorage", "Savannah", "Charleston", "Key West", "Palm Springs",
    "Santa Fe", "Asheville", "Memphis", "Oakland",
  ],
  "Canada": ["Ottawa", "Edmonton", "Winnipeg", "Halifax", "Victoria", "Banff", "Whistler", "Saskatoon"],
  "Mexico": ["Merida", "San Miguel de Allende", "Puebla", "Queretaro", "Los Cabos", "Mazatlan", "Cozumel", "Guanajuato", "Acapulco", "Chihuahua"],
  "Brazil": ["Brasilia", "Florianopolis", "Recife", "Fortaleza", "Curitiba", "Manaus", "Belo Horizonte", "Porto Alegre", "Natal"],
  "Argentina": ["Cordoba", "Rosario", "Salta", "Ushuaia", "El Calafate"],
  "Chile": ["Puerto Varas", "Antofagasta", "Punta Arenas", "San Pedro de Atacama"],
  "Peru": ["Arequipa", "Trujillo", "Iquitos", "Puno"],
  "Colombia": ["Cali", "Santa Marta", "Barranquilla", "Bucaramanga", "Salento"],
  "Ecuador": ["Cuenca", "Banos", "Galapagos"],
  "Bolivia": ["Santa Cruz de la Sierra", "Sucre", "Uyuni"],
  "Uruguay": ["Punta del Este", "Colonia del Sacramento"],
  "Paraguay": ["Ciudad del Este", "Encarnacion"],
  "Venezuela": ["Maracaibo", "Valencia", "Merida"],
  "Costa Rica": ["Tamarindo", "Manuel Antonio", "La Fortuna", "Monteverde"],
  "Panama": ["Bocas del Toro", "Boquete", "Colon"],
  "Guatemala": ["Lake Atitlan", "Flores", "Quetzaltenango"],
  "Cuba": ["Varadero", "Trinidad", "Santiago de Cuba", "Vinales"],
  "Dominican Republic": ["Puerto Plata", "Samana", "La Romana"],
  "Jamaica": ["Negril", "Ocho Rios", "Port Antonio"],
  "Australia": ["Canberra", "Hobart", "Darwin", "Byron Bay", "Alice Springs", "Newcastle", "Townsville"],
  "New Zealand": ["Rotorua", "Dunedin", "Napier", "Nelson", "Taupo"],
  "Fiji": ["Sigatoka"],
}

// A second block, merged with the first rather than replacing it. Kept
// separate because these repeat country keys that already appear above, and a
// duplicate key in one object literal silently discards the earlier value.
const SECONDARY_EXTRA = {
  "Norway": ["Alesund", "Bodo", "Lofoten"],
  "Spain": ["Marbella", "Ibiza", "Tenerife", "Las Palmas", "Salamanca", "Valladolid"],
  "Italy": ["Rimini", "Trieste", "Perugia", "Lecce", "Sorrento", "Como"],
  "France": ["Chamonix", "Ajaccio", "Dijon", "Reims", "Carcassonne", "Annecy"],
  "Germany": ["Rothenburg ob der Tauber", "Freiburg", "Mainz", "Bonn", "Augsburg"],
  "Greece": ["Naxos", "Paros", "Zakynthos", "Kos", "Chania"],
  "Turkey": ["Marmaris", "Alanya", "Kusadasi", "Pamukkale", "Gaziantep"],
  "Morocco": ["Ouarzazate", "Merzouga", "Asilah"],
  "Egypt": ["Dahab", "Marsa Alam", "Siwa"],
  "India": ["Jodhpur", "Jaisalmer", "Mysore", "Shimla", "Manali", "Darjeeling", "Leh", "Madurai", "Surat", "Nagpur"],
  "China": ["Sanya", "Harbin", "Zhangjiajie", "Lijiang", "Tianjin", "Wuhan", "Nanjing", "Dalian"],
  "Japan": ["Sendai", "Takayama", "Nikko", "Matsumoto", "Kumamoto", "Nagasaki", "Beppu"],
  "Indonesia": ["Makassar", "Semarang", "Palembang", "Flores", "Raja Ampat"],
  "Vietnam": ["Can Tho", "Dalat", "Mui Ne", "Ninh Binh"],
  "Thailand": ["Koh Phangan", "Koh Tao", "Kanchanaburi", "Sukhothai", "Udon Thani"],
  "Philippines": ["Iloilo", "Siargao", "Coron", "El Nido", "Vigan"],
  "Malaysia": ["Ipoh", "Kuching", "Cameron Highlands", "Kuantan"],
  "South Korea": ["Sokcho", "Jeonju", "Suwon", "Ulsan"],
  "Brazil": ["Foz do Iguacu", "Belem", "Sao Luis", "Paraty", "Buzios", "Goiania"],
  "Mexico": ["Morelia", "Zacatecas", "Veracruz", "Campeche", "Sayulita", "Huatulco", "Taxco"],
  "United States": ["Fort Lauderdale", "Raleigh", "Columbus", "Omaha", "Boise", "Reno", "Buffalo", "Richmond", "Louisville", "Jacksonville", "Tulsa", "Spokane", "Madison", "Des Moines", "Providence", "Burlington"],
  "Canada": ["London", "Kelowna", "St. John's", "Regina", "Windsor", "Kingston"],
  "Argentina": ["Mar del Plata", "Puerto Madryn", "San Carlos de Bariloche", "Tucuman"],
  "Colombia": ["Pereira", "Manizales", "Villa de Leyva", "Popayan"],
  "Peru": ["Huaraz", "Nazca", "Chiclayo", "Paracas"],
  "Chile": ["La Serena", "Valdivia", "Temuco", "Iquique"],
  "Ecuador": ["Manta", "Loja", "Otavalo"],
  "South Africa": ["East London", "Nelspruit", "Kimberley", "George", "Hermanus"],
  "Kenya": ["Eldoret", "Naivasha", "Diani Beach"],
  "Tanzania": ["Mwanza", "Zanzibar City", "Serengeti"],
  "Nigeria": ["Benin City", "Enugu", "Calabar"],
  "Ghana": ["Tamale", "Ho", "Elmina"],
  "Ethiopia": ["Axum", "Harar", "Dire Dawa"],
  "Uganda": ["Gulu", "Mbarara", "Fort Portal"],
  "Cameroon": ["Yaounde", "Douala", "Kribi"],
  "Ivory Coast": ["Abidjan", "Yamoussoukro", "Grand-Bassam"],
  "Angola": ["Benguela", "Lobito"],
  "Zambia": ["Ndola", "Kitwe"],
  "Malawi": ["Lilongwe", "Blantyre", "Nkhata Bay"],
  "Mali": ["Bamako", "Timbuktu"],
  "Sudan": ["Khartoum", "Port Sudan"],
  "Libya": ["Tripoli", "Benghazi"],
  "Algeria": ["Annaba", "Tlemcen", "Ghardaia"],
  "Tunisia": ["Sfax", "Monastir", "Tozeur"],
  "Mauritius": ["Grand Baie", "Flic en Flac"],
  "Seychelles": ["Victoria", "Praslin"],
  "Cape Verde": ["Praia", "Mindelo", "Sal"],
  "Iran": ["Tehran", "Isfahan", "Shiraz", "Yazd", "Mashhad", "Tabriz"],
  "Iraq": ["Baghdad", "Erbil", "Basra", "Najaf"],
  "Azerbaijan": ["Baku", "Ganja", "Sheki"],
  "Kazakhstan": ["Aktau", "Karaganda"],
  "Kyrgyzstan": ["Bishkek", "Osh", "Karakol"],
  "Tajikistan": ["Dushanbe", "Khujand"],
  "Turkmenistan": ["Ashgabat"],
  "Armenia": ["Gyumri", "Dilijan"],
  "Mongolia": ["Darkhan", "Erdenet"],
  "Bhutan": ["Thimphu", "Paro", "Punakha"],
  "Maldives": ["Hulhumale", "Addu City"],
  "Bangladesh": ["Cox's Bazar", "Rajshahi", "Khulna"],
  "Afghanistan": ["Kabul", "Herat", "Kandahar"],
  "Syria": ["Damascus", "Aleppo", "Latakia"],
  "Yemen": ["Sanaa", "Aden"],
  "Kuwait": ["Kuwait City", "Salmiya"],
  "Lebanon": ["Byblos", "Tripoli", "Baalbek"],
  "Palestine": ["Ramallah", "Bethlehem", "Hebron"],
  "Puerto Rico": ["Ponce", "Rincon"],
  "Trinidad and Tobago": ["Port of Spain", "Scarborough"],
  "Barbados": ["Holetown"],
  "Bahamas": ["Freeport", "Exuma"],
  "Haiti": ["Port-au-Prince", "Cap-Haitien"],
  "Belize": ["San Pedro", "Placencia", "San Ignacio"],
  "Honduras": ["Roatan", "San Pedro Sula", "Copan"],
  "Nicaragua": ["Granada", "Leon", "San Juan del Sur"],
  "El Salvador": ["Santa Ana", "La Libertad"],
  "Guyana": ["Bartica"],
  "Suriname": ["Paramaribo"],
  "Papua New Guinea": ["Lae", "Mount Hagen"],
  "Vanuatu": ["Port Vila"],
  "Samoa": ["Apia"],
  "Tonga": ["Nuku'alofa"],
  "Solomon Islands": ["Honiara"],
  "New Caledonia": ["Noumea"],
  "French Polynesia": ["Bora Bora", "Moorea"],
  "Guam": ["Hagatna"],
  "Ukraine": ["Chernivtsi", "Ivano-Frankivsk"],
  "Belarus": ["Minsk", "Brest", "Grodno"],
  "Moldova": ["Chisinau", "Tiraspol"],
  "Kosovo": ["Pristina", "Prizren"],
  "Luxembourg": ["Luxembourg City"],
  "Monaco": ["Monte Carlo"],
  "Andorra": ["Andorra la Vella"],
  "San Marino": ["San Marino"],
  "Liechtenstein": ["Vaduz"],
  "Gibraltar": ["Gibraltar"],
  "Jersey": ["Saint Helier"],
  "Isle of Man": ["Douglas"],
  "Greenland": ["Nuuk", "Ilulissat"],
  "Faroe Islands": ["Torshavn"],
}

/** "City, Country" for every capital `world-countries` knows about. */
function capitals() {
  const out = []
  for (const c of countries) {
    if (!c.independent) continue
    const capital = c.capital?.[0]
    if (!capital) continue
    out.push(`${capital}, ${c.name.common}`)
  }
  return out
}

/**
 * The full work-list, tier order preserved, de-duplicated case-insensitively.
 * A place appearing in two tiers keeps its highest (earliest) position.
 */
export function buildDestinations({ maxTier = 3 } = {}) {
  const tiers = [TIER1, maxTier >= 2 ? capitals() : [], maxTier >= 3 ? secondaries() : []]
  const seen = new Set()
  const out = []
  tiers.forEach((list, i) => {
    for (const place of list) {
      const key = place.toLowerCase().replace(/\s+/g, " ").trim()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ place, tier: i + 1 })
    }
  })
  return out
}

function secondaries() {
  const merged = new Map()
  for (const block of [SECONDARY, SECONDARY_EXTRA]) {
    for (const [country, cities] of Object.entries(block)) {
      const arr = merged.get(country) ?? []
      for (const city of cities) if (!arr.includes(city)) arr.push(city)
      merged.set(country, arr)
    }
  }
  const out = []
  for (const [country, cities] of merged) {
    for (const city of cities) out.push(`${city}, ${country}`)
  }
  return out
}

export { TIER1, SECONDARY, SECONDARY_EXTRA }
