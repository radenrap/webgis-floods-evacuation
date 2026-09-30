// Tipe domain & kontrak respons lapisan API.
// Sumber: spec/10-spatial-data-spec.md §3 (properties), spec/40-routing-analysis-spec.md §7 (respons RPC).
// Semua enum domain dinyatakan sebagai union string (bukan `enum`) karena `erasableSyntaxOnly`.

import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
  MultiPolygon,
} from 'geojson';

// ---------------------------------------------------------------------------
// Enum domain (spec 10 §3 & 00 §9.2)
// ---------------------------------------------------------------------------
export type KelasRawan = 'RENDAH' | 'SEDANG' | 'TINGGI';
export type ShelterJenis = 'GEDUNG' | 'LAPANGAN' | 'SEKOLAH' | 'MASJID' | 'BALAI';
export type ShelterStatus = 'SIAP' | 'SIAGA' | 'PENUH' | 'NONAKTIF';
export type KelasJalan = 'ARTERI' | 'KOLEKTOR' | 'LOKAL' | 'GANG';
export type RouteStatus = 'AKTIF' | 'CADANGAN';
export type FacilityTipe = 'RUMAH_SAKIT' | 'PUSKESMAS' | 'SEKOLAH' | 'POSKO';

// ---------------------------------------------------------------------------
// Properties tiap lapisan (spec 10 §3). Field "Tidak wajib" -> nullable.
// ---------------------------------------------------------------------------
export interface FloodProneAreaProperties {
  area_id: number;
  nama: string | null;
  kelas_rawan: KelasRawan;
  skor_rawan: number;
  kedalaman_max_m: number | null;
  luas_ha: number | null;
  sumber: string | null;
  updated_at: string;
}

export interface ShelterFasilitas {
  air_bersih?: boolean;
  dapur?: boolean;
  medis?: boolean;
}

export interface EvacuationShelterProperties {
  shelter_id: number;
  nama: string;
  jenis: ShelterJenis;
  kapasitas: number;
  status: ShelterStatus;
  kontak: string | null;
  fasilitas: ShelterFasilitas;
  updated_at: string;
}

export interface RoadNetworkProperties {
  road_id: number;
  nama: string | null;
  kelas_jalan: KelasJalan;
  oneway: boolean;
  speed_kmh: number;
  length_m: number;
}

export interface EvacuationRouteProperties {
  route_id: number;
  nama: string;
  from_shelter_id: number | null;
  length_m: number;
  status: RouteStatus;
}

export interface FloodInundationProperties {
  event_id: number;
  event_time: string;
  kedalaman_m: number;
  aktif: boolean;
  sumber: string | null;
}

export interface CriticalFacilityProperties {
  facility_id: number;
  nama: string;
  tipe: FacilityTipe;
  kontak: string | null;
}

// ---------------------------------------------------------------------------
// Feature / FeatureCollection bertipe per lapisan
// ---------------------------------------------------------------------------
export type FloodProneAreaFeature = Feature<Polygon | MultiPolygon, FloodProneAreaProperties>;
export type EvacuationShelterFeature = Feature<Point, EvacuationShelterProperties>;
export type RoadNetworkFeature = Feature<LineString, RoadNetworkProperties>;
export type EvacuationRouteFeature = Feature<LineString, EvacuationRouteProperties>;
export type FloodInundationFeature = Feature<Polygon | MultiPolygon, FloodInundationProperties>;
export type CriticalFacilityFeature = Feature<Point, CriticalFacilityProperties>;

export type FloodProneAreaCollection = FeatureCollection<Polygon | MultiPolygon, FloodProneAreaProperties>;
export type EvacuationShelterCollection = FeatureCollection<Point, EvacuationShelterProperties>;
export type RoadNetworkCollection = FeatureCollection<LineString, RoadNetworkProperties>;
export type EvacuationRouteCollection = FeatureCollection<LineString, EvacuationRouteProperties>;
export type FloodInundationCollection = FeatureCollection<Polygon | MultiPolygon, FloodInundationProperties>;
export type CriticalFacilityCollection = FeatureCollection<Point, CriticalFacilityProperties>;

// ---------------------------------------------------------------------------
// Nama view & fungsi RPC (kontrak dengan spec 20)
// ---------------------------------------------------------------------------
export type LayerView =
  | 'v_flood_prone_area_geojson'
  | 'v_evacuation_shelter_geojson'
  | 'v_road_network_geojson'
  | 'v_evacuation_route_geojson'
  | 'v_flood_inundation_geojson'
  | 'v_critical_facility_geojson';

export type RpcFunctionName =
  | 'fn_flood_risk_at'
  | 'fn_nearest_shelters'
  | 'fn_evacuation_route'
  | 'fn_evacuation_route_safe'
  | 'fn_service_area'
  | 'fn_population_exposed';

// ---------------------------------------------------------------------------
// Kontrak respons RPC (spec 40 §7)
// ---------------------------------------------------------------------------
export type RouteErrorCode = 'no_network_node' | 'no_route' | 'no_safe_route';

export interface RouteError {
  error: RouteErrorCode;
}

export interface RouteProperties {
  from_shelter_id: number;
  total_distance_m: number;
  total_time_s: number;
  edge_count: number;
  avoids_inundation: boolean;
}

export type RouteFeature = Feature<LineString, RouteProperties>;

/** Hasil rute: Feature LineString ATAU objek error domain (bukan HTTP error). */
export type RouteResponse = RouteFeature | RouteError;

export interface FloodRiskResponse {
  found: boolean;
  area_id?: number;
  nama?: string;
  kelas_rawan?: KelasRawan;
  skor_rawan?: number;
  kedalaman_max_m?: number;
}

/** fn_nearest_shelters menambah `distance_m` pada properties shelter. */
export interface NearestShelterProperties extends EvacuationShelterProperties {
  distance_m: number;
}
export type NearestShelterFeature = Feature<Point, NearestShelterProperties>;
export type NearestSheltersResponse = FeatureCollection<Point, NearestShelterProperties>;

/** fn_service_area: ruas jalan terjangkau (properties minimal `road_id`). */
export interface ServiceAreaEdgeProperties {
  road_id: number;
}
export type ServiceAreaResponse = FeatureCollection<LineString, ServiceAreaEdgeProperties>;

/** fn_population_exposed: proxy populasi/fasilitas terdampak dalam sebuah zona. */
export interface PopulationExposedResponse {
  area_id: number;
  shelter_count: number;
  shelter_capacity: number;
  facility_count: number;
}
