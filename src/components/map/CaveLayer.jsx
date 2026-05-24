import { base44 } from "@/api/base44Client";

// In-memory cache so we don't re-fetch on every toggle
let caveCache = null;

export async function loadCaves() {
  if (caveCache) return caveCache;
  // Load all caves in batches (13k+ records)
  const batchSize = 2000;
  let all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.Cave.list("-depth_m", batchSize, skip);
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