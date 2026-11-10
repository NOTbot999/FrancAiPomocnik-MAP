import { base44, OFFLINE_MODE } from "@/api/base44Client";
import { loadBundled } from "@/lib/offlineData";
import { hasCoords, cavesToLayerFeatures as toFeatures } from "@/data/parsers";

// In-memory cache so we don't re-fetch on every toggle
let caveCache = null;

export async function loadCaves() {
  if (caveCache) return caveCache;

  // 1. Bundled /data/caves.json (built by `npm run fetch-data`) — works offline
  const bundled = await loadBundled("caves");
  if (bundled) {
    caveCache = bundled.filter(hasCoords);
    return caveCache;
  }

  // 2. Base44 Cave entity (paginated, 16k+ records) — only when a backend is configured
  if (OFFLINE_MODE) { caveCache = []; return caveCache; }
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

  caveCache = all.filter(hasCoords);
  return caveCache;
}

export function cavesToLayerFeatures(caves) {
  return toFeatures(caves);
}
