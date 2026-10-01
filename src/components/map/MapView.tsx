import { useEffect, useRef, useState } from 'react';
import { LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMap } from '../../hooks/useMap';
import { useMapLayers } from '../../hooks/useMapLayers';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useEvacuationRoute } from '../../hooks/useEvacuationRoute';
import { BASEMAP_STYLE_URL } from '../../styles/mapStyle';
import RiskLegend from './RiskLegend';
import LayerToggle from './LayerToggle';
import ShelterPopup from './ShelterPopup';
import type { EvacuationShelterProperties } from '../../lib/api';

export interface MapViewProps {
  /** [lng, lat] pusat peta awal. Default kawasan contoh. */
  center?: [number, number];
  zoom?: number;
}

/**
 * Merangkai seluruh hook peta: useMap -> useMapLayers -> useGeolocation ->
 * useEvacuationRoute, plus overlay RiskLegend / LayerToggle / ShelterPopup
 * (spec 30 §7, 40 §7.1).
 */
export default function MapView({ center = [106.82, -6.89], zoom = 13 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { map } = useMap(containerRef, { center, zoom, style: BASEMAP_STYLE_URL });
  const [selectedShelter, setSelectedShelter] = useState<EvacuationShelterProperties | null>(null);

  const { setLayerVisible, setRiskFilter, setRouteResult, setUserLocation } = useMapLayers(map, {
    onShelterClick: setSelectedShelter,
  });
  const { position, error: geoError, locate } = useGeolocation();
  const { route, warning, error: routeError, loading: routeLoading, compute } =
    useEvacuationRoute();

  // Sinkronkan lokasi pengguna -> source src-user (spec 30 §7.1 poin 5).
  useEffect(() => {
    setUserLocation(position);
  }, [position, setUserLocation]);

  // Saat rute tersedia -> pasang ke src-route-result lalu fitBounds (spec 40 §7.1 poin 3).
  useEffect(() => {
    setRouteResult(route);
    if (route && map && route.geometry.type === 'LineString') {
      const bounds = new LngLatBounds();
      for (const coord of route.geometry.coordinates) {
        bounds.extend([coord[0], coord[1]]);
      }
      map.fitBounds(bounds, { padding: 60 });
    }
  }, [route, map, setRouteResult]);

  const resolveFrom = (): [number, number] => {
    if (position) return position;
    const c = map?.getCenter();
    return c ? [c.lng, c.lat] : center;
  };

  const handleRoute = () => {
    if (!selectedShelter) return;
    void compute(resolveFrom(), selectedShelter.shelter_id);
  };

  const message = routeError ?? geoError;

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-overlays">
        <RiskLegend />
        <LayerToggle onToggle={setLayerVisible} onRiskFilter={setRiskFilter} />
        <button type="button" onClick={locate}>
          Lokasi Saya
        </button>
        {selectedShelter ? (
          <ShelterPopup
            shelter={selectedShelter}
            routeLoading={routeLoading}
            onRoute={handleRoute}
            onClose={() => setSelectedShelter(null)}
          />
        ) : null}
        {message ? <p role="alert">{message}</p> : null}
        {warning ? <p role="status">{warning}</p> : null}
      </div>
    </div>
  );
}
