
-- Punkty noclegowe w obszarach „Zanocuj w lesie" (bdl.zanocuj_punkty), opis: docs/SETUP.md, Krok 14.
-- Uruchamiać z głównego folderu repozytorium:
--   docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/zanocuj_punkty.sql
-- Żeby dodać woj. Pomorskie: docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 \ -v "wojewodztwo=województwo pomorskie" -f - < db/sql/zanocuj_punkty.sql

\if :{?wojewodztwo}
\else
\set wojewodztwo 'województwo małopolskie'
\endif
\set bok_m 2236
\set prog_wody_m 200
\timing on

BEGIN;

-- Granica województwa
CREATE TEMP TABLE t_region ON COMMIT DROP AS
SELECT g AS geom_m, ST_Transform(g, 3857) AS geom
FROM (SELECT ST_Transform(ST_BuildArea(geom), 2180) AS g FROM boundaries
      WHERE tags->>'name' = :'wojewodztwo' AND tags->>'admin_level' = '4') x
WHERE g IS NOT NULL;

-- Obszary programu
CREATE TEMP TABLE t_obszary ON COMMIT DROP AS
SELECT z.id AS obszar_id, z.geom, ST_Transform(z.geom, 2180) AS geom_m,
       ST_Expand(ST_Envelope(z.geom), 3000) AS bbox
FROM bdl.zanocuj_w_lesie z, t_region r
WHERE ST_Intersects(z.geom, r.geom);

-- Ścieżki i drogi leśne w obszarach
CREATE TEMP TABLE t_sciezki ON COMMIT DROP AS
SELECT obszar_id, geom
FROM (
    SELECT o.obszar_id,
           ST_CollectionExtract(ST_Intersection(ST_Transform(l.geom, 2180), o.geom_m), 2) AS geom
    FROM t_obszary o
    JOIN lines l ON ST_Intersects(l.geom, o.geom)
    WHERE l.tags->>'highway' IN ('track', 'path', 'footway', 'bridleway')
      AND COALESCE(l.tags->>'access', '') NOT IN ('private', 'no')
      AND COALESCE(l.tags->>'foot', '') <> 'no'
) x
WHERE NOT ST_IsEmpty(geom);
CREATE INDEX ON t_sciezki USING gist (geom);
ANALYZE t_sciezki;

-- Siatka
CREATE TEMP TABLE t_komorki ON COMMIT DROP AS
SELECT o.obszar_id, g.i, g.j, ST_Intersection(g.geom, o.geom_m) AS geom
FROM t_obszary o, ST_SquareGrid(:bok_m, o.geom_m) g
WHERE ST_Intersects(g.geom, o.geom_m);

-- Punkt w komórce: miejsce na ścieżce najbliższe środka komórki
CREATE TEMP TABLE t_punkty ON COMMIT DROP AS
SELECT k.obszar_id, ST_ClosestPoint(s.geom, ST_PointOnSurface(k.geom)) AS geom_m,
       true AS przy_sciezce
FROM t_komorki k
CROSS JOIN LATERAL (
    SELECT ST_Union(ST_Intersection(ts.geom, k.geom)) AS geom
    FROM t_sciezki ts
    WHERE ts.obszar_id = k.obszar_id AND ST_Intersects(ts.geom, k.geom)
) s
WHERE s.geom IS NOT NULL AND NOT ST_IsEmpty(s.geom);

-- Obszar bez ścieżek: jeden punkt w środku
INSERT INTO t_punkty (obszar_id, geom_m, przy_sciezce)
SELECT o.obszar_id, ST_PointOnSurface(o.geom_m), false
FROM t_obszary o
WHERE NOT EXISTS (SELECT 1 FROM t_punkty p WHERE p.obszar_id = o.obszar_id);
CREATE INDEX ON t_punkty USING gist (geom_m);

