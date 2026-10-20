# Nightlife reports — beta release

This feature belongs to `/root/ismytripsafe-beta`, served by
`ismytripsafe-beta.service` on port 3002. Do not deploy to `main`, production,
beta2, or beta3. The local feature branch targets `origin/beta`; use an explicit `HEAD:beta` push.

## Routes and design

- `/nightlife`: directory of published reports, with an honest empty state.
- `/{country}/{city}/nightlife`: sourced, server-rendered report.
- `/{country}/{city}/nightlife/data.json`: ODbL venue export, excluding all
  proprietary ratings, popularity, review counts, tips, and sentiment labels.
- Existing city safety pages start nightlife research on a real browser visit and show a teaser even before the first report qualifies.
- Published nightlife pages link back to safety and to the nearest available
  nightlife reports. Withheld cities never get a scored report, directory card, data export, or sitemap URL. Known cities can show a noindex research/availability screen while data is being gathered.

The evening palette uses charcoal/plum, lime, and the existing paper/serif
identity. Five accessible star cards lead into the venue mix, filterable map
(with a text list), shortlist, late hours, events, beer, traveler themes,
safety, and a source ledger. Booking content stays absent until there are actual links; it never affects ratings. Half-star icons
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

The root `npm install` now installs the pinned opening-hours worker automatically through `postinstall`, including during beta deployment. Its dependency scripts are disabled. For an existing install made with `--ignore-scripts`, install it explicitly before generating:

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
city safety report, then matches Wikidata by settlement/administrative type (P31/P279), label/alias, country ISO code, and coordinates. Exact city labels outrank aliases; nearby landmarks are excluded. Resolution caches carry a version so a corrected resolver never reuses an old wrong-city match. It reads the latest dated, nondeprecated population and
supports year-only and month-only dates without inventing a day, and excludes population claims for only part of a city. The OSM administrative relation must identify the same Wikidata item. If P402 is absent, the adapter can find a unique administrative relation tagged with that item; it never substitutes a radius for a boundary.
Unverified boundaries/populations do not produce density scores.

### Wikidata availability and visitor requests

The October 20 beta logs showed repeated generic `HTTP 503` lookup failures.
The old HTTP helper also converted MediaWiki's HTTP 200 `maxlag` response into
that same error, so those historical logs cannot distinguish replication lag
from an actual HTTP 503. The helper now preserves the real HTTP status, API
error code, lookup operation and requested retry time. It reads at most 8 KiB
of an error body to extract the code; response bodies and credentials never
enter public status or logs.

