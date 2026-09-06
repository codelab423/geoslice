import { describe, it, expect } from 'vitest';
import { computeError, scoreLinear, scoreExponential, tierFromError } from './scoring';

describe('scoring', () => {
  it('gives a perfect score for a perfect 50/50 split', () => {
    expect(computeError(50)).toBe(0);
    expect(scoreLinear(0)).toBe(100);
    expect(scoreExponential(0)).toBeCloseTo(100, 5);
  });

  it('matches the spec examples for the linear curve', () => {
    expect(scoreLinear(computeError(49.5))).toBeCloseTo(99, 5);
    expect(scoreLinear(computeError(48))).toBeCloseTo(96, 5);
    expect(scoreLinear(computeError(45))).toBeCloseTo(90, 5);
    expect(scoreLinear(computeError(30))).toBeCloseTo(60, 5);
  });

  it('error is symmetric whether percentageA is above or below 50', () => {
    expect(computeError(60)).toBe(computeError(40));
  });

  it('never returns a negative score even for extreme error', () => {
    expect(scoreLinear(100)).toBe(0);
  });

  it('exponential curve punishes large errors more than linear', () => {
    const error = 20;
    expect(scoreExponential(error)).toBeLessThan(scoreLinear(error));
  });

  it('assigns result tiers per the spec thresholds', () => {
    expect(tierFromError(0.03)).toBe('INSANE SPLIT');
    expect(tierFromError(0.2)).toBe('NEAR PERFECT');
    expect(tierFromError(0.9)).toBe('EXCELLENT');
    expect(tierFromError(2)).toBe('GREAT');
    expect(tierFromError(4)).toBe('GOOD');
    expect(tierFromError(10)).toBe('KEEP TRYING');
  });
});
