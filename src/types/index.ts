export type ISO3 = string;

export type TerritoryExtent = 'metropolitan' | 'full';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface CountryMeta {
  iso3: ISO3;
  iso2: string;
  name: string;
  flag: string;
  /** Year of the WorldPop gridded population dataset used for this country. */
  populationYear: number;
  /** 1 = easiest, 5 = extreme. Manually rated for the MVP (see difficulty.ts for the heuristic). */
  difficulty: Difficulty;
  /**
   * Whether the shipped boundary covers the full sovereign territory (incl. overseas
   * territories) or just the metropolitan/main landmass. Declared explicitly so map framing
   * stays sane (e.g. France ships 'metropolitan' to avoid zooming out to French Guiana).
   */
  territoryExtent: TerritoryExtent;
}

/** A single aggregated population grid cell, produced by the Python preprocessing pipeline. */
export interface PopulationPoint {
  lon: number;
  lat: number;
  population: number;
}

/** Raw population dataset as shipped in public/population/{ISO3}.json */
export interface PopulationDataFile {
  iso3: ISO3;
  source: 'worldpop';
  datasetYear: number;
  /** Total population represented by the sum of all points, for verification. */
  totalPopulation: number;
  cellCount: number;
  points: [number, number, number][]; // [lon, lat, population]
}

/** A player-drawn split line, in geographic coordinates. */
export interface SplitLine {
  p1: [number, number]; // [lon, lat]
  p2: [number, number]; // [lon, lat]
}

export interface SplitResult {
  populationA: number;
  populationB: number;
  totalPopulation: number;
  percentageA: number;
  percentageB: number;
  /** abs(50 - percentageA), i.e. how far from a perfect 50/50 split. */
  error: number;
  score: number;
  calculationTimeMs: number;
  cellCount: number;
}

export type ResultTier =
  | 'INSANE SPLIT'
  | 'NEAR PERFECT'
  | 'EXCELLENT'
  | 'GREAT'
  | 'GOOD'
  | 'KEEP TRYING';

export type GameModeId =
  | 'classic'
  | 'run10'
  | 'daily'
  | 'streak'
  | 'hardcore';

export interface GameSettings {
  liveMode: boolean;
  hardcoreMode: boolean;
  showCities: boolean;
  scoringCurve: 'linear' | 'exponential';
}

export interface RoundRecord {
  iso3: ISO3;
  result: SplitResult;
  line: SplitLine;
  timestamp: number;
}

export interface StoredStatsV1 {
  version: 1;
  gamesPlayed: number;
  totalScore: number;
  bestScorePerCountry: Record<ISO3, number>;
  bestErrorPerCountry: Record<ISO3, number>;
  highScoreRun10: number;
  bestStreak: number;
  dailyCompletions: Record<string, RoundRecord>; // key = YYYY-MM-DD
  settings: GameSettings;
}
