import type { PopulationDataFile, SplitLine, SplitResult } from '../types';
import { lonLatToMercator } from '../utils/projection';
import { sideOfLine } from '../utils/geometry';
import { scoreFromError, computeError } from '../utils/scoring';
import type { ScoringCurve } from '../utils/scoring';

/**
 * Population grid points pre-projected into Mercator XY once per country load,
 * so that redrawing the line during play only does cheap side-of-line tests
 * (no re-projection). Matches the "cache on load" performance requirement.
 */
export interface ProjectedPopulation {
  iso3: string;
  count: number;
  x: Float32Array;
  y: Float32Array;
  population: Float32Array;
  totalPopulation: number;
  datasetYear: number;
}

export function projectPopulationData(data: PopulationDataFile): ProjectedPopulation {
  const count = data.points.length;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const population = new Float32Array(count);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const [lon, lat, pop] = data.points[i];
    const { x: mx, y: my } = lonLatToMercator(lon, lat);
    x[i] = mx;
    y[i] = my;
    population[i] = pop;
    total += pop;
  }
  return {
    iso3: data.iso3,
    count,
    x,
    y,
    population,
    totalPopulation: total,
    datasetYear: data.datasetYear,
  };
}

/**
 * Core engine for turning a player-drawn line + a country's projected population
 * grid into a split result. Architected with two interchangeable methods:
 *  - calculateCentroidSplit: classify each grid cell by its center point (fast,
 *    used for the MVP; accurate enough given fine-enough grid resolution).
 *  - calculateExactSplit: placeholder for a future upgrade that represents each
 *    cell as a small polygon and splits cells crossed by the line proportionally
 *    by area, rather than an all-or-nothing centroid test.
 */
export class PopulationSplitEngine {
  constructor(private scoringCurve: ScoringCurve = 'linear') {}

  calculateCentroidSplit(pop: ProjectedPopulation, line: SplitLine): SplitResult {
    const start = performance.now();
    const { x: x1m, y: y1m } = lonLatToMercator(line.p1[0], line.p1[1]);
    const { x: x2m, y: y2m } = lonLatToMercator(line.p2[0], line.p2[1]);

    let populationA = 0;
    let populationB = 0;
    const { x, y, population, count } = pop;

    for (let i = 0; i < count; i++) {
      const side = sideOfLine(x1m, y1m, x2m, y2m, x[i], y[i]);
      if (side === 'A') {
        populationA += population[i];
      } else if (side === 'B') {
        populationB += population[i];
      } else {
        // On the line (extremely rare in floating point terms): split evenly.
        populationA += population[i] / 2;
        populationB += population[i] / 2;
      }
    }

    return this.buildResult(populationA, populationB, count, performance.now() - start);
  }

  /**
   * Future upgrade hook: split cells that the line actually crosses proportionally
   * by area rather than by centroid alone. Not implemented for the initial release
   * (the centroid method is accurate enough at our grid resolution and this keeps
   * submit-time calculation cheap); throwing here makes the gap explicit rather
   * than silently degrading to the centroid method under a different name.
   */
  calculateExactSplit(_pop: ProjectedPopulation, _line: SplitLine): SplitResult {
    throw new Error(
      'calculateExactSplit is not implemented yet. Use calculateCentroidSplit — see PopulationSplitEngine docs for the planned cell-intersection upgrade.'
    );
  }

  private buildResult(
    populationA: number,
    populationB: number,
    cellCount: number,
    calculationTimeMs: number
  ): SplitResult {
    const totalPopulation = populationA + populationB;
    const percentageA = (populationA / totalPopulation) * 100;
    const percentageB = (populationB / totalPopulation) * 100;
    const error = computeError(percentageA);
    const score = scoreFromError(error, this.scoringCurve);
    return {
      populationA,
      populationB,
      totalPopulation,
      percentageA,
      percentageB,
      error,
      score,
      calculationTimeMs,
      cellCount,
    };
  }
}
