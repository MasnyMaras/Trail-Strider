-- Wspólna tabela noclegów dla backendu (app.noclegi): OSM + Lasy Państwowe + punkty „Zanocuj w lesie".
-- Uruchamiać z głównego folderu repozytorium (po db/sql/zanocuj_punkty.sql):
--   docker compose exec -T db psql -U osm -d osm -v ON_ERROR_STOP=1 -f - < db/sql/noclegi.sql
-- Tabela jest budowana od nowa przy każdym uruchomieniu (po imporcie OSM, bdl_load.py lub zanocuj_punkty.sql).

\timing on

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;
DROP TABLE IF EXISTS app.noclegi;

CREATE TABLE app.noclegi (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zrodlo text NOT NULL,
    zrodlo_id text NOT NULL,
    rodzaj text NOT NULL,
    nazwa text,
    super boolean NOT NULL DEFAULT false,
    woda_rodzaj text,
    woda_odl_m real,
    www text,
    telefon text,
    geom geometry(Point, 3857) NOT NULL
);
-- noclegi z osm
INSERT INTO app.noclegi (zrodlo, zrodlo_id, rodzaj, nazwa, www, telefon, geom)
SELECT 'osm', osm_id,
    CASE
        WHEN tags->>'tourism' = 'camp_site' AND tags->>'backcountry' = 'yes' THEN 'miejsce_biwakowe'
        WHEN tags->>'tourism' = 'camp_site'      THEN 'pole_namiotowe'
        WHEN tags->>'tourism' = 'alpine_hut'     THEN 'schronisko'
        WHEN tags->>'tourism' = 'wilderness_hut' THEN 'chatka'
        WHEN tags->>'tourism' = 'hostel'         THEN 'hostel'
        WHEN tags->>'tourism' IN ('guest_house', 'chalet') THEN 'kwatera'
        WHEN tags->>'tourism' IN ('hotel', 'motel') THEN 'hotel'
    END,
    tags->>'name',
    COALESCE(tags->>'website', tags->>'contact:website'),
    COALESCE(tags->>'phone', tags->>'contact:phone'),
    geom
FROM (
    SELECT 'n' || node_id AS osm_id, tags, geom FROM points
    UNION ALL
    SELECT CASE WHEN area_id > 0 THEN 'w' || area_id ELSE 'r' || -area_id END,
           tags, ST_PointOnSurface(geom) FROM polygons
) o
WHERE tags->>'tourism' IN ('camp_site', 'alpine_hut', 'wilderness_hut', 'hostel', 'guest_house', 'chalet', 'hotel', 'motel');

-- Lasy Państwowe - miejsca i pola biwakowe
INSERT INTO app.noclegi (zrodlo, zrodlo_id, rodzaj, nazwa, geom)
SELECT 'lp', tabela || ':' || id,
       CASE props->>'tur_obj_desc'
           WHEN 'Miejsca biwakowania' THEN 'miejsce_biwakowe'
           WHEN 'Pola biwakowe'       THEN 'pole_namiotowe'
           WHEN 'Schroniska leśne'    THEN 'schronisko'
           ELSE 'kwatera'
       END,
       props->>'nzw_ob', geom
FROM (
    SELECT 'powierzchniowe' AS tabela, id, props, geom FROM bdl.noclegi_powierzchniowe
    UNION ALL
    SELECT 'kubaturowe', id, props, geom FROM bdl.noclegi_kubaturowe
) l;

-- zanocuj w lesie

INSERT INTO app.noclegi (zrodlo, zrodlo_id, rodzaj, nazwa, super, woda_rodzaj, woda_odl_m, geom)
SELECT 'zanocuj', id::text, 'zanocuj_w_lesie', NULL, super, woda_rodzaj, woda_odl_m, geom
FROM bdl.zanocuj_punkty;

CREATE INDEX noclegi_geom_idx ON app.noclegi USING gist (geom);
ANALYZE app.noclegi;
COMMENT ON TABLE app.noclegi IS
    'Noclegi dla backendu: OSM (© OpenStreetMap contributors), Lasy Państwowe (BDL), bdl.zanocuj_punkty; db/sql/noclegi.sql';

SELECT zrodlo, rodzaj, count(*) AS liczba
FROM app.noclegi
GROUP BY 1, 2
ORDER BY 1, 3 DESC;

COMMIT;