// Helper shelter terdekat di klien (Turf.js). Lihat spec 41 §3.2.

import type { Point, FeatureCollection } from 'geojson';
import { nearestPoint, distance, featureCollection, point as turfPoint } from '@turf/turf';
import type { LngLat, PointFeature } from './convert';

/** Shelter terdekat dari sebuah titik; null bila FC kosong. */
export function nearestShelter(
  from: LngLat | PointFeature,
  sheltersFC: FeatureCollection<Point>,
): PointFeature | null {
  if (!sheltersFC.features.length) return null;
  const target = Array.isArray(from) ? turfPoint(from) : from;
  return nearestPoint(target, sheltersFC);
}

/** Shelter dalam radius (meter), terurut menaik berdasarkan jarak; menambah `distance_m`. */
export function sheltersWithinRadius(
  from: LngLat | PointFeature,
  sheltersFC: FeatureCollection<Point>,
  radiusMeters: number,
): FeatureCollection<Point> {
  const target = Array.isArray(from) ? turfPoint(from) : from;
  const within = sheltersFC.features
    .map((f) => ({ f, d: distance(target, f, { units: 'meters' }) }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d)
    .map((x) => ({
      ...x.f,
      properties: { ...x.f.properties, distance_m: Math.round(x.d * 10) / 10 },
    }));
  return featureCollection(within);
}
