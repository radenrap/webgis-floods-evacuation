-- ============================================================================
-- Seed data SINTETIS (placeholder Jawa) untuk pengembangan / testing LOKAL.
-- Sumber: spec/20-database-spec.md §8.
-- Dipakai oleh `supabase db reset` (local dev). JANGAN dipush ke produksi.
-- SEMUA KOORDINAT SINTETIS - ganti dengan data riil tanpa mengubah skema.
-- ============================================================================

-- Reset deterministik agar seed aman dijalankan ulang.
truncate table
  evacuation_route,
  flood_inundation,
  critical_facility,
  road_network,
  evacuation_shelter,
  flood_prone_area
restart identity cascade;

-- ----------------------------------------------------------------------------
-- 8.1 Zona rawan banjir (SINTETIS)
-- ----------------------------------------------------------------------------
insert into flood_prone_area (nama, kelas_rawan, skor_rawan, kedalaman_max_m, luas_ha, sumber, geom) values
('Zona Utara', 'TINGGI', 82.5, 1.5, 124.3, 'BPBD 2024 (sintetis)',
 st_setsrid(st_geomfromtext('MULTIPOLYGON(((106.80 -6.90,106.82 -6.90,106.82 -6.885,106.80 -6.885,106.80 -6.90)))'), 4326)),
('Zona Tengah', 'SEDANG', 54.0, 0.7, 88.1, 'BPBD 2024 (sintetis)',
 st_setsrid(st_geomfromtext('MULTIPOLYGON(((106.82 -6.90,106.845 -6.90,106.845 -6.88,106.82 -6.88,106.82 -6.90)))'), 4326)),
('Zona Selatan', 'RENDAH', 21.0, 0.3, 150.0, 'BPBD 2024 (sintetis)',
 st_setsrid(st_geomfromtext('MULTIPOLYGON(((106.80 -6.92,106.85 -6.92,106.85 -6.905,106.80 -6.905,106.80 -6.92)))'), 4326));

-- ----------------------------------------------------------------------------
-- 8.2 Shelter evakuasi (ID eksplisit agar cocok dengan contoh RPC) - SINTETIS
-- ----------------------------------------------------------------------------
insert into evacuation_shelter (id, nama, jenis, kapasitas, status, kontak, fasilitas, geom) overriding system value values
(10, 'GOR Kecamatan A', 'GEDUNG', 500, 'SIAP', '081200000001',
   '{"air_bersih":true,"dapur":true,"medis":false}'::jsonb,
   st_setsrid(st_makepoint(106.8150, -6.8920), 4326)),
(11, 'Lapangan B', 'LAPANGAN', 800, 'SIAGA', '081200000002',
   '{"air_bersih":false,"dapur":false,"medis":true}'::jsonb,
   st_setsrid(st_makepoint(106.8360, -6.8870), 4326));
select setval(pg_get_serial_sequence('evacuation_shelter', 'id'), (select max(id) from evacuation_shelter));

-- ----------------------------------------------------------------------------
-- 8.3 Fasilitas kritis - SINTETIS
-- ----------------------------------------------------------------------------
insert into critical_facility (nama, tipe, kontak, geom) values
('RSUD Kota', 'RUMAH_SAKIT', '021000000', st_setsrid(st_makepoint(106.8280, -6.8900), 4326)),
('Puskesmas C', 'PUSKESMAS', '021000001', st_setsrid(st_makepoint(106.8170, -6.8940), 4326));

