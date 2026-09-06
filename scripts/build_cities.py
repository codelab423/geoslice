#!/usr/bin/env python3
"""
Build per-country major-city label data from Natural Earth's public-domain
"populated places" dataset (10m resolution -- the most detailed one, so
smaller/less-famous capitals still show up).

These are DECORATIVE LABELS ONLY. City population (POP_MAX) is used purely
to rank which cities are "major" enough to show and is never fed into the
PopulationSplitEngine -- the actual score always comes from the WorldPop
gridded population data (see build_population.py). This mirrors the design
spec's section 14 ("Cities... visual labels only").

Usage:
    python scripts/build_cities.py NLD
    python scripts/build_cities.py --all
"""
import argparse
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from country_list import ISO3_LIST  # noqa: E402

NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson"
CACHE_PATH = Path(__file__).parent.parent / "data-cache" / "ne_10m_populated_places.geojson"
OUT_DIR = Path(__file__).parent.parent / "public" / "cities"

# How many labeled cities to ship per country. Kept deliberately small so the
# map stays readable ("not too flashy") -- a handful of the biggest cities,
# not every town Natural Earth happens to know about.
CITIES_PER_COUNTRY = 10


def load_dataset() -> dict:
    if CACHE_PATH.exists():
        print(f"Using cached {CACHE_PATH}")
        return json.loads(CACHE_PATH.read_text())
    print(f"Downloading {NE_URL}")
    resp = requests.get(NE_URL, timeout=120)
    resp.raise_for_status()
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(resp.text)
    return resp.json()


def build_country(iso3: str, dataset: dict) -> None:
    candidates = []
    for feature in dataset["features"]:
        props = feature["properties"]
        if props.get("ADM0_A3") != iso3:
            continue
        name = props.get("NAME_EN") or props.get("NAME")
        pop = props.get("POP_MAX") or 0
        lon, lat = feature["geometry"]["coordinates"][:2]
        if not name:
            continue
        candidates.append({"name": name, "lon": round(lon, 5), "lat": round(lat, 5), "population": int(pop)})

    candidates.sort(key=lambda c: c["population"], reverse=True)
    top = candidates[:CITIES_PER_COUNTRY]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{iso3}.json"
    with open(out_path, "w") as f:
        json.dump(top, f)
    names = ", ".join(c["name"] for c in top[:5])
    print(f"{iso3}: {len(top)} cities ({names}{'...' if len(top) > 5 else ''}) -> {out_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("iso3_codes", nargs="*")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    codes = ISO3_LIST if args.all else [c.upper() for c in args.iso3_codes]
    if not codes:
        parser.error("Provide ISO3 codes or --all")

    dataset = load_dataset()
    for iso3 in codes:
        build_country(iso3, dataset)


if __name__ == "__main__":
    main()
