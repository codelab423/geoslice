import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { CityLabel, DrawMode, PopulationDataFile, SplitLine } from '../types';
import { clipLineToRect } from '../map/lineGeometry';
import { splitPolygonByLine } from '../map/splitVisualization';

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b0e14' } }],
};

const SOURCE_COUNTRY = 'country';
const SOURCE_LINE = 'split-line';
const SOURCE_SIDE_A = 'side-a';
const SOURCE_SIDE_B = 'side-b';
const SOURCE_POP = 'population-points';
const SOURCE_TAP_POINTS = 'tap-points';

const EMPTY_FC = turf.featureCollection([]);

interface Props {
  boundary: GeoJSON.FeatureCollection;
  population?: PopulationDataFile;
  line: SplitLine | null;
  onLineChange: (line: SplitLine | null) => void;
  locked: boolean;
  resultRevealed: boolean;
  /** Which screen side Side A (the engine's cross-product-positive side) is actually on,
   *  so the fill color always matches the LEFT/RIGHT labels shown in the result panel. */
  sideALabel: 'left' | 'right';
  showPopulationHeatmap: boolean;
  hardcoreMode: boolean;
  /** 'drag': press-drag-release draws the line. 'points': tap point A, then tap
   *  point B, and they're connected automatically. Both are always implemented;
   *  this only selects which one the current pointer gestures drive. */
  drawMode: DrawMode;
  /** Decorative-only city labels (see CityLabel) -- never affects scoring. */
  cities: CityLabel[];
  showCities: boolean;
}

const LEFT_COLOR = '#ff6b6b';
const RIGHT_COLOR = '#4ecdc4';

/** A point the player has tapped in 'points' mode, kept in both pixel space
 *  (to feed clipLineToRect, same as the drag path) and lon/lat (for the marker
 *  source and for handing off to onLineChange). */
interface TapPoint {
  x: number;
  y: number;
  lon: number;
  lat: number;
}

