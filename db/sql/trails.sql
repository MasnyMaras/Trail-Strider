-- Szlaki turystyczne piesze (relacje route=hiking z OSM) dla serwera kafli Martin.
-- Wymaga app.map_regions (db/sql/map_regions.sql). Uruchamiać z głównego folderu repozytorium:
--   docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/trails.sql

BEGIN;

-- szlaki przycięte do regionów; kolor = pierwszy człon osmc:symbol (np. red:white:red_bar), zapasowo tag colour
DROP TABLE IF EXISTS app.trails;
CREATE TABLE app.trails AS
SELECT t.relation_id AS id,
       r.name AS region,
       t.tags->>'name' AS name,
       nullif(lower(coalesce(nullif(split_part(t.tags->>'osmc:symbol', ':', 1), ''), t.tags->>'colour')), '') AS color,
       ST_Multi(CASE WHEN ST_CoveredBy(t.geom, r.geom) THEN t.geom      -- cały w regionie: bez przycinania (szybciej)
                     ELSE ST_CollectionExtract(ST_Intersection(t.geom, r.geom), 2)
                END)::geometry(MultiLineString, 3857) AS geom
FROM routes t
JOIN app.map_regions r ON ST_Intersects(t.geom, r.geom)
WHERE t.tags->>'route' = 'hiking';

-- szlaki stykające się z regionem tylko w punkcie (po przycięciu pusta geometria)
DELETE FROM app.trails WHERE ST_IsEmpty(geom);

CREATE INDEX ON app.trails USING gist (geom);

-- kontrola: szlaki według regionu i według koloru
SELECT region, count(*) AS trails, count(color) AS with_color,
       round(sum(ST_Length(ST_Transform(geom, 4326)::geography)) / 1000) AS km
FROM app.trails GROUP BY 1 ORDER BY 1;
SELECT color, count(*) FROM app.trails GROUP BY 1 ORDER BY 2 DESC;

COMMIT;