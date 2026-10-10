"""Mapa Krakowa z danych OSM w PostGIS: budynki, drogi, noclegi, granica miasta."""
import os
import time
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
from dotenv import load_dotenv
from sqlalchemy import URL, create_engine

# --- Połączenie z bazą: dane logowania z .env (hasło nie jest w kodzie) ---
load_dotenv()
engine = create_engine(URL.create(
    "postgresql+psycopg",
    username=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    host="127.0.0.1", port=5432,
    database=os.environ["POSTGRES_DB"],
))

# --- Granica Krakowa: linie z tabeli boundaries -> poligon (ST_BuildArea) ---
MIASTO = """
        WITH g AS MATERIALIZED (   -- policz granicę RAZ (bez tego: liczona dla każdego wiersza)
        SELECT ST_BuildArea(geom) AS geom FROM boundaries
        WHERE tags->>'name' = 'Kraków' AND tags->>'admin_level' = '8'
    )
"""

# --- Zapytania: baza sama przycina do granicy miasta ---
QUERIES = {
    "granica": MIASTO + "SELECT geom FROM g",
    "drogi": MIASTO + """
        SELECT l.geom FROM lines l, g
        WHERE l.tags->>'highway' IN (
              'motorway','motorway_link','trunk','trunk_link',
              'primary','primary_link','secondary','secondary_link',
              'tertiary','tertiary_link','unclassified','residential',
              'living_street','service')
          AND ST_Intersects(l.geom, g.geom)""",
    "budynki": MIASTO + """
        SELECT p.geom FROM polygons p, g
        WHERE p.tags ? 'building' AND ST_Intersects(p.geom, g.geom)""",
    "noclegi": MIASTO + """
        SELECT x.geom FROM (
            SELECT geom, tags FROM points
            UNION ALL
            SELECT ST_PointOnSurface(geom), tags FROM polygons   -- obrys -> punkt w środku
        ) x, g
        WHERE x.tags->>'tourism' IN ('hotel','hostel','guest_house','motel')
          AND ST_Intersects(x.geom, g.geom)""",
}

# --- Pobranie danych + pomiar czasu ---
start = time.perf_counter()
dane = {}
for nazwa, sql in QUERIES.items():
    t = time.perf_counter()
    dane[nazwa] = gpd.read_postgis(sql, engine, geom_col="geom")
    print(f"  {nazwa:8} {len(dane[nazwa]):>8,}  {time.perf_counter() - t:5.1f} s")
print(f"Pobrano z bazy w {time.perf_counter() - start:.1f} s")

# --- Rysowanie ---
fig, ax = plt.subplots(figsize=(16, 14))
dane["budynki"].plot(ax=ax, color="lightgray", edgecolor="gray", linewidth=0.15, alpha=0.7)
dane["drogi"].plot(ax=ax, color="black", linewidth=0.5)
dane["noclegi"].plot(ax=ax, color="red", edgecolor="white", markersize=30, zorder=5)
dane["granica"].boundary.plot(ax=ax, color="blue", linewidth=2, zorder=6)
ax.set_title("Kraków – dane OpenStreetMap z bazy PostGIS", fontsize=18)
ax.text(0.99, 0.01, "© OpenStreetMap contributors", transform=ax.transAxes,
        ha="right", fontsize=10)
ax.set_axis_off()

Path("output").mkdir(exist_ok=True)
plt.savefig("output/krakow.png", dpi=200, bbox_inches="tight")
print("Zapisano output/krakow.png")