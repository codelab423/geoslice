import { lonLatToMercator } from './projection';
import { sideOfLine } from './geometry';
import type { SplitLine } from '../types';

/**
 * The split engine's "Side A" / "Side B" are just whichever side of the
 * cross-product sign convention -- purely a function of which endpoint the
 * player dragged from first, not a fixed screen direction. The UI always
 * labels results "LEFT" / "RIGHT" though, so we need to know, for a given
 * line, whether Side A actually sits on the west (left, since the map never
 * rotates) or east side of the country.
 *
 * Probing with the country bbox's west/east edge midpoints is cheap and
 * avoids recomputing the full polygon split just to answer "which side is
 * which" -- CountryMap does that separately for the visual fill.
 */
export function isSideALeft(
  bbox: [number, number, number, number],
  line: SplitLine
): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const west = lonLatToMercator(minLon, midLat);
  const { x: x1, y: y1 } = lonLatToMercator(line.p1[0], line.p1[1]);
  const { x: x2, y: y2 } = lonLatToMercator(line.p2[0], line.p2[1]);
  const westSide = sideOfLine(x1, y1, x2, y2, west.x, west.y);
  return westSide !== 'B'; // treat ON_LINE as "still A/left" -- an arbitrary but consistent tie-break
}