export default function CountryMap({
  boundary,
  population,
  line,
  onLineChange,
  locked,
  resultRevealed,
  sideALabel,
  showPopulationHeatmap,
  hardcoreMode,
  drawMode,
  cities,
  showCities,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const draggingRef = useRef(false);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const onLineChangeRef = useRef(onLineChange);
  onLineChangeRef.current = onLineChange;

  // Initialize the map once. No tile server, no API key: just a dark
  // background plus our own local GeoJSON sources/layers.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      attributionControl: false,
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      touchPitch: false,
      keyboard: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(SOURCE_COUNTRY, { type: 'geojson', data: EMPTY_FC as any });
      map.addLayer({
        id: 'country-fill',
        type: 'fill',
        source: SOURCE_COUNTRY,
        paint: { 'fill-color': '#2a3350', 'fill-opacity': 1 },
      });
      map.addLayer({
        id: 'country-outline',
        type: 'line',
        source: SOURCE_COUNTRY,
        paint: { 'line-color': '#5b6b98', 'line-width': 1.5 },
      });

      map.addSource(SOURCE_SIDE_A, { type: 'geojson', data: EMPTY_FC as any });
      map.addLayer({
        id: 'side-a-fill',
        type: 'fill',
        source: SOURCE_SIDE_A,
        paint: { 'fill-color': '#ff6b6b', 'fill-opacity': 0 },
      });
      map.addSource(SOURCE_SIDE_B, { type: 'geojson', data: EMPTY_FC as any });
      map.addLayer({
        id: 'side-b-fill',
        type: 'fill',
        source: SOURCE_SIDE_B,
        paint: { 'fill-color': '#4ecdc4', 'fill-opacity': 0 },
      });

      map.addSource(SOURCE_POP, { type: 'geojson', data: EMPTY_FC as any });
      map.addLayer({
        id: 'population-heatmap',
        type: 'heatmap',
        source: SOURCE_POP,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'population'], 0, 0, 2000, 1],
          'heatmap-intensity': 0.8,
          'heatmap-radius': 18,
          'heatmap-opacity': 0,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(79,141,255,0.3)',
            0.5, 'rgba(251,191,36,0.6)',
            1, 'rgba(248,113,113,0.9)',
          ],
        },
      });

      map.addSource(SOURCE_LINE, { type: 'geojson', data: EMPTY_FC as any });
      map.addLayer({
        id: 'split-line',
        type: 'line',
        source: SOURCE_LINE,
        paint: {
          'line-color': '#eef1f8',
          'line-width': 3,
          'line-dasharray': [2, 1.5],
        },
      });

      // Point-to-point mode markers: point A and point B stay visible on the
      // map (distinct colors) once tapped, on top of everything else.
      map.addSource(SOURCE_TAP_POINTS, { type: 'geojson', data: EMPTY_FC as any });
      map.addLayer({
        id: 'tap-points',
        type: 'circle',
        source: SOURCE_TAP_POINTS,
        paint: {
          'circle-radius': 7,
          'circle-color': ['match', ['get', 'role'], 'a', '#4f8dff', 'b', '#eef1f8', '#4f8dff'],
          'circle-stroke-color': '#05070c',
          'circle-stroke-width': 2,
        },
      });

      setReady(true);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the country boundary + fit bounds whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(SOURCE_COUNTRY) as maplibregl.GeoJSONSource;
    source?.setData(boundary as any);
    (map.getSource(SOURCE_LINE) as maplibregl.GeoJSONSource)?.setData(EMPTY_FC as any);
    (map.getSource(SOURCE_SIDE_A) as maplibregl.GeoJSONSource)?.setData(EMPTY_FC as any);
    (map.getSource(SOURCE_SIDE_B) as maplibregl.GeoJSONSource)?.setData(EMPTY_FC as any);
    (map.getSource(SOURCE_TAP_POINTS) as maplibregl.GeoJSONSource)?.setData(EMPTY_FC as any);
    tapPointsRef.current = { a: null, b: null };

    const bbox = turf.bbox(boundary as any) as [number, number, number, number];
    map.fitBounds(bbox, { padding: 48, animate: false, maxZoom: 8 });
  }, [boundary, ready]);

  // Population heatmap source + visibility toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (population) {
      const fc = turf.featureCollection(
        population.points.map(([lon, lat, pop]) =>
          turf.point([lon, lat], { population: pop })
        )
      );
      (map.getSource(SOURCE_POP) as maplibregl.GeoJSONSource)?.setData(fc as any);
    }
    map.setPaintProperty('population-heatmap', 'heatmap-opacity', showPopulationHeatmap ? 0.65 : 0);
  }, [population, showPopulationHeatmap, ready]);

  // City labels: plain HTML markers (dot + name) rather than a MapLibre
  // symbol/text-field layer, since text-field rendering needs a `glyphs`
  // font-tile endpoint configured in the style -- and this app deliberately
  // has no external tile/API dependency at all. Markers are pointer-events:
  // none so they never steal the draw gesture from the canvas underneath.
  const cityMarkersRef = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    cityMarkersRef.current.forEach((m) => m.remove());
    cityMarkersRef.current = [];

    if (!showCities || hardcoreMode) return;

    for (const city of cities) {
      const el = document.createElement('div');
      el.style.cssText =
        'display:flex;align-items:center;gap:4px;pointer-events:none;white-space:nowrap;';

      const dot = document.createElement('span');
      dot.style.cssText =
        'width:6px;height:6px;border-radius:50%;background:#8ecbff;' +
        'box-shadow:0 0 0 2px rgba(5,7,12,0.55);flex-shrink:0;';

      const label = document.createElement('span');
      label.style.cssText =
        'font-size:11px;font-weight:600;color:#bcdcff;text-shadow:0 1px 3px rgba(0,0,0,0.9);';
      label.textContent = city.name;

      el.appendChild(dot);
      el.appendChild(label);

      const marker = new maplibregl.Marker({ element: el, anchor: 'left' })
        .setLngLat([city.lon, city.lat])
        .addTo(map);
      cityMarkersRef.current.push(marker);
    }

    return () => {
      cityMarkersRef.current.forEach((m) => m.remove());
      cityMarkersRef.current = [];
    };
  }, [cities, showCities, hardcoreMode, ready]);

  // Draw (or clear) the split line + side coloring whenever `line` changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lineSource = map.getSource(SOURCE_LINE) as maplibregl.GeoJSONSource;
    const sideASource = map.getSource(SOURCE_SIDE_A) as maplibregl.GeoJSONSource;
    const sideBSource = map.getSource(SOURCE_SIDE_B) as maplibregl.GeoJSONSource;

    if (!line) {
      lineSource?.setData(EMPTY_FC as any);
      sideASource?.setData(EMPTY_FC as any);
      sideBSource?.setData(EMPTY_FC as any);
      // An external reset (TRY AGAIN / NEXT COUNTRY) clears the line -- make
      // sure any in-progress point-mode taps are cleared with it.
      tapPointsRef.current = { a: null, b: null };
      (map.getSource(SOURCE_TAP_POINTS) as maplibregl.GeoJSONSource)?.setData(EMPTY_FC as any);
      return;
    }

    lineSource?.setData(turf.lineString([line.p1, line.p2]) as any);
    map.setPaintProperty('split-line', 'line-dasharray', locked ? [1, 0] : [2, 1.5]);

    if (resultRevealed) {
      const countryFeature = (boundary.features[0] as unknown) as Feature<Polygon | MultiPolygon>;
      const { sideA, sideB } = splitPolygonByLine(countryFeature, line);
      sideASource?.setData((sideA ?? EMPTY_FC) as any);
      sideBSource?.setData((sideB ?? EMPTY_FC) as any);
      const aColor = sideALabel === 'left' ? LEFT_COLOR : RIGHT_COLOR;
      const bColor = sideALabel === 'left' ? RIGHT_COLOR : LEFT_COLOR;
      map.setPaintProperty('side-a-fill', 'fill-color', aColor);
      map.setPaintProperty('side-b-fill', 'fill-color', bColor);
      map.setPaintProperty('side-a-fill', 'fill-opacity', 0.55);
      map.setPaintProperty('side-b-fill', 'fill-opacity', 0.55);
      map.setPaintProperty('country-fill', 'fill-opacity', 0);
    } else {
      sideASource?.setData(EMPTY_FC as any);
      sideBSource?.setData(EMPTY_FC as any);
      map.setPaintProperty('country-fill', 'fill-opacity', 1);
    }
  }, [line, locked, resultRevealed, boundary, ready, sideALabel]);

  // --- Drag mode: press, drag, release -----------------------------------
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleDragMove = useCallback((clientX: number, clientY: number, isStart: boolean) => {
    const map = mapRef.current;
    if (!map || lockedRef.current) return;
    const canvas = map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (isStart) {
      dragStartRef.current = { x, y };
      return;
    }
    const start = dragStartRef.current;
    if (!start) return;

    const clipped = clipLineToRect(start.x, start.y, x, y, rect.width, rect.height);
    if (!clipped) return;
    const [p1, p2] = clipped;
    const ll1 = map.unproject(p1 as any);
    const ll2 = map.unproject(p2 as any);
    onLineChangeRef.current({ p1: [ll1.lng, ll1.lat], p2: [ll2.lng, ll2.lat] });
  }, []);

  // --- Point-to-point mode: tap A, tap B, they're connected ---------------
  const tapPointsRef = useRef<{ a: TapPoint | null; b: TapPoint | null }>({ a: null, b: null });

  const renderTapMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { a, b } = tapPointsRef.current;
    const features = [];
    if (a) features.push(turf.point([a.lon, a.lat], { role: 'a' }));
    if (b) features.push(turf.point([b.lon, b.lat], { role: 'b' }));
    (map.getSource(SOURCE_TAP_POINTS) as maplibregl.GeoJSONSource)?.setData(
      turf.featureCollection(features) as any
    );
  }, []);

  const handleTap = useCallback((clientX: number, clientY: number) => {
    const map = mapRef.current;
    if (!map || lockedRef.current) return;
    const canvas = map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ll = map.unproject([x, y] as any);
    const tapped: TapPoint = { x, y, lon: ll.lng, lat: ll.lat };

    const pts = tapPointsRef.current;
    if (!pts.a || pts.b) {
      // First tap ever, or re-tapping after a completed A/B pair -- start fresh.
      tapPointsRef.current = { a: tapped, b: null };
      onLineChangeRef.current(null);
      renderTapMarkers();
      return;
    }

    // pts.a is set, pts.b is not: this tap places point B.
    const clipped = clipLineToRect(pts.a.x, pts.a.y, x, y, rect.width, rect.height);
    if (!clipped) {
      // Degenerate (tapped essentially the same spot as A) -- keep waiting for a real point B.
      return;
    }
    tapPointsRef.current = { a: pts.a, b: tapped };
    renderTapMarkers();
    const [p1, p2] = clipped;
    const ll1 = map.unproject(p1 as any);
    const ll2 = map.unproject(p2 as any);
    onLineChangeRef.current({ p1: [ll1.lng, ll1.lat], p2: [ll2.lng, ll2.lat] });
  }, [renderTapMarkers]);

  // Switching modes starts fresh, so a half-finished gesture in one mode
  // never lingers into the other.
  useEffect(() => {
    dragStartRef.current = null;
    tapPointsRef.current = { a: null, b: null };
    renderTapMarkers();
  }, [drawMode, renderTapMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const canvas = map.getCanvas();
    // touch-action: none hands the browser's default touch gestures (scroll,
    // swipe-back, pinch-zoom) entirely over to our pointer handlers below, on
    // both drag and point-to-point modes.
    canvas.style.touchAction = 'none';
    canvas.style.cursor = locked ? 'default' : 'crosshair';

    if (drawMode === 'drag') {
      const onPointerDown = (e: PointerEvent) => {
        if (lockedRef.current) return;
        e.preventDefault();
        draggingRef.current = true;
        canvas.setPointerCapture(e.pointerId);
        handleDragMove(e.clientX, e.clientY, true);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!draggingRef.current) return;
        e.preventDefault();
        handleDragMove(e.clientX, e.clientY, false);
      };
      const endDrag = (e: PointerEvent) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
      return () => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', endDrag);
        canvas.removeEventListener('pointercancel', endDrag);
      };
    }

    // drawMode === 'points': a tap is a full pointerdown without a drag, so a
    // single 'pointerdown' listener is enough -- no move/up tracking needed.
    const onPointerDownTap = (e: PointerEvent) => {
      if (lockedRef.current) return;
      e.preventDefault();
      handleTap(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerdown', onPointerDownTap);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDownTap);
    };
  }, [ready, locked, drawMode, handleDragMove, handleTap]);

  return (
    <div
      ref={containerRef}
      className={hardcoreMode ? 'country-map hardcore' : 'country-map'}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  );
}
