import type { ProjectedPopulation } from './populationSplitEngine';
import { mercatorToLonLat } from '../utils/projection';
import type { SplitLine } from '../types';

/**
 * Development/validation utility (also powers the "one possible 50/50 split"
 * example line shown after a result). Explicitly NOT "the correct line" —
 * there are infinitely many lines that produce ~50/50, this just finds one.
 *
 * Method (per design doc section 25):
 * For a chosen angle theta, project every population point onto the axis
 * perpendicular to theta, sort by that projection, and walk the cumulative
 * population to find the weighted median. A line through that median point,
 * running in direction theta, is a near-perfect population-halving line for
 * that angle.
 */
export function findSplitLineForAngle(
  pop: ProjectedPopulation,
  angleDeg: number
): SplitLine {
  const theta = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(theta), y: Math.sin(theta) };
  const normal = { x: -Math.sin(theta), y: Math.cos(theta) };

  const { x, y, population, count } = pop;

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < count; i++) {
    cx += x[i];
    cy += y[i];
  }
  cx /= count;
  cy /= count;

  const projections = new Array(count);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const u = (x[i] - cx) * normal.x + (y[i] - cy) * normal.y;
    projections[i] = { u, pop: population[i] };
    total += population[i];
  }
  projections.sort((a, b) => a.u - b.u);

  let cumulative = 0;
  let medianU = projections[0]?.u ?? 0;
  const half = total / 2;
  for (const p of projections) {
    cumulative += p.pop;
    if (cumulative >= half) {
      medianU = p.u;
      break;
    }
  }

  // Extend far enough to cross any country's bounding box; the map layer
  // additionally extends the visual line to the viewport edges.
  const REACH = 5_000_000; // meters
  const originX = cx + medianU * normal.x;
  const originY = cy + medianU * normal.y;
  const p1m = { x: originX - dir.x * REACH, y: originY - dir.y * REACH };
  const p2m = { x: originX + dir.x * REACH, y: originY + dir.y * REACH };

  return {
    p1: mercatorToLonLat(p1m.x, p1m.y),
    p2: mercatorToLonLat(p2m.x, p2m.y),
  };
}

/**
 * Searches across angles (default every 5 degrees from 0-175) and returns the
 * angle whose weighted-median line comes closest to an exact 50/50 split when
 * actually evaluated with the centroid split test. Used by debug tooling and
 * to generate example lines; never displayed as "the correct answer".
 */
export function searchNearOptimalLine(
  pop: ProjectedPopulation,
  evaluate: (line: SplitLine) => number, // returns abs error from 50/50
  angleStepDeg = 5
): { line: SplitLine; angleDeg: number; error: number } {
  let best: { line: SplitLine; angleDeg: number; error: number } | null = null;
  for (let angle = 0; angle < 180; angle += angleStepDeg) {
    const line = findSplitLineForAngle(pop, angle);
    const error = evaluate(line);
    if (!best || error < best.error) {
      best = { line, angleDeg: angle, error };
    }
  }
  return best!;
}
