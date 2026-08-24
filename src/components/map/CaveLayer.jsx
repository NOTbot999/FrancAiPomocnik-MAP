import { base44 } from "@/api/base44Client";

// In-memory cache so we don't re-fetch on every toggle
let caveCache = null;

export async function loadCaves() {
  if (caveCache) return caveCache;

  // Load directly from Cave entity (paginated) — 16k+ records
  const batchSize = 2000;
  let all = [];
  let skip = 0;

  while (true) {
    const batch = await base44.entities.Cave.list(undefined, batchSize, skip);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  caveCache = all.filter(c => c.latitude && c.longitude && parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0);
  return caveCache;
}

export function cavesToLayerFeatures(caves) {
  return caves.map(c => {
    const parts = [c.name];
    if (c.synonyms) parts.push(`(${c.synonyms})`);
    const dims = [];
    if (c.depth_m) dims.push(`${c.depth_m}m globoka`);
    if (c.length_m) dims.push(`${c.length_m}m dolga`);
    if (c.entrance_elevation_m) dims.push(`${c.entrance_elevation_m}m nmv`);
    if (dims.length) parts.push(`— ${dims.join(", ")}`);
    if (c.entry_regime) parts.push(`[${c.entry_regime}]`);
    return {
      type: "Point",
      coords: [parseFloat(c.latitude), parseFloat(c.longitude)],
      label: parts.join(" "),
      depth_m: c.depth_m,
      length_m: c.length_m,
      entrance_elevation_m: c.entrance_elevation_m,
      entry_regime: c.entry_regime,
      administrative_unit: c.administrative_unit,
    };
  });
}