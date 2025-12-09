"""
UDAP Traffic Light Viewer - Main script for generating GeoJSON data.

This script fetches traffic light data from the UDAP API and generates
GeoJSON files for the webapp.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from api_client import get_traffic_lights_gdf, get_statistics, fetch_udap_data


def generate_geojson(output_dir: Path = None, force_refresh: bool = False):
    """
    Generate GeoJSON file with all traffic light data.

    Parameters
    ----------
    output_dir : Path, optional
        Directory to save output files. Defaults to webapp/public/data
    force_refresh : bool
        If True, fetch fresh data from API instead of using cache
    """
    if output_dir is None:
        output_dir = Path(__file__).parent / "webapp" / "public" / "data"

    output_dir.mkdir(parents=True, exist_ok=True)

    print("Fetching traffic light data...")
    gdf = get_traffic_lights_gdf(use_cache=not force_refresh)

    if len(gdf) == 0:
        print("No traffic lights found!")
        return

    print(f"Processing {len(gdf)} traffic lights...")

    # Calculate bounds
    bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]

    # Get unique authorities and organizations
    authorities = sorted(gdf['roadRegulatorName'].unique().tolist())
    tlc_orgs = sorted(gdf['tlc_organization'].dropna().unique().tolist())

    # Priority categories
    priority_categories = ['emergency', 'road_operator', 'public_transport', 'logistics', 'agriculture']

    # Create metadata
    metadata = {
        'generated_at': datetime.now().isoformat(),
        'total_traffic_lights': len(gdf),
        'bounds': bounds.tolist(),
        'authorities': authorities,
        'tlc_organizations': tlc_orgs,
        'priority_categories': priority_categories,
        'source': 'UDAP (Urban Data Access Platform)',
        'source_url': 'https://map.udap.nl'
    }

    # Convert to GeoJSON features
    features = []
    for _, row in gdf.iterrows():
        # Build priority list for this traffic light
        priorities = []
        if row['has_emergency']:
            priorities.append('emergency')
        if row['has_road_operator']:
            priorities.append('road_operator')
        if row['has_public_transport']:
            priorities.append('public_transport')
        if row['has_logistics']:
            priorities.append('logistics')
        if row['has_agriculture']:
            priorities.append('agriculture')

        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [row['longitude'], row['latitude']]
            },
            'properties': {
                'type': 'traffic_light',
                'id': row['id'],
                'name': row['name'],
                'identifier': row['identifier'],
                'latitude': row['latitude'],
                'longitude': row['longitude'],
                'roadRegulatorId': int(row['roadRegulatorId']) if row['roadRegulatorId'] else None,
                'roadRegulatorName': row['roadRegulatorName'],
                'subjectTypeName': row['subjectTypeName'],
                # Priority flags
                'has_emergency': bool(row['has_emergency']),
                'has_road_operator': bool(row['has_road_operator']),
                'has_public_transport': bool(row['has_public_transport']),
                'has_logistics': bool(row['has_logistics']),
                'has_agriculture': bool(row['has_agriculture']),
                'priorities': priorities,
                'priority_count': len(priorities),
                # Organizations
                'tlc_organization': row['tlc_organization'],
                'its_organization': row['its_organization'],
                'ris_organization': row['ris_organization'],
            }
        }
        features.append(feature)

    # Create GeoJSON structure
    geojson = {
        'type': 'FeatureCollection',
        'metadata': metadata,
        'features': features
    }

    # Save main GeoJSON file
    output_file = output_dir / 'traffic_lights.geojson'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)
    print(f"Saved {output_file}")

    # Generate summary/index file
    stats = get_statistics()
    summary = {
        'generated_at': metadata['generated_at'],
        'total_traffic_lights': len(gdf),
        'by_authority': stats['by_authority'],
        'by_tlc_organization': stats['by_tlc_organization'],
        'priority_stats': stats['priority_stats'],
        'source': metadata['source'],
        'source_url': metadata['source_url']
    }

    summary_file = output_dir / 'summary.json'
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"Saved {summary_file}")

    # Generate authorities list
    authorities_list = []
    auth_counts = stats['by_authority']
    for auth in authorities:
        authorities_list.append({
            'name': auth,
            'slug': auth.lower().replace(' ', '-').replace("'", ''),
            'count': auth_counts.get(auth, 0)
        })
    authorities_list.sort(key=lambda x: x['count'], reverse=True)

    authorities_file = output_dir / 'authorities.json'
    with open(authorities_file, 'w', encoding='utf-8') as f:
        json.dump(authorities_list, f, indent=2, ensure_ascii=False)
    print(f"Saved {authorities_file}")

    print(f"\nDone! Generated files in {output_dir}")
    print(f"  - traffic_lights.geojson ({len(features)} features)")
    print(f"  - summary.json")
    print(f"  - authorities.json ({len(authorities_list)} authorities)")


def main():
    parser = argparse.ArgumentParser(
        description="Generate UDAP traffic light data for the webapp."
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        help="Output directory for generated files"
    )
    parser.add_argument(
        "--refresh", "-r",
        action="store_true",
        help="Force refresh data from API (ignore cache)"
    )

    args = parser.parse_args()
    generate_geojson(output_dir=args.output, force_refresh=args.refresh)


if __name__ == "__main__":
    main()
