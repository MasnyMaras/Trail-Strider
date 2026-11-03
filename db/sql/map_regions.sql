-- Obrysy regionów mapy i maska (przyciemnienie poza regionami) dla serwera kafli Martin.
-- Uruchamiać z głównego folderu repozytorium, po imporcie OSM:
--   docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/map_regions.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

-- obrysy regionów: obszar złożony z linii granic (tabela boundaries z osm2pgsql)
DROP TABLE IF EXISTS app.map_regions;
CREATE TABLE app.map_regions AS
SELECT relation_id AS id,
       tags->>'name' AS name,
       ST_Multi(ST_BuildArea(geom))::geometry(MultiPolygon, 3857) AS geom
FROM boundaries
WHERE tags->>'admin_level' = '4'
  AND tags->>'name' IN ('województwo małopolskie', 'województwo pomorskie', 'Maramureș');

-- maska: cały świat (granice układu EPSG:3857) bez regionów
DROP TABLE IF EXISTS app.map_mask;
CREATE TABLE app.map_mask AS
SELECT ST_Multi(ST_Difference(
           ST_MakeEnvelope(-20037508.34, -20037508.34, 20037508.34, 20037508.34, 3857),
           ST_Union(geom)))::geometry(MultiPolygon, 3857) AS geom
FROM app.map_regions;

CREATE INDEX ON app.map_regions USING gist (geom);
CREATE INDEX ON app.map_mask USING gist (geom);

-- kontrola: powierzchnie regionów i kształt maski
SELECT id, name, round(ST_Area(ST_Transform(geom, 4326)::geography) / 1e6) AS km2
FROM app.map_regions ORDER BY id;
SELECT ST_NumGeometries(geom) AS parts, ST_NumInteriorRings(ST_GeometryN(geom, 1)) AS holes
FROM app.map_mask;

COMMIT;