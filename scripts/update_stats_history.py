#!/usr/bin/env python3
"""
Update statistics history for weekly tracking.

This script:
1. Fetches current data from UDAP API
2. Generates statistics per authority and totals
3. Appends to historical stats file with timestamp
4. Maintains week-by-week tracking for changes

Run this via GitHub Actions weekly to track changes over time.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import api_client
sys.path.insert(0, str(Path(__file__).parent.parent))

from api_client import fetch_udap_data

# Paths
WEBAPP_DATA_DIR = Path(__file__).parent.parent / "webapp" / "public" / "data"
STATS_HISTORY_FILE = WEBAPP_DATA_DIR / "stats_history.json"


def get_week_key(dt: datetime) -> str:
    """Get ISO week key (YYYY-Www)."""
    return f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"


def calculate_stats(data: list) -> dict:
    """Calculate statistics from UDAP data."""
    stats = {
        "total": len(data),
        "by_authority": {},
        "by_tlc_organization": {},
        "by_its_organization": {},
        "by_ris_organization": {},
        "by_priority": {
            "emergency": 0,
            "road_operator": 0,
            "public_transport": 0,
            "logistics": 0,
            "agriculture": 0,
        },
    }

    for item in data:
        # Count by authority
        authority = item.get("roadRegulatorName", "Unknown")
        stats["by_authority"][authority] = stats["by_authority"].get(authority, 0) + 1

        # Count by component organizations (TLC, ITS, RIS)
        tlc_found = False
        its_found = False
        ris_found = False
        for component in item.get("subjectComponents", []):
            type_name = component.get("typeName")
            org = component.get("organizationName") or "Onbekend"

            if type_name == "TLC" and not tlc_found:
                stats["by_tlc_organization"][org] = stats["by_tlc_organization"].get(org, 0) + 1
                tlc_found = True
            elif type_name == "ITS-applicatie" and not its_found:
                stats["by_its_organization"][org] = stats["by_its_organization"].get(org, 0) + 1
                its_found = True
            elif type_name == "RIS" and not ris_found:
                stats["by_ris_organization"][org] = stats["by_ris_organization"].get(org, 0) + 1
                ris_found = True

        # Count as "Onbekend" if not found
        if not tlc_found:
            stats["by_tlc_organization"]["Onbekend"] = stats["by_tlc_organization"].get("Onbekend", 0) + 1
        if not its_found:
            stats["by_its_organization"]["Onbekend"] = stats["by_its_organization"].get("Onbekend", 0) + 1
        if not ris_found:
            stats["by_ris_organization"]["Onbekend"] = stats["by_ris_organization"].get("Onbekend", 0) + 1

        # Count by priority (using correct API category IDs)
        for category in item.get("categories", []):
            cat_id = category.get("id", "")
            if cat_id == "PBC:EMERGENCY":
                stats["by_priority"]["emergency"] += 1
            elif cat_id == "PBC:ROAD_OPERATOR":
                stats["by_priority"]["road_operator"] += 1
            elif cat_id == "PBC:PUBLIC":
                stats["by_priority"]["public_transport"] += 1
            elif cat_id == "PBC:LOGISTICS":
                stats["by_priority"]["logistics"] += 1
            elif cat_id == "PBC:MACHINERY":
                stats["by_priority"]["agriculture"] += 1

    # Sort by count
    stats["by_authority"] = dict(
        sorted(stats["by_authority"].items(), key=lambda x: x[1], reverse=True)
    )
    stats["by_tlc_organization"] = dict(
        sorted(stats["by_tlc_organization"].items(), key=lambda x: x[1], reverse=True)
    )
    stats["by_its_organization"] = dict(
        sorted(stats["by_its_organization"].items(), key=lambda x: x[1], reverse=True)
    )
    stats["by_ris_organization"] = dict(
        sorted(stats["by_ris_organization"].items(), key=lambda x: x[1], reverse=True)
    )

    return stats


def load_history() -> dict:
    """Load existing history or create new structure."""
    if STATS_HISTORY_FILE.exists():
        with open(STATS_HISTORY_FILE) as f:
            return json.load(f)
    return {
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "description": "Weekly statistics history for UDAP traffic lights",
            "source": "UDAP",
            "source_url": "https://map.udap.nl",
        },
        "weeks": [],
    }


def calculate_changes(current: dict, previous: dict | None) -> dict:
    """Calculate changes from previous week."""
    if not previous:
        return {"total_change": 0, "is_first_week": True}

    changes = {
        "total_change": current["total"] - previous["stats"]["total"],
        "is_first_week": False,
        "authority_changes": {},
    }

    # Calculate per-authority changes
    current_auth = current["by_authority"]
    prev_auth = previous["stats"]["by_authority"]

    all_authorities = set(current_auth.keys()) | set(prev_auth.keys())
    for auth in all_authorities:
        curr_count = current_auth.get(auth, 0)
        prev_count = prev_auth.get(auth, 0)
        if curr_count != prev_count:
            changes["authority_changes"][auth] = {
                "previous": prev_count,
                "current": curr_count,
                "change": curr_count - prev_count,
            }

    return changes


def main():
    print("🚦 Fetching UDAP data...")
    data = fetch_udap_data(use_cache=False)
    print(f"   Found {len(data)} traffic lights")

    print("📊 Calculating statistics...")
    stats = calculate_stats(data)

    print("📁 Loading history...")
    history = load_history()

    now = datetime.now()
    week_key = get_week_key(now)

    # Check if we already have data for this week
    existing_week = next(
        (w for w in history["weeks"] if w["week"] == week_key), None
    )

    # Get previous week for change calculation
    previous_week = history["weeks"][-1] if history["weeks"] else None

    # Calculate changes
    changes = calculate_changes(stats, previous_week)

    week_entry = {
        "week": week_key,
        "date": now.strftime("%Y-%m-%d"),
        "timestamp": now.isoformat(),
        "stats": stats,
        "changes": changes,
    }

    if existing_week:
        print(f"⚠️  Week {week_key} already exists, updating...")
        idx = history["weeks"].index(existing_week)
        history["weeks"][idx] = week_entry
    else:
        print(f"➕ Adding new week: {week_key}")
        history["weeks"].append(week_entry)

    # Update metadata
    history["metadata"]["last_updated"] = now.isoformat()
    history["metadata"]["total_weeks"] = len(history["weeks"])

    # Save history
    print("💾 Saving history...")
    STATS_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATS_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

    print(f"✅ Done! History saved to {STATS_HISTORY_FILE}")
    print(f"   Total weeks tracked: {len(history['weeks'])}")
    print(f"   Current total: {stats['total']} traffic lights")
    if changes.get("total_change"):
        change = changes["total_change"]
        symbol = "📈" if change > 0 else "📉" if change < 0 else "➡️"
        print(f"   Change from last week: {symbol} {change:+d}")


if __name__ == "__main__":
    main()