Visitor-triggered research uses interactive Wikidata requests without
`maxlag`; CLI and scheduled requests retain `maxlag=5`, following
[MediaWiki's documented distinction](https://www.mediawiki.org/wiki/Manual:Maxlag_parameter).
Both modes keep the bounded retry, descriptive User-Agent and source cache.
HTTP 200 API errors obey `Retry-After` too. Job cooldowns never shorten an
upstream retry time longer than the normal ten-minute cooldown. Explicit retry
times from the required Wikidata/OSM sources also cover other cities, across
processes, without spending another attempt or blocking fresh saved reports.

If search/entity reads fail with a service or transport error, the resolver
can obtain a candidate ID from Wikipedia's summary API and read it through
[Wikidata's linked-data interface](https://www.wikidata.org/wiki/Wikidata:Data_access).
This fallback makes sequential reads, is capped at 12 entities, and applies
the same settlement type, name, country and coordinate validation. A nearby
station, an ambiguous page or a same-name city in another country cannot
qualify. Wikipedia prose is neither stored nor used for population or scores.
The source note identifies successful linked-data resolution. Access denials,
rate limits, `maxlag`, `readonly` and explicit requests to wait do not trigger
alternate-interface requests. Verified cached source data still survives an
outage with its original date.

Regression coverage includes visitor versus batch request parameters, both
search and entity outages, full pipeline recovery, country/station rejection,
HTTP 200 and 503 error documents, oversized bodies, rate limits and persisted
retry times. These use controlled fixtures; they do not substitute for a
successful live-source pilot after deployment.

The pilot is Budapest, London, Tbilisi, Shkoder, Gdansk, and Luang Prabang.
It spans a major nightlife destination, a megacity, and smaller/less-covered
places. Before scaling, inspect boundary identity, population year, OSM
coverage, duplicate matches, category counts, rating coverage, and each
publication outcome. Density's initial cut-offs and Quality's cut-offs are
**provisional**, not empirically calibrated. Do not claim this pilot has been
calibrated until a live-source run has succeeded and been reviewed.

The default Overpass endpoint is `https://overpass.private.coffee/api/interpreter`, whose listed policy permits use in any project. Public Overpass runs remain capped at 10 cities per invocation. Keep the single-worker limit and configure a dedicated endpoint before scaling. Larger jobs must
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

## Source contracts and licensing check (19–20 October 2026)

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
unknown city's 404 and a known withheld city's unscored availability screen. Run `npm run check:nightlife -- country/city` for read-only HTTP checks.
Confirm noindex, source dates, mobile layout, map filter,
JSON-LD and absence of browser errors. Do not mark deployment complete from
a local build alone.

## Recovery fixes (20 October 2026)

The live Tbilisi record had cached Q1341835 (Tbilisi Central Station) instead of Q994 (the city). Distance-only ranking selected the station's Tbilisi alias. With no population or boundary, the same cached result failed on every retry. The new resolver checks settlement types, ranks city labels before aliases, and invalidates the old resolution cache. Report and job pipeline versions bypass old failed/withheld cooldowns after a collector fix; no manual cache deletion is required.

Source requests retry transient failures once, honor short Retry-After values, and stop on authentication errors or longer rate limits. MediaWiki error documents returned with HTTP 200 are not treated as data. A four-minute source deadline bounds on-demand work; optional district lookups have their own short budget. Failed source names and genuine evidence shortages are distinct status outcomes. A publishable report remains ready even if an optional source fails.

The browser reconnects after transient status failures, discovers an already-started job after a lost POST response, and retries source outages once after the advertised cooldown. It shows the real retry time and disables premature retries. An expired callback cannot run after another worker reclaims its lease. Concurrent JSON writes use unique temporary filenames.

Broader beta fixes include public-host redirects for mixed-case beta links, a hostname-based noindex header, and safety-search cancellation so old results cannot overwrite a new destination. HTTP errors and prematurely ended safety streams no longer masquerade as completed reports. Cancelling a browser stream is safe, the API only advertises a permanent link after persistence, and an interrupted model cannot cache an unfinished report or replace a healthy report during background refresh. Report wording is simpler and the empty booking promotion is removed.

Regression checks cover the actual wrong-entity failure, year/month population precision, old cache migration, API retries, partial source success, cooldown migration, abandoned jobs, browser polling, safety-stream errors, competing searches, stream cancellation, completion after persistence, interrupted models, and beta redirects. The test suite has 82 unit tests plus mocked pipeline and server-render checks. Browser launch, shell DNS/network and GitHub push are restricted in this environment; a local build is not evidence of a live deployment. The pinned opening-hours dependency must still be fetched by the host's deployment install.

## Visit-triggered generation

Visiting either a known city's safety report or its nightlife page mounts a
small browser component that starts `POST /api/nightlife/{country}/{city}`.
This only accepts cities already backed by a safety report. Metadata requests,
link prefetches, API GETs, and visitors who never open the report do not create
research jobs. No batch run is needed to discover a report.

The POST claims a durable research slot, responds immediately with progress,
and uses Next's `after` callback to perform collection and scoring. A status-only
GET powers polling; real source phases are persisted, not a fabricated progress
percentage. The browser refreshes the server-rendered page once a report is
available. A cold known-city route is noindex until it has publishable data;
unknown cities remain 404. Stale scored reports remain readable during refresh.

Locks and job state live in `NIGHTLIFE_CACHE_DIR/jobs`, alongside a UTC daily
attempt budget. Independent requests/processes share one active on-demand
research slot. Each job callback runs once, lock heartbeats prevent accidental
expiry during active collection, and abandoned jobs recover after 15 minutes.
Source failures cool down for ten minutes; genuinely insufficient evidence is retried after a day. Published reports remain ready during a failed optional refresh. Pipeline upgrades bypass older failure cooldowns and stale resolver cache identities. Neither can create made-up ratings or overwrite a healthy
report with broken data.

`NIGHTLIFE_ON_DEMAND_DAILY_LIMIT` controls new on-demand research attempts
(default 10 with public Overpass, 100 with a configured provider, maximum 1000).
Cached reports and status polling do not spend the budget. Capacity screens
check again automatically while the browser is open. Licensing flags and
credentials from the original adapters still apply; automatic generation does
not unlock unavailable licensed sources.

`npm run test:nightlife` additionally tests cold visits, concurrent requests
across independent coordinator instances, fresh-cache reuse, stale refreshes,
error cooldowns, thin data, global capacity, persisted daily budgets, crash
recovery, optional-source TTLs, source/formula changes, API GET/POST separation,
unknown cities, same-origin enforcement and after-response scheduling.


## Nightlife directory refresh

The nightlife homepage is a compact city directory rather than a promotional
landing page: plain paper background, restrained typography, city/country
search, region filtering, and a two-column list that becomes one column on
mobile. It includes real cities from the safety index so an empty nightlife
store does not create a dead end. Opening a city starts the on-demand flow.
Published guides show their real rating/count and are listed first; unresearched
cities have an Explore link without invented scores. Prefetch is disabled on
these research links. The interface distinguishes saved reports from first
visits, which may take a few minutes. No generic hero art or placeholder city
photographs are used.
