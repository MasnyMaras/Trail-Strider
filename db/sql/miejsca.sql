\timing on
BEGIN;
 
CREATE SCHEMA IF NOT EXISTS app;
DROP TABLE IF EXISTS app.miejsca;
 
CREATE TABLE app.miejsca (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rodzaj text NOT NULL,
    nazwa text,
    wysokosc integer,
    osm_id text NOT NULL,
    geom geometry(Point, 3857) NOT NULL
);
 
-- miejsca z OSM jako punkty
INSERT INTO app.miejsca (rodzaj, nazwa, wysokosc, osm_id, geom)
SELECT
    CASE
        WHEN tags->>'natural' = 'peak'                                       THEN 'szczyt'
        WHEN tags->>'natural' = 'saddle' OR tags->>'mountain_pass' = 'yes'   THEN 'przelecz'
        WHEN tags->>'natural' = 'valley'                                     THEN 'dolina'
        WHEN tags->>'tourism' = 'viewpoint'                                  THEN 'punkt_widokowy'
        WHEN tags->>'waterway' = 'waterfall'                                 THEN 'wodospad'
        WHEN tags->>'natural' = 'cave_entrance'                              THEN 'jaskinia'
    END,
    tags->>'name',
    substring(tags->>'ele' from '^[0-9]+')::integer,   -- wysokość
    osm_id,
    geom
FROM (
    SELECT 'n' || node_id AS osm_id, tags, geom FROM points
    UNION ALL
    SELECT 'w' || way_id, tags, ST_LineInterpolatePoint(geom, 0.5) FROM lines
    UNION ALL
    SELECT CASE WHEN area_id > 0 THEN 'w' || area_id ELSE 'r' || -area_id END,
           tags, ST_PointOnSurface(geom) FROM polygons
) o
WHERE tags->>'natural' IN ('peak', 'saddle', 'valley', 'cave_entrance')
   OR tags->>'mountain_pass' = 'yes'
   OR tags->>'tourism' = 'viewpoint'
   OR tags->>'waterway' = 'waterfall';
 
-- w granicach regionów
CREATE TEMP TABLE t_regiony ON COMMIT DROP AS
SELECT ST_BuildArea(geom) AS geom
FROM boundaries
WHERE tags->>'admin_level' = '4'
  AND tags->>'name' IN ('województwo małopolskie', 'województwo pomorskie', 'Maramureș');
 
DELETE FROM app.miejsca m
WHERE NOT EXISTS (SELECT 1 FROM t_regiony r WHERE ST_Intersects(m.geom, r.geom));
 
CREATE INDEX miejsca_geom_idx ON app.miejsca USING gist (geom);
ANALYZE app.miejsca;
 

COMMENT ON TABLE app.miejsca IS
    '{"description": "Ciekawe miejsca z OSM: szczyty, przełęcze, doliny, punkty widokowe, wodospady, jaskinie; db/sql/miejsca.sql",
      "attribution": "© OpenStreetMap contributors"}';
 
SELECT rodzaj, count(*) AS liczba, count(nazwa) AS z_nazwa, count(wysokosc) AS z_wysokoscia
FROM app.miejsca
GROUP BY 1
ORDER BY 2 DESC;
 
COMMIT;