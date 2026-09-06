import { describe, it, expect } from 'vitest';
import { COUNTRIES, MILESTONE_1_COUNTRIES, getCountry } from './countries';

describe('country metadata', () => {
  it('has no duplicate ISO3 codes', () => {
    const seen = new Set<string>();
    for (const c of COUNTRIES) {
      expect(seen.has(c.iso3)).toBe(false);
      seen.add(c.iso3);
    }
  });

  it('every country has a 3-letter ISO3 and 2-letter ISO2 code', () => {
    for (const c of COUNTRIES) {
      expect(c.iso3).toMatch(/^[A-Z]{3}$/);
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('every country has a non-empty name and flag emoji', () => {
    for (const c of COUNTRIES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.flag.length).toBeGreaterThan(0);
    }
  });

  it('difficulty is within the 1-5 range', () => {
    for (const c of COUNTRIES) {
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('uses the same population dataset year (2020) for every country', () => {
    for (const c of COUNTRIES) {
      expect(c.populationYear).toBe(2020);
    }
  });

  it('declares a territory extent for every country', () => {
    for (const c of COUNTRIES) {
      expect(['full', 'metropolitan']).toContain(c.territoryExtent);
    }
  });

  it('milestone 1 countries all exist in the country list', () => {
    for (const iso3 of MILESTONE_1_COUNTRIES) {
      expect(getCountry(iso3)).toBeDefined();
    }
  });
});
