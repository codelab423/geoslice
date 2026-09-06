/**
 * npm run validate-data
 *
 * Validates every country listed in src/data/countries.ts against the checks
 * from the design spec (section 17):
 *   1. boundary file exists
 *   2. population file exists
 *   3. population sum > 0
 *   4. coordinates fall reasonably near the country (within its bbox + margin)
 *   5. no NaN values
 *   6. no negative population values
 *   7. percentage A + B ~= 100 for a test split
 *   8. horizontal and vertical test splits return valid results
 *
 * Missing population data is reported as a warning, not a hard failure --
 * this repo intentionally ships without it until the data-build GitHub Action
 * (or a local `python scripts/build_population.py`) has produced real
 * WorldPop-derived files. What IS a hard failure is any data file that
 * exists but is malformed, inconsistent, or contains fabricated-looking
 * values (NaN, negative, wildly out-of-bounds).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES } from '../src/data/countries';
import { PopulationSplitEngine, projectPopulationData } from '../src/game/populationSplitEngine';
import type { PopulationDataFile } from '../src/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = new PopulationSplitEngine('linear');

let hardFailures = 0;
let warnings = 0;
let fullyValidated = 0;

function fail(msg: string) {
  console.error(`  FAIL: ${msg}`);
  hardFailures++;
}
function warn(msg: string) {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

for (const country of COUNTRIES) {
  console.log(`\n${country.flag} ${country.name} (${country.iso3})`);

  const boundaryPath = join(ROOT, 'public', 'countries', `${country.iso3}.geojson`);
  const populationPath = join(ROOT, 'public', 'population', `${country.iso3}.json`);

  // 1. boundary file exists
  if (!existsSync(boundaryPath)) {
    fail(`boundary file missing: ${boundaryPath}`);
    continue;
  }
  const boundary = JSON.parse(readFileSync(boundaryPath, 'utf-8'));
  const geom = boundary?.features?.[0]?.geometry;
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
    fail(`boundary geometry invalid (type=${geom?.type})`);
    continue;
  }
  const bbox: [number, number, number, number] | undefined = boundary.bbox;
  if (!bbox) {
    fail('boundary is missing a bbox');
    continue;
  }
  console.log(`  boundary OK (${geom.type}, bbox=${bbox.map((n) => n.toFixed(2)).join(', ')})`);

  // 2. population file exists
  if (!existsSync(populationPath)) {
    warn(`population file not built yet: ${populationPath} (run scripts/build_population.py ${country.iso3})`);
    continue;
  }
  const data: PopulationDataFile = JSON.parse(readFileSync(populationPath, 'utf-8'));

  if (data.iso3 !== country.iso3) {
    fail(`population file iso3 mismatch: expected ${country.iso3}, got ${data.iso3}`);
    continue;
  }
  if (data.source !== 'worldpop') {
    fail(`population source is "${data.source}", expected "worldpop" -- refusing non-real data`);
    continue;
  }
  if (data.datasetYear !== country.populationYear) {
    fail(`dataset year mismatch: file says ${data.datasetYear}, metadata says ${country.populationYear}`);
    continue;
  }
  if (!Array.isArray(data.points) || data.points.length === 0) {
    fail('population file has no points');
    continue;
  }

  // 3. population sum > 0, 5. no NaN, 6. no negative population
  let sum = 0;
  let nanCount = 0;
  let negativeCount = 0;
  const margin = 2; // degrees -- generous, accounts for simplified boundaries
  const [minLon, minLat, maxLon, maxLat] = bbox;
  let outOfBoundsCount = 0;

  for (const [lon, lat, pop] of data.points) {
    if (Number.isNaN(lon) || Number.isNaN(lat) || Number.isNaN(pop)) {
      nanCount++;
      continue;
    }
    if (pop < 0) negativeCount++;
    if (lon < minLon - margin || lon > maxLon + margin || lat < minLat - margin || lat > maxLat + margin) {
      outOfBoundsCount++;
    }
    sum += pop;
  }

  if (nanCount > 0) fail(`${nanCount} point(s) contain NaN values`);
  if (negativeCount > 0) fail(`${negativeCount} point(s) have negative population`);
  if (outOfBoundsCount > 0) fail(`${outOfBoundsCount} point(s) fall well outside the country's bbox`);
  if (!(sum > 0)) fail('total population sum is not > 0');

  const declaredTotalDiffPct = Math.abs(sum - data.totalPopulation) / data.totalPopulation * 100;
  if (declaredTotalDiffPct > 0.1) {
    fail(`declared totalPopulation (${data.totalPopulation}) doesn't match summed points (${sum}), off by ${declaredTotalDiffPct.toFixed(4)}%`);
  }

  console.log(`  population OK (${data.points.length.toLocaleString()} points, total ${Math.round(sum).toLocaleString()})`);

  // 7 & 8: horizontal and vertical test splits return valid, consistent results
  const projected = projectPopulationData(data);
  const [cLon, cLat] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  const span = Math.max(maxLon - minLon, maxLat - minLat) * 2;

  const verticalLine = { p1: [cLon, minLat - span] as [number, number], p2: [cLon, maxLat + span] as [number, number] };
  const horizontalLine = { p1: [minLon - span, cLat] as [number, number], p2: [maxLon + span, cLat] as [number, number] };

  for (const [label, line] of [['vertical', verticalLine], ['horizontal', horizontalLine]] as const) {
    const result = engine.calculateCentroidSplit(projected, line);
    const totalPct = result.percentageA + result.percentageB;
    if (Math.abs(totalPct - 100) > 0.01) {
      fail(`${label} test split: percentages sum to ${totalPct}, expected ~100`);
    }
    if (Number.isNaN(result.percentageA) || Number.isNaN(result.score)) {
      fail(`${label} test split produced NaN`);
    }
    console.log(`  ${label} split OK (${result.percentageA.toFixed(2)}% / ${result.percentageB.toFixed(2)}%, score ${result.score.toFixed(2)})`);
  }

  fullyValidated++;
}

console.log(`\n${'='.repeat(50)}`);
console.log(`${fullyValidated}/${COUNTRIES.length} countries fully validated (boundary + real population data).`);
if (warnings > 0) console.log(`${warnings} warning(s) -- population data not yet built for some countries.`);
if (hardFailures > 0) {
  console.error(`${hardFailures} hard failure(s).`);
  process.exit(1);
} else {
  console.log('No hard failures.');
}
