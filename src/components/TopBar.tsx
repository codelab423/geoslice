import type { CountryMeta } from '../types';

interface Props {
  country: CountryMeta;
  roundLabel?: string; // e.g. "3 / 10"
  score?: number;
  scoreLabel?: string;
  onExit: () => void;
}

export default function TopBar({ country, roundLabel, score, scoreLabel, onExit }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `calc(10px + var(--safe-top)) 16px 10px`,
        gap: 12,
        background: 'linear-gradient(to bottom, rgba(11,14,20,0.9), rgba(11,14,20,0))',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <button
        className="btn btn-ghost"
        onClick={onExit}
        style={{ pointerEvents: 'auto', padding: '8px 14px', fontSize: '0.85rem' }}
      >
        ← Exit
      </button>

      <div
        className="panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{country.flag}</span>
        <span style={{ fontWeight: 700 }}>{country.name}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {roundLabel && (
          <div
            className="panel"
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: 'var(--text-dim)', pointerEvents: 'auto' }}
          >
            {roundLabel}
          </div>
        )}
        {score !== undefined && (
          <div
            className="panel"
            style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--accent-strong)', pointerEvents: 'auto' }}
          >
            {scoreLabel ?? 'Score'}: {score.toFixed(0)}
          </div>
        )}
      </div>
    </div>
  );
}
