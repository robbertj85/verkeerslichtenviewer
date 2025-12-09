/**
 * Boundary Loader for Province and Municipality polygons
 *
 * Loads boundary GeoJSON files for displaying administrative regions on the map.
 * Province boundaries are split into 12 files to avoid GitHub's 100MB file size limit.
 */

export interface ProvinceMetadata {
  name: string;
  slug: string;
  file: string;
  size_mb: number;
  boundaries_count: number;
}

export interface BoundaryIndex {
  generated_at: string;
  total_provinces: number;
  total_boundaries: number;
  provinces: ProvinceMetadata[];
}

export interface BoundaryLoadProgress {
  loaded: number;
  total: number;
  currentProvince?: string;
  percentage: number;
}

export interface BoundaryFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    gemeentenaam?: string;
    provincienaam?: string;
    [key: string]: any;
  };
}

export interface BoundaryData {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
  metadata: {
    total_boundaries: number;
    provinces_loaded: number;
    provinces: string[];
  };
}

/**
 * Load all provincial boundaries (which include municipality boundaries) in parallel
 * @param onProgress Optional callback to track loading progress
 * @returns Merged GeoJSON FeatureCollection with all boundaries
 */
export async function loadAllBoundaries(
  onProgress?: (progress: BoundaryLoadProgress) => void
): Promise<BoundaryData> {
  // First, load the index to know which files to fetch
  const indexResponse = await fetch('/data/boundaries/index.json');
  if (!indexResponse.ok) {
    throw new Error(`Failed to load boundary index: ${indexResponse.status}`);
  }

  const index: BoundaryIndex = await indexResponse.json();
  const { provinces } = index;

  console.log(`Loading ${provinces.length} provincial boundary files...`);

  // Track progress
  let loaded = 0;
  const total = provinces.length;

  const updateProgress = (currentProvince?: string) => {
    loaded++;
    if (onProgress) {
      onProgress({
        loaded,
        total,
        currentProvince,
        percentage: Math.round((loaded / total) * 100),
      });
    }
  };

  // Load all provinces in parallel
  const provincialDataPromises = provinces.map(async (province) => {
    try {
      const response = await fetch(`/data/${province.file}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${province.name}: ${response.status}`);
      }
      const data = await response.json();
      updateProgress(province.name);
      return {
        province: province.name,
        features: data.features as BoundaryFeature[],
      };
    } catch (error) {
      console.error(`Error loading ${province.name}:`, error);
      updateProgress(province.name);
      return {
        province: province.name,
        features: [],
      };
    }
  });

  // Wait for all provinces to load
  const provincialData = await Promise.all(provincialDataPromises);

  // Merge all features into a single collection
  const allFeatures = provincialData.flatMap((data) => data.features);
  const loadedProvinces = provincialData
    .filter((data) => data.features.length > 0)
    .map((data) => data.province);

  console.log(`Loaded ${allFeatures.length} boundaries from ${loadedProvinces.length} provinces`);

  return {
    type: 'FeatureCollection',
    features: allFeatures,
    metadata: {
      total_boundaries: allFeatures.length,
      provinces_loaded: loadedProvinces.length,
      provinces: loadedProvinces,
    },
  };
}

/**
 * Load boundaries for specific provinces only
 * @param provinceSlugs Array of province slugs to load (e.g., ['noord-holland', 'zuid-holland'])
 * @param onProgress Optional callback to track loading progress
 * @returns Merged GeoJSON FeatureCollection with selected boundaries
 */
export async function loadSelectedProvinceBoundaries(
  provinceSlugs: string[],
  onProgress?: (progress: BoundaryLoadProgress) => void
): Promise<BoundaryData> {
  const indexResponse = await fetch('/data/boundaries/index.json');
  if (!indexResponse.ok) {
    throw new Error(`Failed to load boundary index: ${indexResponse.status}`);
  }

  const index: BoundaryIndex = await indexResponse.json();

  // Filter to requested provinces
  const selectedProvinces = index.provinces.filter((p) =>
    provinceSlugs.includes(p.slug)
  );

  if (selectedProvinces.length === 0) {
    console.warn('No matching provinces found');
    return {
      type: 'FeatureCollection',
      features: [],
      metadata: {
        total_boundaries: 0,
        provinces_loaded: 0,
        provinces: [],
      },
    };
  }

  console.log(`Loading ${selectedProvinces.length} selected provinces...`);

  let loaded = 0;
  const total = selectedProvinces.length;

  const updateProgress = (currentProvince?: string) => {
    loaded++;
    if (onProgress) {
      onProgress({
        loaded,
        total,
        currentProvince,
        percentage: Math.round((loaded / total) * 100),
      });
    }
  };

  const provincialDataPromises = selectedProvinces.map(async (province) => {
    try {
      const response = await fetch(`/data/${province.file}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${province.name}: ${response.status}`);
      }
      const data = await response.json();
      updateProgress(province.name);
      return {
        province: province.name,
        features: data.features as BoundaryFeature[],
      };
    } catch (error) {
      console.error(`Error loading ${province.name}:`, error);
      updateProgress(province.name);
      return {
        province: province.name,
        features: [],
      };
    }
  });

  const provincialData = await Promise.all(provincialDataPromises);

  const allFeatures = provincialData.flatMap((data) => data.features);
  const loadedProvinces = provincialData
    .filter((data) => data.features.length > 0)
    .map((data) => data.province);

  console.log(`Loaded ${allFeatures.length} boundaries from ${loadedProvinces.length} provinces`);

  return {
    type: 'FeatureCollection',
    features: allFeatures,
    metadata: {
      total_boundaries: allFeatures.length,
      provinces_loaded: loadedProvinces.length,
      provinces: loadedProvinces,
    },
  };
}

/**
 * Get the boundary index without loading the actual boundary data
 */
export async function getBoundaryIndex(): Promise<BoundaryIndex> {
  const response = await fetch('/data/boundaries/index.json');
  if (!response.ok) {
    throw new Error(`Failed to load boundary index: ${response.status}`);
  }
  return response.json();
}
