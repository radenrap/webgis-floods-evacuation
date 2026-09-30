-- ============================================================================
-- Migration : init skema WebGIS rawan banjir & evakuasi
-- Sumber    : spec/20-database-spec.md (prompt P1 di spec/50-ai-prompt-pack.md)
-- Target    : Supabase (PostgreSQL 15 + PostGIS 3.4 + pgRouting 3.6)
-- Sifat     : idempoten (aman dijalankan ulang)
--
-- CATATAN ADAPTASI SUPABASE (penting):
--  * Ekstensi dipasang ke schema `extensions` (konvensi Supabase).
--  * Fungsi analisis dibuat SECURITY DEFINER + search_path terkunci, agar role
--    `anon` (yang hanya punya EXECUTE, tanpa grant tabel) tetap bisa memanggil
--    via supabase.rpc() sementara RLS aktif. spec 20 §7.3 memetakan
--    `webgis_anon` -> role `anon` Supabase.
--  * RLS diaktifkan pada semua tabel; akses publik hanya lewat view v_*_geojson
--    (SELECT) dan fungsi fn_* (EXECUTE).
--  * Data contoh/seed (spec 20 §8) TIDAK termasuk di sini; buat migration
--    terpisah, lalu jalankan ulang bagian 3 (topologi) setelah data dimuat.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Ekstensi
-- ----------------------------------------------------------------------------
create extension if not exists postgis   with schema extensions;
create extension if not exists pgrouting with schema extensions;

-- Pastikan tipe geometry & fungsi ST_*/pgr_* ter-resolve selama migration ini.
set search_path = public, extensions;

-- ----------------------------------------------------------------------------
-- 2) DDL Tabel
-- ----------------------------------------------------------------------------

-- 2.1 flood_prone_area -------------------------------------------------------
create table if not exists flood_prone_area (
  id              bigint generated always as identity primary key,
  nama            text,
  kelas_rawan     text         not null check (kelas_rawan in ('RENDAH','SEDANG','TINGGI')),
  skor_rawan      numeric(5,2) not null check (skor_rawan between 0 and 100),
  kedalaman_max_m numeric(6,2),
  luas_ha         numeric(12,3),
  sumber          text,
  updated_at      timestamptz  not null default now(),
  geom            geometry(MultiPolygon, 4326) not null
);
create index if not exists flood_prone_area_geom_idx on flood_prone_area using gist (geom);

-- 2.2 evacuation_shelter -----------------------------------------------------
create table if not exists evacuation_shelter (
  id         bigint generated always as identity primary key,
  nama       text    not null,
  jenis      text    not null check (jenis in ('GEDUNG','LAPANGAN','SEKOLAH','MASJID','BALAI')),
  kapasitas  integer not null check (kapasitas >= 0),
  status     text    not null default 'SIAP'
                     check (status in ('SIAP','SIAGA','PENUH','NONAKTIF')),
  kontak     text,
  fasilitas  jsonb   not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  geom       geometry(Point, 4326) not null
);
create index if not exists evacuation_shelter_geom_idx on evacuation_shelter using gist (geom);
-- index geography untuk KNN / ST_DWithin berbasis meter
create index if not exists evacuation_shelter_geog_idx on evacuation_shelter using gist ((geom::geography));

-- 2.3 road_network (edge graf pgRouting) -------------------------------------
create table if not exists road_network (
  id           bigint generated always as identity primary key,
  nama         text,
  kelas_jalan  text    not null check (kelas_jalan in ('ARTERI','KOLEKTOR','LOKAL','GANG')),
  oneway       boolean not null default false,
  speed_kmh    numeric(5,2) not null check (speed_kmh > 0),
  length_m     double precision,          -- dihitung dari geom
  source       bigint,                    -- node awal (diisi pgr_createTopology)
  target       bigint,                    -- node akhir (diisi pgr_createTopology)
  cost         double precision,          -- detik = length_m / (speed_kmh/3.6)
  reverse_cost double precision,          -- -1 bila oneway
  geom         geometry(LineString, 4326) not null
);
create index if not exists road_network_geom_idx   on road_network using gist (geom);
create index if not exists road_network_source_idx on road_network (source);
create index if not exists road_network_target_idx on road_network (target);

