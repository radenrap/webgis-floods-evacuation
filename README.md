# WebGIS Pemetaan Rawan Banjir & Evakuasi

A WebGIS application that visualizes flood-prone zones, evacuation shelters, and road networks,
and computes evacuation routes (including flood-aware routing) from the user's location.

## Demo

_No public demo yet — fill in the URL after deployment (e.g. Vercel)._

## Features

### Visualization (in the UI)
- **Flood zone visualization** — polygons colored by risk class (`RENDAH` / `SEDANG` / `TINGGI`).
- **Active inundation layer** — current flooding polygons (opacity scales with depth).
- **Evacuation point visualization** — shelters as clustered points colored by operational status.
- **Critical facilities** — hospitals / clinics / schools / posts.
- **Road network** and **predefined evacuation routes** (toggleable).
- **Evacuation route visualization** — computed route drawn and auto-fitted to bounds.
- **Legend & layer controls** — risk legend, per-group layer toggles, risk-class filter.

### Interaction (in the UI)
- **Click-to-analyze location** — click a flood zone for its risk class & score; click a facility
  or shelter for its details.
- **Shelter detail + "route to here"** — select a shelter, then compute & draw the evacuation route.
- **Geolocation** — "Lokasi Saya" drops a user marker used as the route origin.
- **Flood-aware routing with fallback** — prefers a route avoiding active inundation; falls back to
  the plain network route (with a warning) when every path is flooded.

### Analysis (server RPC + client helpers; partially surfaced in the UI)
- **Nearest evacuation point calculation** — `fn_nearest_shelters` (server, meter-accurate radius)
  and Turf `nearestShelter` / `sheltersWithinRadius` (instant client-side).
- **Flood risk at a point** — `fn_flood_risk_at` (server) and Turf `isPointInFloodZone` (client).
- **Evacuation route & travel time** — `fn_evacuation_route` / `fn_evacuation_route_safe`
  (pgRouting Dijkstra; returns distance in meters and time in seconds).
- **Service area / reachability** — `fn_service_area` (pgRouting driving distance).
- **Exposed-population proxy** — `fn_population_exposed`.
- **Client spatial helpers** — haversine distance, route length, buffer, point-along-route,
  bearing, point-in-polygon (`src/lib/turf`, unit-tested).

> Travel-time estimation is based on road speed (`speed_kmh`), i.e. vehicle time in seconds —
> a walking-specific mode is listed under Future Improvements.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19 + Vite 8 + TypeScript 6 |
| Map | MapLibre GL JS 6 |
| Client spatial analysis | Turf.js (`@turf/turf`) 7 |
| Data access | `@supabase/supabase-js` (PostgREST RPC + views) |
| Database | PostgreSQL 15+ with **PostGIS** and **pgRouting** (via Supabase; local Docker stack supported) |
| Test / lint | Vitest 5, ESLint 10 + typescript-eslint |
| Runtime | Node `^20.19.0 \|\| >=22.12.0` (`.nvmrc` = 26) |

## Architecture

```
Browser (React 19 + Vite 8)
  MapView + hooks (useMap, useMapLayers, useGeolocation, useEvacuationRoute)
    ├─ MapLibre GL JS 6      render geojson sources + layers (src/styles/mapStyle.ts)
    ├─ Turf.js 7             instant client analysis (src/lib/turf)
    └─ src/lib/api           supabase-js client
         ├─ supabase.rpc('fn_*')            -> PostgREST RPC (server analysis)
         └─ supabase.from('v_*_geojson')    -> PostgREST views (layer data)
Supabase  =  PostgREST + Auth + PostgreSQL 15 (+ PostGIS, pgRouting)
  tables -> views v_*_geojson (FeatureCollection) -> functions fn_* (SECURITY DEFINER, RLS on)
```

- Heavy analysis (network routing, service area, flood-aware cost) runs **server-side** in SQL/pgRouting.
- Light analysis (straight-line distance, buffer, nearest, point-in-polygon) runs **client-side** in Turf.
- All distances are **meters**, times **seconds**, geometry **EPSG:4326** (`[lng, lat]`).

## Spatial Data Model

Tables (geometry type):

| Table | Geometry | Purpose |
| --- | --- | --- |
| `flood_prone_area` | MultiPolygon | Risk zones (`kelas_rawan`, `skor_rawan`) |
| `evacuation_shelter` | Point | Shelters (capacity, status, facilities) |
| `road_network` | LineString | Routing graph (`source`, `target`, `cost`, `reverse_cost`) |
| `evacuation_route` | LineString | Predefined evacuation routes |
| `flood_inundation` | MultiPolygon | Active flooding (drives flood-aware routing) |
| `critical_facility` | Point | Hospitals / clinics / schools / posts |

Read models:

- **Views** `v_<layer>_geojson` — one row each holding a GeoJSON `FeatureCollection` for MapLibre.
- **Functions** `fn_flood_risk_at`, `fn_nearest_shelters`, `fn_evacuation_route`,
  `fn_evacuation_route_safe`, `fn_service_area`, `fn_population_exposed` — return `jsonb` GeoJSON
  (or a `{ "error": ... }` object), exposed as RPC.

