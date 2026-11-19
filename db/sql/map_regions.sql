
BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

-- obrysy regionów
DROP TABLE IF EXISTS app.map_regions;
CREATE TABLE app.map_regions AS
SELECT relation_id AS id,
       tags->>'name' AS name,
       ST_Multi(ST_BuildArea(geom))::geometry(MultiPolygon, 3857) AS geom
FROM boundaries
WHERE tags->>'admin_level' = '4'
  AND tags->>'name' IN ('województwo małopolskie', 'województwo pomorskie', 'Maramureș');

-- maska
DROP TABLE IF EXISTS app.map_mask;
CREATE TABLE app.map_mask AS
SELECT ST_Multi(ST_Difference(
           ST_MakeEnvelope(-20037508.34, -20037508.34, 20037508.34, 20037508.34, 3857),
           ST_Union(geom)))::geometry(MultiPolygon, 3857) AS geom
FROM app.map_regions;

CREATE INDEX ON app.map_regions USING gist (geom);
CREATE INDEX ON app.map_mask USING gist (geom);

-- kontrola
SELECT id, name, round(ST_Area(ST_Transform(geom, 4326)::geography) / 1e6) AS km2
FROM app.map_regions ORDER BY id;
SELECT ST_NumGeometries(geom) AS parts, ST_NumInteriorRings(ST_GeometryN(geom, 1)) AS holes
FROM app.map_mask;

COMMIT;