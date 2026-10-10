"""Drogi całego województwa małopolskiego z bazy PostGIS, w 3 klasach."""
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

# --- Drogi samochodowe z podziałem na 3 klasy (do różnej grubości linii) ---
DROGI = """
    SELECT geom,
           CASE
             WHEN tags->>'highway' IN ('motorway','motorway_link','trunk','trunk_link',
                                       'primary','primary_link') THEN 'glowne'
             WHEN tags->>'highway' IN ('secondary','secondary_link',
                                       'tertiary','tertiary_link') THEN 'srednie'
             ELSE 'lokalne'
           END AS klasa
    FROM lines
    WHERE tags->>'highway' IN (
          'motorway','motorway_link','trunk','trunk_link',
          'primary','primary_link','secondary','secondary_link',
          'tertiary','tertiary_link','unclassified','residential',
          'living_street','service')
"""

GRANICA = """
    SELECT ST_BuildArea(geom) AS geom FROM boundaries
    WHERE tags->>'name' = 'województwo małopolskie' AND tags->>'admin_level' = '4'
"""

# klasa: (kolor, grubość) - kolejność = kolejność rysowania (główne na wierzchu)
STYL = {"lokalne": ("lightgray", 0.2), "srednie": ("gray", 0.6), "glowne": ("black", 1.2)}

# --- Pobranie danych ---
t = time.perf_counter()
drogi = gpd.read_postgis(DROGI, engine, geom_col="geom")
granica = gpd.read_postgis(GRANICA, engine, geom_col="geom")
print(f"Pobrano z bazy w {time.perf_counter() - t:.1f} s ({len(drogi):,} odcinków dróg)")

# --- Rysowanie ---
fig, ax = plt.subplots(figsize=(16, 14))
for klasa, (kolor, grubosc) in STYL.items():
    drogi[drogi["klasa"] == klasa].plot(ax=ax, color=kolor, linewidth=grubosc)
granica.boundary.plot(ax=ax, color="blue", linewidth=1.5)
ax.set_title("Województwo małopolskie – drogi z bazy PostGIS", fontsize=18)
ax.text(0.99, 0.01, "© OpenStreetMap contributors", transform=ax.transAxes,
        ha="right", fontsize=10)
ax.set_axis_off()

Path("output").mkdir(exist_ok=True)
plt.savefig("output/malopolskie_drogi.png", dpi=200, bbox_inches="tight")
print("Zapisano output/malopolskie_drogi.png")