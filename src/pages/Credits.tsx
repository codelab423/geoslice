interface Props {
  onBack: () => void;
}

export default function Credits({ onBack }: Props) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
        <h1>Data &amp; Credits</h1>

        <h2>Population data</h2>
        <p>
          Population distribution estimates are based on <strong>WorldPop</strong> gridded population
          data (University of Southampton), dataset year <strong>2020</strong>, used consistently for
          every country. These are modeled estimates, not exact census counts. See{' '}
          <a href="https://www.worldpop.org" target="_blank" rel="noreferrer">worldpop.org</a>.
        </p>

        <h2>Country boundaries</h2>
        <p>
          Country outlines come from <strong>geoBoundaries</strong> (ADM0, ISO3-coded), simplified for
          web performance. See{' '}
          <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer">geoboundaries.org</a>.
          A small number of countries define a "metropolitan" extent (excluding distant overseas
          territories) so the map doesn't zoom out to a ridiculous bounding box — see each country's
          entry in <code>src/data/countries.ts</code>.
        </p>

        <h2>Map rendering</h2>
        <p>
          Rendered with <strong>MapLibre GL JS</strong>, an open-source WebGL map library. No basemap
          tiles or API key are used — every layer you see is generated from this game's own local data.
        </p>

        <h2>Limitations</h2>
        <ul>
          <li>Population figures are modeled estimates from a single dataset year (2020), not real-time or census data.</li>
          <li>Grid points are aggregated for browser performance; classification uses each cell's center point.</li>
          <li>A handful of countries ship a "metropolitan" extent rather than full sovereign territory (see above).</li>
        </ul>

        <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 32 }}>
          Population Split is an independent project and is not affiliated with WorldPop, the
          University of Southampton, or geoBoundaries.
        </p>
      </div>
    </div>
  );
}
