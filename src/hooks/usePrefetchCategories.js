// Background prefetcher — pre-warms the Overpass cache for all search categories
// so the first click on any "Označi na karti" layer is instant.
// Runs in a low-priority queue (one category at a time, 800ms apart) to avoid
// hammering Overpass and blocking the main thread.

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

async function fetchCategory(cat) {
  if (!cat.query) return; // municipality layer — no Overpass needed
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
  // Only run once per app session
  if (prefetchStarted) return;
  prefetchStarted = true;

  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule = (fn) =>
    typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback(fn, { timeout: 5000 })
      : setTimeout(fn, 2000);

  schedule(async () => {
    // Filter to only categories that need Overpass and aren't cached yet
    const toFetch = categories.filter(c => c.query && !isCached(c.id));
    if (toFetch.length === 0) return;

    for (const cat of toFetch) {
      try {
        await fetchCategory(cat);
        // Pause between requests to be kind to Overpass
        await new Promise(r => setTimeout(r, 1000));
      } catch {
        // Silently ignore — cache will be populated on demand instead
      }
    }
  });
}