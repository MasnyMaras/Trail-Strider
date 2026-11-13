#!/usr/bin/env python3
"""Cut the Maramureș county out of romania-latest.osm.pbf using its OSM admin boundary.

python utils/0_prepare_maramures.py
"""
import json

import geopandas as gpd
from shapely.geometry import mapping

from common import DATA, run, log

src = DATA / "romania-latest.osm.pbf"
adm = DATA / "romania_admin4.osm.pbf"
adm_geojson = DATA / "romania_admin4.geojson"
poly = DATA / "maramures_boundary.json"

run(["osmium", "tags-filter", src, "r/admin_level=4", "-o", adm, "--overwrite"])
run(["osmium", "export", adm, "-f", "geojson", "--geometry-types=polygon",
     "-o", adm_geojson, "--overwrite"])

g = gpd.read_file(adm_geojson)
m = g[g["name"].fillna("").str.contains("Maramure")]
log(f"boundary: {list(m['name'])}")

# osmium extract expects a GeoJSON Feature
poly.write_text(json.dumps({
    "type": "Feature",
    "properties": {},
    "geometry": mapping(m.geometry.union_all()),
}))

run(["osmium", "extract", "-p", poly, src, "-o", DATA / "maramures.osm.pbf", "--overwrite"])