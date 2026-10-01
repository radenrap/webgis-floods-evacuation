import { useCallback, useEffect, useRef } from 'react';
import { Popup } from 'maplibre-gl';
import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { LAYERS, SOURCE_IDS, SOURCES } from '../styles/mapStyle';
import type { RiskClass } from '../styles/tokens';
import { fetchLayerGeoJson } from '../lib/api';
import type { EvacuationShelterProperties, LayerView } from '../lib/api';

/** Pemetaan source -> view geojson utk muat data awal (spec 30 §7.1 poin 3). */
const SOURCE_VIEW: Partial<Record<string, LayerView>> = {
  'src-flood-prone': 'v_flood_prone_area_geojson',
  'src-inundation': 'v_flood_inundation_geojson',
  'src-roads': 'v_road_network_geojson',
  'src-routes': 'v_evacuation_route_geojson',
  'src-facilities': 'v_critical_facility_geojson',
  'src-shelters': 'v_evacuation_shelter_geojson',
};

export interface UseMapLayersOptions {
  /** Dipanggil saat shelters-point diklik (konsumen menampilkan ShelterPopup). */
  onShelterClick?: (shelter: EvacuationShelterProperties) => void;
}

export interface UseMapLayersResult {
  setLayerVisible: (layerId: string, visible: boolean) => void;
  setRiskFilter: (classes: RiskClass[]) => void;
  setRouteResult: (geojson: Feature | null) => void;
  setUserLocation: (lngLat: [number, number] | null) => void;
}

/**
 * Menambahkan seluruh `source` lalu `layer` setelah event `load`, memuat data
 * lapisan via `fetchLayerGeoJson` + `getSource(id).setData(fc)` (source dimulai
 * kosong), memasang interaksi hover feature-state & click popup, dan
 * mengembalikan setter utk toggle/filter/rute/lokasi (spec 30 §7).
 */
export function useMapLayers(
  map: MapLibreMap | null,
  options: UseMapLayersOptions = {},
): UseMapLayersResult {
  const { onShelterClick } = options;

  const hoveredId = useRef<number | string | null>(null);
  const onShelterClickRef = useRef(onShelterClick);
  useEffect(() => {
    onShelterClickRef.current = onShelterClick; // selalu terbaru tanpa re-run effect interaksi
  }, [onShelterClick]);

  // 1) add sources + layers + load data awal sekali style siap (spec 30 §7.1).
  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const init = async () => {
      if (!map.isStyleLoaded()) {
        await new Promise<void>((resolve) => {
          map.once('load', () => resolve());
        });
      }
      if (cancelled) return;

      for (const id of SOURCE_IDS) {
        if (!map.getSource(id)) map.addSource(id, SOURCES[id]);
      }
      for (const layer of LAYERS) {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
      }

      await Promise.all(
        SOURCE_IDS.map(async (id) => {
          const view = SOURCE_VIEW[id];
          if (!view) return;
          try {
            const fc = await fetchLayerGeoJson(view);
            if (cancelled) return;
            (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
          } catch {
            // Lapisan gagal dimuat; biarkan kosong (data dinamis bisa di-refresh, §7.2).
          }
        }),
      );
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [map]);

  // 2) interaksi: hover feature-state (shelters-point) + click popup (spec 30 §5.2).
  useEffect(() => {
    if (!map) return;

    const onMove = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer';
      const id = e.features?.[0]?.id ?? null;
      if (hoveredId.current !== null) {
        map.setFeatureState({ source: 'src-shelters', id: hoveredId.current }, { hover: false });
      }
      hoveredId.current = id;
      if (id !== null) map.setFeatureState({ source: 'src-shelters', id }, { hover: true });
    };

    const onLeave = () => {
      map.getCanvas().style.cursor = '';
      if (hoveredId.current !== null) {
        map.setFeatureState({ source: 'src-shelters', id: hoveredId.current }, { hover: false });
      }
      hoveredId.current = null;
    };

    const onShelter = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as EvacuationShelterProperties | undefined;
      if (props) onShelterClickRef.current?.(props);
    };

    const onFlood = (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties as
        | { kelas_rawan?: string; skor_rawan?: number }
        | undefined;
      if (!p) return;
      new Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${p.kelas_rawan ?? '-'}</strong><br/>Skor rawan: ${p.skor_rawan ?? '-'}`)
        .addTo(map);
    };

    const onFacility = (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties as { nama?: string; tipe?: string } | undefined;
      if (!p) return;
      new Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${p.nama ?? '-'}</strong><br/>${p.tipe ?? ''}`)
        .addTo(map);
    };

    map.on('mousemove', 'shelters-point', onMove);
    map.on('mouseleave', 'shelters-point', onLeave);
    map.on('click', 'shelters-point', onShelter);
    map.on('click', 'flood-fill', onFlood);
    map.on('click', 'facilities', onFacility);

    return () => {
      map.off('mousemove', 'shelters-point', onMove);
      map.off('mouseleave', 'shelters-point', onLeave);
      map.off('click', 'shelters-point', onShelter);
      map.off('click', 'flood-fill', onFlood);
      map.off('click', 'facilities', onFacility);
    };
  }, [map]);

  const setLayerVisible = useCallback(
    (layerId: string, visible: boolean) => {
      map?.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    },
    [map],
  );

  const setRiskFilter = useCallback(
    (classes: RiskClass[]) => {
      if (!map) return;
      const filter: FilterSpecification = ['match', ['get', 'kelas_rawan'], classes, true, false];
      map.setFilter('flood-fill', filter);
      map.setFilter('flood-outline', filter);
    },
    [map],
  );

  const setRouteResult = useCallback(
    (geojson: Feature | null) => {
      const src = map?.getSource('src-route-result') as GeoJSONSource | undefined;
      const fc: FeatureCollection = {
        type: 'FeatureCollection',
        features: geojson ? [geojson] : [],
      };
      src?.setData(fc); // setData, bukan recreate layer (spec 30 §7.2)
    },
    [map],
  );

  const setUserLocation = useCallback(
    (lngLat: [number, number] | null) => {
      const src = map?.getSource('src-user') as GeoJSONSource | undefined;
      const fc: FeatureCollection<Point> = {
        type: 'FeatureCollection',
        features: lngLat
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: lngLat },
              },
            ]
          : [],
      };
      src?.setData(fc);
    },
    [map],
  );

  return { setLayerVisible, setRiskFilter, setRouteResult, setUserLocation };
}