-- 2.4 evacuation_route -------------------------------------------------------
create table if not exists evacuation_route (
  id              bigint generated always as identity primary key,
  nama            text not null,
  from_shelter_id bigint references evacuation_shelter(id) on delete set null,
  length_m        double precision not null check (length_m >= 0),
  status          text not null default 'AKTIF' check (status in ('AKTIF','CADANGAN')),
  geom            geometry(LineString, 4326) not null
);
create index if not exists evacuation_route_geom_idx on evacuation_route using gist (geom);

-- 2.5 flood_inundation (dinamis) ---------------------------------------------
create table if not exists flood_inundation (
  id          bigint generated always as identity primary key,
  event_time  timestamptz not null default now(),
  kedalaman_m numeric(6,2) not null check (kedalaman_m >= 0),
  aktif       boolean not null default true,
  sumber      text,
  geom        geometry(MultiPolygon, 4326) not null
);
create index if not exists flood_inundation_geom_idx  on flood_inundation using gist (geom);
create index if not exists flood_inundation_aktif_idx on flood_inundation (aktif) where aktif;

-- 2.6 critical_facility ------------------------------------------------------
create table if not exists critical_facility (
  id     bigint generated always as identity primary key,
  nama   text not null,
  tipe   text not null check (tipe in ('RUMAH_SAKIT','PUSKESMAS','SEKOLAH','POSKO')),
  kontak text,
  geom   geometry(Point, 4326) not null
);
create index if not exists critical_facility_geom_idx on critical_facility using gist (geom);

-- ----------------------------------------------------------------------------
-- 3) Topologi & cost jaringan (pgRouting)
--    PENTING: bagian ini bergantung data. Pada migration init (tabel kosong)
--    ia tetap membuat tabel node road_network_v (dipakai fungsi fn_*). Setelah
--    data road_network dimuat (migration seed), JALANKAN ULANG bagian 3.
-- ----------------------------------------------------------------------------

-- 3.1 Hitung panjang (meter) & cost (detik)
update road_network set
  length_m     = st_length(geom::geography),
  cost         = st_length(geom::geography) / (speed_kmh / 3.6),
  reverse_cost = case when oneway
                      then -1
                      else st_length(geom::geography) / (speed_kmh / 3.6)
                 end;

-- 3.2 Bangun topologi: mengisi source/target + membuat tabel node road_network_v
select pgr_createTopology('road_network', 0.000001, 'geom', 'id');

-- 3.3 Index node untuk snapping KNN
create index if not exists road_network_v_geom_idx on road_network_v using gist (the_geom);

-- ----------------------------------------------------------------------------
-- 4) SQL Function (diekspos sebagai RPC; SECURITY DEFINER + search_path kunci)
--    Semua mengembalikan jsonb (GeoJSON). Bila gagal -> { "error": "<kode>" }.
-- ----------------------------------------------------------------------------

-- 4.1 fn_flood_risk_at(lng, lat) ---------------------------------------------
create or replace function fn_flood_risk_at(lng numeric, lat numeric)
returns jsonb
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    (select jsonb_build_object(
        'found',           true,
        'area_id',         f.id,
        'nama',            f.nama,
        'kelas_rawan',     f.kelas_rawan,
        'skor_rawan',      f.skor_rawan,
        'kedalaman_max_m', f.kedalaman_max_m
     )
     from flood_prone_area f
     where st_contains(f.geom, st_setsrid(st_makepoint(lng, lat), 4326))
     order by f.skor_rawan desc
     limit 1),
    jsonb_build_object('found', false)
  );
$$;

