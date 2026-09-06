import { useCallback, useEffect, useState } from 'react';
import type { ISO3, RoundRecord, StoredStatsV1, GameSettings } from '../types';

const STORAGE_KEY = 'population-split:stats';

const DEFAULT_SETTINGS: GameSettings = {
  liveMode: false,
  hardcoreMode: false,
  showCities: true,
  scoringCurve: 'linear',
};

function defaultStats(): StoredStatsV1 {
  return {
    version: 1,
    gamesPlayed: 0,
    totalScore: 0,
    bestScorePerCountry: {},
    bestErrorPerCountry: {},
    highScoreRun10: 0,
    bestStreak: 0,
    dailyCompletions: {},
    settings: DEFAULT_SETTINGS,
  };
}

function load(): StoredStatsV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    // Only version 1 exists today; future migrations branch on parsed.version here.
    if (parsed.version !== 1) return defaultStats();
    return { ...defaultStats(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    return defaultStats();
  }
}

function save(stats: StoredStatsV1) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* localStorage unavailable (private browsing, quota) -- stats just won't persist */
  }
}

export function useStats() {
  const [stats, setStats] = useState<StoredStatsV1>(() => load());

  useEffect(() => {
    save(stats);
  }, [stats]);

  const recordRound = useCallback((iso3: ISO3, record: RoundRecord) => {
    setStats((prev) => {
      const bestScore = Math.max(prev.bestScorePerCountry[iso3] ?? 0, record.result.score);
      const bestError = Math.min(
        prev.bestErrorPerCountry[iso3] ?? Infinity,
        record.result.error
      );
      return {
        ...prev,
        gamesPlayed: prev.gamesPlayed + 1,
        totalScore: prev.totalScore + record.result.score,
        bestScorePerCountry: { ...prev.bestScorePerCountry, [iso3]: bestScore },
        bestErrorPerCountry: { ...prev.bestErrorPerCountry, [iso3]: bestError },
      };
    });
  }, []);

  const recordDaily = useCallback((dateKey: string, record: RoundRecord) => {
    setStats((prev) => ({
      ...prev,
      dailyCompletions: { ...prev.dailyCompletions, [dateKey]: record },
    }));
  }, []);

  const recordRun10Score = useCallback((total: number) => {
    setStats((prev) => ({ ...prev, highScoreRun10: Math.max(prev.highScoreRun10, total) }));
  }, []);

  const recordStreak = useCallback((length: number) => {
    setStats((prev) => ({ ...prev, bestStreak: Math.max(prev.bestStreak, length) }));
  }, []);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setStats((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
  }, []);

  return {
    stats,
    recordRound,
    recordDaily,
    recordRun10Score,
    recordStreak,
    updateSettings,
  };
}
