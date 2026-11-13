#!/usr/bin/env python3
"""Stage 1: candidate paths of a given type in a given region.
TODO: add more types like abonded railway
python utils/1_import.py --region malopolskie --type power_line
Output: data/<region>/candidates_<type>.geojson
"""
import argparse

import numpy as np
import pandas as pd
import geopandas as gpd
import shapely

from common import REGIONS, layer, log, region_dir

MIN_LEN_M = 50


def import_stream(region):
    """Tier 3: waterway=stream, excluding tunnels and very short pieces."""
    crs = REGIONS[region]["crs"]
    s = gpd.read_file(layer(region, "streams")).to_crs(crs)
    s = s[s.geometry.type.isin(["LineString", "MultiLineString"])].copy()
    if "tunnel" in s:
        s = s[s["tunnel"].isna()]
    s = s[["geometry"]].explode(index_parts=False)
    s["tier"] = 3
    return s[s.length >= 100].copy()


def max_voltage(v):
    try:
        return max(float(x) for x in str(v).split(";"))
    except (ValueError, TypeError):
        return np.nan


def import_power_line(region):
    """Tier 1: power=line >= 110 kV (or no voltage).
    Tier 2: minor_line 15-30 kV (or no voltage), forest parts only."""
    crs = REGIONS[region]["crs"]
    p = gpd.read_file(layer(region, "power")).to_crs(crs)
    p = p[p.geometry.type.isin(["LineString", "MultiLineString"])].copy()
    p["v"] = p["voltage"].map(max_voltage) if "voltage" in p else np.nan

    t1 = p[(p.power == "line") & ((p.v >= 110000) | p.v.isna())][["geometry"]].copy()
    t1["tier"] = 1
    t2 = p[(p.power == "minor_line") &
           (((p.v >= 15000) & (p.v <= 30000)) | p.v.isna())][["geometry"]].copy()

    f = gpd.read_file(layer(region, "forest"))[["geometry"]].to_crs(crs)
    f["geometry"] = shapely.make_valid(f.geometry.values)
    f = f[f.geometry.type.isin(["Polygon", "MultiPolygon"])]
    t2 = gpd.overlay(t2, f, how="intersection", keep_geom_type=True)
    t2["tier"] = 2

    c = gpd.GeoDataFrame(pd.concat([t1, t2], ignore_index=True), crs=crs).explode(index_parts=False)
    c = c[c.geometry.type == "LineString"]
    return c[c.length >= MIN_LEN_M].copy()


TYPES = {"power_line": import_power_line, "stream": import_stream}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True, choices=REGIONS)
    ap.add_argument("--type", required=True, choices=TYPES)
    a = ap.parse_args()

    crs = REGIONS[a.region]["crs"]
    c = TYPES[a.type](a.region)

    keep = gpd.GeoDataFrame(geometry=c.geometry.values, crs=crs)
    keep["highway"] = "path"
    keep["off-trail"] = "yes"
    keep["off-trail:type"] = a.type
    keep["off-trail:tier"] = c["tier"].astype(int).values
    keep["foot"] = "yes"

    out = region_dir(a.region) / f"candidates_{a.type}.geojson"
    keep.to_crs(4326).to_file(out, driver="GeoJSON")
    log(f"saved {out}: {len(keep)} segments, {keep.length.sum() / 1000:.0f} km")


if __name__ == "__main__":
    main()