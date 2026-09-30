// Helper konversi & tipe bersama untuk modul turf.
// Konvensi: koordinat [lng, lat] (EPSG:4326), jarak meter. Lihat spec 41 §3.4.

import type { Feature, Point, Polygon, MultiPolygon, Position } from 'geojson';
import { point as turfPoint, featureCollection } from '@turf/turf';

// Tipe bersama (dipakai distance/nearest/zone).
export type LngLat = [number, number];
export type PointFeature = Feature<Point>;
export type AnyPolygon = Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon;

/** [lng, lat] -> Feature<Point>. */
export function lngLatToFeature(
  lngLat: LngLat,
  properties: Record<string, unknown> = {},
): PointFeature {
  return turfPoint(lngLat, properties);
}

/** Ambil [lng, lat] dari Position / Point / Feature<Point>. */
export function toLngLat(v: Position | PointFeature | Point): LngLat {
  const coords = Array.isArray(v)
    ? v
    : (v as PointFeature).type === 'Feature'
      ? (v as PointFeature).geometry.coordinates
      : (v as Point).coordinates;
  return [coords[0], coords[1]];
}

/** Bungkus array feature -> FeatureCollection. */
export function asFeatureCollection<T extends Feature>(features: T[]) {
  return featureCollection(features);
}
