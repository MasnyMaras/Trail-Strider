import json

from sqlalchemy import text
from app.db import engine

LODGINGS_NEAR_ROUTE = text("""
    WITH t AS (
        SELECT g AS g3857, ST_Transform(g, 2180) AS g2180
        FROM (SELECT ST_Transform(ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON(:geom)), 4326), 3857) AS g) x
    )
    SELECT n.zrodlo AS source, n.rodzaj AS type, n.nazwa AS name, n.super AS preferred,
           n.woda_rodzaj AS water_type, n.woda_odl_m AS water_distance_m,
           n.www AS website, n.telefon AS phone,
           ST_X(ST_Transform(n.geom, 4326)) AS lon, ST_Y(ST_Transform(n.geom, 4326)) AS lat,
           round(ST_Distance(ST_Transform(n.geom, 2180), t.g2180)::numeric) AS distance_m,
           round((ST_LineLocatePoint(t.g2180, ST_Transform(n.geom, 2180)) * ST_Length(t.g2180) / 1000)::numeric, 2) AS route_km
    FROM app.noclegi n, t
    WHERE ST_DWithin(n.geom, t.g3857, :buffer_m * 1.8)
      AND ST_DWithin(ST_Transform(n.geom, 2180), t.g2180, :buffer_m)
    ORDER BY route_km, distance_m
""")

def lodgings_near_route(geometry: dict, buffer_m: int) -> list[dict]:
    """Noclegi przy trasie (geometry: GeoJSON LineString z BRoutera), posortowane wzdłuż trasy."""
    with engine.connect() as conn:
        rows = conn.execute(LODGINGS_NEAR_ROUTE, {"geom": json.dumps(geometry), "buffer_m": buffer_m})
        return [dict(r) for r in rows.mappings()]