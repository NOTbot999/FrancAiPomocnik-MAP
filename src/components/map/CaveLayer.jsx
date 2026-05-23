import { base44 } from "@/api/base44Client";

// In-memory cache so we don't re-fetch on every toggle
let caveCache = null;

export async function loadCaves() {
  if (caveCache) return caveCache;
  // Load all caves with valid coordinates
  const all = await base44.entities.Cave.list("-depth_m", 5000);
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