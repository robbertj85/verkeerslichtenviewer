#!/usr/bin/env python3
"""
Download and process Dutch municipal boundaries from PDOK.

This script fetches the latest municipal (gemeente) boundaries from PDOK's
CBS Gebiedsindelingen WFS service and splits them into per-province GeoJSON files.

Data source: https://service.pdok.nl/cbs/gebiedsindelingen/
"""

import json
import os
from datetime import datetime, timezone

import geopandas as gpd
import requests

# PDOK WFS endpoint for CBS administrative boundaries
PDOK_WFS_URL = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"

# Output directory
OUTPUT_DIR = "webapp/public/data/boundaries"


def fetch_municipalities() -> gpd.GeoDataFrame:
    """Fetch all Dutch municipalities from PDOK WFS."""
    print("Fetching municipalities from PDOK...")

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:gemeente_gegeneraliseerd",
        "outputFormat": "json",
        "srsName": "EPSG:4326",
    }

    response = requests.get(PDOK_WFS_URL, params=params, timeout=60)
    response.raise_for_status()

    gdf = gpd.GeoDataFrame.from_features(response.json()["features"], crs="EPSG:4326")
    print(f"  Fetched {len(gdf)} municipalities")

    return gdf


def fetch_provinces() -> gpd.GeoDataFrame:
    """Fetch all Dutch provinces from PDOK WFS."""
    print("Fetching provinces from PDOK...")

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:provincie_gegeneraliseerd",
        "outputFormat": "json",
        "srsName": "EPSG:4326",
    }

    response = requests.get(PDOK_WFS_URL, params=params, timeout=60)
    response.raise_for_status()

    gdf = gpd.GeoDataFrame.from_features(response.json()["features"], crs="EPSG:4326")
    print(f"  Fetched {len(gdf)} provinces")

    return gdf


def create_slug(name: str) -> str:
    """Create a URL-friendly slug from a province name."""
    # Normalize Fryslân to Friesland for consistency
    if name == "Fryslân":
        return "friesland"
    return name.lower().replace(" ", "-").replace("ë", "e")


def normalize_province_name(name: str) -> str:
    """Normalize province name for display."""
    # Use Dutch name Friesland instead of Frisian name Fryslân
    if name == "Fryslân":
        return "Friesland"
    return name


def process_and_save(municipalities: gpd.GeoDataFrame, provinces: gpd.GeoDataFrame):
    """Process municipalities, group by province, and save as GeoJSON files."""

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Get province name for each municipality using spatial join
    print("Matching municipalities to provinces...")
    municipalities_with_province = gpd.sjoin(
        municipalities,
        provinces[["geometry", "statnaam"]].rename(columns={"statnaam": "provincie"}),
        how="left",
        predicate="within"
    )

    # Handle municipalities that might be on province borders (use centroid)
    missing_province = municipalities_with_province["provincie"].isna()
    if missing_province.any():
        print(f"  {missing_province.sum()} municipalities need centroid matching...")
        centroids = municipalities[missing_province].copy()
        centroids["geometry"] = centroids.geometry.centroid
        centroid_matches = gpd.sjoin(
            centroids,
            provinces[["geometry", "statnaam"]].rename(columns={"statnaam": "provincie"}),
            how="left",
            predicate="within"
        )
        municipalities_with_province.loc[missing_province, "provincie"] = centroid_matches["provincie"].values

    # Group by province and save
    province_data = []

    for province_name_raw in sorted(municipalities_with_province["provincie"].dropna().unique()):
        province_municipalities = municipalities_with_province[
            municipalities_with_province["provincie"] == province_name_raw
        ]

        # Normalize province name
        province_name = normalize_province_name(province_name_raw)

        # Create GeoJSON features
        features = []
        for _, row in province_municipalities.iterrows():
            feature = {
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": {
                    "type": "boundary",
                    "gemeente": row["statnaam"],
                }
            }
            features.append(feature)

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }

        # Save province file
        slug = create_slug(province_name_raw)
        filename = f"provincie-{slug}.geojson"
        filepath = os.path.join(OUTPUT_DIR, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False)

        file_size = os.path.getsize(filepath) / (1024 * 1024)  # MB

        province_data.append({
            "name": province_name,
            "slug": slug,
            "file": f"boundaries/{filename}",
            "size_mb": round(file_size, 2),
            "boundaries_count": len(features)
        })

        print(f"  {province_name}: {len(features)} municipalities ({file_size:.2f} MB)")

    # Create index file
    index = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "total_provinces": len(province_data),
        "total_boundaries": sum(p["boundaries_count"] for p in province_data),
        "provinces": sorted(province_data, key=lambda x: x["name"])
    }

    index_path = os.path.join(OUTPUT_DIR, "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {index['total_boundaries']} municipality boundaries across {index['total_provinces']} provinces")
    print(f"Index saved to: {index_path}")


def main():
    """Main entry point."""
    print("=" * 60)
    print("Dutch Municipal Boundaries Generator")
    print("Data source: PDOK CBS Gebiedsindelingen 2024")
    print("=" * 60)
    print()

    municipalities = fetch_municipalities()
    provinces = fetch_provinces()

    print()
    process_and_save(municipalities, provinces)

    print()
    print("Done!")


if __name__ == "__main__":
    main()
