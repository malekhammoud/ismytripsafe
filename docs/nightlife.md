# Nightlife reports — beta release

This feature belongs to `/root/ismytripsafe-beta`, served by
`ismytripsafe-beta.service` on port 3002. Do not deploy to `main`, production,
beta2, or beta3. Beta currently has a local `main` branch checked out even
though its webhook fetches `origin/beta`; use an explicit `HEAD:beta` push.

## Routes and design

- `/nightlife`: directory of published reports, with an honest empty state.
- `/{country}/{city}/nightlife`: sourced, server-rendered report.
- `/{country}/{city}/nightlife/data.json`: ODbL venue export, excluding all
  proprietary ratings, popularity, review counts, tips, and sentiment labels.
- Existing city safety pages link to nightlife only when a report qualifies.
- Published nightlife pages link back to safety and to the nearest available
  nightlife reports. Withheld cities never get a card, route, or sitemap URL.

The evening palette uses charcoal/plum, lime, and the existing paper/serif
identity. Five accessible star cards lead into the venue mix, filterable map
(with a text list), shortlist, late hours, events, beer, traveler themes,
separate future booking block, safety, and a source ledger. Half-star icons
accompany precise numeric subscores; the overall displays one decimal.

New nightlife pages are **noindex by default**, independently of the existing
beta flag (which currently differs from its documentation).
`NIGHTLIFE_INDEXABLE=1` is reserved for an explicitly approved production
rollout. Canonicals default to `https://beta.ismytripsafe.com` and can be set
with `NIGHTLIFE_SITE_URL`. Existing production metadata is unchanged.

## Storage and generation

`NIGHTLIFE_CACHE_DIR` defaults to `/root/ismytripsafe-nightlife-data`. This is
separate from the shared safety report store. The worker reads safety reports;
it never generates, refreshes, or writes them.

```
reports/<safety-cache-key>.json   full record, inputs, source dates, score reasons
index/<safety-cache-key>.json     small directory/peer/sitemap metadata
lookup/<country>/<city>.json     direct route lookup, no corpus scan
raw/<safety-cache-key>/*.json     source responses, fetch dates, private
last-run.json                    job results and source failures
```

Writes use temporary files + atomic rename. Raw API keys and request headers
are never persisted. External-source failures preserve a previous valid raw
response and its original timestamp. A source failure cannot replace a
published report with a withheld one or reduce its score coverage.

Install the optional batch-only opening-hours library before generating:

```sh
cd /root/ismytripsafe-beta
npm install --prefix workers/nightlife --no-audit --no-fund
npm run nightlife -- --test-batch
npm run nightlife -- --audit
npm run nightlife -- ge_tbilisi
npm run nightlife -- ge_tbilisi --rescore
npm run nightlife -- ge_tbilisi --events-only
npm run nightlife -- --refresh-due
```

The worker loads Next's local environment files through `@next/env` and also
accepts ordinary process environment variables. API source credentials are
server-only. `--force` bypasses raw-source TTLs. `--rescore` recomputes stored
inputs without calling external APIs. City resolution requires an existing
city safety report, then matches Wikidata by label/alias, country ISO code,
and coordinates. It reads the latest dated, nondeprecated population and
requires the OSM administrative relation to identify the same Wikidata item.
Unverified boundaries/populations do not produce density scores.

The pilot is Budapest, London, Tbilisi, Shkoder, Gdansk, and Luang Prabang.
It spans a major nightlife destination, a megacity, and smaller/less-covered
places. Before scaling, inspect boundary identity, population year, OSM
coverage, duplicate matches, category counts, rating coverage, and each
publication outcome. Density's initial cut-offs and Quality's cut-offs are
**provisional**, not empirically calibrated. Do not claim this pilot has been
calibrated until a live-source run has succeeded and been reviewed.

Public Overpass runs are capped at 10 cities per invocation. Larger jobs must
configure `OVERPASS_URL` for a private/commercial endpoint or replace the
adapter with a regional extract. The provided systemd service uses `flock`
for one worker. The daily timer only checks due data: venues/ratings/mentions
monthly, events weekly, population and prices every 180 days. Copy the two
`deploy/ismytripsafe-nightlife-beta.*` units to systemd and enable the timer
on the host only after a successful pilot. No timer is enabled by this code.

## Score contracts

All values retain full calculation precision. The overall is the unweighted
mean of available subscores, never a weighted commercial recommendation.

- Density: venues/population × 100,000. Peer percentile within under-100k,
  100k–under-500k, 500k–under-2M, and 2M+ bands, only after 20 other published
  cities exist in the band. Ties receive half credit. Until then use the
  openly labelled provisional scale: 0→1, 5→1.5, 15→2, 30→3, 60→4, 100→5,
  linearly interpolated. Never claim a measured percentile on this scale.
