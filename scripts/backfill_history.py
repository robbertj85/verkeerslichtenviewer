#!/usr/bin/env python3
"""
Backfill stats_history.json with TLC and priority data from git history.
"""

import json
import subprocess
from pathlib import Path

WEBAPP_DATA_DIR = Path(__file__).parent.parent / "webapp" / "public" / "data"
STATS_HISTORY_FILE = WEBAPP_DATA_DIR / "stats_history.json"
GEOJSON_FILE = WEBAPP_DATA_DIR / "traffic_lights.geojson"

def get_commits_for_file():
    """Get list of commits that modified the geojson file."""
    result = subprocess.run(
        ["git", "log", "--oneline", "--format=%H %s", "--", str(GEOJSON_FILE)],
        capture_output=True, text=True, cwd=Path(__file__).parent.parent
    )
    commits = []
    for line in result.stdout.strip().split('\n'):
        if line:
            parts = line.split(' ', 1)
            commits.append({'hash': parts[0], 'message': parts[1] if len(parts) > 1 else ''})
    return commits

def get_geojson_at_commit(commit_hash):
    """Get the geojson content at a specific commit."""
    result = subprocess.run(
        ["git", "show", f"{commit_hash}:{GEOJSON_FILE.relative_to(Path(__file__).parent.parent)}"],
        capture_output=True, text=True, cwd=Path(__file__).parent.parent
    )
    if result.returncode == 0:
        return json.loads(result.stdout)
    return None

def calculate_stats_from_geojson(geojson):
    """Calculate TLC and priority stats from geojson."""
    tlc_counts = {}
    priority_counts = {
        'emergency': 0,
        'road_operator': 0,
        'public_transport': 0,
        'logistics': 0,
        'agriculture': 0,
    }
    
    for feature in geojson.get('features', []):
        props = feature.get('properties', {})
        
        # TLC organization
        tlc = props.get('tlc_organization', '')
        if tlc:
            tlc_counts[tlc] = tlc_counts.get(tlc, 0) + 1
        
        # Priority flags
        if props.get('has_emergency'):
            priority_counts['emergency'] += 1
        if props.get('has_road_operator'):
            priority_counts['road_operator'] += 1
        if props.get('has_public_transport'):
            priority_counts['public_transport'] += 1
        if props.get('has_logistics'):
            priority_counts['logistics'] += 1
        if props.get('has_agriculture'):
            priority_counts['agriculture'] += 1
    
    # Sort TLC by count
    tlc_counts = dict(sorted(tlc_counts.items(), key=lambda x: x[1], reverse=True))
    
    return tlc_counts, priority_counts

def main():
    # Load current history
    with open(STATS_HISTORY_FILE) as f:
        history = json.load(f)
    
    print(f"Found {len(history['weeks'])} weeks in history")
    
    # Get commits
    commits = get_commits_for_file()
    print(f"Found {len(commits)} commits for geojson file")
    
    # Map week keys to commits (look for weekly update commits)
    week_commits = {}
    for commit in commits:
        msg = commit['message']
        # Look for week patterns like "2025-W51" in commit message
        import re
        match = re.search(r'(\d{4}-W\d{2})', msg)
        if match:
            week_key = match.group(1)
            week_commits[week_key] = commit['hash']
    
    print(f"Found commits for weeks: {list(week_commits.keys())}")
    
    # Update each week in history
    updated = 0
    for week_entry in history['weeks']:
        week_key = week_entry['week']
        
        # Check if this week needs backfill (empty TLC or zero priorities)
        needs_backfill = (
            not week_entry['stats'].get('by_tlc_organization') or
            all(v == 0 for v in week_entry['stats'].get('by_priority', {}).values())
        )
        
        if needs_backfill and week_key in week_commits:
            print(f"Backfilling {week_key}...")
            geojson = get_geojson_at_commit(week_commits[week_key])
            if geojson:
                tlc_counts, priority_counts = calculate_stats_from_geojson(geojson)
                week_entry['stats']['by_tlc_organization'] = tlc_counts
                week_entry['stats']['by_priority'] = priority_counts
                updated += 1
                print(f"  TLC: {tlc_counts}")
                print(f"  Priorities: {priority_counts}")
    
    # Save updated history
    with open(STATS_HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2, ensure_ascii=False)
    
    print(f"\nDone! Updated {updated} weeks")

if __name__ == "__main__":
    main()
