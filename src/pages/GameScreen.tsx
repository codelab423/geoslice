import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CountryMap from '../components/CountryMap';
import TopBar from '../components/TopBar';
import ResultPanel from '../components/ResultPanel';
import { useCountryData } from '../hooks/useCountryData';
import { useCityData } from '../hooks/useCityData';
import { useSplitEngine } from '../hooks/useSplitEngine';
import { useStats } from '../hooks/useStats';
import { requireCountry } from '../data/countries';
import type { GameModeId, ISO3, RoundRecord, SplitLine, SplitResult } from '../types';
import {
  getDailyCountry,
  generateRun10,
  pickRandomCountry,
  STREAK_ERROR_THRESHOLD_PCT,
} from '../game/gameModes';
import { utcDateString } from '../utils/seededRandom';
import {
  buildClassicShareText,
  buildDailyShareText,
  buildRun10ShareText,
  copyToClipboard,
} from '../utils/share';
import { isDebugMode, DebugPanel } from '../components/DebugPanel';
import * as turf from '@turf/turf';
import { isSideALeft } from '../utils/orientation';

interface Props {
  mode: GameModeId;
  onExit: () => void;
  forcedCountry?: ISO3;
}

export default function GameScreen({ mode, onExit, forcedCountry }: Props) {
  const { stats, recordRound, recordDaily, recordRun10Score, recordStreak, updateSettings } = useStats();
  const settings = stats.settings;
  const hardcoreMode = mode === 'hardcore' || settings.hardcoreMode;

  const todayKey = useMemo(() => utcDateString(), []);
  const dailyAlreadyDone = mode === 'daily' ? stats.dailyCompletions[todayKey] : undefined;

  const [queue, setQueue] = useState<ISO3[]>(() => {
    if (forcedCountry) return [forcedCountry];
    if (mode === 'run10') return generateRun10();
    if (mode === 'daily') return [getDailyCountry()];
    return [pickRandomCountry()];
  });
  const [roundIndex, setRoundIndex] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [runScores, setRunScores] = useState<number[]>([]);
  const [finished, setFinished] = useState<'run10' | 'streak' | null>(null);

  const currentIso3 = queue[roundIndex];
  const country = requireCountry(currentIso3);

  const [line, setLine] = useState<SplitLine | null>(null);
  const [phase, setPhase] = useState<'drawing' | 'submitted'>(
    dailyAlreadyDone ? 'submitted' : 'drawing'
  );
  const [result, setResult] = useState<SplitResult | null>(dailyAlreadyDone?.result ?? null);
  const [liveResult, setLiveResult] = useState<SplitResult | null>(null);
  const [showPopulationHeatmap, setShowPopulationHeatmap] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [aIsLeft, setAIsLeft] = useState(true);

  const dataState = useCountryData(currentIso3);
  const cities = useCityData(currentIso3);
  const { calculateSync, calculateLive } = useSplitEngine(
    dataState.status === 'ready' ? dataState.population! : null,
    settings.scoringCurve
  );

  // Live mode: cheap off-main-thread preview while dragging (never shown unless the setting is on).
  const liveRequestSeq = useRef(0);
  useEffect(() => {
    if (!settings.liveMode || !line || phase !== 'drawing') {
      setLiveResult(null);
      return;
    }
    const seq = ++liveRequestSeq.current;
    calculateLive(line, settings.scoringCurve)?.then((r) => {
      if (liveRequestSeq.current === seq) setLiveResult(r);
    });
  }, [line, settings.liveMode, settings.scoringCurve, phase, calculateLive]);

  const resetRound = useCallback(() => {
    setLine(null);
    setPhase('drawing');
    setResult(null);
    setLiveResult(null);
    setShowPopulationHeatmap(false);
    setShareCopied(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!line || dataState.status !== 'ready') return;
    const raw = calculateSync(line);
    if (!raw) return;

    // The engine's Side A/B is arbitrary (depends on drag direction); the UI
    // always shows "LEFT" then "RIGHT", so normalize A -> always-left here,
    // once, rather than threading a left/right flag through every consumer.
    const bbox = turf.bbox(dataState.boundary!) as [number, number, number, number];
    const leftIsA = isSideALeft(bbox, line);
    setAIsLeft(leftIsA);
    const r: SplitResult = leftIsA
      ? raw
      : {
          ...raw,
          populationA: raw.populationB,
          populationB: raw.populationA,
          percentageA: raw.percentageB,
          percentageB: raw.percentageA,
        };

    setResult(r);
    setPhase('submitted');

    const record: RoundRecord = { iso3: currentIso3, result: r, line, timestamp: Date.now() };
    recordRound(currentIso3, record);
    if (mode === 'daily') recordDaily(todayKey, record);
    if (mode === 'run10' || mode === 'streak') {
      setRunScores((prev) => [...prev, r.score]);
    }
  }, [line, calculateSync, currentIso3, mode, recordRound, recordDaily, todayKey]);

  const goToCountry = useCallback((iso3: ISO3) => {
    setQueue((q) => [...q, iso3]);
    setRoundIndex((i) => i + 1);
    resetRound();
  }, [resetRound]);

  const handleNext = useCallback(() => {
    if (mode === 'run10') {
      if (roundIndex + 1 >= 10) {
        const total = [...runScores, result?.score ?? 0].reduce((a, b) => a + b, 0);
        recordRun10Score(total);
        setFinished('run10');
        return;
      }
      setRoundIndex((i) => i + 1);
      resetRound();
      return;
    }
    if (mode === 'streak') {
      const err = result?.error ?? Infinity;
      if (err > STREAK_ERROR_THRESHOLD_PCT) {
        recordStreak(streakCount);
        setFinished('streak');
        return;
      }
      setStreakCount((c) => c + 1);
      goToCountry(pickRandomCountry([currentIso3]));
      return;
    }
    if (mode === 'daily') {
      onExit();
      return;
    }
    // classic / hardcore
    goToCountry(pickRandomCountry([currentIso3]));
  }, [mode, roundIndex, runScores, result, recordRun10Score, recordStreak, streakCount, goToCountry, currentIso3, onExit, resetRound]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const text =
      mode === 'daily'
        ? buildDailyShareText(result)
        : mode === 'run10' && finished === 'run10'
          ? buildRun10ShareText(
              runScores.reduce((a, b) => a + b, 0),
              runScores.length
                ? runScores.reduce((a, b) => a + (100 - b) / 2, 0) / runScores.length
                : 0
            )
          : buildClassicShareText(country, result);
    const ok = await copyToClipboard(text);
    setShareCopied(ok);
    setTimeout(() => setShareCopied(false), 2000);
  }, [result, mode, country, finished, runScores]);

  if (finished) {
    const total = runScores.reduce((a, b) => a + b, 0);
    const avgError = runScores.length
      ? runScores.reduce((a, b) => a + (100 - b) / 2, 0) / runScores.length
      : 0;
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="panel" style={{ padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }}>{finished === 'run10' ? 'Run Complete!' : 'Streak Ended'}</h2>
          {finished === 'run10' ? (
            <>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-strong)' }}>
                {total.toFixed(1)} / 1000
              </div>
              <p style={{ color: 'var(--text-dim)' }}>Average error: {avgError.toFixed(2)}%</p>
            </>
          ) : (
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-strong)' }}>
              Streak: {streakCount}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onExit}>
              Back to Menu
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => window.location.reload()}
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        country={country}
        onExit={onExit}
        roundLabel={
          mode === 'run10'
            ? `Round ${roundIndex + 1} / 10`
            : mode === 'streak'
              ? `Streak ${streakCount}`
              : undefined
        }
        score={mode === 'run10' ? runScores.reduce((a, b) => a + b, 0) : undefined}
        scoreLabel="Score"
      />

      <div style={{ flex: 1, position: 'relative' }}>
        {dataState.status === 'ready' && (
          <CountryMap
            boundary={dataState.boundary!}
            population={dataState.population}
            line={line}
            onLineChange={setLine}
            locked={phase === 'submitted'}
            resultRevealed={phase === 'submitted'}
            sideALabel={aIsLeft ? 'left' : 'right'}
            showPopulationHeatmap={showPopulationHeatmap}
            hardcoreMode={hardcoreMode}
            drawMode={settings.drawMode}
            cities={cities}
            showCities={settings.showCities}
          />
        )}
        {dataState.status === 'loading' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            Loading {country.name}...
          </div>
        )}
        {dataState.status === 'error' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="panel" style={{ padding: 24, maxWidth: 480, textAlign: 'center' }}>
              <strong style={{ color: 'var(--danger)' }}>Data not available</strong>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{dataState.error}</p>
              <button className="btn btn-secondary" onClick={onExit}>Back to Menu</button>
            </div>
          </div>
        )}

        {isDebugMode() && dataState.status === 'ready' && (
          <DebugPanel
            boundary={dataState.boundary!}
            population={dataState.population!}
            line={line}
            result={phase === 'submitted' ? result : liveResult}
          />
        )}
      </div>

      {dataState.status === 'ready' && phase === 'drawing' && (
        <ResultPanel
          phase="drawing"
          hasLine={!!line}
          liveMode={settings.liveMode}
          liveResult={liveResult}
          onSubmit={handleSubmit}
        />
      )}
      {dataState.status === 'ready' && phase === 'submitted' && result && (
        <ResultPanel
          phase="submitted"
          result={result}
          showPopulationHeatmap={showPopulationHeatmap}
          onTogglePopulationHeatmap={() => setShowPopulationHeatmap((v) => !v)}
          onTryAgain={resetRound}
          onNext={handleNext}
          nextLabel={
            mode === 'run10'
              ? roundIndex + 1 >= 10 ? 'FINISH RUN' : 'NEXT COUNTRY'
              : mode === 'streak'
                ? (result.error > STREAK_ERROR_THRESHOLD_PCT ? 'END STREAK' : 'NEXT COUNTRY')
                : mode === 'daily'
                  ? 'BACK TO MENU'
                  : 'NEXT COUNTRY'
          }
          hideTryAgain={mode === 'daily'}
          onShare={handleShare}
          shareCopied={shareCopied}
        />
      )}

      {phase === 'drawing' && (
        <div
          role="group"
          aria-label="Line drawing method"
          style={{
            position: 'absolute',
            bottom: 'calc(236px + var(--safe-bottom))',
            right: 16,
            display: 'flex',
            gap: 2,
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            background: 'rgba(11,14,20,0.7)',
            padding: 3,
            borderRadius: 8,
          }}
        >
          {(['drag', 'points'] as const).map((mode_) => (
            <button
              key={mode_}
              onClick={() => updateSettings({ drawMode: mode_ })}
              style={{
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                fontWeight: 700,
                background: settings.drawMode === mode_ ? 'var(--accent)' : 'transparent',
                color: settings.drawMode === mode_ ? '#05070c' : 'var(--text-dim)',
              }}
            >
              {mode_ === 'drag' ? 'Drag' : 'Two points'}
            </button>
          ))}
        </div>
      )}

      {!hardcoreMode && (
        <label
          style={{
            position: 'absolute',
            bottom: 'calc(200px + var(--safe-bottom))',
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            color: 'var(--text-faint)',
            background: 'rgba(11,14,20,0.6)',
            padding: '4px 8px',
            borderRadius: 8,
          }}
        >
          <input
            type="checkbox"
            checked={settings.showCities}
            onChange={(e) => updateSettings({ showCities: e.target.checked })}
          />
          Cities
        </label>
      )}

      <label
        style={{
          position: 'absolute',
          bottom: 'calc(164px + var(--safe-bottom))',
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.75rem',
          color: 'var(--text-faint)',
          background: 'rgba(11,14,20,0.6)',
          padding: '4px 8px',
          borderRadius: 8,
        }}
      >
        <input
          type="checkbox"
          checked={settings.liveMode}
          onChange={(e) => updateSettings({ liveMode: e.target.checked })}
        />
        Live mode
      </label>
    </div>
  );
}