- Quality: at least eight venues with finite 0–10 rating, vote count, and
  0–1 popularity. Select up to 20 by popularity; adjusted rating is
  `(votes × rating + 20 × city mean) / (votes + 20)`. Median adjusted rating
  maps 6.5→1, 7→2, 7.5→3, 8→4, 8.5→5, interpolated and clamped. Missing
  popularity or votes is not fabricated.
- Variety: effective types `exp(-sum(p log p))`, excluding Other. At least
  ten classified venues. Under 2 types→1 star, 2–under 3→2, 3–under 4.5→3,
  4.5–under 6→4, 6+→5. Each venue has one type from `VENUE_TYPES`.
- Vibe: at least ten relevant mentions within three years and at least four
  independent groups. Last-year weight 1, older weight .5. Water filling
  caps every thread/article at 25% of total weight. Reddit comments group
  with their thread; tracking parameters cannot split a blog article.
  `stars = 1 + 4 × (positive + .5 × mixed) / weighted total`.
- Safety: 40% published city safety index, 40% walking-after-dark signal,
  20% existing traveler **safety** sentiment. Missing components are removed
  and weights renormalized. Existing advisory caps apply after weighting.
  0–20→1, >20–40→2, >40–60→3, >60–80→4, >80–100→5. District guidance
  is shown separately: the report does not falsely claim measured district
  crime rates or that a venue cluster is safe because it is busy.

All five computable → full. One or two missing, at least ten venues → limited,
with the available denominator stated. Fewer than ten venues or three missing
→ withheld, logged with reasons. Unknown data never becomes a zero star score.

Opening times and events/beer prices never enter any score. Opening hours
are interpreted by `opening_hours`, not a hand-built regex parser. The
known-hours denominator excludes missing, invalid, and conditional schedules.
It samples local wall-clock 00:01, 02:01, and 04:01 across a reference week,
showing the share open on at least one sampled night. No library means an
explicit unavailable section, not fabricated hours.

## Source contracts and licensing check (19 October 2026)

These links were checked before implementation. They describe API contracts,
not evidence that this account has a paid licence. Optional sources stay off
until the account's entitlements and intended storage/analysis rights are set.

