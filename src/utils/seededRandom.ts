/** Deterministic string -> 32-bit hash (djb2 variant), used to seed the PRNG. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG -- small, fast, deterministic for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(seedString: string): () => number {
  return mulberry32(hashString(seedString));
}

/** Fisher-Yates shuffle using a seeded RNG, so it's reproducible for a given seed. */
export function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** UTC calendar date as YYYY-MM-DD, used as the Daily mode seed so every
 * player worldwide gets the same country on the same day, with no server. */
export function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
