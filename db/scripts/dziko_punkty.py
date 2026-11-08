import math
import os

import psycopg
import rasterio
from dotenv import load_dotenv

# woda z OSM, w metrach
WODA = """
CREATE TEMP TABLE woda AS
SELECT ST_Transform(geom, 3844) AS geom FROM points
WHERE tags->>'natural' = 'spring' OR tags->>'amenity' = 'drinking_water'
UNION ALL
SELECT ST_Transform(geom, 3844) FROM lines WHERE tags->>'waterway' IN ('river', 'stream')
UNION ALL
SELECT ST_Transform(geom, 3844) FROM polygons WHERE tags->>'natural' = 'water';
CREATE INDEX ON woda USING gist (geom);
"""
#odleglosc od zabudowan
ZABUDOWA = """
CREATE TEMP TABLE zabudowa AS
SELECT ST_Transform(p.geom, 3844) AS geom
FROM polygons p,
     (SELECT ST_Envelope(geom) AS bbox FROM boundaries
      WHERE tags->>'name' = 'Maramureș' AND tags->>'admin_level' = '4') r
WHERE p.geom && r.bbox
  AND (p.tags->>'building' IS NOT NULL
       OR p.tags->>'landuse' IN ('residential', 'industrial', 'commercial', 'retail', 'farmyard'));
CREATE INDEX ON zabudowa USING gist (geom);
"""

LAS = """
CREATE TEMP TABLE las AS
SELECT ST_Transform(p.geom, 3844) AS geom
FROM polygons p,
     (SELECT ST_Envelope(geom) AS bbox FROM boundaries
      WHERE tags->>'name' = 'Maramureș' AND tags->>'admin_level' = '4') r
WHERE p.geom && r.bbox
  AND (p.tags->>'landuse' = 'forest' OR p.tags->>'natural' = 'wood');
CREATE INDEX ON las USING gist (geom);
"""

PARKI = """
CREATE TEMP TABLE parki AS
SELECT ST_Transform(g, 3844) AS geom
FROM (SELECT ST_BuildArea(geom) AS g FROM boundaries
      WHERE tags->>'boundary' IN ('national_park', 'protected_area')
        AND tags->>'protect_class' IN ('1', '2')) x
WHERE g IS NOT NULL;
CREATE INDEX ON parki USING gist (geom);
"""

# punkty co 100 m na ścieżkach Maramuresu i odległość do najbliższej wody
PUNKTY = """
WITH region AS (
    SELECT ST_BuildArea(geom) AS geom FROM boundaries
    WHERE tags->>'name' = 'Maramureș' AND tags->>'admin_level' = '4'
),
sciezki AS (
    SELECT ST_Transform(l.geom, 3844) AS geom
    FROM lines l, region r
    WHERE l.tags->>'highway' IN ('track', 'path', 'footway', 'bridleway')
      AND ST_Intersects(l.geom, r.geom)
),
punkty AS (
    SELECT (ST_DumpPoints(ST_LineInterpolatePoints(geom, LEAST(1.0, 100 / ST_Length(geom))))).geom AS geom
    FROM sciezki
    WHERE ST_Length(geom) > 0
)
SELECT ST_X(p.geom), ST_Y(p.geom), w.odl
FROM punkty p
CROSS JOIN LATERAL (
    SELECT min(ST_Distance(w.geom, p.geom)) AS odl
    FROM woda w
    WHERE ST_DWithin(w.geom, p.geom, 200)
) w
WHERE w.odl IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM zabudowa z WHERE ST_DWithin(z.geom, p.geom, 200))
  AND EXISTS (SELECT 1 FROM las l WHERE ST_Intersects(l.geom, p.geom))
  AND NOT EXISTS (SELECT 1 FROM parki k WHERE ST_Intersects(k.geom, p.geom))
"""

load_dotenv()
with psycopg.connect(host="127.0.0.1", user=os.environ["POSTGRES_USER"],
                     password=os.environ["POSTGRES_PASSWORD"], dbname=os.environ["POSTGRES_DB"]) as conn:
    # woda do 200 m i poza zabudowaniami
    conn.execute(WODA)
    conn.execute(ZABUDOWA)
    conn.execute(LAS)
    conn.execute(PARKI)
    punkty = conn.execute(PUNKTY).fetchall()

    # nachylenie
    prog = 5  
    with rasterio.open("data/slope_maramures.tif") as raster:
        nachylenia = [v[0] for v in raster.sample([(x, y) for x, y, _ in punkty])]
    plaskie = [(x, y, odl) for (x, y, odl), n in zip(punkty, nachylenia) if n < prog]

    wybrane = {}
    for x, y, odl in plaskie:
        kwadrat = (x // 2236, y // 2236)
        if kwadrat not in wybrane or odl < wybrane[kwadrat][2]:
            wybrane[kwadrat] = (x, y, odl)

    conn.execute("DROP TABLE IF EXISTS app.dziko_punkty")
    conn.execute("CREATE TABLE app.dziko_punkty (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "
                 "woda_odl_m real NOT NULL, geom geometry(Point, 3857) NOT NULL)")
    with conn.cursor() as cur:
        cur.executemany("INSERT INTO app.dziko_punkty (woda_odl_m, geom) "
                        "VALUES (%s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 3844), 3857))",
                        [(round(odl), x, y) for x, y, odl in wybrane.values()])

print(f"punkty w lesie z wodą: {len(punkty)}")
print(f"  w tym z nachyleniem < 5stopni: {len(plaskie)}")
print(f"app.dziko_punkty: {len(wybrane)}")
