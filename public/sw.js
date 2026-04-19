const TILE_CACHE = "map-tiles-v1";
const APP_CACHE = "app-shell-v1";

// App shell files to cache on install
const APP_SHELL = ["/", "/src/main.jsx"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Tile hosts to cache
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "server.arcgisonline.com",
  "tile.opentopomap.org",
  "basemaps.cartocdn.com",
  "tiles.wmflabs.org",
  "ows.terrestris.de",
];

function isTileRequest(url) {
  return TILE_HOSTS.some((h) => url.hostname.includes(h));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (isTileRequest(url)) {
    // Cache-first for tiles
    e.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const resp = await fetch(e.request);
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        } catch {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // Network-first for everything else
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Message: pre-cache a region
self.addEventListener("message", async (e) => {
  if (e.data?.type !== "CACHE_REGION") return;
  const { bounds, minZoom, maxZoom } = e.data;
  const cache = await caches.open(TILE_CACHE);
  const urls = getTileUrlsForBounds(bounds, minZoom, maxZoom);
  let done = 0;
  const port = e.ports[0];

  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (!existing) {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      }
    } catch {}
    done++;
    if (port) port.postMessage({ done, total: urls.length });
  }
  if (port) port.postMessage({ done: urls.length, total: urls.length, finished: true });
});

// Message: get cache stats
self.addEventListener("message", async (e) => {
  if (e.data?.type !== "CACHE_STATS") return;
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  e.ports[0]?.postMessage({ count: keys.length });
});

// Message: clear tile cache
self.addEventListener("message", async (e) => {
  if (e.data?.type !== "CLEAR_TILE_CACHE") return;
  await caches.delete(TILE_CACHE);
  e.ports[0]?.postMessage({ ok: true });
});

function getTileUrlsForBounds(bounds, minZoom, maxZoom) {
  const urls = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const [x0, y0] = latLngToTile(bounds.north, bounds.west, z);
    const [x1, y1] = latLngToTile(bounds.south, bounds.east, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        // OSM tiles
        const s = ["a", "b", "c"][Math.abs(x + y) % 3];
        urls.push(`https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }
  return urls;
}

function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return [x, y];
}
