import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { SplitLine } from '../types';

/**
 * Splits a country polygon into its "Side A" / "Side B" pieces for the
 * post-submit reveal (different fill per side). Purely visual -- the actual
 * score always comes from the population grid classification, never from
 * this polygon geometry.
 *
 * Implementation: build two huge rectangles, one on each side of the
 * (infinitely extended) split line, and intersect each with the country
 * polygon.
 */
export function splitPolygonByLine(
  country: Feature<Polygon | MultiPolygon>,
  line: SplitLine
): { sideA: Feature<Polygon | MultiPolygon> | null; sideB: Feature<Polygon | MultiPolygon> | null } {
  const [lon1, lat1] = line.p1;
  const [lon2, lat2] = line.p2;
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const len = Math.hypot(dx, dy) || 1;
  // Unit vector along the line, and its perpendicular (normal).
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const REACH = 200; // degrees -- comfortably covers the whole globe

  const rectOnSide = (sign: 1 | -1): Feature<Polygon> => {
    const cx = lon1 + nx * sign * 0.0001; // nudge just off the line
    const cy = lat1 + ny * sign * 0.0001;
    const corners: [number, number][] = [
      [cx - ux * REACH, cy - uy * REACH],
      [cx + ux * REACH, cy + uy * REACH],
      [cx + ux * REACH + nx * sign * REACH, cy + uy * REACH + ny * sign * REACH],
      [cx - ux * REACH + nx * sign * REACH, cy - uy * REACH + ny * sign * REACH],
    ];
    return turf.polygon([[...corners, corners[0]]]);
  };

  const rectA = rectOnSide(1);
  const rectB = rectOnSide(-1);

  const safeIntersect = (rect: Feature<Polygon>) => {
    try {
      const result = turf.intersect(turf.featureCollection([country, rect]));
      return result as Feature<Polygon | MultiPolygon> | null;
    } catch {
      return null;
    }
  };

  return {
    sideA: safeIntersect(rectA),
    sideB: safeIntersect(rectB),
  };
}
