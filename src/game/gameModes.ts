import { COUNTRIES } from '../data/countries';
import type { ISO3, GameModeId } from '../types';
import { createSeededRng, seededShuffle, utcDateString } from '../utils/seededRandom';

export const GAME_MODE_LABELS: Record<GameModeId, string> = {
  classic: 'Classic',
  run10: '10 Country Run',
  daily: 'Daily',
  streak: 'Streak',
  hardcore: 'Hardcore',
};

const ALL_ISO3 = COUNTRIES.map((c) => c.iso3);

export function pickRandomCountry(exclude: ISO3[] = []): ISO3 {
  const pool = ALL_ISO3.filter((c) => !exclude.includes(c));
  const source = pool.length > 0 ? pool : ALL_ISO3;
  return source[Math.floor(Math.random() * source.length)];
}

/** 10 distinct countries for a 10-Country Run, in random order. */
export function generateRun10(): ISO3[] {
  const rng = () => Math.random();
  return seededShuffle(ALL_ISO3, rng).slice(0, 10);
}

/**
 * Deterministic daily country: seeded by the UTC calendar date so every
 * player gets the same country on the same day, without needing a server.
 * Also returns a daily "puzzle number" counted from a fixed epoch, for the
 * "Population Split #142" style share text.
 */
const DAILY_EPOCH = new Date('2024-01-01T00:00:00Z');

export function getDailyPuzzleNumber(date: Date = new Date()): number {
  const days = Math.floor((date.getTime() - DAILY_EPOCH.getTime()) / 86_400_000);
  return Math.max(1, days + 1);
}

export function getDailyCountry(date: Date = new Date()): ISO3 {
  const seed = `population-split-daily-${utcDateString(date)}`;
  const rng = createSeededRng(seed);
  const shuffled = seededShuffle(ALL_ISO3, rng);
  return shuffled[0];
}

/** Streak mode: keep playing random countries until a result falls below this threshold. */
export const STREAK_ERROR_THRESHOLD_PCT = 5;

export const RUN10_TOTAL_MAX_SCORE = 1000;
