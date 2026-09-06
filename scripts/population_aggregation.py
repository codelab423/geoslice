"""
Pure numpy aggregation logic for gridded population rasters, kept separate
from build_population.py (which needs rasterio + a real WorldPop download) so
it can be unit tested with small synthetic arrays -- see test_population_aggregation.py.

The core guarantee this module must uphold: aggregation NEVER loses population
mass. Summing a block of source pixels into one output point is exact (no
resampling, no interpolation), so total population before/after aggregation
matches to floating-point tolerance.
"""
from dataclasses import dataclass

import numpy as np


@dataclass
class AggregationResult:
    lons: np.ndarray
    lats: np.ndarray
    populations: np.ndarray
    total_population: float
    cell_count: int


def choose_block_size(populated_pixel_count: int, target_points: int) -> int:
    """Pick a block (aggregation window) size in pixels so the resulting
    non-empty aggregated cell count lands near target_points."""
    if populated_pixel_count <= target_points:
        return 1
    return max(1, int(round((populated_pixel_count / target_points) ** 0.5)))


def target_point_count(populated_pixel_count: int) -> int:
    """5,000-40,000 output points depending on how many populated source
    pixels the country has (larger/denser countries get more points)."""
    return int(np.clip(populated_pixel_count / 40, 5_000, 40_000))


def aggregate_grid(
    pop_array: np.ndarray,
    lon_origin: float,
    lat_origin: float,
    pixel_width: float,
    pixel_height: float,  # signed; negative for north-up rasters
    block_size: int,
) -> AggregationResult:
    """
    pop_array: 2D array [row, col] of non-negative population values, with 0
    meaning "no population / outside country / nodata" (caller's responsibility
    to have zeroed those out already).
    lon_origin/lat_origin: geographic coordinate of the array's [0, 0] pixel's
    top-left corner (standard raster affine convention).
    """
    h, w = pop_array.shape
    pad_h = (-h) % block_size
    pad_w = (-w) % block_size
    if pad_h or pad_w:
        pop_array = np.pad(pop_array, ((0, pad_h), (0, pad_w)), constant_values=0)
    hp, wp = pop_array.shape
    hb, wb = hp // block_size, wp // block_size

    block_sums = pop_array.reshape(hb, block_size, wb, block_size).sum(axis=(1, 3))

    # Geometric center of each block (per spec: "use the center coordinate of
    # the aggregate cell", not a population-weighted centroid).
    col_centers = (np.arange(wb) * block_size + block_size / 2.0) * pixel_width + lon_origin
    row_centers = (np.arange(hb) * block_size + block_size / 2.0) * pixel_height + lat_origin
    lon_grid, lat_grid = np.meshgrid(col_centers, row_centers)

    nonzero = block_sums > 0
    lons = lon_grid[nonzero].astype(np.float32)
    lats = lat_grid[nonzero].astype(np.float32)
    pops = block_sums[nonzero].astype(np.float32)

    return AggregationResult(
        lons=lons,
        lats=lats,
        populations=pops,
        total_population=float(block_sums.sum()),
        cell_count=int(nonzero.sum()),
    )
