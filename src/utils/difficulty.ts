import type { Difficulty, PopulationDataFile } from '../types';

/**
 * Data-driven difficulty heuristic (section 9 of the design spec).
 *
 * The MVP ships manually-assigned difficulty ratings in src/data/countries.ts.
 * This function computes a heuristic score from the same population grid the
 * game already loads, so it can eventually replace (or validate) the manual
 * ratings without guessing. Not wired into gameplay yet -- exposed for the
 * debug panel (?debug=true) and future automation.
 *
 * Signals used:
 *  - largestCellShare: the biggest single grid cell's share of total
 *    population (proxy for "one metro area dominates the result").
 *  - dispersion: population-weighted standard distance from the population
 *    centroid, normalized by the country's bounding-box diagonal (proxy for
 *    how spread out / clustered the population is).
 */
export function computeDifficultyHeuristic(data: PopulationDataFile): {
  largestCellShare: number;
  dispersion: number;
  estimatedDifficulty: Difficulty;
} {
  const total = data.totalPopulation;
  let largest = 0;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat, pop] of data.points) {
    if (pop > largest) largest = pop;
    sumLon += lon * pop;
    sumLat += lat * pop;
  }
  const centroidLon = sumLon / total;
  const centroidLat = sumLat / total;

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  let weightedSqDist = 0;
  for (const [lon, lat, pop] of data.points) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    const dLon = lon - centroidLon;
    const dLat = lat - centroidLat;
    weightedSqDist += (dLon * dLon + dLat * dLat) * pop;
  }
  const stdDistance = Math.sqrt(weightedSqDist / total);
  const bboxDiagonal = Math.hypot(maxLon - minLon, maxLat - minLat) || 1;

  const largestCellShare = largest / total;
  const dispersion = stdDistance / bboxDiagonal;

  // Higher dispersion + higher single-cell dominance => harder to guess a 50/50 line.
  const rawScore = dispersion * 3 + largestCellShare * 10;
  const estimatedDifficulty: Difficulty =
    rawScore < 0.4 ? 1 : rawScore < 0.8 ? 2 : rawScore < 1.3 ? 3 : rawScore < 1.8 ? 4 : 5;

  return { largestCellShare, dispersion, estimatedDifficulty };
}
