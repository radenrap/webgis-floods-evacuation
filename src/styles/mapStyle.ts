// Style & lapisan MapLibre. Sumber: spec 30 §1 (sources), §3 (z-order & definisi layer), §4 (ekspresi).
// Ditipekan dengan tipe spesifikasi MapLibre agar source/layer/ekspresi tervalidasi saat compile.

import type { FeatureCollection } from 'geojson';
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { RISK_COLOR, RISK_FILL_OPACITY, SHELTER_STATUS_COLOR } from './tokens';

/** Basemap default (demo). Ganti dengan basemap produksi (MapTiler / OSM / dll). */
export const BASEMAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/** FeatureCollection kosong baru (data diisi runtime via fetchLayerGeoJson + setData, 30 §1.1). */
const emptyFC = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

// ---------------------------------------------------------------------------
// Sources (spec 30 §1.1). promoteId menstabilkan feature.id utk setFeatureState.
// ---------------------------------------------------------------------------
export type SourceId =
  | 'src-flood-prone'
  | 'src-inundation'
  | 'src-roads'
  | 'src-routes'
  | 'src-facilities'
  | 'src-shelters'
  | 'src-user'
  | 'src-route-result';

export const SOURCES: Record<SourceId, SourceSpecification> = {
  'src-flood-prone': {
    type: 'geojson',
    data: emptyFC(),
    promoteId: 'area_id',
  },
  'src-inundation': {
    type: 'geojson',
    data: emptyFC(),
    promoteId: 'event_id',
  },
  'src-roads': {
    type: 'geojson',
    data: emptyFC(),
    promoteId: 'road_id',
    maxzoom: 16,
  },
  'src-routes': {
    type: 'geojson',
    data: emptyFC(),
    promoteId: 'route_id',
  },
  'src-facilities': {
    type: 'geojson',
    data: emptyFC(),
    promoteId: 'facility_id',
  },
  'src-shelters': {
    type: 'geojson',
    data: emptyFC(),
    promoteId: 'shelter_id',
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  },
  'src-user': { type: 'geojson', data: emptyFC() },
  'src-route-result': { type: 'geojson', data: emptyFC() },
};

export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

// ---------------------------------------------------------------------------
// Layers (spec 30 §3): urutan array = z-order bawah->atas. Ekspresi sesuai §4.
// ---------------------------------------------------------------------------
export const LAYERS: LayerSpecification[] = [
  {
    id: 'flood-fill',
    type: 'fill',
    source: 'src-flood-prone',
    paint: {
      'fill-color': [
        'match',
        ['get', 'kelas_rawan'],
        'RENDAH',
        RISK_COLOR.RENDAH,
        'SEDANG',
        RISK_COLOR.SEDANG,
        'TINGGI',
        RISK_COLOR.TINGGI,
        '#9e9e9e',
      ],
      'fill-opacity': [
        'match',
        ['get', 'kelas_rawan'],
        'RENDAH',
        RISK_FILL_OPACITY.RENDAH,
        'SEDANG',
        RISK_FILL_OPACITY.SEDANG,
        'TINGGI',
        RISK_FILL_OPACITY.TINGGI,
        0.3,
      ],
    },
  },
  {
    id: 'flood-outline',
    type: 'line',
    source: 'src-flood-prone',
    paint: { 'line-color': '#37474f', 'line-width': 1 },
  },
  {
    id: 'inundation-fill',
    type: 'fill',
    source: 'src-inundation',
    filter: ['==', ['get', 'aktif'], true],
    paint: {
      'fill-color': '#1565c0',
      'fill-opacity': ['interpolate', ['linear'], ['get', 'kedalaman_m'], 0, 0.25, 2, 0.65],
    },
  },
  {
    id: 'roads',
    type: 'line',
    source: 'src-roads',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-opacity': 0.9,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        ['match', ['get', 'kelas_jalan'], 'ARTERI', 1.5, 'KOLEKTOR', 1.0, 'LOKAL', 0.6, 'GANG', 0.4, 0.5],
        16,
        ['match', ['get', 'kelas_jalan'], 'ARTERI', 6, 'KOLEKTOR', 4, 'LOKAL', 2.5, 'GANG', 1.5, 2],
      ],
    },
  },
  {
    id: 'routes',
    type: 'line',
    source: 'src-routes',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#00897b', 'line-width': 2, 'line-dasharray': [2, 2] },
  },
  {
    id: 'facilities',
    type: 'circle',
    source: 'src-facilities',
    paint: {
      'circle-radius': 5,
      'circle-color': '#6a1b9a',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    },
  },
  {
    id: 'route-result-casing',
    type: 'line',
    source: 'src-route-result',
    paint: { 'line-color': '#0d47a1', 'line-width': 8, 'line-opacity': 0.3 },
  },
  {
    id: 'route-result',
    type: 'line',
    source: 'src-route-result',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#1976d2', 'line-width': 4 },
  },
  {
    id: 'shelters-cluster',
    type: 'circle',
    source: 'src-shelters',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#42a5f5', 10, '#1e88e5', 30, '#1565c0'],
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 22],
    },
  },
  {
    id: 'shelters-cluster-count',
    type: 'symbol',
    source: 'src-shelters',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
    paint: { 'text-color': '#ffffff' },
  },
  {
    id: 'shelters-point',
    type: 'circle',
    source: 'src-shelters',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 9, 7],
      'circle-color': [
        'match',
        ['get', 'status'],
        'SIAP',
        SHELTER_STATUS_COLOR.SIAP,
        'SIAGA',
        SHELTER_STATUS_COLOR.SIAGA,
        'PENUH',
        SHELTER_STATUS_COLOR.PENUH,
        'NONAKTIF',
        SHELTER_STATUS_COLOR.NONAKTIF,
        '#2e7d32',
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
  {
    id: 'shelters-label',
    type: 'symbol',
    source: 'src-shelters',
    filter: ['!', ['has', 'point_count']],
    layout: {
      visibility: 'none',
      'text-field': ['get', 'nama'],
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
    },
    paint: { 'text-color': '#263238', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
  },
  {
    id: 'user-location',
    type: 'circle',
    source: 'src-user',
    paint: {
      'circle-radius': 8,
      'circle-color': '#1976d2',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
];

export const LAYER_IDS = LAYERS.map((l) => l.id);

// ---------------------------------------------------------------------------
// Grup toggle (spec 30 §3 tabel "Grup toggle") utk LayerToggle / setLayoutProperty.
// ---------------------------------------------------------------------------
export const LAYER_GROUPS = {
  Risiko: ['flood-fill', 'flood-outline', 'inundation-fill'],
  Infrastruktur: ['roads', 'routes', 'facilities'],
  Shelter: ['shelters-cluster', 'shelters-cluster-count', 'shelters-point', 'shelters-label'],
  Analisis: ['route-result-casing', 'route-result', 'user-location'],
} as const satisfies Record<string, readonly string[]>;

export type LayerGroupId = keyof typeof LAYER_GROUPS;
