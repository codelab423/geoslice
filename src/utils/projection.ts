/**
 * Web Mercator projection helpers.
 *
 * We deliberately project into the SAME coordinate system MapLibre renders with
 * (spherical Web Mercator), rather than an azimuthal-equidistant local CRS.
 * The player draws a straight line in screen/map space, which is a straight
 * line in Mercator XY — so classifying population points in that same space
 * guarantees the calculation matches exactly what the player sees. Using a
 * different projection (e.g. azimuthal equidistant) would classify points
 * against a line that looks curved on the rendered Mercator map, which would
 * feel broken. Raw lon/lat is avoided because a degree of longitude shrinks
 * with latitude, which would bias the side test at high latitudes (Norway,
 * Canada, etc.) relative to what's rendered.
 */

const EARTH_RADIUS = 6378137; // meters, WGS84 semi-major axis (matches Web Mercator convention)

export interface ProjectedPoint {
  x: number;
  y: number;
}

export function lonLatToMercator(lon: number, lat: number): ProjectedPoint {
  const x = (lon * Math.PI) / 180 * EARTH_RADIUS;
  const clampedLat = Math.max(Math.min(lat, 85.051129), -85.051129);
  const y =
    Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360)) * EARTH_RADIUS;
  return { x, y };
}

export function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}
