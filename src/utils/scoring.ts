import type { ResultTier } from '../types';

/** error = abs(50 - percentageA), symmetric regardless of which side is "A". */
export function computeError(percentageA: number): number {
  return Math.abs(50 - percentageA);
}

/** Default scoring curve: linear, -2 points per percentage point of error. */
export function scoreLinear(error: number): number {
  return Math.max(0, 100 - error * 2);
}

/**
 * Alternative competitive scoring curve that punishes large errors much more
 * strongly than the linear default, while still giving ~100 for a perfect split.
 * score = 100 * exp(-k * error^p)
 */
export function scoreExponential(error: number, k = 0.05, p = 1.6): number {
  return 100 * Math.exp(-k * Math.pow(error, p));
}

export type ScoringCurve = 'linear' | 'exponential';

export function scoreFromError(error: number, curve: ScoringCurve = 'linear'): number {
  return curve === 'exponential' ? scoreExponential(error) : scoreLinear(error);
}

export function tierFromError(error: number): ResultTier {
  if (error <= 0.05) return 'INSANE SPLIT';
  if (error <= 0.25) return 'NEAR PERFECT';
  if (error <= 1) return 'EXCELLENT';
  if (error <= 2.5) return 'GREAT';
  if (error <= 5) return 'GOOD';
  return 'KEEP TRYING';
}

/** 3 decimals for very tight splits, 2 decimals otherwise, per spec section 8. */
export function formatPercentage(pct: number): string {
  const decimals = Math.abs(50 - pct) <= 0.25 ? 3 : 2;
  return pct.toFixed(decimals);
}
