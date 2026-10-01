// Verifikasi read-path Supabase (view v_*_geojson + RPC fn_*) tanpa Docker.
// Memakai kredensial dari .env (VITE_SUPABASE_URL + publishable/anon key).
// Hanya READ (SELECT/EXECUTE); tidak melakukan DDL/mutasi.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key || url.startsWith('your_') || key.startsWith('your_')) {
  console.error('ENV tidak valid: isi .env dengan URL & key Supabase asli.');
  process.exit(2);
}
const sb = createClient(url, key);

const views = [
  'v_flood_prone_area_geojson',
  'v_evacuation_shelter_geojson',
  'v_road_network_geojson',
  'v_evacuation_route_geojson',
  'v_flood_inundation_geojson',
  'v_critical_facility_geojson',
];
console.log('--- VIEWS ---');
for (const v of views) {
  const { data, error } = await sb.from(v).select('geojson').single();
  if (error) console.log(`VIEW ${v}: ERROR [${error.code}] ${error.message}`);
  else console.log(`VIEW ${v}: OK features=${data?.geojson?.features?.length ?? '?'}`);
}

console.log('--- RPC ---');
const calls = [
  ['fn_flood_risk_at', { lng: 106.811, lat: -6.891 }],
  ['fn_nearest_shelters', { lng: 106.812, lat: -6.893, radius_m: 5000, limit_n: 3 }],
  ['fn_evacuation_route', { from_lng: 106.81, from_lat: -6.895, to_shelter_id: 10 }],
  ['fn_evacuation_route_safe', { from_lng: 106.81, from_lat: -6.895, to_shelter_id: 10 }],
  ['fn_evacuation_route', { from_lng: 106.81, from_lat: -6.895, to_shelter_id: 11 }],
  ['fn_evacuation_route_safe', { from_lng: 106.81, from_lat: -6.895, to_shelter_id: 11 }],
  ['fn_service_area', { shelter_id: 11, dist_m: 1000 }],
  ['fn_population_exposed', { area_id: 1 }],
];
for (const [fn, args] of calls) {
  const { data, error } = await sb.rpc(fn, args);
  const a = JSON.stringify(args);
  if (error) console.log(`RPC ${fn} ${a}: ERROR [${error.code}] ${error.message}`);
  else console.log(`RPC ${fn} ${a}: OK ${JSON.stringify(data).slice(0, 140)}`);
}