Schema + seed live in [`supabase/migrations/`](supabase/migrations/) and [`supabase/seed.sql`](supabase/seed.sql).

## Project Structure

```
src/
  components/map/   MapView, RiskLegend, LayerToggle, ShelterPopup
  hooks/            useMap, useMapLayers, useGeolocation, useEvacuationRoute
  lib/api/          supabase.ts (client), index.ts (rpc + wrappers), types.ts
  lib/turf/         distance, nearest, zone, convert (+ *.test.ts)
  styles/           tokens.ts (palette), mapStyle.ts (sources/layers/groups)
supabase/
  migrations/       20261001000000_init_webgis_schema.sql
  seed.sql          synthetic Java placeholder data (local dev only)
  tests/            integration_functions.sql
spec/               00-50 product/data/db/rendering/routing/turf/prompt-pack specs
docs/               git-workflow.md, ci-workflow.md (proposal, not activated)
scripts/            verify-supabase.mjs (read-path verification)
```

## How to Run

Prerequisites: Node >= 22.12 (repo targets 26 via `.nvmrc`; `nvm use`), npm, and Docker (for the
local Supabase stack).

```bash
# 1) install
npm install

# 2) start local Supabase (Docker) and apply migrations + seed
npx supabase start
npx supabase db reset        # applies supabase/migrations/* then supabase/seed.sql

# 3) configure env (copy then fill)
cp .env.example .env
#    VITE_SUPABASE_URL=http://127.0.0.1:54321          (local Kong/API port)
#    VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from `npx supabase status`>

# 4) run
npm run dev
```

Other commands:

```bash
npm run build        # tsc -b && vite build
npm run lint         # eslint
npx vitest run       # unit tests (src/lib/turf)
node scripts/verify-supabase.mjs   # read-path check against the configured Supabase project
```

Notes:

- Vite reads `.env*` **only at startup** — restart `npm run dev` after editing env vars.
- `vite.config.ts` excludes `maplibre-gl` from `optimizeDeps`; this is required so MapLibre's web
  worker resolves (otherwise the map renders blank). Do not remove it.
- For a **remote** Supabase project instead of Docker: apply
  `supabase/migrations/20261001000000_init_webgis_schema.sql` (and optionally `seed.sql`) via the
  SQL editor, then set `VITE_SUPABASE_URL`/key to that project.
- Local ports: DB `54322`, API/Kong `54321`, Studio `54323`.

## How Analysis Works

- **Routing** uses pgRouting `pgr_dijkstra` over `road_network`. Edge `cost` is travel time in
  seconds (`length_m / (speed_kmh / 3.6)`); `reverse_cost = -1` for one-way edges.
- **Flood-aware routing** (`fn_evacuation_route_safe`) rebuilds edge costs at call time: any edge
  intersecting an **active** `flood_inundation` polygon gets `cost = -1` (impassable), so Dijkstra
  avoids flooded streets. If no safe path exists it returns `{ "error": "no_safe_route" }` and the
  client falls back to the plain route with a warning.
- **Origin/destination snapping** projects the clicked point and the target shelter onto the
  nearest network node (`road_network_v`).
- **Service area** uses `pgr_drivingDistance` with `length_m` as cost, so the radius is in meters.
- **Distance on the client** uses Turf with `{ units: 'meters' }`; SQL uses `geography` /
  `ST_DistanceSphere` (never plain `ST_Distance` on 4326, which yields degrees).
- **Security:** tables have RLS enabled; the anonymous role only gets `SELECT` on the
  `v_*_geojson` views and `EXECUTE` on the `fn_*` functions. The functions are `SECURITY DEFINER`
  (with a pinned `search_path`) so they can read tables while callers cannot.

## Testing

- **Unit (client):** `npx vitest run` — covers the Turf helpers (normal, empty, boundary, units).
- **Integration (DB):** after migrations + seed, run `supabase/tests/integration_functions.sql`
  (psql / SQL editor). It asserts expected outputs, e.g. risk = `TINGGI` at a known point and
  `no_safe_route` toward a shelter cut off by the synthetic inundation.

## Documentation

- [`spec/`](spec/) — product, spatial-data, database, rendering, routing, Turf, and AI prompt-pack specs.
- [`docs/git-workflow.md`](docs/git-workflow.md) — branching, commits, PRs, protection rules.
- [`docs/ci-workflow.md`](docs/ci-workflow.md) — proposed GitHub Actions CI (not yet activated).

## Future Improvements

- Walking-mode travel time (current estimate uses road/vehicle speed).
- Surface the nearest-shelters list in the UI (the RPC + Turf helpers already exist).
- Real-time flood data ingestion (currently `flood_inundation` is manually/seed managed).
- Direction arrows / bearing visualization along the computed route.
- Mobile layout optimization.
- Authentication and data editing (the public app is intentionally read-only).
- Activate the CI workflow from `docs/ci-workflow.md` and add a hosted demo.

## License

MIT
