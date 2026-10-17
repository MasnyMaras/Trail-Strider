#!/usr/bin/env python3
#Mapa nachyleń z Copernicus GLO-30.


#       python utils/slope.py --region malopolskie --dem-dir data/dem --out data/slope_malopolskie.tif

import argparse
import glob
import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.warp import calculate_default_transform, reproject, Resampling


REGIONS = {
    "malopolskie": {"bbox": (18.95, 49.05, 21.45, 50.55), "epsg": 2180},
    "pomorskie":   {"bbox": (16.65, 53.40, 19.75, 54.90), "epsg": 2180},
    "maramures":   {"bbox": (22.90, 47.30, 25.30, 48.05), "epsg": 3844},
}


def horn_slope_deg(z, res):
    # Slope map Horn metod. z and res in meters.
    p = np.pad(z, 1, mode="edge")
    a, b, c = p[:-2, :-2], p[:-2, 1:-1], p[:-2, 2:]
    d, f = p[1:-1, :-2], p[1:-1, 2:]
    g, h, i = p[2:, :-2], p[2:, 1:-1], p[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * res)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * res)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy))).astype("float32")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True, choices=REGIONS)
    ap.add_argument("--dem-dir", default="data/dem")
    ap.add_argument("--out", required=True)
    ap.add_argument("--res", type=float, default=30.0)
    ap.add_argument("--buffer", type=float, default=0.02)
    args = ap.parse_args()

    cfg = REGIONS[args.region]
    w, s, e, n = cfg["bbox"]
    bounds = (w - args.buffer, s - args.buffer, e + args.buffer, n + args.buffer)

    files = sorted(glob.glob(f"{args.dem_dir}/*.tif"))
    if not files:
        raise SystemExit(f"no data in {args.dem_dir}")
    srcs = [rasterio.open(f) for f in files]

    # mozaic from downloaded data
    mosaic, transform = merge(srcs, bounds=bounds, nodata=-9999)
    src_crs = srcs[0].crs
    for sr in srcs:
        sr.close()
    print("Mozaic:", mosaic.shape)

    # ----------------------------------------------------------------
    dst_crs = f"EPSG:{cfg['epsg']}"
    height, width = mosaic.shape[1:]
    dst_transform, dst_w, dst_h = calculate_default_transform(
        src_crs, dst_crs, width, height, *bounds, resolution=args.res
    )
    dem = np.full((dst_h, dst_w), np.nan, dtype="float32")
    reproject(
        source=mosaic[0].astype("float32"),
        destination=dem,
        src_transform=transform, src_crs=src_crs, src_nodata=-9999,
        dst_transform=dst_transform, dst_crs=dst_crs, dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )

    # Slope:
    slope = horn_slope_deg(dem, args.res)
    slope[np.isnan(dem)] = np.nan

    # Save data:
    with rasterio.open(
        args.out, "w", driver="GTiff", height=dst_h, width=dst_w, count=1,
        dtype="float32", crs=dst_crs, transform=dst_transform,
        nodata=np.nan, compress="deflate", tiled=True,
    ) as dst:
        dst.write(slope, 1)

    valid = slope[~np.isnan(slope)]
    print(f"Saved: {args.out}: {dst_w}x{dst_h}, "
          f"min={valid.min():.1f}° median={np.median(valid):.1f}° max={valid.max():.1f}°")
    print(f" >15°: {(valid > 15).mean():.1%}, >20°: {(valid > 20).mean():.1%}, "
          f"<5°: {(valid < 5).mean():.1%}")


if __name__ == "__main__":
    main()