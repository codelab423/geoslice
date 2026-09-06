import { describe, it, expect } from 'vitest';
import { findSplitLineForAngle, searchNearOptimalLine } from './bestLineSearch';
import { PopulationSplitEngine, projectPopulationData } from './populationSplitEngine';
import type { PopulationDataFile } from '../types';

function makeData(points: [number, number, number][]): PopulationDataFile {
  return {
    iso3: 'TST',
    source: 'worldpop',
    datasetYear: 2020,
    totalPopulation: points.reduce((s, p) => s + p[2], 0),
    cellCount: points.length,
    points,
  };
}

describe('weighted-median best line search', () => {
  const engine = new PopulationSplitEngine('linear');

  it('finds a near-perfect 50/50 line for a random population distribution', () => {
    const points: [number, number, number][] = [];
    for (let i = 0; i < 500; i++) {
      const lon = -3 + Math.random() * 6;
      const lat = 40 + Math.random() * 8;
      const pop = Math.random() * 1000 + 1;
      points.push([lon, lat, pop]);
    }
    const pop = projectPopulationData(makeData(points));

    const line = findSplitLineForAngle(pop, 90); // vertical-ish split
    const result = engine.calculateCentroidSplit(pop, line);
    expect(result.error).toBeLessThan(3); // should land close to 50/50
  });

  it('searchNearOptimalLine picks an angle whose evaluated error is small', () => {
    const points: [number, number, number][] = [];
    for (let i = 0; i < 300; i++) {
      const lon = -3 + Math.random() * 6;
      const lat = 40 + Math.random() * 8;
      points.push([lon, lat, Math.random() * 500 + 1]);
    }
    const pop = projectPopulationData(makeData(points));

    const { error } = searchNearOptimalLine(
      pop,
      (line) => engine.calculateCentroidSplit(pop, line).error,
      10
    );
    expect(error).toBeLessThan(5);
  });
});
