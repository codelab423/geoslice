# Population Split

Draw **one straight line** across a country and try to split its
**population** — not its land area — as close to 50% / 50% as possible.

Population clusters (Amsterdam, Paris, Istanbul, Cairo, ...) mean the
geographic center of a country is almost never the population center. This
game is built around that fact: every split is calculated from real
[WorldPop](https://www.worldpop.org) gridded population data, projected and
tested against the exact line you draw.

> **Status:** Milestone 1 (Netherlands, Belgium, Bosnia and Herzegovina,
> France, Germany) is fully wired end-to-end: real boundaries, real
> population pipeline, drawing, scoring, results. 35 countries are defined
> in `src/data/countries.ts` with real boundaries already fetched; their
> population grids are built by CI (see "Data pipeline" below) rather than
> shipped from this development environment, which has no route to WorldPop's
> servers. Nothing in this app ever falls back to fake/random population data
> — see "No fake data, ever" below.

## Screenshots

_(add screenshots here once you've run the game locally — `npm run dev`,
play a round, and drop a PNG in `docs/screenshots/`)_

## How it works

1. Pick a country. You see its real outline, nothing else — no basemap, no
   API key, no external tiles.
2. Drag a line across the map. It's automatically extended to the edges of
   the viewport, like an infinite line.
3. Press **SUBMIT SPLIT**. The game classifies every population grid cell in
   that country by which side of your line it falls on, sums the population
   on each side, and scores you on how close you got to 50/50.
4. See your result: percentages, a score out of 100, a tier label
   ("INSANE SPLIT" down to "KEEP TRYING"), and an optional population
   heatmap reveal.

There is no single "correct" line — infinitely many lines can produce a
near-perfect split. Score only ever depends on population balance.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL. The Netherlands, Belgium, Bosnia and Herzegovina,
France and Germany boundaries are already included in `public/countries/`;
population data appears in `public/population/` once the data pipeline has
run (locally or via CI — see below). If a country's population file is
missing, the game tells you so explicitly instead of guessing.

```bash
npm test              # vitest unit tests (engine, scoring, geometry, metadata)
npm run validate-data # checks every country's boundary + population data
npm run build          # production build (tsc + vite)
```

## Data pipeline

This is the part that matters most: **real spatial population distribution**,
not land area, not city-only approximations, not random numbers.

### Boundaries — geoBoundaries

`scripts/fetch_boundaries.py` downloads each country's ADM0 polygon from
[geoBoundaries](https://www.geoboundaries.org) (via GitHub's own LFS media
CDN, which is geoBoundaries' real distribution channel), simplifies large
files for browser performance, and — for a handful of countries whose
sovereign territory includes distant overseas regions — filters out polygon
parts more than ~1000km from the main landmass so the map doesn't zoom out to
a ridiculous extent (see `territoryExtent` in `src/data/countries.ts`; this
affects France, Spain, Portugal, Denmark, Norway, the USA, Argentina, India,
China and Australia). Output: `public/countries/{ISO3}.geojson`.

```bash
python scripts/fetch_boundaries.py NLD BEL DEU
python scripts/fetch_boundaries.py --all
```

### Population — WorldPop

`scripts/build_population.py` downloads each country's
[WorldPop](https://www.worldpop.org) 2020 UN-adjusted, 1km gridded population
GeoTIFF, clips it to the exact country boundary, drops NoData/negative cells,
and aggregates populated pixels into 5,000–40,000 output points (mass-
preserving — aggregation only ever sums population, never resamples or
interpolates it) for smooth browser performance. Output:
`public/population/{ISO3}.json`, shaped as:

```json
{
  "iso3": "NLD",
  "source": "worldpop",
  "datasetYear": 2020,
  "totalPopulation": 17441139.4,
  "cellCount": 21830,
  "points": [[4.895, 52.370, 214.4], ...]
}
```

```bash
pip install -r scripts/requirements.txt
python scripts/build_population.py NLD
python scripts/build_population.py --all
```

**Network note:** `data.worldpop.org` is unreachable from some
restricted-egress sandboxes (including the one this repository was
originally developed in). Rather than silently substituting fake data, the
pipeline is designed to run on a normal internet connection — locally, or via
`.github/workflows/build-data.yml`, which runs on an ordinary GitHub-hosted
runner and commits the resulting real data back to the repo. If you're
running this somewhere with restricted network access, trigger that
workflow (Actions tab → "Build real game data" → Run workflow) instead.

### Verification

- `scripts/test_population_aggregation.py` — unit tests proving aggregation
  never loses population mass, drops empty cells, and stays within the
  5,000–40,000 point target.
- `scripts/test_build_population_smoke.py` — exercises the real rasterio
  clip/mask path against a real country boundary (Netherlands) using a
  synthetic raster, so the pipeline logic is verified even without network
  access to WorldPop.
- `npm run validate-data` — checks every country has a valid boundary, that
  population sums are positive with no NaN/negative values, coordinates fall
  near the country, and that test splits sum to ~100%.

## No fake data, ever

This game will **never**:
- generate random population points,
- approximate population from city locations alone,
- derive population from land area,
- divide a national population evenly across a polygon,
- or silently substitute placeholder data.

If a country's population file hasn't been built yet, the game says so
explicitly (see `useCountryData.ts`) instead of guessing. The
`PopulationDataFile.source` field is typed as the literal `"worldpop"` —
anything else fails `validate-data`.

## Architecture

```
src/
  components/   CountryMap (MapLibre + line drawing), ResultPanel, TopBar, DebugPanel
  pages/        MainMenu, GameScreen, Countries, HowToPlay, Credits
  game/         PopulationSplitEngine, bestLineSearch (weighted-median line finder), gameModes
  map/          pixel-space line clipping, turf-based split-polygon visualization
  utils/        projection (Mercator), geometry (side-of-line), scoring, difficulty heuristic,
                seeded RNG (daily mode), share text
  hooks/        useCountryData, useSplitEngine (+ Web Worker), useStats (localStorage), useCountUp
  workers/      splitWorker.ts — off-main-thread classification for Live Mode
  data/         countries.ts — single source of truth for supported countries
  types/        shared TypeScript types

scripts/        Python data pipeline (see "Data pipeline" above)
public/
  countries/    {ISO3}.geojson — real geoBoundaries ADM0 polygons
  population/   {ISO3}.json — real WorldPop-derived population grids
```

### Split calculation

The player's line and every population grid point are projected into Web
Mercator XY (the same projection MapLibre renders with) rather than raw
longitude/latitude, so a straight line on screen is exactly the line tested
mathematically — this avoids the classic bug where a naive lon/lat side test
gets skewed at high latitudes (Norway, Canada...). See
`src/utils/projection.ts` and `src/game/populationSplitEngine.ts`.

`PopulationSplitEngine` exposes `calculateCentroidSplit` (classify each grid
cell by its center point — used today) and a `calculateExactSplit` hook
reserved for a future upgrade that would split cells the line actually
crosses proportionally by area, rather than all-or-nothing by centroid.

### Scoring

```
error = |50 − percentageA|
score = max(0, 100 − error × 2)          // default, linear
score = 100 × exp(−k × error^p)          // alternative, punishes big misses harder
```

### Modes

Classic · Daily (deterministic per-UTC-date seed, no server needed) · 10
Country Run (scored out of 1000) · Streak (until a split misses by >5%) ·
Hardcore (minimal chrome) · Live Mode (toggle — shows percentages while
dragging, off by default so it doesn't trivialize the game).

World Mode (whole-planet split) and 3-Way Mode (two lines, three equal
thirds) are intentionally not implemented yet, but the engine's projection
and side-test abstractions were built to extend to both without a rewrite.

### Debug mode

Append `?debug=true` to the URL during a round to see grid cell counts, raw
line coordinates, per-side population, and calculation timing. Never shown
during normal play.

## Supported countries

Netherlands, Belgium, Germany, France, United Kingdom, Spain, Portugal,
Italy, Switzerland, Austria, Poland, Czechia, Denmark, Sweden, Norway,
Finland, Bosnia and Herzegovina, Croatia, Serbia, Turkey, Greece, United
States, Canada, Mexico, Brazil, Argentina, Japan, South Korea, India, China,
Indonesia, Australia, Egypt, South Africa, Nigeria — see
`src/data/countries.ts` for ISO codes, flags and difficulty ratings. Adding
another country only requires a boundary file, a population file, and one
entry in that file.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: installs
dependencies, runs the test suite and `validate-data`, builds with the
correct GitHub Pages base path, and deploys to Pages via the official
`actions/deploy-pages` action. `.github/workflows/build-data.yml` runs the
Python pipeline (on a runner with real internet access) and commits refreshed
boundary/population data, which in turn triggers a redeploy.

To deploy your own fork: enable GitHub Pages (Settings → Pages → Source:
GitHub Actions), then push to `main`.

## Data sources & attribution

- **Population**: [WorldPop](https://www.worldpop.org), University of
  Southampton — gridded population estimates, dataset year 2020, used
  consistently across every country. These are modeled estimates, not exact
  census counts.
- **Boundaries**: [geoBoundaries](https://www.geoboundaries.org) (ADM0),
  with Natural Earth as a documented fallback path for any country
  geoBoundaries doesn't cover.
- **Map rendering**: [MapLibre GL JS](https://maplibre.org) — no basemap
  tiles or API key used.

See the in-app Credits page (`src/pages/Credits.tsx`) for the same
attribution, including per-country notes on metropolitan vs. full
territorial extent.

## Limitations

- Population figures are modeled estimates from a single dataset year
  (2020), not real-time or census data.
- Grid points are aggregated for browser performance; the shipped
  calculation classifies each aggregated cell by its center point
  (`calculateExactSplit`, a proportional-by-area upgrade, is architected but
  not implemented).
- A handful of countries ship a "metropolitan" extent rather than their full
  sovereign territory, to keep map framing sane — documented per-country in
  `src/data/countries.ts`.
- World Mode and 3-Way Mode are designed for but not yet built.
