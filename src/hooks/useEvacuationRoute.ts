// Hook orkestrasi rute evakuasi (klien). Lihat spec 40 §7.1.
// Perilaku compute: (1) pakai evacuationRouteSafe bila opts.safe !== false;
// (2) bila error 'no_safe_route', fallback ke evacuationRoute + set flag peringatan;
// (3) simpan route -> konsumen memanggil setRouteResult(route) lalu fitBounds (30 §7).

import { useCallback, useState } from 'react';
import type { Feature } from 'geojson';
import { evacuationRoute, evacuationRouteSafe, isRouteError } from '../lib/api';

export interface UseEvacuationRouteOptions {
  /** true (default) = rute sadar-banjir; false = rute jaringan biasa. */
  safe?: boolean;
}

export interface UseEvacuationRouteResult {
  loading: boolean;
  error: string | null;
  /** Peringatan non-fatal, mis. fallback dari rute sadar-banjir ke rute biasa. */
  warning: string | null;
  route: Feature | null;
  compute(
    from: [number, number],
    toShelterId: number,
    opts?: UseEvacuationRouteOptions,
  ): Promise<void>;
}

export function useEvacuationRoute(): UseEvacuationRouteResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [route, setRoute] = useState<Feature | null>(null);

  const compute = useCallback(
    async (from: [number, number], toShelterId: number, opts?: UseEvacuationRouteOptions) => {
      const [lng, lat] = from;
      setLoading(true);
      setError(null);
      setWarning(null);
      setRoute(null);
      try {
        const safe = opts?.safe !== false;
        let res = safe
          ? await evacuationRouteSafe(lng, lat, toShelterId)
          : await evacuationRoute(lng, lat, toShelterId);

        // Fallback: semua jalur aman terputus genangan -> rute biasa + peringatan.
        if (safe && isRouteError(res) && res.error === 'no_safe_route') {
          setWarning(
            'Rute sadar-banjir tidak tersedia; memakai rute biasa (mungkin melewati genangan).',
          );
          res = await evacuationRoute(lng, lat, toShelterId);
        }

        if (isRouteError(res)) {
          setError(res.error);
          return;
        }
        setRoute(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan jaringan/database.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, warning, route, compute };
}
