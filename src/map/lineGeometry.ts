/**
 * Clips the infinite line through (x1,y1)-(x2,y2) (pixel space) against a
 * width x height rectangle, so the player's drawn line visually extends all
 * the way to the edges of the map viewport (per design spec section 6),
 * regardless of how short the actual drag gesture was.
 *
 * Returns null for a degenerate (near-zero-length) gesture, or a line whose
 * direction can't be determined yet.
 */
export function clipLineToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
): [[number, number], [number, number]] | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.hypot(dx, dy) < 1e-6) return null;

  // Parametrize P(t) = (x1,y1) + t*(dx,dy) and find the t-range where P(t) is
  // inside [0,width] x [0,height] (Liang-Barsky clipping against an infinite line).
  let tMin = -Infinity;
  let tMax = Infinity;

  const clip = (p: number, q: number) => {
    if (p === 0) {
      if (q < 0) return false; // parallel to this boundary and outside it
      return true;
    }
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
    return true;
  };

  if (!clip(-dx, x1 - 0)) return null;
  if (!clip(dx, width - x1)) return null;
  if (!clip(-dy, y1 - 0)) return null;
  if (!clip(dy, height - y1)) return null;

  if (tMin > tMax) return null;

  const p1: [number, number] = [x1 + tMin * dx, y1 + tMin * dy];
  const p2: [number, number] = [x1 + tMax * dx, y1 + tMax * dy];
  return [p1, p2];
}
