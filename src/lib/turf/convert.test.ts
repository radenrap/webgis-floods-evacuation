import { describe, it, expect } from 'vitest';
import type { Point } from 'geojson';
import { lngLatToFeature, toLngLat, asFeatureCollection } from './convert';

describe('lngLatToFeature', () => {
  it('membuat Feature<Point> dari [lng, lat]', () => {
    const f = lngLatToFeature([106.81, -6.89], { nama: 'A' });
    expect(f.geometry.type).toBe('Point');
    expect(f.geometry.coordinates).toEqual([106.81, -6.89]);
  });
});

describe('toLngLat', () => {
  it('membaca dari Position', () => {
    expect(toLngLat([106.81, -6.89])).toEqual([106.81, -6.89]);
  });
  it('membaca dari Feature<Point>', () => {
    expect(toLngLat(lngLatToFeature([106.82, -6.88]))).toEqual([106.82, -6.88]);
  });
  it('membaca dari geometry Point', () => {
    const g: Point = { type: 'Point', coordinates: [106.83, -6.87] };
    expect(toLngLat(g)).toEqual([106.83, -6.87]);
  });
});

describe('asFeatureCollection', () => {
  it('membungkus array feature menjadi FeatureCollection', () => {
    const fc = asFeatureCollection([lngLatToFeature([106.81, -6.89])]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
  });
});