-- 4.2 fn_nearest_shelters(lng, lat, radius_m, limit_n) -----------------------
create or replace function fn_nearest_shelters(
  lng      numeric,
  lat      numeric,
  radius_m integer default 5000,
  limit_n  integer default 5
)
returns jsonb
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  with pt as (select st_setsrid(st_makepoint(lng, lat), 4326) as g)
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(x.f), '[]'::jsonb)
  )
  from (
    select jsonb_build_object(
      'type', 'Feature',
      'id',   s.id,
      'geometry', st_asgeojson(s.geom)::jsonb,
      'properties', jsonb_build_object(
        'shelter_id', s.id,
        'nama',       s.nama,
        'jenis',      s.jenis,
        'kapasitas',  s.kapasitas,
        'status',     s.status,
        'kontak',     s.kontak,
        'fasilitas',  s.fasilitas,
        'distance_m', round(st_distancesphere(s.geom, pt.g)::numeric, 1)
      )
    ) as f
    from evacuation_shelter s cross join pt
    where s.status <> 'NONAKTIF'
      and st_dwithin(s.geom::geography, pt.g::geography, radius_m)
    order by st_distancesphere(s.geom, pt.g)
    limit limit_n
  ) x;
$$;

-- 4.3 fn_evacuation_route(from_lng, from_lat, to_shelter_id) -----------------
create or replace function fn_evacuation_route(
  from_lng      numeric,
  from_lat      numeric,
  to_shelter_id bigint
)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_start_node bigint;
  v_end_node   bigint;
  v_result     jsonb;
begin
  -- Snap titik asal ke node jaringan terdekat
  select v.id into v_start_node
  from road_network_v v
  order by v.the_geom <-> st_setsrid(st_makepoint(from_lng, from_lat), 4326)
  limit 1;

  -- Snap shelter tujuan ke node jaringan terdekat
  select v.id into v_end_node
  from road_network_v v
  cross join evacuation_shelter s
  where s.id = to_shelter_id
  order by v.the_geom <-> s.geom
  limit 1;

  if v_start_node is null or v_end_node is null then
    return jsonb_build_object('error', 'no_network_node');
  end if;

  with route as (
    select d.seq, d.edge, d.node, d.cost, r.geom, r.source, r.target, r.length_m
    from pgr_dijkstra(
           'select id, source, target, cost, reverse_cost from road_network',
           v_start_node, v_end_node
         ) as d
    join road_network r on r.id = d.edge
    where d.edge <> -1
  )
  select jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'from_shelter_id',   to_shelter_id,
      'total_distance_m',  round(sum(length_m)::numeric, 1),
      'total_time_s',      round(sum(cost)::numeric, 1),
      'edge_count',        count(*),
      'avoids_inundation', false
    ),
    'geometry', st_asgeojson(
      st_makeline(
        case when node = source then geom else st_reverse(geom) end
        order by seq
      )
    )::jsonb
  ) into v_result
  from route;

  if v_result is null then
    return jsonb_build_object('error', 'no_route');
  end if;

  return v_result;
end;
$$;

-- 4.4 fn_evacuation_route_safe(...) - rute sadar-banjir ----------------------
create or replace function fn_evacuation_route_safe(
  from_lng      numeric,
  from_lat      numeric,
  to_shelter_id bigint
)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_start_node bigint;
  v_end_node   bigint;
  v_edges_sql  text;
  v_result     jsonb;
