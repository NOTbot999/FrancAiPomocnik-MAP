// Background prefetcher — pre-warms the layer cache for all search categories
// Priority order: 1. bundled /data json, 2. localStorage, 3. CachedLayer (server), 4. Overpass (fallback)
// Uses a concurrency pool for fast parallel fetching.
import { useEffect } from "react";
import { base44, OFFLINE_MODE } from "@/api/base44Client";
import { fetchOverpass } from "@/lib/overpass";
import { loadBundled } from "@/lib/offlineData";
import { parseOverpassPoints } from "@/data/parsers";

const LS_PREFIX = "slomapcat_";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const CONCURRENCY = 6;

function isCached(id) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL;
  } catch { return false; }
}

function saveToCache(id, features) {
  try {
    localStorage.setItem(LS_PREFIX + id, JSON.stringify({ ts: Date.now(), features }));
  } catch { /* quota */ }
}

async function prefetchCategory(cat) {
  if (!cat.query && !cat._caveDbLayer && !cat._municipalityLayer && !cat._source) return;
  if (cat._municipalityLayer) return; // municipality uses a special polygon layer, skip
  if (cat._caveDbLayer) return;       // caves come from /data/caves.json via loadCaves()

  // Bundled data: fetching it once also stores it in the service-worker cache.
  // No need to copy it into localStorage (quota) — fetchFullSloveniaLayer reads it directly.
  const bundled = await loadBundled(cat.id);
  if (bundled) return;

  // Try server CachedLayer next (only with a Base44 backend)
  if (!OFFLINE_MODE) {
    try {
      const serverData = await base44.entities.CachedLayer.filter({ category_id: cat.id });
      if (serverData && serverData.length > 0 && serverData[0].features?.length > 0) {
        saveToCache(cat.id, serverData[0].features);
        return;
      }
    } catch { /* fallback */ }
  }

  // Fallback to Overpass (only for categories with a query)
  if (!cat.query) return;
  const data = await fetchOverpass(cat.query);
  const features = parseOverpassPoints(data);
  // Server cache is written only on explicit click (SearchBar) — writing here in
  // parallel created hundreds of duplicate records that slowed layers to a halt.
  if (features.length > 0) saveToCache(cat.id, features);
}

// Run a pool of workers over the queue, each picking the next item until done
async function runPool(items, worker, poolSize) {
  let index = 0;
  const next = async () => {
    while (index < items.length) {
      const current = items[index++];
      try { await worker(current); } catch { /* silently ignore */ }
    }
  };
  const workers = Array.from({ length: Math.min(poolSize, items.length) }, () => next());
  await Promise.all(workers);
}

let prefetchStarted = false;

export function usePrefetchCategories(categories) {
  useEffect(() => {
    if (prefetchStarted) return;
    prefetchStarted = true;

    const run = async () => {
      const toFetch = categories.filter(c => !isCached(c.id));
      await runPool(toFetch, prefetchCategory, CONCURRENCY);
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => run(), { timeout: 3000 });
    } else {
      setTimeout(run, 800);
    }
  }, []);
}
