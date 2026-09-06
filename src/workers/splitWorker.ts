/// <reference lib="webworker" />
import { sideOfLine } from '../utils/geometry';
import { lonLatToMercator } from '../utils/projection';
import { scoreFromError, computeError } from '../utils/scoring';
import type { ScoringCurve } from '../utils/scoring';

/**
 * The population grid (up to ~40k points) is sent ONCE via an 'init' message
 * when a country loads, not on every pointer move — only the line (a handful
 * of numbers) is sent per live-mode update. This keeps live-mode dragging cheap
 * even though postMessage structured-clones its payload.
 */
export type SplitWorkerMessage =
  | {
      type: 'init';
      x: Float32Array;
      y: Float32Array;
      population: Float32Array;
      count: number;
    }
  | {
      type: 'classify';
      requestId: number;
      line: { p1: [number, number]; p2: [number, number] };
      scoringCurve: ScoringCurve;
    };

export interface SplitWorkerResponse {
  requestId: number;
  populationA: number;
  populationB: number;
  totalPopulation: number;
  percentageA: number;
  percentageB: number;
  error: number;
  score: number;
  calculationTimeMs: number;
  cellCount: number;
}

const ctx: DedicatedWorkerGlobalScope = self as any;

let gx: Float32Array | null = null;
let gy: Float32Array | null = null;
let gpop: Float32Array | null = null;
let gcount = 0;

ctx.onmessage = (e: MessageEvent<SplitWorkerMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    gx = msg.x;
    gy = msg.y;
    gpop = msg.population;
    gcount = msg.count;
    return;
  }

  if (!gx || !gy || !gpop) return;
  const { requestId, line, scoringCurve } = msg;
  const start = performance.now();

  const { x: x1, y: y1 } = lonLatToMercator(line.p1[0], line.p1[1]);
  const { x: x2, y: y2 } = lonLatToMercator(line.p2[0], line.p2[1]);

  let populationA = 0;
  let populationB = 0;
  for (let i = 0; i < gcount; i++) {
    const side = sideOfLine(x1, y1, x2, y2, gx[i], gy[i]);
    if (side === 'A') populationA += gpop[i];
    else if (side === 'B') populationB += gpop[i];
    else {
      populationA += gpop[i] / 2;
      populationB += gpop[i] / 2;
    }
  }

  const totalPopulation = populationA + populationB;
  const percentageA = (populationA / totalPopulation) * 100;
  const percentageB = (populationB / totalPopulation) * 100;
  const error = computeError(percentageA);
  const score = scoreFromError(error, scoringCurve);

  const response: SplitWorkerResponse = {
    requestId,
    populationA,
    populationB,
    totalPopulation,
    percentageA,
    percentageB,
    error,
    score,
    calculationTimeMs: performance.now() - start,
    cellCount: gcount,
  };
  ctx.postMessage(response);
};
