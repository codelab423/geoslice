import type { GameModeId } from '../types';

interface Props {
  onPlay: (mode: GameModeId) => void;
  onNavigate: (screen: 'countries' | 'howto' | 'credits') => void;
}

export default function MainMenu({ onPlay, onNavigate }: Props) {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'safe center',
        gap: 20,
        padding: '24px 24px calc(24px + var(--safe-bottom))',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: 'clamp(2.2rem, 8vw, 3.6rem)', margin: 0, letterSpacing: '-0.02em' }}>
          POPULATION SPLIT
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.05rem', marginTop: 10 }}>
          Can you divide a country into two equal populations?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <button className="btn btn-primary" onClick={() => onPlay('classic')}>
          PLAY
        </button>
        <button className="btn btn-secondary" onClick={() => onPlay('daily')}>
          DAILY
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('countries')}>
          COUNTRIES
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('howto')}>
          HOW TO PLAY
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={() => onPlay('run10')}>
          10 Country Run
        </button>
        <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={() => onPlay('streak')}>
          Streak
        </button>
        <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={() => onPlay('hardcore')}>
          Hardcore
        </button>
      </div>

      <button
        className="btn btn-ghost"
        style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}
        onClick={() => onNavigate('credits')}
      >
        Data &amp; Credits
      </button>
    </div>
  );
}