| Source | Adapter and licensing boundary |
| --- | --- |
| [OSM / Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | Administrative area query of nodes/ways/relations for bar, pub, nightclub, biergarten, music_venue; restaurant only with bar=yes. Keep real coordinates, name, hours, useful tags. Skip closed/disused places. Full boundary geometry clips unmatched FSQ places; if geometry is incomplete, only matched OSM records are enriched. Public services are for small workloads. |
| [OSM copyright](https://www.openstreetmap.org/copyright) | © OpenStreetMap contributors, ODbL 1.0 attribution on maps/figures and a downloadable OSM-derived database. Preserve source tags in export; do not relicense proprietary FSQ fields as OSM. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | CC0 structured claims: P1082 dated population, P625 coordinates, P17/P297 country validation, P402 relation. No Wikipedia prose used in scores. |
| [Foursquare current search](https://docs.foursquare.com/fsq-developers-places/reference/place-search) | New `https://places-api.foursquare.com/places/search`, Bearer auth, `X-Places-Api-Version: 2025-06-17`, current `fsq_category_ids`, `fsq_place_id`, latitude/longitude. Request rating, popularity, price, stats and location. [Legacy V3 deprecated May 2026](https://docs.foursquare.com/developer/reference/upcoming-changes). Rich fields depend on plan. Up to 50 popularity-selected places are a sample, not an exhaustive city count. |
| [Foursquare usage guidelines](https://docs.foursquare.com/developer/reference/usage-guidelines-personalization-apis) | Personalization API cache restrictions must not be confused with a blanket right to archive Places data. Require explicit account agreement covering server storage, derived scores and displayed fields: `FOURSQUARE_DURABLE_STORAGE_LICENSED=1`, `FOURSQUARE_API_KEY`, `FOURSQUARE_CATEGORY_IDS`. Tips require a separate `FOURSQUARE_TIPS_LICENSED=1`. The open places dataset could support a later bulk adapter, but does not replace licensed ratings/tips. |
| [Ticketmaster](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Optional `TICKETMASTER_API_KEY`; `geoPoint` geohash (latlong is deprecated), radius 15 km, music, next 45 days, first 100 listings. Store source response and link each event. Weekly cache; suppress past/cancelled events in rendered listings. Listings are shown as partial coverage. |
| [Numbeo](https://www.numbeo.com/api/doc.jsp) | Licensed API only; no new price scraping. `NUMBEO_API_KEY`, `NUMBEO_STORAGE_LICENSED=1`; X-Api-Key header; `/api/city_prices`, strict matching, `use_estimated=false`; restaurant IDs 4 and 5 in local currency and USD. Stored source fetch and observation dates differ visibly. |
| [Reddit terms](https://redditinc.com/policies/data-api-terms) and [API](https://www.reddit.com/dev/api/) | No scraping. `REDDIT_COMMERCIAL_ANALYSIS_LICENSED=1` must cover commercial derived sentiment and third-party LLM processing, plus `REDDIT_ACCESS_TOKEN`. OAuth search + comments, limited request rate. Raw posts/comments are transient; only derived themes/labels, links, dates and content hashes remain. Deletion/retention obligations in the actual agreement still apply. |
| [Blog discovery](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started) | `BRAVE_SEARCH_API_KEY`, `NIGHTLIFE_BLOG_ANALYSIS_LICENSED=1`, and `NIGHTLIFE_BLOG_ALLOWED_DOMAINS` (comma-separated domains whose access/analysis rights have been reviewed). Fetch only HTTPS allowlisted pages, no redirects to other domains. Require a source publication date. Source prose is transient. No generic scrape-all mode. |
| [District geocoding policy](https://operations.osmfoundation.org/policies/nominatim/) | Optional `NIGHTLIFE_NOMINATIM_URL`; no default bulk calls to the public service. Cached district positions/polygons; reject matches over 30 km away. If deliberately pointed at public Nominatim, serialize at under four requests per minute for regular jobs. For scaling use a private provider. Missing coordinates leave text guidance, never guessed zones. |
| Internal safety | Read the existing cached city report. Reuse walking-after-dark, sentiment, advisory ceilings and neighborhood guidance. Never call `/api/research` from this worker. |

Live sentiment classification additionally requires `OPENROUTER_API_KEY` and
an explicitly selected `NIGHTLIFE_SENTIMENT_MODEL`; no paid fallback or
unbounded model loop. At most ten inputs per classification request, validated
against original IDs. A model cannot invent URLs, timestamps, extra mentions,
or a new source identity. Relevance excludes marketing and safety-only accounts.

Existing licensed labels can instead be supplied in
`NIGHTLIFE_MENTIONS_DIR/<safety-cache-key>.json`, as an array of:

```json
[{"id":"stable-id","source":"blogs","url":"https://approved.example/article",
  "group":"article-id","publishedAt":"2026-09-12","relevant":true,
  "sentiment":"mixed","themes":["Lively on weekends"]}]
```

The source's rights flag is still required. The worker derives canonical groups
from URLs, validates dates and labels, and discards duplicates. To honor a
source deletion, remove the import label, remove that city's private
`raw/.../sentiment.json`, then force regenerate. There is no public raw-text API.
Raw reproducibility is intentionally limited for UGC/blogs: hashes + validated
labels are retained instead of violating the no-raw-content requirement.

## Verification and beta deployment

```sh
npm run test:nightlife
npx tsc --noEmit
```

The tests cover formulas, thresholds, vote shrinkage, recency/group caps,
merging, clipping holes in boundaries, source identity validation, and hours
handling. The mocked integration job covers full/limited/withheld records,
raw caching, source failure dates, internal safety, current FSQ headers, and
licence-safe export. All fixtures are in isolated temporary directories;
none are committed as real city reports. `tests/nightlife-render.cjs <fixture-dir>`
checks both full and limited reports render every evidence section on the server.

Build from an isolated copy, never in a serving checkout:

```sh
npm run build
```

A restricted-session fallback verification can use `next build --webpack`
with Next's `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` pointing at the existing real
font assets. That checks compilation, types and all routes without downloading
fonts, but does not replace the normal host build or a browser smoke test.

After the live pilot and isolated build succeed, commit the feature and push
**only** `git push origin HEAD:beta`. The existing beta webhook builds and
restarts only port 3002. Check the beta deploy log and HTTP responses for the
directory, a qualified city, its safety crosslink, its data export and a
withheld city's 404. Run `npm run check:nightlife -- country/city` for read-only HTTP checks.
Confirm noindex, source dates, mobile layout, map filter,
JSON-LD and absence of browser errors. Do not mark deployment complete from
a local build alone.

## This implementation session

32 unit tests and the mocked pipeline pass. Both full and limited pages
server-render successfully. TypeScript and an isolated webpack production
build with existing font assets pass. The normal Turbopack build is blocked
by the session's Google Fonts network restriction and subprocess port-binding
restriction. Browser launch is also denied by the sandbox.

The real six-city batch was attempted against the existing safety corpus:
all six were withheld after Wikidata/Overpass could not be reached. No scores
or venues were invented, no real nightlife pages were seeded, and no safety
reports were modified. Shell DNS/network, GitHub push and systemd access are
blocked in this session, so deployment and live HTTP/browser verification
remain outstanding. API licences/keys and the optional opening-hours worker
installation must be configured on the host before a complete live-source run.
