-- ============================================================================
-- Uji integrasi fungsi analisis (spec 20 §8.7).
-- Jalankan MANUAL setelah migration + seed:
--   supabase db reset          # apply migrations lalu seed.sql (local)
--   lalu jalankan file ini di Supabase SQL Editor / psql.
-- Tiap query disertai komentar HASIL YANG DIHARAPKAN (berbasis seed sintetis).
-- ============================================================================

-- 1) Risiko pada titik di Zona Utara.
--    HARUS: {"found":true, "area_id":1, "kelas_rawan":"TINGGI", "skor_rawan":82.5, ...}
select fn_flood_risk_at(106.8110, -6.8910);

-- 2) Tiga shelter terdekat dalam radius 5 km.
--    HARUS: FeatureCollection berisi shelter 10 lalu 11 (10 lebih dekat),
--           tiap properties punya distance_m (meter).
select fn_nearest_shelters(106.8120, -6.8930, 5000, 3);

-- 3) Rute jaringan BIASA ke shelter 10.
--    HARUS: Feature LineString, avoids_inundation=false, total_distance_m>0, total_time_s>0.
select fn_evacuation_route(106.8100, -6.8950, 10);

-- 4) Rute SADAR-BANJIR ke shelter 10.
--    HARUS: Feature LineString, avoids_inundation=true, dan TIDAK melintasi edge 1002
--           (1002 terpotong genangan aktif). Untuk pasangan asal-tujuan ini jalur
--           aman via 1006/1007 sehingga tetap ditemukan.
select fn_evacuation_route_safe(106.8100, -6.8950, 10);

-- 4b) Demonstrasi flood-aware: rute sadar-banjir ke shelter 11 (timur).
--    Rute biasa  -> HARUS ditemukan (via 1001-1002-1003).
--    Rute aman   -> HARUS {"error":"no_safe_route"} karena satu-satunya penghubung
--                   ke timur (1002) tergenang dan tidak ada jalur alternatif.
select fn_evacuation_route(106.8100, -6.8950, 11);
select fn_evacuation_route_safe(106.8100, -6.8950, 11);

-- 5) Area terjangkau 1000 m dari shelter 11.
--    HARUS: FeatureCollection ruas jalan terjangkau (tidak kosong), properties road_id.
select fn_service_area(11, 1000);

-- 6) Proxy populasi terdampak Zona Utara (area_id 1).
--    HARUS: {"area_id":1, "shelter_count":1, "shelter_capacity":500, "facility_count":1}
--           (shelter 10 & Puskesmas C berada di dalam Zona Utara; shelter 11 & RSUD di luar).
select fn_population_exposed(1);
