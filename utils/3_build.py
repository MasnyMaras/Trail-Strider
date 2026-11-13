#!/usr/bin/env python3
"""Stage 3: merge types, snap to roads, merge with the base pbf, renumber, build rd5.

python utils/3_build.py --country poland
python utils/3_build.py --country romania
python utils/3_build.py --country poland,romania --out-dir segments_all
"""
import argparse
import subprocess
import sys
from pathlib import Path

import pandas as pd
import geopandas as gpd

from common import REGIONS, BASE, DATA, HIGHWAYS, TYPE_ORDER, region_dir, osm_dir, run, log

UTILS = Path(__file__).parent
MIN_LEN_M = 50
OVERLAP_BUF_M = 3


def merge_types(region):
    """Merge a region's filtered_*.geojson; on overlap the lower tier wins, then TYPE_ORDER."""
    d = region_dir(region)
    files = sorted(d.glob("filtered_*.geojson"))
    if not files:
        raise SystemExit(f"No filtered_*.geojson in {d} (run stage 2)")
    crs = REGIONS[region]["crs"]
    c = gpd.GeoDataFrame(pd.concat([gpd.read_file(f).to_crs(crs) for f in files],
                                   ignore_index=True), crs=crs)
    order = c["off-trail:type"].map(lambda t: TYPE_ORDER.index(t) if t in TYPE_ORDER else len(TYPE_ORDER))
    c["prio"] = c["off-trail:tier"].astype(int) * 100 + order

    out, done = [], None
    for p in sorted(c.prio.unique()):
        cur = c[c.prio == p]
        if done is not None and len(done):
            buf = gpd.GeoDataFrame(geometry=done.geometry.buffer(OVERLAP_BUF_M), crs=crs)
            cur = gpd.overlay(cur, buf, how="difference", keep_geom_type=True)
        cur = cur.explode(index_parts=False)
        cur = cur[(cur.geometry.type == "LineString") & (cur.length >= MIN_LEN_M)]
        out.append(cur)
        done = gpd.GeoDataFrame(pd.concat(out, ignore_index=True), crs=crs)

    res = done.drop(columns=["prio"])
    path = d / "paths_final.geojson"
    res.to_crs(4326).to_file(path, driver="GeoJSON")
    log(f"{region}: {len(res)} paths / {res.length.sum() / 1000:.0f} km")
    return path


def roads_for(region, base, paths):
    """Roads from the base pbf within the bbox of the region's paths."""
    out = osm_dir(region) / "roads.osm.pbf"
    if out.exists():
        return out
    x0, y0, x1, y1 = gpd.read_file(paths).total_bounds
    bbox = f"{x0 - 0.05},{y0 - 0.05},{x1 + 0.05},{y1 + 0.05}"
    tmp = osm_dir(region) / "roads_bbox.osm.pbf"
    run(["osmium", "extract", "-b", bbox, "--strategy", "complete_ways", base, "-o", tmp, "--overwrite"])
    run(["osmium", "tags-filter", tmp, HIGHWAYS, "-o", out, "--overwrite"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", required=True, help="poland, romania or poland,romania")
    ap.add_argument("--out-dir", default=None)
    ap.add_argument("--no-rd5", action="store_true", help="stop after the pbf")
    a = ap.parse_args()

    countries = a.country.split(",")
    name = "_".join(countries)
    work = DATA / "build" / name
    work.mkdir(parents=True, exist_ok=True)
    out_dir = a.out_dir or f"segments_{name}"
    regions = [r for r, cfg in REGIONS.items() if cfg["country"] in countries]

    if len(countries) == 1:
        base = BASE[countries[0]]
    else:
        base = work / "base.osm.pbf"
        run(["osmium", "merge", *[BASE[c] for c in countries], "-o", base, "--overwrite"])

    oscs = []
    for i, r in enumerate(regions):
        paths = merge_types(r)
        roads = roads_for(r, base, paths)
        osc = work / f"{r}.osc"
        # per-region ID offsets keep negative IDs unique across regions
        run([sys.executable, UTILS / "snap_and_export_b.py", "--inp", paths, "--roads", roads,
             "--out", osc, "--crs", REGIONS[r]["crs"],
             "--node-offset", i * 10_000_000, "--way-offset", i * 1_000_000])
        oscs.append(osc)

    # keep negative node ID as source of truth
    wild = work / "wild.osm.pbf"
    run(["osmium", "apply-changes", base, *oscs, "-o", wild, "--overwrite"])
    subprocess.run(["osmium", "check-refs", str(wild)], check=False)
    chk = work / "check.osm.pbf"
    run(["osmium", "tags-filter", wild, "w/off-trail=yes", "-o", chk, "--overwrite"])
    log("off-trail ways in pbf:")
    subprocess.run(["osmium", "fileinfo", "-e", "-g", "data.count.ways", str(chk)], check=False)

    if a.no_rd5:
        return

    rd5 = work / "wild_rd5.osm.pbf"
    run(["osmium", "renumber", wild, "-o", rd5, "--overwrite"])
    run(["bash", UTILS / "build_rd5.sh", rd5, out_dir])


if __name__ == "__main__":
    main()