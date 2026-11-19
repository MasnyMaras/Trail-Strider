from sqlalchemy import text

from app.db import engine


SEARCH_PLACES = text("""
    WITH tagged_features AS (
        SELECT tags, geom::geometry AS geom FROM points
        UNION ALL
        SELECT tags, geom::geometry FROM lines
        UNION ALL
        SELECT tags, geom::geometry FROM polygons
        UNION ALL
        SELECT tags, geom::geometry FROM routes
    ),
    source_records AS (
        SELECT
            coalesce(nullif(btrim(t.tags->>'name'), ''),
                     nullif(btrim(t.tags->>'name:pl'), ''),
                     nullif(btrim(t.tags->>'name:en'), '')) AS name,
            CASE
                WHEN t.tags->>'place' IN (
                    'city', 'town', 'village', 'hamlet', 'isolated_dwelling',
                    'locality', 'suburb', 'quarter', 'neighbourhood', 'borough'
                ) THEN 'Miejscowość'
                WHEN t.tags->>'place' IS NOT NULL THEN 'Miejsce'
                WHEN t.tags->>'tourism' IS NOT NULL THEN 'Turystyka'
                WHEN t.tags->>'natural' IS NOT NULL THEN 'Przyroda'
                WHEN t.tags->>'historic' IS NOT NULL THEN 'Zabytek'
                WHEN t.tags->>'waterway' IS NOT NULL THEN 'Woda'
                WHEN t.tags->>'amenity' IS NOT NULL THEN 'Usługi'
                WHEN t.tags->>'leisure' IS NOT NULL THEN 'Rekreacja'
                ELSE 'Obiekt OSM'
            END AS category,
            r.id AS region_id,
            r.name AS region,
            t.geom,
            CASE
                WHEN t.tags->>'place' IN (
                    'city', 'town', 'village', 'hamlet', 'isolated_dwelling',
                    'locality', 'suburb', 'quarter', 'neighbourhood', 'borough'
                ) THEN 0
                ELSE 2
            END AS priority
        FROM tagged_features t
        JOIN app.map_regions r ON ST_Intersects(t.geom, r.geom)

        UNION ALL

        SELECT m.nazwa, m.rodzaj, r.id, r.name, m.geom, 1
        FROM app.miejsca m
        JOIN app.map_regions r ON ST_Intersects(m.geom, r.geom)

        UNION ALL

        SELECT n.nazwa, n.rodzaj, r.id, r.name, n.geom, 1
        FROM app.noclegi n
        JOIN app.map_regions r ON ST_Intersects(n.geom, r.geom)

        UNION ALL

        SELECT t.name, 'szlak', r.id, r.name, t.geom, 1
        FROM app.trails t
        JOIN app.map_regions r ON ST_Intersects(t.geom, r.geom)
    ),
    normalized AS (
        SELECT *,
            translate(
                lower(btrim(name)),
                'ąćęłńóśźżăâîșț',
                'acelnoszzaaist'
            ) AS search_name,
            CASE region
                WHEN 'województwo małopolskie' THEN 'malopolskie'
                WHEN 'województwo pomorskie' THEN 'pomorskie'
                WHEN 'Maramureș' THEN 'maramures'
            END AS search_region_id
        FROM source_records
        WHERE name IS NOT NULL AND btrim(name) <> ''
    ),
    matches AS (
        SELECT n.*, ST_PointOnSurface(n.geom) AS location
        FROM normalized n
        WHERE position(:query IN n.search_name) > 0
           OR n.search_name % :query
    ),
    coordinates AS (
        SELECT *,
            ST_X(location) AS x,
            ST_Y(location) AS y
        FROM matches
    ),
    ranked AS (
        SELECT *,
            row_number() OVER (
                PARTITION BY search_name, region_id, round(x / 100), round(y / 100)
                ORDER BY priority
            ) AS duplicate_rank
        FROM coordinates
    )
    SELECT
        concat(search_region_id, ':', md5(search_name), ':',
               round(x / 100)::integer, ':', round(y / 100)::integer) AS id,
        name,
        category,
        region,
        search_region_id AS region_id,
        ST_X(ST_Transform(location, 4326)) AS longitude,
        ST_Y(ST_Transform(location, 4326)) AS latitude,
        similarity(search_name, :query) AS score
    FROM ranked
    WHERE duplicate_rank = 1
    ORDER BY
        (search_name = :query) DESC,
        (search_name LIKE :query || '%') DESC,
        priority,
        score DESC,
        name
    LIMIT 12
""")


def search_places(query: str) -> list[dict]:
    normalized_query = query.strip().lower().translate(str.maketrans(
        "ąćęłńóśźżăâîșț",
        "acelnoszzaaist",
    ))
    with engine.begin() as connection:
        connection.execute(text("SET LOCAL pg_trgm.similarity_threshold = 0.2"))
        rows = connection.execute(SEARCH_PLACES, {"query": normalized_query})
        return [dict(row) for row in rows.mappings()]