-- Woda
CREATE TEMP TABLE t_woda ON COMMIT DROP AS
SELECT rodzaj, ST_Transform(geom, 2180) AS geom
FROM (
    SELECT 'zrodlo' AS rodzaj, geom, tags FROM points
    WHERE tags->>'natural' = 'spring' OR tags->>'amenity' = 'drinking_water'
    UNION ALL
    SELECT CASE tags->>'waterway' WHEN 'river' THEN 'rzeka' ELSE 'strumien' END, geom, tags FROM lines
    WHERE tags->>'waterway' IN ('river', 'stream')
    UNION ALL
    SELECT CASE WHEN tags->>'waterway' = 'riverbank' OR tags->>'water' = 'river' THEN 'rzeka'
                ELSE 'zbiornik' END, geom, tags FROM polygons
    WHERE (tags->>'natural' = 'water' AND COALESCE(tags->>'water', '') NOT IN ('wastewater', 'canal', 'ditch'))
       OR tags->>'waterway' = 'riverbank'
) w
WHERE COALESCE(tags->>'intermittent', '') <> 'yes'
  AND COALESCE(tags->>'seasonal', '') <> 'yes'
  AND EXISTS (SELECT 1 FROM t_obszary o WHERE w.geom && o.bbox);
CREATE INDEX ON t_woda USING gist (geom);
ANALYZE t_woda;

-- Tabela wynikowa
CREATE TABLE IF NOT EXISTS bdl.zanocuj_punkty (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    obszar_id    integer NOT NULL,
    wojewodztwo  text    NOT NULL,
    przy_sciezce boolean NOT NULL,
    woda_rodzaj  text,
    woda_odl_m   real,
    super        boolean NOT NULL,
    geom         geometry(Point, 3857) NOT NULL
);
CREATE INDEX IF NOT EXISTS zanocuj_punkty_geom_idx ON bdl.zanocuj_punkty USING gist (geom);
COMMENT ON TABLE bdl.zanocuj_punkty IS
    'Punkty noclegowe wyznaczone z bdl.zanocuj_w_lesie (db/sql/zanocuj_punkty.sql): siatka 5 km², punkty na ścieżkach, woda z OSM';

DELETE FROM bdl.zanocuj_punkty WHERE wojewodztwo = :'wojewodztwo';

INSERT INTO bdl.zanocuj_punkty (obszar_id, wojewodztwo, przy_sciezce, woda_rodzaj, woda_odl_m, super, geom)
SELECT p.obszar_id, :'wojewodztwo', p.przy_sciezce, w.rodzaj, round(w.odl::numeric, 1),
       COALESCE(w.odl <= :prog_wody_m, false), ST_Transform(p.geom_m, 3857)
FROM t_punkty p
LEFT JOIN LATERAL (
    SELECT w.rodzaj, ST_Distance(w.geom, p.geom_m) AS odl
    FROM t_woda w
    ORDER BY w.geom <-> p.geom_m
    LIMIT 1
) w ON true;

ANALYZE bdl.zanocuj_punkty;

-- Podsumowanie
SELECT :'wojewodztwo'                                            AS wojewodztwo,
       (SELECT count(*) FROM t_obszary)                          AS obszary,
       count(*)                                                  AS punkty,
       count(*) FILTER (WHERE przy_sciezce)                      AS przy_sciezce,
       count(DISTINCT obszar_id) FILTER (WHERE NOT przy_sciezce) AS obszary_bez_sciezek,
       count(*) FILTER (WHERE super)                             AS super,
       round(100.0 * count(*) FILTER (WHERE super) / NULLIF(count(*), 0)) AS super_proc
FROM bdl.zanocuj_punkty
WHERE wojewodztwo = :'wojewodztwo';

SELECT woda_rodzaj, count(*) AS super_punkty
FROM bdl.zanocuj_punkty
WHERE wojewodztwo = :'wojewodztwo' AND super
GROUP BY 1 ORDER BY 2 DESC;

COMMIT;
