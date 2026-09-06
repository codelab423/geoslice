import { useState } from 'react';
import type { SplitResult } from '../types';
import { formatPercentage, tierFromError } from '../utils/scoring';
import { useCountUp } from '../hooks/useCountUp';

interface DrawingProps {
  phase: 'drawing';
  hasLine: boolean;
  liveMode: boolean;
  liveResult: SplitResult | null;
  onSubmit: () => void;
}

interface SubmittedProps {
  phase: 'submitted';
  result: SplitResult;
  showPopulationHeatmap: boolean;
  onTogglePopulationHeatmap: () => void;
  onNext: () => void;
  onTryAgain: () => void;
  nextLabel: string;
  onShare: () => void;
  shareCopied: boolean;
  hideTryAgain?: boolean;
}

type Props = DrawingProps | SubmittedProps;

function formatPeople(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export default function ResultPanel(props: Props) {
  // Hooks must run unconditionally every render (this component's `phase` prop
  // flips from 'drawing' to 'submitted' within the same mounted instance), so
  // useCountUp/useState are called up front with safe fallback values rather
  // than inside the phase-specific branches below.
  const submitted = props.phase === 'submitted' ? props : null;
  const animA = useCountUp(submitted?.result.percentageA ?? 0, 900, !!submitted);
  const animB = useCountUp(submitted?.result.percentageB ?? 0, 900, !!submitted);
  const animScore = useCountUp(submitted?.result.score ?? 0, 1100, !!submitted);
  const [showPeople, setShowPeople] = useState(false);

  if (props.phase === 'drawing') {
    return (
      <div className="bottom-panel panel">
        <p style={{ margin: '0 0 14px', color: 'var(--text-dim)', fontSize: '0.95rem' }}>
          Draw one line to split the population 50/50.
        </p>
        {props.liveMode && props.liveResult && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'var(--side-a)', fontWeight: 700 }}>
              {formatPercentage(props.liveResult.percentageA)}%
            </span>
            <span style={{ color: 'var(--side-b)', fontWeight: 700 }}>
              {formatPercentage(props.liveResult.percentageB)}%
            </span>
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={!props.hasLine}
          onClick={props.onSubmit}
        >
          SUBMIT SPLIT
        </button>
      </div>
    );
  }

  const { result } = props;
  const tier = tierFromError(result.error);

  return (
    <div className="bottom-panel panel">
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent-strong)', marginBottom: 10 }}>
        {tier}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--side-a)', fontVariantNumeric: 'tabular-nums' }}>
            {formatPercentage(animA)}%
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>LEFT</div>
          {showPeople && (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: 2 }}>
              {formatPeople(result.populationA)} people
            </div>
          )}
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--side-b)', fontVariantNumeric: 'tabular-nums' }}>
            {formatPercentage(animB)}%
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>RIGHT</div>
          {showPeople && (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: 2 }}>
              {formatPeople(result.populationB)} people
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: '0.9rem' }}>
        <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
          onClick={() => setShowPeople((v) => !v)}>
          {showPeople ? 'hide totals' : 'show population totals'}
        </button>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>OFF BY </span>
          <strong>{result.error.toFixed(2)}%</strong>
          <span style={{ color: 'var(--text-dim)' }}> · SCORE </span>
          <strong style={{ color: 'var(--accent-strong)' }}>{animScore.toFixed(2)}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {!props.hideTryAgain && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={props.onTryAgain}>
            TRY AGAIN
          </button>
        )}
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={props.onNext}>
          {props.nextLabel}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-ghost"
          style={{ flex: 1, fontSize: '0.85rem' }}
          onClick={props.onTogglePopulationHeatmap}
        >
          {props.showPopulationHeatmap ? 'Hide population' : 'Show population'}
        </button>
        <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.85rem' }} onClick={props.onShare}>
          {props.shareCopied ? 'Copied!' : 'Share result'}
        </button>
      </div>
    </div>
  );
}
