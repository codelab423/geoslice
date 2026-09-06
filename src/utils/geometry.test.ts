import { describe, it, expect } from 'vitest';
import { sideOfLine } from './geometry';

describe('sideOfLine', () => {
  // Which literal label ('A' vs 'B') a given side gets is an arbitrary
  // consequence of the cross-product sign convention -- these tests assert
  // the properties that actually matter: opposite points get different
  // labels, and reversing the line's direction swaps them consistently.

  it('classifies points on opposite sides of a vertical line differently', () => {
    const left = sideOfLine(0, -10, 0, 10, -5, 0);
    const right = sideOfLine(0, -10, 0, 10, 5, 0);
    expect(left).not.toBe(right);
    expect(['A', 'B']).toContain(left);
    expect(['A', 'B']).toContain(right);
  });

  it('classifies points on opposite sides of a horizontal line differently', () => {
    const above = sideOfLine(-10, 0, 10, 0, 0, 5);
    const below = sideOfLine(-10, 0, 10, 0, 0, -5);
    expect(above).not.toBe(below);
  });

  it('classifies points on opposite sides of a diagonal line differently', () => {
    const upperLeft = sideOfLine(-10, -10, 10, 10, -5, 5);
    const lowerRight = sideOfLine(-10, -10, 10, 10, 5, -5);
    expect(upperLeft).not.toBe(lowerRight);
  });

  it('treats a point exactly on the line as ON_LINE', () => {
    expect(sideOfLine(0, 0, 10, 10, 5, 5)).toBe('ON_LINE');
    expect(sideOfLine(-10, 0, 10, 0, 3, 0)).toBe('ON_LINE');
  });

  it('treats a point within the epsilon distance of the line as ON_LINE (Float32 rounding tolerance)', () => {
    expect(sideOfLine(-1_000_000, 0, 1_000_000, 0, 3, 0.5)).toBe('ON_LINE');
  });

  it('flips A/B when the line endpoints are reversed, for the same point', () => {
    const forward = sideOfLine(0, -10, 0, 10, 5, 0);
    const reversed = sideOfLine(0, 10, 0, -10, 5, 0);
    expect(forward).not.toBe(reversed);
    expect(['A', 'B']).toContain(forward);
    expect(['A', 'B']).toContain(reversed);
  });
});
