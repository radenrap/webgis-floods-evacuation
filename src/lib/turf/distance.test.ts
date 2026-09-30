import { describe, it, expect } from 'vitest';
import type { Feature, LineString } from 'geojson';
import {
  haversineDistanceMeters,
  routeLengthMeters,
  pointAlongRoute,
  fractionAlongRoute,
  bearingTo,
} from './distance';

const line: Feature<LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [106.81, -6.895],
      [106.82, -6.895],
    ],
  },
};

describe('haversineDistanceMeters', () => {
  it('menghitung jarak ~ meter antara dua titik berdekatan', () => {
    const d = haversineDistanceMeters([106.81, -6.895], [106.82, -6.895]);
    expect(d).toBeGreaterThan(1000); // ~1.1 km
    expect(d).toBeLessThan(1200);
  });
  it('mengembalikan 0 untuk titik identik', () => {
    expect(haversineDistanceMeters([106.81, -6.89], [106.81, -6.89])).toBe(0);
  });
});

describe('routeLengthMeters', () => {
  it('menjumlahkan panjang segmen LineString (satuan meter)', () => {
    const len = routeLengthMeters(line);
    expect(len).toBeGreaterThan(1000);
    expect(len).toBeLessThan(1200);
  });
  it('menerima geometry LineString mentah', () => {
    expect(routeLengthMeters(line.geometry)).toBeGreaterThan(1000);
  });
});

describe('pointAlongRoute & fractionAlongRoute', () => {
  it('menghasilkan Point di atas rute', () => {
    expect(pointAlongRoute(line, 100).geometry.type).toBe('Point');
  });
  it('fraksi 0 dan 1 berada di ujung rute', () => {
    expect(fractionAlongRoute(line, 0).geometry.coordinates[0]).toBeCloseTo(106.81, 4);
    expect(fractionAlongRoute(line, 1).geometry.coordinates[0]).toBeCloseTo(106.82, 4);
  });
  it('fraksi di luar [0,1] dijepit ke batas', () => {
    expect(fractionAlongRoute(line, 2).geometry.coordinates[0]).toBeCloseTo(106.82, 4);
    expect(fractionAlongRoute(line, -1).geometry.coordinates[0]).toBeCloseTo(106.81, 4);
  });
});

describe('bearingTo', () => {
  it('berada dalam rentang [-180, 180]', () => {
    const b = bearingTo([106.81, -6.895], [106.82, -6.895]);
    expect(b).toBeGreaterThanOrEqual(-180);
    expect(b).toBeLessThanOrEqual(180);
  });
});
