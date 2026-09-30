// Lapisan API: klien data (Supabase/PostgREST) untuk view GeoJSON & fungsi RPC.
// Kontrak: spec 40 §7 dan spec 20 §7.3. Semua fungsi melempar PostgrestError bila
// permintaan gagal (HTTP/DB); error domain rute dikembalikan sebagai nilai (RouteError).

import type { FeatureCollection } from 'geojson';
import { supabase } from './supabase';
import type {
  FloodRiskResponse,
  LayerView,
  NearestSheltersResponse,
  PopulationExposedResponse,
  RouteError,
  RouteResponse,
  RpcFunctionName,
  ServiceAreaResponse,
} from './types';

export type * from './types';

type RpcArgs = Record<string, unknown>;
type GeoJsonViewRow = { geojson: FeatureCollection };

/**
 * Panggil SQL function (RPC) via supabase.rpc.
 * `fn` dibatasi ke nama fungsi yang dikenal (RpcFunctionName) demi type-safety.
 */
export async function rpc<T>(fn: RpcFunctionName, args: RpcArgs = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

/**
 * Ambil satu lapisan GeoJSON dari view `v_*_geojson`.
 * View mengembalikan satu baris { geojson: FeatureCollection } (spec 20 §6).
 */
export async function fetchLayerGeoJson(view: LayerView): Promise<FeatureCollection> {
  const { data, error } = await supabase.from(view).select('geojson').single();
  if (error) throw error;
  return (data as GeoJsonViewRow).geojson;
}

/** fn_nearest_shelters: shelter terdekat (FeatureCollection + `distance_m`). */
export function nearestShelters(
  lng: number,
  lat: number,
  radiusM = 5000,
  limitN = 5,
): Promise<NearestSheltersResponse> {
  return rpc<NearestSheltersResponse>('fn_nearest_shelters', {
    lng,
    lat,
    radius_m: radiusM,
    limit_n: limitN,
  });
}

/** fn_evacuation_route: rute jaringan biasa (tidak menghindari genangan). */
export function evacuationRoute(
  fromLng: number,
  fromLat: number,
  toShelterId: number,
): Promise<RouteResponse> {
  return rpc<RouteResponse>('fn_evacuation_route', {
    from_lng: fromLng,
    from_lat: fromLat,
    to_shelter_id: toShelterId,
  });
}

/** fn_evacuation_route_safe: rute sadar-banjir (menghindari genangan aktif). */
export function evacuationRouteSafe(
  fromLng: number,
  fromLat: number,
  toShelterId: number,
): Promise<RouteResponse> {
  return rpc<RouteResponse>('fn_evacuation_route_safe', {
    from_lng: fromLng,
    from_lat: fromLat,
    to_shelter_id: toShelterId,
  });
}

/** fn_flood_risk_at: kelas & skor risiko pada sebuah titik. */
export function floodRiskAt(lng: number, lat: number): Promise<FloodRiskResponse> {
  return rpc<FloodRiskResponse>('fn_flood_risk_at', { lng, lat });
}

/** fn_service_area: jaringan terjangkau dari sebuah shelter dalam radius (meter). */
export function serviceArea(shelterId: number, distM = 1000): Promise<ServiceAreaResponse> {
  return rpc<ServiceAreaResponse>('fn_service_area', {
    shelter_id: shelterId,
    dist_m: distM,
  });
}

/** fn_population_exposed: proxy populasi/fasilitas terdampak dalam sebuah zona. */
export function populationExposed(areaId: number): Promise<PopulationExposedResponse> {
  return rpc<PopulationExposedResponse>('fn_population_exposed', { area_id: areaId });
}

/** Type guard: membedakan RouteError dari RouteFeature pada RouteResponse. */
export function isRouteError(res: RouteResponse): res is RouteError {
  return 'error' in res;
}
