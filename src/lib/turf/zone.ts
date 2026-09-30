// Helper zona rawan & buffer di klien (Turf.js). Lihat spec 41 §3.3.

import type { Feature, Point, Polygon, MultiPolygon, LineString, FeatureCollection } from 'geojson';
import { booleanPointInPolygon, pointsWithinPolygon, buffer, point as turfPoint } from '@turf/turf';
import type { LngLat, PointFeature, AnyPolygon } from './convert';

const scoreOf = (f: Feature<Polygon | MultiPolygon>): number => {
  const s = f.properties?.skor_rawan;
  return typeof s === 'number' ? s : 0;
};

/** true bila titik berada di dalam salah satu poligon zona rawan. */
export function isPointInFloodZone(
  pt: LngLat | PointFeature,
  floodFC: FeatureCollection<Polygon | MultiPolygon>,
): boolean {
  const p = Array.isArray(pt) ? turfPoint(pt) : pt;
  return floodFC.features.some((poly) => booleanPointInPolygon(p, poly));
}

/** Fitur zona dengan skor_rawan tertinggi yang memuat titik; null bila tidak ada. */
export function floodZoneAtPoint(
  pt: LngLat | PointFeature,
  floodFC: FeatureCollection<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> | null {
  const p = Array.isArray(pt) ? turfPoint(pt) : pt;
  return (
    floodFC.features
      .filter((poly) => booleanPointInPolygon(p, poly))
      .sort((a, b) => scoreOf(b) - scoreOf(a))[0] ?? null
  );
}

/** Fasilitas (Point) yang berada di dalam zona (Polygon/MultiPolygon). */
export function facilitiesInZone(
  zone: AnyPolygon | FeatureCollection<Polygon | MultiPolygon>,
  facilitiesFC: FeatureCollection<Point>,
): FeatureCollection<Point> {
  // Tipe kembalian turf konservatif (Point | MultiPoint); input kita Point, jadi aman dipersempit.
  return pointsWithinPolygon(facilitiesFC, zone) as unknown as FeatureCollection<Point>;
}

/** Buffer dalam meter; null bila geometri degenerasi. */
export function bufferMeters(
  geom: AnyPolygon | Feature<LineString> | PointFeature,
  meters: number,
): Feature<Polygon | MultiPolygon> | null {
  const res = buffer(geom, meters, { units: 'meters', steps: 16 });
  if (!res) return null;
  return res as Feature<Polygon | MultiPolygon>;
}
