import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { PopulationDataFile, SplitLine } from '../types';
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
}

const LEFT_COLOR = '#ff6b6b';
const RIGHT_COLOR = '#4ecdc4';

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

  const handlePointerMove = useCallback((clientX: number, clientY: number, isStart: boolean) => {
    const map = mapRef.current;
    if (!map || lockedRef.current) return;
    const canvas = map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (isStart) {
      startRef.current = { x, y };
      return;
    }
    const start = startRef.current;
    if (!start) return;

    const clipped = clipLineToRect(start.x, start.y, x, y, rect.width, rect.height);
    if (!clipped) return;
    const [p1, p2] = clipped;
    const ll1 = map.unproject(p1 as any);
    const ll2 = map.unproject(p2 as any);
    onLineChangeRef.current({ p1: [ll1.lng, ll1.lat], p2: [ll2.lng, ll2.lat] });
  }, []);

  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const canvas = map.getCanvas();
    canvas.style.touchAction = 'none';
    canvas.style.cursor = locked ? 'default' : 'crosshair';

    const onPointerDown = (e: PointerEvent) => {
      if (lockedRef.current) return;
      draggingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      handlePointerMove(e.clientX, e.clientY, true);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      handlePointerMove(e.clientX, e.clientY, false);
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
  }, [ready, locked, handlePointerMove]);

  return (
    <div
      ref={containerRef}
      className={hardcoreMode ? 'country-map hardcore' : 'country-map'}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  );
}
