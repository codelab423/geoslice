import type { CountryMeta, SplitResult } from '../types';
import { formatPercentage } from './scoring';
import { getDailyPuzzleNumber } from '../game/gameModes';

/**
 * Share text never reveals the actual line the player drew -- only the
 * resulting percentages/score, per design spec section 24 ("there is no
 * single correct line").
 */
export function buildClassicShareText(country: CountryMeta, result: SplitResult): string {
  return [
    'Population Split 🌍',
    '',
    `${country.flag} ${country.name}`,
    '',
    `${formatPercentage(result.percentageA)}% | ${formatPercentage(result.percentageB)}%`,
    `🎯 Error: ${result.error.toFixed(2)}%`,
    `⭐ ${result.score.toFixed(2)}/100`,
  ].join('\n');
}

function errorEmoji(error: number): string {
  if (error <= 0.25) return '🟩';
  if (error <= 1) return '🟩';
  if (error <= 2.5) return '🟨';
  if (error <= 5) return '🟧';
  return '🟥';
}

export function buildDailyShareText(result: SplitResult, date: Date = new Date()): string {
  const puzzleNumber = getDailyPuzzleNumber(date);
  return [
    `Population Split #${puzzleNumber}`,
    `${errorEmoji(result.error)} ${result.error.toFixed(2)}%`,
    `⭐ ${result.score.toFixed(2)}`,
  ].join('\n');
}

export function buildRun10ShareText(totalScore: number, avgError: number): string {
  return [
    'Population Split 🌍 — 10 Country Run',
    '',
    `TOTAL SCORE: ${totalScore.toFixed(1)} / 1000`,
    `Average error: ${avgError.toFixed(2)}%`,
  ].join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
