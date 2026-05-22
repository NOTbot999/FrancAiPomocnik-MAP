// Background prefetcher — pre-warms the Overpass cache for all search categories
import { useEffect } from "react";

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
      const toFetch = categories.filter(c => c.query && !isCached(c.id));
      for (const cat of toFetch) {
        try {
          await fetchCategory(cat);
          await new Promise(r => setTimeout(r, 1000));
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