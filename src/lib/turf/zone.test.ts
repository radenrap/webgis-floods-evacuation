import { describe, it, expect } from 'vitest';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { isPointInFloodZone, floodZoneAtPoint, facilitiesInZone, bufferMeters } from './zone';

const floodFC: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { area_id: 1, kelas_rawan: 'TINGGI', skor_rawan: 82.5 },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [106.80, -6.90],
          [106.82, -6.90],
          [106.82, -6.885],
          [106.80, -6.885],
          [106.80, -6.90],
        ]],
      },
    },
  ],
};

const facilities: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { facility_id: 1 },
      geometry: { type: 'Point', coordinates: [106.81, -6.892] },
    },
    {
      type: 'Feature',
      properties: { facility_id: 2 },
      geometry: { type: 'Point', coordinates: [106.90, -6.892] },
    },
  ],
};

describe('isPointInFloodZone', () => {
  it('true untuk titik di dalam poligon', () => {
    expect(isPointInFloodZone([106.81, -6.892], floodFC)).toBe(true);
  });
  it('false untuk titik di luar poligon', () => {
    expect(isPointInFloodZone([106.90, -6.892], floodFC)).toBe(false);
  });
});

describe('floodZoneAtPoint', () => {
  it('mengembalikan zona dengan skor_rawan tertinggi yang memuat titik', () => {
    const z = floodZoneAtPoint([106.81, -6.892], floodFC);
    const skor = (z?.properties as { skor_rawan?: number } | undefined)?.skor_rawan;
    expect(skor).toBe(82.5);
  });
  it('null bila titik di luar semua zona', () => {
    expect(floodZoneAtPoint([106.90, -6.892], floodFC)).toBeNull();
  });
});

describe('facilitiesInZone', () => {
  it('hanya mengembalikan fasilitas di dalam zona', () => {
    expect(facilitiesInZone(floodFC, facilities).features).toHaveLength(1);
  });
});

describe('bufferMeters', () => {
  it('menghasilkan Polygon dari Point', () => {
    const b = bufferMeters(
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [106.81, -6.89] } },
      200,
    );
    expect(b?.geometry.type).toBe('Polygon');
  });
});
