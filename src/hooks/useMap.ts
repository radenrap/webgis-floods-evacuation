import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';

export interface UseMapOptions {
  /** [lng, lat], mis. [106.82, -6.89] (spec 30 §7). */
  center: [number, number];
  zoom: number;
  /** URL basemap (styles/mapStyle.ts BASEMAP_STYLE_URL). */
  style: string;
}

export interface UseMapResult {
  map: MapLibreMap | null;
  loaded: boolean;
}

/**
 * Menginisialisasi peta MapLibre pada `container` dan menunggu event `load`
 * (spec 30 §7.1). Cleanup memanggil `map.remove()` agar tidak bocor.
 */
export function useMap(
  container: RefObject<HTMLDivElement | null>,
  opts: UseMapOptions,
): UseMapResult {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Destructure agar deps effect berupa primitif (center array berubah identity tiap render).
  const { center, zoom, style } = opts;
  const lng = center[0];
  const lat = center[1];

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const instance = new MapLibreMap({
      container: el,
      style,
      center: [lng, lat],
      zoom,
    });

    // setState hanya dalam callback event (bukan body effect) agar tidak cascading render.
    const onLoad = () => {
      setMap(instance);
      setLoaded(true);
    };
    // Surface error style/tile ke console agar kegagalan render tidak silent.
    const onError = (e: { error?: unknown }) => {
      const err = e.error;
      console.error('[maplibre] error:', err instanceof Error ? err.message : String(err ?? e));
    };
    instance.on('load', onLoad);
    instance.on('error', onError);

    return () => {
      instance.off('load', onLoad);
      instance.off('error', onError);
      instance.remove(); // cleanup (spec 30 §7.1)
      setMap(null);
      setLoaded(false);
    };
  }, [container, lng, lat, zoom, style]);

  return { map, loaded };
}
