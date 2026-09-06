"""
Smoke test for the rasterio clip/mask path in build_population.py, using a
synthetic in-memory GeoTIFF instead of a real WorldPop download (WorldPop's
servers are unreachable from some restricted-egress environments -- this test
exercises everything else: boundary loading, rio_mask, nodata cleanup and
aggregation, against a real country boundary).

Run with: python -m pytest scripts/test_build_population_smoke.py -v
"""
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.mask import mask as rio_mask
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).parent))
from build_population import load_boundary_geometry  # noqa: E402
from population_aggregation import aggregate_grid, choose_block_size, target_point_count  # noqa: E402

REPO_ROOT = Path(__file__).parent.parent


def _make_synthetic_raster(tmp_path, bounds, resolution_deg=0.01, seed=42):
    """A raster covering `bounds` (west, south, east, north) with random
    population values, standing in for a real WorldPop GeoTIFF."""
    west, south, east, north = bounds
    width = max(10, int((east - west) / resolution_deg))
    height = max(10, int((north - south) / resolution_deg))
    rng = np.random.default_rng(seed)
    data = rng.random((height, width)).astype(np.float32) * 500

    transform = from_origin(west, north, resolution_deg, resolution_deg)
    path = tmp_path / "synthetic.tif"
    with rasterio.open(
        path, "w", driver="GTiff", height=height, width=width, count=1,
        dtype=data.dtype, crs="EPSG:4326", transform=transform, nodata=-99999,
    ) as dst:
        dst.write(data, 1)
    return path, float(data.sum())


def test_clip_mask_and_aggregate_against_real_nld_boundary(tmp_path):
    boundary_path = REPO_ROOT / "public" / "countries" / "NLD.geojson"
    if not boundary_path.exists():
        import pytest
        pytest.skip("NLD.geojson not present -- run fetch_boundaries.py first")

    geometry = load_boundary_geometry("NLD")
    raster_path, _ = _make_synthetic_raster(tmp_path, geometry.bounds)

    with rasterio.open(raster_path) as src:
        total_source_cells = src.width * src.height
        out_image, out_transform = rio_mask(src, [geometry], crop=True, nodata=0, filled=True)
        arr = out_image[0].astype(np.float64)
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
        arr[arr < 0] = 0.0

    populated = int(np.count_nonzero(arr > 0))
    assert populated > 0, "clipping against the real NLD boundary should keep some pixels"
    assert populated < total_source_cells, "clipping should drop pixels outside the country"

    total_before = float(arr.sum())
    target_points = target_point_count(populated)
    block_size = choose_block_size(populated, target_points)
    result = aggregate_grid(
        arr, out_transform.c, out_transform.f, out_transform.a, out_transform.e, block_size
    )

    diff_pct = abs(result.total_population - total_before) / total_before * 100
    assert diff_pct < 0.01, f"lost {diff_pct}% of population mass during aggregation"
    assert result.cell_count > 0
    assert np.all(result.populations >= 0)
    assert not np.any(np.isnan(result.populations))

    # Every aggregated point should fall roughly within the Netherlands' bbox.
    minx, miny, maxx, maxy = geometry.bounds
    pad = 0.5
    assert result.lons.min() >= minx - pad
    assert result.lons.max() <= maxx + pad
    assert result.lats.min() >= miny - pad
    assert result.lats.max() <= maxy + pad
