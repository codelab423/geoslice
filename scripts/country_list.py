"""
Shared country list for the data-preprocessing scripts.

This mirrors src/data/countries.ts (the app's single source of truth for game
metadata). Kept as a plain Python list here because the boundary/population
build scripts don't need a TypeScript toolchain to run. If you add a country
to src/data/countries.ts, add it here too.

territory_extent:
  "full"          -> ship the geoBoundaries ADM0 geometry as-is.
  "metropolitan"  -> drop polygon parts far from the main landmass (overseas
                     territories, distant island claims, etc.) so the map
                     doesn't zoom out to a ridiculous extent. See
                     filter_to_metropolitan() in fetch_boundaries.py.
"""

COUNTRIES = [
    {"iso3": "NLD", "territory_extent": "full"},
    {"iso3": "BEL", "territory_extent": "full"},
    {"iso3": "DEU", "territory_extent": "full"},
    {"iso3": "FRA", "territory_extent": "metropolitan"},
    {"iso3": "GBR", "territory_extent": "full"},
    {"iso3": "ESP", "territory_extent": "metropolitan"},
    {"iso3": "PRT", "territory_extent": "metropolitan"},
    {"iso3": "ITA", "territory_extent": "full"},
    {"iso3": "CHE", "territory_extent": "full"},
    {"iso3": "AUT", "territory_extent": "full"},
    {"iso3": "POL", "territory_extent": "full"},
    {"iso3": "CZE", "territory_extent": "full"},
    {"iso3": "DNK", "territory_extent": "metropolitan"},
    {"iso3": "SWE", "territory_extent": "full"},
    {"iso3": "NOR", "territory_extent": "metropolitan"},
    {"iso3": "FIN", "territory_extent": "full"},
    {"iso3": "BIH", "territory_extent": "full"},
    {"iso3": "HRV", "territory_extent": "full"},
    {"iso3": "SRB", "territory_extent": "full"},
    {"iso3": "TUR", "territory_extent": "full"},
    {"iso3": "GRC", "territory_extent": "full"},
    {"iso3": "USA", "territory_extent": "metropolitan"},
    {"iso3": "CAN", "territory_extent": "full"},
    {"iso3": "MEX", "territory_extent": "full"},
    {"iso3": "BRA", "territory_extent": "full"},
    {"iso3": "ARG", "territory_extent": "metropolitan"},
    {"iso3": "JPN", "territory_extent": "full"},
    {"iso3": "KOR", "territory_extent": "full"},
    {"iso3": "IND", "territory_extent": "metropolitan"},
    {"iso3": "CHN", "territory_extent": "metropolitan"},
    {"iso3": "IDN", "territory_extent": "full"},
    {"iso3": "AUS", "territory_extent": "metropolitan"},
    {"iso3": "EGY", "territory_extent": "full"},
    {"iso3": "ZAF", "territory_extent": "full"},
    {"iso3": "NGA", "territory_extent": "full"},
]

MILESTONE_1 = ["NLD", "BEL", "BIH", "FRA", "DEU"]

ISO3_LIST = [c["iso3"] for c in COUNTRIES]
TERRITORY_EXTENT = {c["iso3"]: c["territory_extent"] for c in COUNTRIES}
