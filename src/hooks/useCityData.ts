import { useEffect, useState } from 'react';
import type { CityLabel, ISO3 } from '../types';

const cache = new Map<ISO3, CityLabel[]>();

/**
 * City labels are purely decorative (see CityLabel in types/index.ts), so
 * unlike useCountryData this fails soft: a missing/unbuilt file just means
 * no city labels are shown, never an error screen.
 */
export function useCityData(iso3: ISO3 | null): CityLabel[] {
  const [cities, setCities] = useState<CityLabel[]>([]);

  useEffect(() => {
    if (!iso3) {
      setCities([]);
      return;
    }
    const cached = cache.get(iso3);
    if (cached) {
      setCities(cached);
      return;
    }

    let cancelled = false;
    setCities([]);
    const base = import.meta.env.BASE_URL;
    fetch(`${base}cities/${iso3}.json`)
      .then((res) => {
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || !contentType.includes('json')) return [];
        return res.json();
      })
      .then((data: CityLabel[]) => {
        if (cancelled) return;
        cache.set(iso3, data);
        setCities(data);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      });

    return () => {
      cancelled = true;
    };
  }, [iso3]);

  return cities;
}
