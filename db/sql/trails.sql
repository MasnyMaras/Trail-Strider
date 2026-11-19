
BEGIN;

-- szlaki przycięte do regionów
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

DELETE FROM app.trails WHERE ST_IsEmpty(geom);

CREATE INDEX ON app.trails USING gist (geom);


DROP TABLE IF EXISTS app.trail_segments;
CREATE TABLE app.trail_segments AS
WITH pieces AS (       
  SELECT t.region, coalesce(t.color, '') AS color,
         ST_AsBinary(CASE WHEN ST_X(ST_StartPoint(d.geom)) < ST_X(ST_EndPoint(d.geom))
                            OR (ST_X(ST_StartPoint(d.geom)) = ST_X(ST_EndPoint(d.geom))
                                AND ST_Y(ST_StartPoint(d.geom)) < ST_Y(ST_EndPoint(d.geom)))
                          THEN d.geom ELSE ST_Reverse(d.geom) END) AS seg
  FROM app.trails t, ST_DumpSegments(t.geom) d
), piece_colors AS (  
  SELECT region, seg, array_agg(DISTINCT color ORDER BY color) AS colors
  FROM pieces GROUP BY region, seg
), merged AS (         
  SELECT region, colors, (ST_Dump(ST_LineMerge(ST_Collect(ST_GeomFromWKB(seg, 3857))))).geom AS geom
  FROM piece_colors GROUP BY region, colors
)
SELECT region,
       nullif(c.color, '') AS color,
       c.i::int AS i,                   -- numer koloru na odcinku
       cardinality(colors) AS n,        
       (CASE WHEN ST_X(ST_StartPoint(geom)) > ST_X(ST_EndPoint(geom)) THEN ST_Reverse(geom) ELSE geom END)::geometry(LineString, 3857) AS geom
FROM merged, unnest(colors) WITH ORDINALITY AS c(color, i);

CREATE INDEX ON app.trail_segments USING gist (geom);

-- szlaki wg regionu i wg koloru
SELECT region, count(*) AS trails, count(color) AS with_color,
       round(sum(ST_Length(ST_Transform(geom, 4326)::geography)) / 1000) AS km
FROM app.trails GROUP BY 1 ORDER BY 1;
SELECT color, count(*) FROM app.trails GROUP BY 1 ORDER BY 2 DESC;

SELECT region, n, count(*) AS lines, round(sum(ST_Length(ST_Transform(geom, 4326)::geography)) / 1000 / n) AS km
FROM app.trail_segments GROUP BY 1, 2 ORDER BY 1, 2;

COMMIT;