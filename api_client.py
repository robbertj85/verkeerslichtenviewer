"""
UDAP API Client - Fetches smart traffic light (iVRI) data from the Dutch UDAP platform.

The Urban Data Access Platform (UDAP) provides data about intelligent traffic light
controllers (iTLCs) across the Netherlands.

API Endpoint: https://map.udap.nl/api/v1/subjects
"""

import requests
import pandas as pd
import geopandas as gpd
from pathlib import Path
from shapely.geometry import Point
from typing import Optional, Dict, Any, List
import json
from datetime import datetime


def make_session() -> requests.Session:
    """Create a requests session with standard headers."""
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'UDAP-Viewer/1.0 (https://github.com/robbertj85)',
        'Accept': 'application/json'
    })
    return session


def fetch_udap_data(use_cache: bool = True, cache_file: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Fetch all traffic light data from the UDAP API.

    Parameters
    ----------
    use_cache : bool
        If True, try to load from cache file first
    cache_file : Path, optional
        Path to cache file. Defaults to data/udap_all_locations.json

    Returns
    -------
    list
        List of traffic light dictionaries from the API
    """
    if cache_file is None:
        cache_file = Path(__file__).parent / "data" / "udap_all_locations.json"

    # Try cache first
    if use_cache and cache_file.exists():
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            print(f"  Loaded {len(cache_data.get('locations', []))} traffic lights from cache")
            return cache_data.get('locations', [])
        except Exception as e:
            print(f"  Cache load failed ({e}), fetching from API...")

    # Fetch from API
    session = make_session()
    url = "https://map.udap.nl/api/v1/subjects"

    print(f"  Fetching traffic light data from UDAP API...")
    response = session.get(url, timeout=60)
    response.raise_for_status()

    data = response.json()
    print(f"  Fetched {len(data)} traffic lights from UDAP API")

    # Save to cache
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_data = {
        'fetched_at': datetime.now().isoformat(),
        'source': url,
        'total_count': len(data),
        'locations': data
    }
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)
    print(f"  Cached data to {cache_file}")

    return data


def get_traffic_lights_gdf(use_cache: bool = True) -> gpd.GeoDataFrame:
    """
    Get all UDAP traffic lights as a GeoDataFrame.

    Returns
    -------
    geopandas.GeoDataFrame
        GeoDataFrame with traffic light locations and metadata
    """
    locations = fetch_udap_data(use_cache=use_cache)

    if not locations:
        # Return empty GeoDataFrame with correct structure
        return gpd.GeoDataFrame(
            columns=['id', 'name', 'identifier', 'latitude', 'longitude',
                     'roadRegulatorId', 'roadRegulatorName', 'subjectTypeName',
                     'components', 'categories', 'geometry'],
            crs='EPSG:4326'
        )

    rows = []
    for loc in locations:
        # Extract category IDs as a list
        category_ids = [cat.get('id', '') for cat in loc.get('categories', [])]
        category_names = [cat.get('name', '') for cat in loc.get('categories', [])]

        # Extract component info
        components = loc.get('subjectComponents', [])
        tlc_org = next((c.get('organizationName', '') for c in components if c.get('typeName') == 'TLC'), '')
        its_org = next((c.get('organizationName', '') for c in components if c.get('typeName') == 'ITS-applicatie'), '')
        ris_org = next((c.get('organizationName', '') for c in components if c.get('typeName') == 'RIS'), '')

        rows.append({
            'id': loc.get('id', ''),
            'name': loc.get('name', ''),
            'identifier': loc.get('identifier', ''),
            'latitude': loc.get('latitude'),
            'longitude': loc.get('longitude'),
            'roadRegulatorId': loc.get('roadRegulatorId'),
            'roadRegulatorName': loc.get('roadRegulatorName', ''),
            'subjectTypeName': loc.get('subjectTypeName', 'iVRI'),
            'subjectTypeCode': loc.get('subjectTypeCode', 'TRAFFIC_LIGHT'),
            # Priority categories
            'has_emergency': 'PBC:EMERGENCY' in category_ids,
            'has_road_operator': 'PBC:ROAD_OPERATOR' in category_ids,
            'has_public_transport': 'PBC:PUBLIC' in category_ids,  # API uses PBC:PUBLIC
            'has_logistics': 'PBC:LOGISTICS' in category_ids,
            'has_agriculture': 'PBC:MACHINERY' in category_ids,  # API uses PBC:MACHINERY
            # Component organizations
            'tlc_organization': tlc_org,
            'its_organization': its_org,
            'ris_organization': ris_org,
            # Raw data for detail views
            'category_ids': ','.join(category_ids),
            'category_names': ','.join(category_names),
        })

    df = pd.DataFrame(rows)

    # Filter out rows without coordinates
    df = df.dropna(subset=['latitude', 'longitude'])

    # Create geometry
    geometry = [Point(row['longitude'], row['latitude']) for _, row in df.iterrows()]
    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')

    return gdf


def get_road_authorities() -> Dict[int, str]:
    """
    Get a mapping of road authority IDs to names.

    Returns
    -------
    dict
        Dictionary mapping roadRegulatorId to roadRegulatorName
    """
    locations = fetch_udap_data(use_cache=True)

    authorities = {}
    for loc in locations:
        reg_id = loc.get('roadRegulatorId')
        reg_name = loc.get('roadRegulatorName', '')
        if reg_id and reg_name:
            authorities[reg_id] = reg_name

    return authorities


def get_statistics() -> Dict[str, Any]:
    """
    Calculate statistics about the traffic light network.

    Returns
    -------
    dict
        Dictionary with various statistics
    """
    gdf = get_traffic_lights_gdf(use_cache=True)

    if len(gdf) == 0:
        return {'total': 0}

    stats = {
        'total': len(gdf),
        'by_authority': gdf.groupby('roadRegulatorName').size().to_dict(),
        'by_tlc_organization': gdf.groupby('tlc_organization').size().to_dict(),
        'priority_stats': {
            'emergency': int(gdf['has_emergency'].sum()),
            'road_operator': int(gdf['has_road_operator'].sum()),
            'public_transport': int(gdf['has_public_transport'].sum()),
            'logistics': int(gdf['has_logistics'].sum()),
            'agriculture': int(gdf['has_agriculture'].sum()),
        }
    }

    return stats


if __name__ == "__main__":
    # Test the API client
    print("Testing UDAP API client...")

    gdf = get_traffic_lights_gdf(use_cache=False)
    print(f"\nTotal traffic lights: {len(gdf)}")

    print(f"\nSample data:")
    print(gdf.head())

    print(f"\nStatistics:")
    stats = get_statistics()
    print(f"  Total: {stats['total']}")
    print(f"  By authority (top 10):")
    sorted_auth = sorted(stats['by_authority'].items(), key=lambda x: x[1], reverse=True)[:10]
    for name, count in sorted_auth:
        print(f"    {name}: {count}")

    print(f"\n  Priority statistics:")
    for key, value in stats['priority_stats'].items():
        print(f"    {key}: {value}")
