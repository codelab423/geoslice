#!/usr/bin/env python3
"""
Build real gridded population data for the game, from WorldPop.

For every country this:
  1. loads the boundary saved by fetch_boundaries.py (public/countries/{ISO3}.geojson)
  2. downloads (and caches in data-cache/) the WorldPop 2020 UN-adjusted 1km
     gridded population GeoTIFF for that country
  3. clips the raster to the country boundary
  4. removes NoData / negative cells
  5. aggregates populated pixels to a coarser grid (5,000-40,000 points,
     mass-preserving -- see population_aggregation.py) for browser performance
  6. writes public/population/{ISO3}.json

Data source: WorldPop (www.worldpop.org), Global 2000-2020, 1km resolution,
UN-adjusted mosaics, year 2020 -- used consistently for every country so
results are never mixed across dataset years.

IMPORTANT -- network requirement:
  data.worldpop.org must be reachable from wherever this script runs. It is
  intentionally blocked in some sandboxed / restricted-egress environments
  (including the one this repo was originally built in -- see README "Data
  pipeline" section). This is why the GitHub Actions workflow
  (.github/workflows/build-data.yml) runs this script on a normal GitHub-hosted
  runner rather than relying on it having been run ahead of time.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/build_population.py NLD
    python scripts/build_population.py --all
    python scripts/build_population.py --milestone1
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import requests

sys.path.insert(0, str(Path(__file__).parent))
from country_list import ISO3_LIST, MILESTONE_1  # noqa: E402
from population_aggregation import (  # noqa: E402
    aggregate_grid,
    choose_block_size,
    target_point_count,
)

DATASET_YEAR = 2020
WORLDPOP_URL_TEMPLATE = (
    "https://data.worldpop.org/GIS/Population/Global_2000_2020_1km_UNadj/"
    "{year}/{iso3}/{iso3_lower}_ppp_{year}_1km_Aggregated_UNadj.tif"
)

REPO_ROOT = Path(__file__).parent.parent
BOUNDARIES_DIR = REPO_ROOT / "public" / "countries"
OUT_DIR = REPO_ROOT / "public" / "population"
CACHE_DIR = REPO_ROOT / "data-cache"


def fmt(n):
    return f"{n:,.0f}" if abs(n) >= 1 else f"{n:.6f}"


def download_raster(iso3: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{iso3}_ppp_{DATASET_YEAR}_1km_Aggregated_UNadj.tif"
    if cache_path.exists():
        print(f"  Using cached raster: {cache_path}")
        return cache_path

    url = WORLDPOP_URL_TEMPLATE.format(year=DATASET_YEAR, iso3=iso3, iso3_lower=iso3.lower())
    print(f"  Downloading {url}")
    resp = requests.get(url, stream=True, timeout=300)
    resp.raise_for_status()
    tmp_path = cache_path.with_suffix(".tif.partial")
    total = 0
    with open(tmp_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            f.write(chunk)
            total += len(chunk)
    tmp_path.rename(cache_path)
    print(f"  Downloaded {fmt(total)} bytes")
    return cache_path


def load_boundary_geometry(iso3: str):
    from shapely.geometry import shape

    boundary_path = BOUNDARIES_DIR / f"{iso3}.geojson"
    if not boundary_path.exists():
        raise FileNotFoundError(
            f"Missing {boundary_path}. Run fetch_boundaries.py for {iso3} first."
        )
    with open(boundary_path) as f:
        fc = json.load(f)
    return shape(fc["features"][0]["geometry"])


def build_country(iso3: str) -> None:
    import rasterio
    from rasterio.mask import mask as rio_mask

    print(f"Building {iso3}...")
    geometry = load_boundary_geometry(iso3)
    print("  Boundary loaded")

    raster_path = download_raster(iso3)

    with rasterio.open(raster_path) as src:
        total_source_cells = src.width * src.height
        print(f"  Raster loaded: {fmt(total_source_cells)} cells ({src.width}x{src.height})")

        out_image, out_transform = rio_mask(
            src, [geometry], crop=True, nodata=0, filled=True
        )
        arr = out_image[0].astype(np.float64)

        # Defensive cleanup: WorldPop's own nodata sentinel (commonly -99999)
        # and any stray negative/NaN values all mean "no population data" here.
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
        arr[arr < 0] = 0.0

        populated_pixel_count = int(np.count_nonzero(arr > 0))
        total_before = float(arr.sum())
        print(f"  Cells inside country: {fmt(populated_pixel_count)}")
        print(f"  Population before aggregation: {fmt(total_before)}")

        target_points = target_point_count(populated_pixel_count)
        block_size = choose_block_size(populated_pixel_count, target_points)

        lon_origin = out_transform.c
        lat_origin = out_transform.f
        pixel_width = out_transform.a
        pixel_height = out_transform.e  # negative for north-up rasters

        result = aggregate_grid(
            arr, lon_origin, lat_origin, pixel_width, pixel_height, block_size
        )

    print(f"  Aggregated cells: {fmt(result.cell_count)}")
    print(f"  Population after aggregation: {fmt(result.total_population)}")
    diff_pct = (
        abs(result.total_population - total_before) / total_before * 100
        if total_before > 0
        else 0.0
    )
    print(f"  Difference: {diff_pct:.6f}%")
    if diff_pct > 0.01:
        raise AssertionError(
            f"{iso3}: aggregation lost {diff_pct:.4f}% of population mass (tolerance 0.01%)"
        )
    if result.cell_count == 0:
        raise AssertionError(f"{iso3}: aggregation produced zero populated cells")

    points = [
        [round(float(lon), 5), round(float(lat), 5), round(float(pop), 2)]
        for lon, lat, pop in zip(result.lons, result.lats, result.populations)
    ]
    out_data = {
        "iso3": iso3,
        "source": "worldpop",
        "datasetYear": DATASET_YEAR,
        "totalPopulation": round(result.total_population, 2),
        "cellCount": result.cell_count,
        "points": points,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{iso3}.json"
    with open(out_path, "w") as f:
        json.dump(out_data, f)
    print(f"  Saved {out_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("iso3_codes", nargs="*")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--milestone1", action="store_true")
    args = parser.parse_args()

    if args.all:
        codes = ISO3_LIST
    elif args.milestone1:
        codes = MILESTONE_1
    elif args.iso3_codes:
        codes = [c.upper() for c in args.iso3_codes]
    else:
        parser.error("Provide ISO3 codes, or --all, or --milestone1")

    failures = []
    start = time.time()
    for iso3 in codes:
        try:
            build_country(iso3)
        except Exception as e:
            print(f"  FAILED {iso3}: {e}", file=sys.stderr)
            failures.append(iso3)
        print()

    elapsed = time.time() - start
    print(f"Done in {elapsed:.1f}s. {len(codes) - len(failures)}/{len(codes)} succeeded.")
    if failures:
        print(f"Failed: {failures}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
