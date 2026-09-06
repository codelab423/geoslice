import { useEffect, useState } from 'react';
import type { ISO3, PopulationDataFile } from '../types';

export interface CountryDataState {
  status: 'loading' | 'ready' | 'error';
  /** Human-readable reason when status === 'error'. Never silently substitutes fake data. */
  error?: string;
  boundary?: GeoJSON.FeatureCollection;
  population?: PopulationDataFile;
}

const cache = new Map<ISO3, { boundary: GeoJSON.FeatureCollection; population: PopulationDataFile }>();

export function useCountryData(iso3: ISO3 | null): CountryDataState {
  const [state, setState] = useState<CountryDataState>({ status: 'loading' });

  useEffect(() => {
    if (!iso3) return;
    const cached = cache.get(iso3);
    if (cached) {
      setState({ status: 'ready', ...cached });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}countries/${iso3}.geojson`),
      fetch(`${base}population/${iso3}.json`),
    ])
      .then(async ([boundaryRes, popRes]) => {
        if (cancelled) return;
        // A dev-server SPA fallback (or a misconfigured static host) can return
        // index.html with a 200 status for a missing file, so content-type is
        // checked too rather than trusting `res.ok` alone.
        const isJson = (res: Response) => res.ok && (res.headers.get('content-type') ?? '').includes('json');

        if (!isJson(boundaryRes)) {
          throw new Error(
            `Boundary data missing for ${iso3} (public/countries/${iso3}.geojson). Run scripts/fetch_boundaries.py.`
          );
        }
        if (!isJson(popRes)) {
          throw new Error(
            `Real WorldPop population data is not built yet for ${iso3} (public/population/${iso3}.json is missing). ` +
              `This game never substitutes fake population data — run scripts/build_population.py ${iso3}, ` +
              `or wait for the data-build GitHub Action to finish, then reload.`
          );
        }
        const [boundary, population] = await Promise.all([boundaryRes.json(), popRes.json()]);
        if (cancelled) return;
        cache.set(iso3, { boundary, population });
        setState({ status: 'ready', boundary, population });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [iso3]);

  return state;
}
