// Background prefetcher — pre-warms the layer cache for all search categories
// Priority order: 1. localStorage, 2. CachedLayer (server), 3. Overpass (fallback)
// Uses a concurrency pool for fast parallel fetching.
import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { fetchOverpass } from "@/lib/overpass";

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
  if (!cat.query && !cat._caveDbLayer && !cat._municipalityLayer) return;
  if (cat._municipalityLayer) return; // municipality uses a special polygon layer, skip

  // Try server CachedLayer first
  try {
    const serverData = await base44.entities.CachedLayer.filter({ category_id: cat.id });
    if (serverData && serverData.length > 0 && serverData[0].features?.length > 0) {
      saveToCache(cat.id, serverData[0].features);
      return;
    }
  } catch { /* fallback */ }

  // Fallback to Overpass (only for categories with a query)
  if (!cat.query) return;
  const data = await fetchOverpass(cat.query);
  const features = (data.elements || []).map(el => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) return null;
    return {
      type: "Point",
      coords: [lat, lon],
      label: el.tags?.name || el.tags?.["name:sl"] || el.tags?.ref || "",
    };
  }).filter(Boolean);
  saveToCache(cat.id, features);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}