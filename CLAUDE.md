# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is a dual-component system for collecting, analyzing, and visualizing smart traffic lights (iVRI's) connected to the UDAP (Urban Data Access Platform) across the Netherlands:
- **Python backend**: Data collection from the UDAP API with caching
- **Next.js webapp**: Interactive map visualization with Leaflet, featuring filters, statistics, and data export functionality

## Common Development Commands

### Python Backend

```bash
# Setup virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Generate data for the webapp (fetches from UDAP API)
python main.py

# Force refresh data from API (ignore cache)
python main.py --refresh

# Run the API client tests
python api_client.py
```

### Next.js Webapp

```bash
cd webapp

# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

## Architecture

### Python Backend Architecture

**Core Scripts**:
- `api_client.py` - Fetches data from UDAP API (`https://map.udap.nl/api/v1/subjects`)
- `main.py` - Generates GeoJSON files for the webapp

**Data Flow**:
```
UDAP API → api_client.py → Cache (data/udap_all_locations.json) →
main.py → GeoJSON files (webapp/public/data/)
```

### Next.js Webapp Architecture

**Component Hierarchy** (`app/page.tsx`):
```
Home (page.tsx)
├── StatsPanel → Priority statistics, authority counts
├── FilterPanel → Priority filters, authority filters, TLC org filters
└── Map → Leaflet with circle markers colored by priority
```

**API Routes** (`app/api/v1/`):
- `/api/v1/subjects` - Paginated list of traffic lights with filters
- `/api/v1/stats` - Summary statistics
- `/api/v1/export` - Download data in GeoJSON, JSON, or CSV format

**Data Files** (`public/data/`):
- `traffic_lights.geojson` - Complete dataset with all features
- `summary.json` - Statistics summary
- `authorities.json` - List of road authorities with counts

### TypeScript Types (`webapp/types/traffic-lights.ts`)

Traffic light features include:
- Geographic coordinates (latitude/longitude)
- Road authority (wegbeheerder) information
- Priority categories: emergency, road_operator, public_transport, logistics, agriculture
- TLC organization (traffic light controller supplier)

## UDAP Data Source

**API Endpoint**: `https://map.udap.nl/api/v1/subjects`

The UDAP (Urban Data Access Platform) is a Dutch national platform connecting intelligent traffic light controllers (iVRI's). The API returns JSON with:
- `id` - Unique identifier
- `name` - Traffic light name/code
- `latitude`, `longitude` - Geographic coordinates
- `roadRegulatorId`, `roadRegulatorName` - Road authority info
- `subjectComponents` - TLC, ITS, and RIS organizations
- `categories` - Priority categories (e.g., `PBC:EMERGENCY`, `PBC:LOGISTICS`)

## Priority Categories

Traffic lights can be configured to give priority to different road users:

| Category | ID | Description |
|----------|-----|-------------|
| Emergency | `PBC:EMERGENCY` | Fire, ambulance, police |
| Road Operator | `PBC:ROAD_OPERATOR` | Road inspectors, recovery vehicles |
| Public Transport | `PBC:PUBLIC_TRANSPORT` | Buses, trams |
| Logistics | `PBC:LOGISTICS` | Freight transport |
| Agriculture | `PBC:AGRICULTURE` | Farm vehicles |

## Map Marker Colors

Markers are colored based on highest priority:
- 🔴 Red (#dc2626) - Emergency services
- 🔵 Blue (#2563eb) - Public transport
- 🟢 Green (#16a34a) - Logistics
- 🟠 Orange (#f97316) - Road operator
- 🟡 Yellow (#ca8a04) - Agriculture
- ⚪ Gray (#6b7280) - No priorities

## Output Files

### GeoJSON Structure
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "generated_at": "2024-01-15T10:30:00Z",
    "total_traffic_lights": 1217,
    "bounds": [3.36, 50.75, 7.21, 53.47],
    "authorities": ["Amsterdam", "Rotterdam", ...],
    "tlc_organizations": ["Vialis", "Swarco", ...],
    "priority_categories": ["emergency", "road_operator", ...]
  },
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [4.9, 52.4] },
      "properties": {
        "type": "traffic_light",
        "id": "abc123",
        "name": "AMS001",
        "roadRegulatorName": "Amsterdam",
        "has_emergency": true,
        "has_public_transport": false,
        "priorities": ["emergency", "road_operator"],
        "tlc_organization": "Vialis"
      }
    }
  ]
}
```

## Data Attribution

When using this data, include attribution:
```
Data bron: UDAP (Urban Data Access Platform) - https://map.udap.nl
```

## Known Limitations

- Data is a snapshot at time of fetch - not real-time
- Some traffic lights may not have all metadata fields populated
- Public transport priority (`PBC:PUBLIC_TRANSPORT`) appears to not be widely configured yet
