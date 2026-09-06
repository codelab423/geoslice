import type { PopulationDataFile, SplitLine, SplitResult } from '../types';

/** Only enabled via ?debug=true, per design spec section 26 -- never shown during normal play. */
export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === 'true';
}

interface Props {
  boundary: GeoJSON.FeatureCollection;
  population: PopulationDataFile;
  line: SplitLine | null;
  result: SplitResult | null;
}

export function DebugPanel({ boundary, population, line, result }: Props) {
  const geom = boundary.features[0]?.geometry;
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 20,
        background: 'rgba(0,0,0,0.75)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: 8,
        borderRadius: 6,
        maxWidth: 280,
        lineHeight: 1.5,
        pointerEvents: 'none',
      }}
    >
      <div>DEBUG MODE</div>
      <div>boundary geometry: {geom?.type}</div>
      <div>population source: {population.source} ({population.datasetYear})</div>
      <div>grid cells: {population.cellCount.toLocaleString()}</div>
      <div>country total pop: {population.totalPopulation.toLocaleString()}</div>
      {line && (
        <div>
          line: [{line.p1[0].toFixed(4)}, {line.p1[1].toFixed(4)}] → [{line.p2[0].toFixed(4)}, {line.p2[1].toFixed(4)}]
        </div>
      )}
      {result && (
        <>
          <div>pop A: {Math.round(result.populationA).toLocaleString()}</div>
          <div>pop B: {Math.round(result.populationB).toLocaleString()}</div>
          <div>% A / B: {result.percentageA.toFixed(4)} / {result.percentageB.toFixed(4)}</div>
          <div>error: {result.error.toFixed(4)}%</div>
          <div>score: {result.score.toFixed(4)}</div>
          <div>calc time: {result.calculationTimeMs.toFixed(2)}ms</div>
          <div>cells classified: {result.cellCount.toLocaleString()}</div>
        </>
      )}
    </div>
  );
}
