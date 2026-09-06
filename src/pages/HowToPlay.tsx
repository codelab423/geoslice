interface Props {
  onBack: () => void;
}

export default function HowToPlay({ onBack }: Props) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
        <h1>How to Play</h1>
        <p>
          You'll see the outline of a country. Your job: draw <strong>one straight line</strong> across
          it that splits the country's <strong>population</strong> as close to 50% / 50% as possible.
        </p>
        <p>
          Two ways to draw: <strong>Drag</strong> — click/touch and drag across the map, the line
          extends automatically to the edges. <strong>Two points</strong> — tap one point, then
          tap another, and they're connected into a line for you. Switch between them anytime with
          the toggle near the bottom of the map. When you're happy with your line, press{' '}
          <strong>SUBMIT SPLIT</strong>.
        </p>
        <p>
          The catch: population isn't spread evenly across a country. A line through the geographic
          center is often nowhere near 50/50 once real population clusters — cities like Amsterdam,
          Paris, Istanbul or Cairo — are taken into account. The score is calculated from real gridded
          population data, not land area.
        </p>
        <h2>Scoring</h2>
        <p>
          <code>error = |50 − (% on side A)|</code>, and <code>score = max(0, 100 − error × 2)</code>.
          A perfect 50.00% / 50.00% split scores 100.
        </p>
        <ul>
          <li>Within 0.05% → <strong>INSANE SPLIT</strong></li>
          <li>Within 0.25% → <strong>NEAR PERFECT</strong></li>
          <li>Within 1% → <strong>EXCELLENT</strong></li>
          <li>Within 2.5% → <strong>GREAT</strong></li>
          <li>Within 5% → <strong>GOOD</strong></li>
          <li>Otherwise → <strong>KEEP TRYING</strong></li>
        </ul>
        <h2>Modes</h2>
        <ul>
          <li><strong>Classic</strong> — one country, one line, try for 50/50.</li>
          <li><strong>Daily</strong> — everyone gets the same country each day.</li>
          <li><strong>10 Country Run</strong> — ten countries, scored out of 1000.</li>
          <li><strong>Streak</strong> — keep going until a split misses by more than 5%.</li>
          <li><strong>Hardcore</strong> — minimal map, no extras.</li>
        </ul>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          There's no single "correct" line — infinitely many lines can produce a near-perfect split.
          Your score depends only on how close your split is to 50/50.
        </p>
      </div>
    </div>
  );
}