-- ----------------------------------------------------------------------------
-- 8.4 Jaringan jalan (graf terhubung) - SINTETIS
-- ----------------------------------------------------------------------------
insert into road_network (id, nama, kelas_jalan, oneway, speed_kmh, geom) overriding system value values
(1001, 'Jl. Merdeka',  'ARTERI',   false, 50, st_setsrid(st_geomfromtext('LINESTRING(106.810 -6.895,106.820 -6.895)'), 4326)),
(1002, 'Jl. Sudirman', 'ARTERI',   false, 50, st_setsrid(st_geomfromtext('LINESTRING(106.820 -6.895,106.830 -6.895)'), 4326)),
(1003, 'Jl. Timur',    'KOLEKTOR', false, 40, st_setsrid(st_geomfromtext('LINESTRING(106.830 -6.895,106.836 -6.887)'), 4326)),
(1004, 'Jl. Melati',   'LOKAL',    true,  30, st_setsrid(st_geomfromtext('LINESTRING(106.820 -6.895,106.820 -6.887)'), 4326)),
(1005, 'Jl. Mawar',    'LOKAL',    false, 30, st_setsrid(st_geomfromtext('LINESTRING(106.820 -6.887,106.830 -6.887)'), 4326)),
(1006, 'Gang Utara',   'GANG',     false, 20, st_setsrid(st_geomfromtext('LINESTRING(106.810 -6.895,106.815 -6.892)'), 4326)),
(1007, 'Gang Tengah',  'GANG',     false, 20, st_setsrid(st_geomfromtext('LINESTRING(106.815 -6.892,106.820 -6.895)'), 4326));
select setval(pg_get_serial_sequence('road_network', 'id'), (select max(id) from road_network));

-- Hitung length_m / cost / reverse_cost lalu bangun topologi pgRouting (spec 20 §4).
-- WAJIB dijalankan ulang setelah data road_network dimuat (migration init membuatnya kosong).
update road_network set
  length_m     = st_length(geom::geography),
  cost         = st_length(geom::geography) / (speed_kmh / 3.6),
  reverse_cost = case when oneway then -1 else st_length(geom::geography) / (speed_kmh / 3.6) end;

-- Fix audit #1: setelah compute, length_m wajib terisi (spec 10 §3 "Wajib").
-- Ditaruh SETELAH UPDATE (bukan di migration) karena insert seed sengaja mengosongkan
-- length_m lalu mengisinya via UPDATE di atas; NOT NULL sebelum insert akan menolak insert.
alter table road_network alter column length_m set not null;

-- Topologi jaringan dibangun eksplisit (pengganti pgr_createTopology):
-- deterministik lintas versi pgRouting (lokal 3.4.1 vs cloud 3.6+).
-- Node = titik ujung ruas yang berbagi koordinat persis.
create table if not exists public.road_network_v (
  id       bigint primary key,
  the_geom geometry(Point, 4326)
);
truncate public.road_network_v;

insert into public.road_network_v (id, the_geom)
select row_number() over (order by geom), geom
from (
  select st_startpoint(geom) as geom from public.road_network
  union
  select st_endpoint(geom)   as geom from public.road_network
) nodes;

update public.road_network r
set source = v.id
from public.road_network_v v
where st_equals(v.the_geom, st_startpoint(r.geom));

update public.road_network r
set target = v.id
from public.road_network_v v
where st_equals(v.the_geom, st_endpoint(r.geom));

create index if not exists road_network_v_geom_idx
  on public.road_network_v using gist (the_geom);

-- Guard: topologi wajib lengkap sebelum uji integrasi.
do $$
begin
  if exists (select 1 from public.road_network where source is null or target is null) then
    raise exception 'topologi gagal: masih ada source/target null di road_network';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 8.5 Genangan aktif: menutup ruas 1002 dan menyentuh sebagian 1001/1003/1004/1007,
--     sehingga rute sadar-banjir ke shelter 11 menjadi no_safe_route - SINTETIS
-- ----------------------------------------------------------------------------
insert into flood_inundation (event_time, kedalaman_m, aktif, sumber, geom) values
(now(), 0.6, true, 'Laporan warga (sintetis)',
 st_setsrid(st_geomfromtext('MULTIPOLYGON(((106.818 -6.897,106.832 -6.897,106.832 -6.893,106.818 -6.893,106.818 -6.897)))'), 4326));

-- ----------------------------------------------------------------------------
-- 8.6 Rute evakuasi yang telah ditetapkan - SINTETIS
-- ----------------------------------------------------------------------------
insert into evacuation_route (nama, from_shelter_id, length_m, status, geom) values
('Rute Evakuasi A-1', 10, 1200.0, 'AKTIF',
 st_setsrid(st_geomfromtext('LINESTRING(106.810 -6.895,106.815 -6.892)'), 4326));
