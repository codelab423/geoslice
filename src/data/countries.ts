import type { CountryMeta, ISO3 } from '../types';

/**
 * Single source of truth for supported countries. Adding a new country only
 * requires: a boundary file at public/countries/{ISO3}.geojson, a population
 * file at public/population/{ISO3}.json, and an entry here.
 *
 * Difficulty is manually rated for the MVP (1 = easiest, 5 = extreme) based on
 * population concentration, shape complexity and geographic dispersion. See
 * src/utils/difficulty.ts for a data-driven heuristic that can replace this later.
 *
 * populationYear is fixed at 2020 for every country so results are never mixed
 * across dataset years (see WorldPop attribution on the credits page).
 */
export const COUNTRIES: CountryMeta[] = [
  { iso3: 'NLD', iso2: 'NL', name: 'Netherlands', flag: '🇳🇱', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'BEL', iso2: 'BE', name: 'Belgium', flag: '🇧🇪', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'DEU', iso2: 'DE', name: 'Germany', flag: '🇩🇪', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'FRA', iso2: 'FR', name: 'France', flag: '🇫🇷', populationYear: 2020, difficulty: 3, territoryExtent: 'metropolitan' },
  { iso3: 'GBR', iso2: 'GB', name: 'United Kingdom', flag: '🇬🇧', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'ESP', iso2: 'ES', name: 'Spain', flag: '🇪🇸', populationYear: 2020, difficulty: 3, territoryExtent: 'metropolitan' },
  { iso3: 'PRT', iso2: 'PT', name: 'Portugal', flag: '🇵🇹', populationYear: 2020, difficulty: 2, territoryExtent: 'metropolitan' },
  { iso3: 'ITA', iso2: 'IT', name: 'Italy', flag: '🇮🇹', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'CHE', iso2: 'CH', name: 'Switzerland', flag: '🇨🇭', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'AUT', iso2: 'AT', name: 'Austria', flag: '🇦🇹', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'POL', iso2: 'PL', name: 'Poland', flag: '🇵🇱', populationYear: 2020, difficulty: 2, territoryExtent: 'full' },
  { iso3: 'CZE', iso2: 'CZ', name: 'Czechia', flag: '🇨🇿', populationYear: 2020, difficulty: 2, territoryExtent: 'full' },
  { iso3: 'DNK', iso2: 'DK', name: 'Denmark', flag: '🇩🇰', populationYear: 2020, difficulty: 2, territoryExtent: 'metropolitan' },
  { iso3: 'SWE', iso2: 'SE', name: 'Sweden', flag: '🇸🇪', populationYear: 2020, difficulty: 4, territoryExtent: 'full' },
  { iso3: 'NOR', iso2: 'NO', name: 'Norway', flag: '🇳🇴', populationYear: 2020, difficulty: 5, territoryExtent: 'metropolitan' },
  { iso3: 'FIN', iso2: 'FI', name: 'Finland', flag: '🇫🇮', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'BIH', iso2: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦', populationYear: 2020, difficulty: 4, territoryExtent: 'full' },
  { iso3: 'HRV', iso2: 'HR', name: 'Croatia', flag: '🇭🇷', populationYear: 2020, difficulty: 4, territoryExtent: 'full' },
  { iso3: 'SRB', iso2: 'RS', name: 'Serbia', flag: '🇷🇸', populationYear: 2020, difficulty: 2, territoryExtent: 'full' },
  { iso3: 'TUR', iso2: 'TR', name: 'Turkey', flag: '🇹🇷', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'GRC', iso2: 'GR', name: 'Greece', flag: '🇬🇷', populationYear: 2020, difficulty: 4, territoryExtent: 'full' },
  { iso3: 'USA', iso2: 'US', name: 'United States', flag: '🇺🇸', populationYear: 2020, difficulty: 4, territoryExtent: 'metropolitan' },
  { iso3: 'CAN', iso2: 'CA', name: 'Canada', flag: '🇨🇦', populationYear: 2020, difficulty: 4, territoryExtent: 'full' },
  { iso3: 'MEX', iso2: 'MX', name: 'Mexico', flag: '🇲🇽', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'BRA', iso2: 'BR', name: 'Brazil', flag: '🇧🇷', populationYear: 2020, difficulty: 4, territoryExtent: 'full' },
  { iso3: 'ARG', iso2: 'AR', name: 'Argentina', flag: '🇦🇷', populationYear: 2020, difficulty: 4, territoryExtent: 'metropolitan' },
  { iso3: 'JPN', iso2: 'JP', name: 'Japan', flag: '🇯🇵', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'KOR', iso2: 'KR', name: 'South Korea', flag: '🇰🇷', populationYear: 2020, difficulty: 2, territoryExtent: 'full' },
  { iso3: 'IND', iso2: 'IN', name: 'India', flag: '🇮🇳', populationYear: 2020, difficulty: 3, territoryExtent: 'metropolitan' },
  { iso3: 'CHN', iso2: 'CN', name: 'China', flag: '🇨🇳', populationYear: 2020, difficulty: 4, territoryExtent: 'metropolitan' },
  { iso3: 'IDN', iso2: 'ID', name: 'Indonesia', flag: '🇮🇩', populationYear: 2020, difficulty: 5, territoryExtent: 'full' },
  { iso3: 'AUS', iso2: 'AU', name: 'Australia', flag: '🇦🇺', populationYear: 2020, difficulty: 4, territoryExtent: 'metropolitan' },
  { iso3: 'EGY', iso2: 'EG', name: 'Egypt', flag: '🇪🇬', populationYear: 2020, difficulty: 5, territoryExtent: 'full' },
  { iso3: 'ZAF', iso2: 'ZA', name: 'South Africa', flag: '🇿🇦', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
  { iso3: 'NGA', iso2: 'NG', name: 'Nigeria', flag: '🇳🇬', populationYear: 2020, difficulty: 3, territoryExtent: 'full' },
];

/** The five countries that must be fully working end-to-end for Milestone 1. */
export const MILESTONE_1_COUNTRIES: ISO3[] = ['NLD', 'BEL', 'BIH', 'FRA', 'DEU'];

const BY_ISO3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));

export function getCountry(iso3: ISO3): CountryMeta | undefined {
  return BY_ISO3.get(iso3);
}

export function requireCountry(iso3: ISO3): CountryMeta {
  const c = BY_ISO3.get(iso3);
  if (!c) throw new Error(`Unknown country ISO3: ${iso3}`);
  return c;
}
