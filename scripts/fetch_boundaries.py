#!/usr/bin/env python3
"""
Fetch real ADM0 country boundaries from geoBoundaries and save normalized
GeoJSON under public/countries/{ISO3}.geojson.

geoBoundaries publishes its files through Git LFS on GitHub. The plain
`raw.githubusercontent.com` host only returns the LFS *pointer* file, so we
fetch from `media.githubusercontent.com` (GitHub's LFS media CDN) instead --
this is geoBoundaries' own official distribution channel, just accessed
directly rather than via their metadata API.

Usage:
    python scripts/fetch_boundaries.py NLD
    python scripts/fetch_boundaries.py --all
    python scripts/fetch_boundaries.py --milestone1
"""
import argparse
import json
import math
import sys
from pathlib import Path

import requests
from shapely.geometry import shape, mapping
from shapely.ops import transform

sys.path.insert(0, str(Path(__file__).parent))
from country_list import ISO3_LIST, TERRITORY_EXTENT, MILESTONE_1  # noqa: E402

GEOBOUNDARIES_MEDIA_URL = (
    "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/"
    "releaseData/gbOpen/{iso3}/ADM0/geoBoundaries-{iso3}-ADM0_simplified.geojson"
)
# Fallback for the rare country where geoBoundaries only ships the unsimplified file.
GEOBOUNDARIES_MEDIA_URL_FALLBACK = (
    "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/"
    "releaseData/gbOpen/{iso3}/ADM0/geoBoundaries-{iso3}-ADM0.geojson"
)

OUT_DIR = Path(__file__).parent.parent / "public" / "countries"
EARTH_RADIUS_KM = 6371.0
METROPOLITAN_THRESHOLD_KM = 1000.0
# Target ceiling for a single country's GeoJSON, so even sprawling
# archipelago/Arctic countries (Canada, Indonesia, Norway...) stay smooth to
# load and render in the browser. Geometry is only simplified, never replaced
# with a bounding box -- islands/enclaves/MultiPolygons are preserved.
MAX_GEOJSON_BYTES = 350_000


def simplify_to_target_size(geom, feature_builder, max_bytes=MAX_GEOJSON_BYTES):
    size = len(json.dumps(feature_builder(geom)))
    if size <= max_bytes:
        return geom, size
    tolerance = 0.0005
    best_geom, best_size = geom, size
    for _ in range(20):
        candidate = geom.simplify(tolerance, preserve_topology=True)
        if candidate.is_empty:
            break
        candidate_size = len(json.dumps(feature_builder(candidate)))
        best_geom, best_size = candidate, candidate_size
        if candidate_size <= max_bytes:
            break
        tolerance *= 1.6
    return best_geom, best_size


def haversine_km(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def filter_to_metropolitan(geom):
    """
    Drop polygon parts whose centroid is far (> METROPOLITAN_THRESHOLD_KM) from
    the centroid of the largest (by area) part. Used for countries whose
    sovereign territory includes distant overseas regions (French Guiana,
    Alaska/Hawaii, Greenland, Canary Islands, Andaman Islands, etc.) which
    would otherwise blow out the map's bounding box. See country_list.py.
    """
    if geom.geom_type == "Polygon":
        return geom
    if geom.geom_type != "MultiPolygon":
        return geom

    parts = list(geom.geoms)
    parts.sort(key=lambda g: g.area, reverse=True)
    main = parts[0]
    main_centroid = main.centroid

    kept = [main]
    for part in parts[1:]:
        c = part.centroid
        dist = haversine_km(main_centroid.x, main_centroid.y, c.x, c.y)
        if dist <= METROPOLITAN_THRESHOLD_KM:
            kept.append(part)

    if len(kept) == 1:
        return kept[0]
    from shapely.geometry import MultiPolygon
    return MultiPolygon(kept)


def fetch_one(iso3: str) -> dict:
    for url_template in (GEOBOUNDARIES_MEDIA_URL, GEOBOUNDARIES_MEDIA_URL_FALLBACK):
        url = url_template.format(iso3=iso3)
        resp = requests.get(url, timeout=60)
        if resp.status_code == 200 and resp.content[:20].lstrip().startswith(b"{"):
            return resp.json()
    raise RuntimeError(f"Could not fetch boundary for {iso3} (tried simplified + full)")


def process_country(iso3: str) -> None:
    print(f"Fetching boundary for {iso3}...")
    fc = fetch_one(iso3)

    if fc.get("type") != "FeatureCollection" or not fc.get("features"):
        raise ValueError(f"{iso3}: unexpected GeoJSON shape from geoBoundaries")

    # geoBoundaries ADM0 files normally contain exactly one feature for the
    # whole country (possibly a MultiPolygon with islands/enclaves).
    geoms = [shape(f["geometry"]) for f in fc["features"]]
    from shapely.ops import unary_union
    geom = unary_union(geoms)

    extent = TERRITORY_EXTENT.get(iso3, "full")
    if extent == "metropolitan":
        before_parts = len(geom.geoms) if geom.geom_type == "MultiPolygon" else 1
        geom = filter_to_metropolitan(geom)
        after_parts = len(geom.geoms) if geom.geom_type == "MultiPolygon" else 1
        if after_parts != before_parts:
            print(f"  {iso3}: metropolitan filter kept {after_parts}/{before_parts} polygon parts")

    bounds = geom.bounds  # (minx, miny, maxx, maxy) == (west, south, east, north)

    def build_feature(g):
        return {
            "type": "Feature",
            "properties": {"iso3": iso3, "source": "geoBoundaries", "territoryExtent": extent},
            "geometry": mapping(g),
        }

    simplified_geom, _ = simplify_to_target_size(geom, build_feature)
    if simplified_geom is not geom:
        before_pts = sum(len(p.exterior.coords) for p in _polygons(geom))
        after_pts = sum(len(p.exterior.coords) for p in _polygons(simplified_geom))
        print(f"  {iso3}: simplified {before_pts} -> {after_pts} boundary vertices")
    geom = simplified_geom

    out_feature = build_feature(geom)
    out_fc = {
        "type": "FeatureCollection",
        "bbox": list(bounds),
        "features": [out_feature],
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{iso3}.geojson"
    with open(out_path, "w") as f:
        json.dump(out_fc, f)

    size_kb = out_path.stat().st_size / 1024
    print(f"  Saved {out_path} ({size_kb:.1f} KB, bbox={[round(b, 2) for b in bounds]})")


def _polygons(geom):
    return list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("iso3_codes", nargs="*", help="ISO3 codes to fetch")
    parser.add_argument("--all", action="store_true", help="Fetch all supported countries")
    parser.add_argument("--milestone1", action="store_true", help="Fetch only the 5 milestone countries")
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
    for iso3 in codes:
        try:
            process_country(iso3)
        except Exception as e:
            print(f"  FAILED {iso3}: {e}", file=sys.stderr)
            failures.append(iso3)

    print(f"\nDone. {len(codes) - len(failures)}/{len(codes)} succeeded.")
    if failures:
        print(f"Failed: {failures}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
