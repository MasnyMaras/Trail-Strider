#!/usr/bin/env python3
# Script for mapping all power connections in małopolska

# python utils/power_candidates.py --power data/power.geojson  --forest data/forest.geojson --out data/power_candidates.geojson

import argparse
import time
import numpy as np
import pandas as pd
import geopandas as gpd
import shapely

MIN_LEN_M = 50  # Length threshold

# find voltage value
def max_voltage(v):
    try:
        return max(float(x) for x in str(v).split(";"))
    except (ValueError, TypeError):
        return np.nan


def log(msg, t0=[time.time()]):
    print(f"[{time.time() - t0[0]:6.0f}s] {msg}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--power", default="data/power.geojson")
    ap.add_argument("--forest", default="data/forest.geojson")
    ap.add_argument("--out", default="data/power_candidates.geojson")
    ap.add_argument("--crs", type=int, default=2180)
    a = ap.parse_args()

    p = gpd.read_file(a.power).to_crs(a.crs)
    p = p[p.geometry.type.isin(["LineString", "MultiLineString"])].copy()
    p["v"] = p["voltage"].map(max_voltage) if "voltage" in p else np.nan
    log(f"found: {len(p)}")

    # First filter power=line, >=110 kV or Nan
    t1 = p[(p.power == "line") & ((p.v >= 110000) | p.v.isna())][["geometry"]].copy()
    t1["tier"] = 1
    log(f"hgh voltage: {len(t1)}")

    # minor_line 15-30 kV or Nan, only in forest
    t2 = p[(p.power == "minor_line") &
           (((p.v >= 15000) & (p.v <= 30000)) | p.v.isna())][["geometry"]].copy()
    log(f"mid voltage: {len(t2)}")

    f = gpd.read_file(a.forest)[["geometry"]].to_crs(a.crs)
    f["geometry"] = shapely.make_valid(f.geometry.values)
    f = f[f.geometry.type.isin(["Polygon", "MultiPolygon"])]
    #log(f"Forests size: {len(f)}")

    t2 = gpd.overlay(t2, f, how="intersection", keep_geom_type=True)
    t2["tier"] = 2
    log(f"mid power lines in the forest: {len(t2)}")

    c = gpd.GeoDataFrame(pd.concat([t1, t2], ignore_index=True), crs=a.crs)
    c = c.explode(index_parts=False)
    c = c[c.geometry.type == "LineString"]
    c = c[c.length >= MIN_LEN_M].copy()

    keep = gpd.GeoDataFrame(geometry=c.geometry, crs=a.crs)
    keep["highway"] = "path"
    keep["off-trail"] = "yes"
    keep["off-trail:type"] = "power_line"
    keep["off-trail:tier"] = c["tier"].astype(int).values
    keep["foot"] = "yes"

    keep.to_crs(4326).to_file(a.out, driver="GeoJSON")
    km = keep.length / 1000
    log(f"saved {len(keep)} paths, {km.sum():.0f} km")
    print(km.groupby(keep["off-trail:tier"]).agg(["count", "sum"]).round(1))


if __name__ == "__main__":
    main()