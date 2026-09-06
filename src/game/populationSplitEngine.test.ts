import { describe, it, expect } from 'vitest';
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

describe('PopulationSplitEngine.calculateCentroidSplit', () => {
  const engine = new PopulationSplitEngine('linear');

  it('splits an evenly distributed grid exactly 50/50 with a vertical line through the center', () => {
    const points: [number, number, number][] = [];
    for (let lon = -2; lon <= 2; lon += 0.5) {
      for (let lat = 40; lat <= 44; lat += 0.5) {
        points.push([lon, lat, 100]);
      }
    }
    const pop = projectPopulationData(makeData(points));
    const result = engine.calculateCentroidSplit(pop, { p1: [0, 30], p2: [0, 50] });
    expect(result.percentageA).toBeCloseTo(50, 0);
    expect(result.error).toBeLessThan(1);
    expect(result.percentageA + result.percentageB).toBeCloseTo(100, 6);
  });

  it('puts all population on one side when the line does not cross any points', () => {
    const points: [number, number, number][] = [
      [5, 50, 1000],
      [6, 51, 2000],
      [7, 52, 500],
    ];
    const pop = projectPopulationData(makeData(points));
    // Line far to the west of every point.
    const result = engine.calculateCentroidSplit(pop, { p1: [-50, 0], p2: [-50, 80] });
    expect(result.populationA + result.populationB).toBeCloseTo(3500, 4);
    expect([0, 100]).toContain(Math.round(result.percentageA));
  });

  it('splits a horizontal line the same way a vertical line splits its rotated equivalent', () => {
    const points: [number, number, number][] = [];
    for (let lon = -2; lon <= 2; lon += 0.5) {
      for (let lat = 40; lat <= 44; lat += 0.5) {
        points.push([lon, lat, 100]);
      }
    }
    const pop = projectPopulationData(makeData(points));
    const result = engine.calculateCentroidSplit(pop, { p1: [-50, 42], p2: [50, 42] });
    expect(result.percentageA).toBeCloseTo(50, 0);
  });

  it('splits a diagonal line and total percentages always sum to 100', () => {
    const points: [number, number, number][] = [];
    for (let lon = -2; lon <= 2; lon += 0.4) {
      for (let lat = 40; lat <= 44; lat += 0.4) {
        points.push([lon, lat, Math.random() * 100 + 1]);
      }
    }
    const pop = projectPopulationData(makeData(points));
    const result = engine.calculateCentroidSplit(pop, { p1: [-10, 30], p2: [10, 54] });
    expect(result.percentageA + result.percentageB).toBeCloseTo(100, 6);
  });

  it('reversing the line endpoints swaps A/B but keeps error and score identical', () => {
    const points: [number, number, number][] = [
      [1, 50, 300],
      [2, 51, 700],
      [-1, 49, 450],
      [-3, 48, 900],
    ];
    const pop = projectPopulationData(makeData(points));
    const forward = engine.calculateCentroidSplit(pop, { p1: [0, 45], p2: [0, 55] });
    const reversed = engine.calculateCentroidSplit(pop, { p1: [0, 55], p2: [0, 45] });

    expect(reversed.percentageA).toBeCloseTo(forward.percentageB, 6);
    expect(reversed.percentageB).toBeCloseTo(forward.percentageA, 6);
    expect(reversed.error).toBeCloseTo(forward.error, 9);
    expect(reversed.score).toBeCloseTo(forward.score, 9);
  });

  it('splits a population cell exactly on the line 50/50 between both sides', () => {
    const points: [number, number, number][] = [[0, 50, 1000]];
    const pop = projectPopulationData(makeData(points));
    // Vertical line passing exactly through the point's longitude.
    const result = engine.calculateCentroidSplit(pop, { p1: [0, 0], p2: [0, 80] });
    expect(result.populationA).toBeCloseTo(500, 1);
    expect(result.populationB).toBeCloseTo(500, 1);
  });

  it('calculateExactSplit is explicitly not implemented yet (future upgrade hook)', () => {
    const pop = projectPopulationData(makeData([[0, 50, 100]]));
    expect(() => engine.calculateExactSplit(pop, { p1: [0, 0], p2: [0, 1] })).toThrow();
  });
});
