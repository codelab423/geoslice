export type Side = 'A' | 'B' | 'ON_LINE';

/**
 * Classifies point (xp, yp) relative to the directed line through (x1,y1) -> (x2,y2),
 * all in the same projected (planar) coordinate system.
 *
 * cross = (x2-x1)*(yp-y1) - (y2-y1)*(xp-x1)
 * cross > 0 -> Side A, cross < 0 -> Side B, |cross| ~ 0 -> ON_LINE
 *
 * Reversing p1/p2 flips the sign of `cross` and therefore swaps A/B, but does not
 * change which points are classified together — so the resulting 50/50 error and
 * score are direction-invariant.
 *
 * `cross / lineLen` is the point's exact perpendicular distance from the line,
 * in the same units as x/y (meters, for our Mercator-projected callers) — NOT
 * a dimensionless ratio. `epsilon` is therefore a distance too: population
 * point coordinates are stored as Float32 for memory/perf (see
 * projectPopulationData), which alone introduces ~0.1-1m of rounding versus
 * the endpoints' full-precision Mercator coordinates, so an epsilon much
 * tighter than ~1m would make ON_LINE nearly unreachable even for points a
 * game designer would call "exactly on the line". 1m is still utterly
 * negligible next to our ~1km population grid resolution.
 */
export function sideOfLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  xp: number,
  yp: number,
  epsilon = 1.0
): Side {
  const cross = (x2 - x1) * (yp - y1) - (y2 - y1) * (xp - x1);
  const lineLen = Math.hypot(x2 - x1, y2 - y1) || 1;
  const distance = cross / lineLen;
  if (Math.abs(distance) < epsilon) return 'ON_LINE';
  return distance > 0 ? 'A' : 'B';
}