begin
  select v.id into v_start_node
  from road_network_v v
  order by v.the_geom <-> st_setsrid(st_makepoint(from_lng, from_lat), 4326)
  limit 1;

  select v.id into v_end_node
  from road_network_v v
  cross join evacuation_shelter s
  where s.id = to_shelter_id
  order by v.the_geom <-> s.geom
  limit 1;

  if v_start_node is null or v_end_node is null then
    return jsonb_build_object('error', 'no_network_node');
  end if;

  -- Cost dinamis: edge yang memotong genangan aktif menjadi impassable (cost = -1)
  v_edges_sql := $sql$
    select r.id, r.source, r.target,
           case when exists (
                  select 1 from flood_inundation fi
                  where fi.aktif and st_intersects(fi.geom, r.geom)
                ) then -1::double precision else r.cost end as cost,
           case when exists (
                  select 1 from flood_inundation fi
                  where fi.aktif and st_intersects(fi.geom, r.geom)
                ) then -1::double precision else r.reverse_cost end as reverse_cost
    from road_network r
  $sql$;

  with route as (
    select d.seq, d.edge, d.node, d.cost, r.geom, r.source, r.target, r.length_m
    from pgr_dijkstra(v_edges_sql, v_start_node, v_end_node) as d
    join road_network r on r.id = d.edge
    where d.edge <> -1
  )
  select jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'from_shelter_id',   to_shelter_id,
      'total_distance_m',  round(sum(length_m)::numeric, 1),
      'total_time_s',      round(sum(cost)::numeric, 1),
      'edge_count',        count(*),
      'avoids_inundation', true
    ),
    'geometry', st_asgeojson(
      st_makeline(
        case when node = source then geom else st_reverse(geom) end
        order by seq
      )
    )::jsonb
  ) into v_result
  from route;

  if v_result is null then
    -- Tidak ada jalur aman (semua terputus genangan)
    return jsonb_build_object('error', 'no_safe_route');
  end if;

  return v_result;
end;
$$;

-- 4.5 fn_service_area(shelter_id, dist_m) - area terjangkau ------------------
create or replace function fn_service_area(
  shelter_id bigint,
  dist_m     double precision default 1000
)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_start_node bigint;
  v_result     jsonb;
begin
  select v.id into v_start_node
  from road_network_v v
  cross join evacuation_shelter s
  where s.id = shelter_id
  order by v.the_geom <-> s.geom
  limit 1;

  if v_start_node is null then
    return jsonb_build_object('error', 'no_network_node');
  end if;

  with reachable as (
    select dd.node
    from pgr_drivingdistance(
           'select id, source, target, length_m as cost, length_m as reverse_cost from road_network',
           v_start_node, dist_m, false
         ) as dd
  ),
  edges as (
    select r.id, r.geom
    from road_network r
    where r.source in (select node from reachable)
       or r.target in (select node from reachable)
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'id',   e.id,
      'geometry', st_asgeojson(e.geom)::jsonb,
      'properties', jsonb_build_object('road_id', e.id)
    )), '[]'::jsonb)
  ) into v_result
  from edges e;

  return coalesce(v_result,
    jsonb_build_object('type','FeatureCollection','features','[]'::jsonb));
end;
$$;

-- 4.6 fn_population_exposed(area_id) - proxy populasi terdampak (opsional) ---
create or replace function fn_population_exposed(area_id bigint)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_geom geometry(MultiPolygon, 4326);
begin
  select geom into v_geom from flood_prone_area where id = area_id;
  if v_geom is null then
    return jsonb_build_object('error', 'area_not_found');
  end if;

  return jsonb_build_object(
    'area_id', area_id,
    'shelter_count', (
      select count(*) from evacuation_shelter s where st_within(s.geom, v_geom)
    ),
    'shelter_capacity', (
      select coalesce(sum(s.kapasitas), 0) from evacuation_shelter s where st_within(s.geom, v_geom)
    ),
    'facility_count', (
      select count(*) from critical_facility c where st_within(c.geom, v_geom)
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) View GeoJSON untuk MapLibre (satu baris: FeatureCollection di kolom geojson)
-- ----------------------------------------------------------------------------

create or replace view v_flood_prone_area_geojson as
select jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id',   id,
    'geometry', st_asgeojson(geom)::jsonb,
    'properties', jsonb_build_object(
      'area_id', id, 'nama', nama, 'kelas_rawan', kelas_rawan,
      'skor_rawan', skor_rawan, 'kedalaman_max_m', kedalaman_max_m,
      'luas_ha', luas_ha, 'sumber', sumber, 'updated_at', updated_at)
  )), '[]'::jsonb)
) as geojson
from flood_prone_area;

