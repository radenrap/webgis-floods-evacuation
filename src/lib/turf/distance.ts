// Helper jarak & rute di klien (Turf.js). Semua satuan meter. Lihat spec 41 §3.1.

import type { Feature, LineString } from 'geojson';
import { distance, length, along, bearing, lineString, point as turfPoint } from '@turf/turf';
import type { LngLat, PointFeature } from './convert';

const asPoint = (v: LngLat | PointFeature): PointFeature =>
  Array.isArray(v) ? turfPoint(v) : v;

/** Jarak garis lurus (haversine) dalam meter antara dua titik. */
export function haversineDistanceMeters(a: LngLat | PointFeature, b: LngLat | PointFeature): number {
  return distance(asPoint(a), asPoint(b), { units: 'meters' });
}

/** Panjang total sebuah rute (LineString) dalam meter. */
// turf v7 `length` menuntut properties non-null; pastikan feature selalu punya properties.
const asLineFeature = (
  line: Feature<LineString> | LineString,
): Feature<LineString, Record<string, unknown>> =>
  line.type === 'LineString'
    ? lineString(line.coordinates, {})
    : { ...line, properties: line.properties ?? {} };

export function routeLengthMeters(line: Feature<LineString> | LineString): number {
  return length(asLineFeature(line), { units: 'meters' });
}

/** Titik pada jarak `meters` sepanjang rute (turf.along). */
export function pointAlongRoute(line: Feature<LineString>, meters: number): PointFeature {
  return along(line, meters, { units: 'meters' });
}

/** Titik pada fraksi [0..1] sepanjang rute. */
export function fractionAlongRoute(line: Feature<LineString>, fraction: number): PointFeature {
  const total = routeLengthMeters(line);
  const f = Math.min(Math.max(fraction, 0), 1);
  return along(line, total * f, { units: 'meters' });
}

/** Arah (bearing) dari a ke b dalam derajat [-180..180]. */
export function bearingTo(a: LngLat | PointFeature, b: LngLat | PointFeature): number {
  return bearing(asPoint(a), asPoint(b));
}
