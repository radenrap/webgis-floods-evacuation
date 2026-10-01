import { useCallback, useState } from 'react';

export interface UseGeolocationResult {
  /** [lng, lat] pengguna, atau null bila belum/bagal. */
  position: [number, number] | null;
  error: string | null;
  locate: () => void;
}

/** Membaca geolokasi browser -> [lng, lat] (spec 30 §7.1 poin 5). */
export function useGeolocation(): UseGeolocationResult {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolokasi tidak didukung perangkat ini.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.longitude, pos.coords.latitude]);
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { position, error, locate };
}