create or replace view v_evacuation_shelter_geojson as
select jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id',   id,
    'geometry', st_asgeojson(geom)::jsonb,
    'properties', jsonb_build_object(
      'shelter_id', id, 'nama', nama, 'jenis', jenis, 'kapasitas', kapasitas,
      'status', status, 'kontak', kontak, 'fasilitas', fasilitas,
      'updated_at', updated_at)
  )), '[]'::jsonb)
) as geojson
from evacuation_shelter;

create or replace view v_road_network_geojson as
select jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id',   id,
    'geometry', st_asgeojson(geom)::jsonb,
    'properties', jsonb_build_object(
      'road_id', id, 'nama', nama, 'kelas_jalan', kelas_jalan,
      'oneway', oneway, 'speed_kmh', speed_kmh, 'length_m', length_m)
  )), '[]'::jsonb)
) as geojson
from road_network;

create or replace view v_evacuation_route_geojson as
select jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id',   id,
    'geometry', st_asgeojson(geom)::jsonb,
    'properties', jsonb_build_object(
      'route_id', id, 'nama', nama, 'from_shelter_id', from_shelter_id,
      'length_m', length_m, 'status', status)
  )), '[]'::jsonb)
) as geojson
from evacuation_route;

create or replace view v_flood_inundation_geojson as
select jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id',   id,
    'geometry', st_asgeojson(geom)::jsonb,
    'properties', jsonb_build_object(
      'event_id', id, 'event_time', event_time, 'kedalaman_m', kedalaman_m,
      'aktif', aktif, 'sumber', sumber)
  )), '[]'::jsonb)
) as geojson
from flood_inundation;

create or replace view v_critical_facility_geojson as
select jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id',   id,
    'geometry', st_asgeojson(geom)::jsonb,
    'properties', jsonb_build_object(
      'facility_id', id, 'nama', nama, 'tipe', tipe, 'kontak', kontak)
  )), '[]'::jsonb)
) as geojson
from critical_facility;

-- ----------------------------------------------------------------------------
-- 6) Keamanan: RLS + GRANT read-only untuk role Supabase (anon, authenticated)
--    anon/authenticated TIDAK diberi akses tabel mentah; hanya view + fungsi.
-- ----------------------------------------------------------------------------

-- 6.1 Aktifkan RLS pada semua tabel (defense-in-depth; akses publik via view/fungsi)
alter table flood_prone_area   enable row level security;
alter table evacuation_shelter enable row level security;
alter table road_network       enable row level security;
alter table evacuation_route   enable row level security;
alter table flood_inundation   enable row level security;
alter table critical_facility  enable row level security;

-- 6.2 USAGE schema
grant usage on schema public to anon, authenticated;

-- 6.3 SELECT hanya pada view GeoJSON (bukan tabel mentah)
grant select on
  v_flood_prone_area_geojson,
  v_evacuation_shelter_geojson,
  v_road_network_geojson,
  v_evacuation_route_geojson,
  v_flood_inundation_geojson,
  v_critical_facility_geojson
to anon, authenticated;

-- 6.4 EXECUTE hanya pada fungsi analisis
grant execute on function
  fn_flood_risk_at(numeric, numeric),
  fn_nearest_shelters(numeric, numeric, integer, integer),
  fn_evacuation_route(numeric, numeric, bigint),
  fn_evacuation_route_safe(numeric, numeric, bigint),
  fn_service_area(bigint, double precision),
  fn_population_exposed(bigint)
to anon, authenticated;

-- ============================================================================
-- Selesai. Langkah berikutnya:
--  * Buat migration seed terpisah (spec 20 §8), lalu jalankan ulang bagian 3
--    (update cost + pgr_createTopology) setelah data road_network dimuat.
--  * Verifikasi cepat: select fn_flood_risk_at(106.811, -6.891);
-- ============================================================================
