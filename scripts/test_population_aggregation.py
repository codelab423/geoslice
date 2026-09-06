"""
Run with: python -m pytest scripts/test_population_aggregation.py -v
(pytest is in scripts/requirements.txt)
"""
import numpy as np

from population_aggregation import (
    aggregate_grid,
    choose_block_size,
    target_point_count,
)


def test_mass_is_preserved_exactly_with_block_size_1():
    arr = np.random.rand(37, 41).astype(np.float32) * 100
    result = aggregate_grid(arr, lon_origin=0.0, lat_origin=10.0, pixel_width=0.01,
                             pixel_height=-0.01, block_size=1)
    assert abs(result.total_population - float(arr.sum())) / float(arr.sum()) < 1e-5


def test_mass_is_preserved_with_larger_blocks_and_padding():
    # Deliberately not divisible by block size, to exercise the padding path.
    arr = np.random.rand(53, 47).astype(np.float32) * 1000
    total_before = float(arr.sum())
    for block_size in (2, 3, 5, 7):
        result = aggregate_grid(arr, lon_origin=5.0, lat_origin=52.0, pixel_width=0.008,
                                 pixel_height=-0.008, block_size=block_size)
        diff_pct = abs(result.total_population - total_before) / total_before * 100
        assert diff_pct < 1e-3, f"block_size={block_size} lost {diff_pct}% of population"


def test_empty_cells_are_dropped_not_zero_padded():
    arr = np.zeros((10, 10), dtype=np.float32)
    arr[3, 3] = 500.0
    arr[7, 8] = 250.0
    result = aggregate_grid(arr, 0.0, 0.0, 1.0, -1.0, block_size=1)
    assert result.cell_count == 2
    assert result.total_population == 750.0
    assert all(p > 0 for p in result.populations)


def test_no_negative_or_nan_population_in_output():
    arr = np.random.rand(20, 20).astype(np.float32) * 50
    result = aggregate_grid(arr, 0.0, 0.0, 0.05, -0.05, block_size=3)
    assert np.all(result.populations >= 0)
    assert not np.any(np.isnan(result.populations))
    assert not np.any(np.isnan(result.lons))
    assert not np.any(np.isnan(result.lats))


def test_block_center_coordinates_fall_within_expected_bounds():
    h, w = 20, 30
    lon_origin, lat_origin = 4.0, 53.0
    pixel_width, pixel_height = 0.01, -0.01
    arr = np.ones((h, w), dtype=np.float32)
    result = aggregate_grid(arr, lon_origin, lat_origin, pixel_width, pixel_height, block_size=4)
    assert result.lons.min() >= lon_origin
    assert result.lons.max() <= lon_origin + w * pixel_width
    assert result.lats.max() <= lat_origin
    assert result.lats.min() >= lat_origin + h * pixel_height  # pixel_height negative


def test_choose_block_size_targets_requested_point_count_roughly():
    populated = 4_000_000
    target = target_point_count(populated)
    block = choose_block_size(populated, target)
    assert block >= 1
    approx_output_cells = populated / (block ** 2)
    # within an order of magnitude of the target -- this is a heuristic, not exact
    assert 0.2 * target <= approx_output_cells <= 5 * target


def test_target_point_count_is_clamped_to_spec_range():
    assert target_point_count(1) == 5_000
    assert target_point_count(100_000_000) == 40_000
