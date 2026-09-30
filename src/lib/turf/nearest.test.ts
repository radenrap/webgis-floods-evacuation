import { describe, it, expect } from 'vitest';
import type { FeatureCollection, Point } from 'geojson';
import { nearestShelter, sheltersWithinRadius } from './nearest';

const shelters: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { shelter_id: 10 },
      geometry: { type: 'Point', coordinates: [106.815, -6.892] },
    },
    {
      type: 'Feature',
      properties: { shelter_id: 11 },
      geometry: { type: 'Point', coordinates: [106.836, -6.887] },
    },
  ],
};
const empty: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

describe('nearestShelter', () => {
  it('mengembalikan shelter terdekat', () => {
    const n = nearestShelter([106.814, -6.892], shelters);
    const props = n?.properties as { shelter_id?: number } | undefined;
    expect(props?.shelter_id).toBe(10);
  });
  it('null untuk FeatureCollection kosong', () => {
    expect(nearestShelter([106.81, -6.89], empty)).toBeNull();
  });
});

describe('sheltersWithinRadius', () => {
  it('menyaring theo radius, terurut, dan menambah distance_m (meter)', () => {
    const within = sheltersWithinRadius([106.815, -6.892], shelters, 500);
    expect(within.features).toHaveLength(1);
    const d = (within.features[0].properties as { distance_m?: number }).distance_m;
    expect(typeof d).toBe('number');
    expect(d).toBeLessThanOrEqual(500);
  });
  it('radius 0 dari titik bukan-shelter mengembalikan kosong', () => {
    expect(sheltersWithinRadius([106.814, -6.892], shelters, 0).features).toHaveLength(0);
  });
  it('radius 0 menyertakan shelter yang tepat berimpit (batas inklusif)', () => {
    expect(sheltersWithinRadius([106.815, -6.892], shelters, 0).features).toHaveLength(1);
  });
});
