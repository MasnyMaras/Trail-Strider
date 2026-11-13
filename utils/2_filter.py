#!/usr/bin/env python3
"""Stage 2: OSM exclusions + slope filter.

python utils/2_filter.py --region malopolskie [--types power_line] [--max-slope 15]
Input: data/<region>/candidates_*.geojson,
Output: filtered_<type>.geojson
"""
import argparse

import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
import shapely
import shapely.ops

from common import REGIONS, layer, buildings, empty_gdf, log, region_dir

MIN_LEN_M = 50
STEP_M = 10
BUILD_BUF_M = 30


def load(path, crs, geom_types):
    g = gpd.read_file(path)
    if g.empty:
        return empty_gdf(crs)
    g = g[["geometry"]].to_crs(crs)
    g["geometry"] = shapely.make_valid(g.geometry.values)
    return g[g.geometry.type.isin(geom_types)]


def load_near(path, crs, lines, dist, chunk=200_000):
    """Read polygons in chunks and keep only those within dist of the lines."""
    tree = shapely.STRtree(lines.geometry.values)
    parts, skip = [], 0
    while True:
        g = gpd.read_file(path, layer="multipolygons", engine="pyogrio",
                          skip_features=skip, max_features=chunk)[["geometry"]]
        if len(g) == 0:
            break
        skip += chunk
        g = g.to_crs(crs)
        g = g[g.geometry.type.isin(["Polygon", "MultiPolygon"])]
        idx = tree.query(g.geometry.values, predicate="dwithin", distance=dist)[0]
        parts.append(g.iloc[np.unique(idx)])
    if not parts:
        return empty_gdf(crs)
    return gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=crs)


def cut_out(lines, mask):
    if len(mask) == 0:
        return lines
    return gpd.overlay(lines, mask, how="difference", keep_geom_type=True)


def slope_filter(lines, slope_path, crs, max_deg, step):
    """Sample the raster every step m and keep continuous runs with slope <= max_deg."""
    out = []
    with rasterio.open(slope_path) as src:
        if src.crs.to_epsg() != crs:
            raise SystemExit(f"Raster {slope_path} has CRS {src.crs}, expected EPSG:{crs}")
        arr = src.read(1)
        inv = ~src.transform
        h, w = arr.shape
        for geom, attrs in zip(lines.geometry, lines.drop(columns="geometry").to_dict("records")):
            n = max(int(geom.length // step), 1)
            dists = np.linspace(0, geom.length, n + 1)
            pts = shapely.line_interpolate_point(geom, dists)
            cols, rows = inv * (shapely.get_x(pts), shapely.get_y(pts))
            cols, rows = cols.astype(int), rows.astype(int)
            inside = (rows >= 0) & (rows < h) & (cols >= 0) & (cols < w)
            vals = np.full(len(dists), np.nan)
            vals[inside] = arr[rows[inside], cols[inside]]
            ok = vals <= max_deg  # NaN -> False
            i = 0
            while i < len(dists):
                if not ok[i]:
                    i += 1
                    continue
                j = i
                while j + 1 < len(dists) and ok[j + 1]:
                    j += 1
                if j > i:
                    seg = shapely.ops.substring(geom, dists[i], dists[j])
                    out.append({**attrs, "geometry": seg,
                                "slope_max": float(np.nanmax(vals[i:j + 1]))})
                i = j + 1
    if not out:
        return lines.iloc[0:0].copy()
    return gpd.GeoDataFrame(out, crs=lines.crs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True, choices=REGIONS)
    ap.add_argument("--types", default=None, help="e.g. power_line,stream (default: all)")
    ap.add_argument("--max-slope", type=float, default=15.0)
    a = ap.parse_args()

    cfg = REGIONS[a.region]
    crs = cfg["crs"]
    d = region_dir(a.region)
    files = sorted(d.glob("candidates_*.geojson"))
    if a.types:
        want = set(a.types.split(","))
        files = [f for f in files if f.stem.replace("candidates_", "") in want]
    if not files:
        raise SystemExit(f"No candidates_*.geojson in {d}")

    c = gpd.GeoDataFrame(pd.concat([gpd.read_file(f).to_crs(crs) for f in files],
                                   ignore_index=True), crs=crs)
    log(f"{a.region}: {len(c)} candidates / {c.length.sum() / 1000:.0f} km")

    c = cut_out(c, load(layer(a.region, "excl_areas"), crs, ["Polygon", "MultiPolygon"]))

    bld = load_near(buildings(a.region), crs, c, BUILD_BUF_M)
    bld["geometry"] = bld.geometry.buffer(BUILD_BUF_M)
    c = cut_out(c, bld)

    bar = load(layer(a.region, "barriers"), crs, ["LineString", "MultiLineString"])
    bar["geometry"] = bar.geometry.buffer(3)
    c = cut_out(c, bar)
    log(f"after exclusions: {len(c)} / {c.length.sum() / 1000:.0f} km")

    c = c.explode(index_parts=False)
    c = c[c.geometry.type == "LineString"].reset_index(drop=True)

    c = slope_filter(c, cfg["slope"], crs, a.max_slope, STEP_M)
    log(f"after slope filter (<= {a.max_slope} deg): {len(c)} / {c.length.sum() / 1000:.0f} km")

    c = c[c.length >= MIN_LEN_M].copy()

    for t, g in c.groupby("off-trail:type"):
        out = d / f"filtered_{t}.geojson"
        g.to_crs(4326).to_file(out, driver="GeoJSON")
        log(f"saved {out}: {len(g)} segments, {g.length.sum() / 1000:.0f} km")


if __name__ == "__main__":
    main()