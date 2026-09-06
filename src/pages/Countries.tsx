import { COUNTRIES } from '../data/countries';
import type { ISO3 } from '../types';

interface Props {
  onSelect: (iso3: ISO3) => void;
  onBack: () => void;
}

const DIFFICULTY_LABEL = ['', 'Easy', 'Medium', 'Medium', 'Hard', 'Extreme'];

export default function Countries({ onSelect, onBack }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Countries</h2>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
          paddingBottom: 20,
        }}
      >
        {COUNTRIES.map((c) => (
          <button
            key={c.iso3}
            className="panel"
            onClick={() => onSelect(c.iso3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              cursor: 'pointer',
              border: 'none',
              color: 'var(--text)',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
              <span style={{ fontSize: '1.4rem' }}>{c.flag}</span>
              {c.name}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {DIFFICULTY_LABEL[c.difficulty]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
