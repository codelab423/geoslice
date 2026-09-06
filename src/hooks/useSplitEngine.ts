import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PopulationDataFile, SplitLine, SplitResult } from '../types';
import {
  PopulationSplitEngine,
  projectPopulationData,
  type ProjectedPopulation,
} from '../game/populationSplitEngine';
import type { SplitWorkerMessage, SplitWorkerResponse } from '../workers/splitWorker';
import type { ScoringCurve } from '../utils/scoring';

/**
 * Owns a country's projected population grid (computed once per country load)
 * plus a dedicated worker for cheap live-mode side tests, so line dragging never
 * blocks the main thread. Final submit results are always computed synchronously
 * on the main thread for determinism and to avoid a message round trip on the
 * number the player actually sees.
 */
export function useSplitEngine(data: PopulationDataFile | null, scoringCurve: ScoringCurve) {
  const engineRef = useRef(new PopulationSplitEngine(scoringCurve));
  const projectedRef = useRef<ProjectedPopulation | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, (r: SplitResult) => void>>(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    engineRef.current = new PopulationSplitEngine(scoringCurve);
  }, [scoringCurve]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/splitWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<SplitWorkerResponse>) => {
      const resolve = pendingRef.current.get(e.data.requestId);
      if (resolve) {
        resolve(e.data);
        pendingRef.current.delete(e.data.requestId);
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!data) {
      projectedRef.current = null;
      return;
    }
    const projected = projectPopulationData(data);
    projectedRef.current = projected;
    const initMsg: SplitWorkerMessage = {
      type: 'init',
      x: projected.x,
      y: projected.y,
      population: projected.population,
      count: projected.count,
    };
    workerRef.current?.postMessage(initMsg);
  }, [data]);

  const isReady = useMemo(() => !!data, [data]);

  const calculateSync = useCallback((line: SplitLine): SplitResult | null => {
    const pop = projectedRef.current;
    if (!pop) return null;
    return engineRef.current.calculateCentroidSplit(pop, line);
  }, []);

  /** For live mode: off main thread, cheap, safe to call frequently (still debounce in the caller). */
  const calculateLive = useCallback(
    (line: SplitLine, curve: ScoringCurve): Promise<SplitResult> | null => {
      const pop = projectedRef.current;
      const worker = workerRef.current;
      if (!pop || !worker) return null;
      const requestId = requestIdRef.current++;
      const msg: SplitWorkerMessage = {
        type: 'classify',
        requestId,
        line,
        scoringCurve: curve,
      };
      return new Promise((resolve) => {
        pendingRef.current.set(requestId, resolve as any);
        worker.postMessage(msg);
      });
    },
    []
  );

  const getProjected = useCallback(() => projectedRef.current, []);

  return { isReady, calculateSync, calculateLive, getProjected };
}
