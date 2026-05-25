// Background prefetcher — pre-warms the layer cache for all search categories
// Priority order: 1. localStorage, 2. CachedLayer (server), 3. Overpass (fallback)
import { useEffect } from "react";
import { base44 } from "@/api/base44Client";

const LS_PREFIX = "slomapcat_";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

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

  // Try server CachedLayer first (works for cave and regular categories)
  try {
    const serverData = await base44.entities.CachedLayer.filter({ category_id: cat.id });
    if (serverData && serverData.length > 0 && serverData[0].features?.length > 0) {
      saveToCache(cat.id, serverData[0].features);
      return;
    }
  } catch { /* fallback */ }

  // Fallback to Overpass (only for categories with a query)
  if (!cat.query) return;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(cat.query),
  });
  const data = await res.json();
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

let prefetchStarted = false;

export function usePrefetchCategories(categories) {
  useEffect(() => {
    if (prefetchStarted) return;
    prefetchStarted = true;

    const run = async () => {
      const toFetch = categories.filter(c => !isCached(c.id));
      for (const cat of toFetch) {
        try {
          await prefetchCategory(cat);
          await new Promise(r => setTimeout(r, 500));
        } catch { /* silently ignore */ }
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => run(), { timeout: 5000 });
    } else {
      setTimeout(run, 2000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}