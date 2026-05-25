import { base44 } from "@/api/base44Client";

// In-memory cache so we don't re-fetch on every toggle
let caveCache = null;

export async function loadCaves() {
  if (caveCache) return caveCache;

  // 1. Try server-side CachedLayer first (fastest)
  try {
    const serverData = await base44.entities.CachedLayer.filter({ category_id: "cave" });
    if (serverData && serverData.length > 0 && serverData[0].features?.length > 0) {
      const features = serverData[0].features;
      // Convert back to cave-like objects for cavesToLayerFeatures
      caveCache = features.map(f => ({
        latitude: f.coords[0],
        longitude: f.coords[1],
        name: f.label || "",
        depth_m: f.depth_m || null,
        length_m: f.length_m || null,
        _fromCache: true,
      }));
      return caveCache;
    }
  } catch { /* fallback to DB */ }

  // 2. Fallback: Load from Cave entity via backend function
  const batchSize = 2000;
  let all = [];
  let skip = 0;

  while (true) {
    const res = await base44.functions.invoke('getCaves', { skip, limit: batchSize });
    const batch = res.data?.caves || [];
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  caveCache = all.filter(c => c.latitude && c.longitude && parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0);
  return caveCache;
}

export function cavesToLayerFeatures(caves) {
  return caves.map(c => ({
    type: "Point",
    coords: [parseFloat(c.latitude), parseFloat(c.longitude)],
    label: c.name + (c.depth_m ? ` (${c.depth_m}m globoka)` : "") + (c.length_m ? `, ${c.length_m}m dolga` : ""),
    depth_m: c.depth_m,
    length_m: c.length_m,
  }));
}