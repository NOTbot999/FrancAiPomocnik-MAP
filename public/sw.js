/* FrancAiMap service worker — offline app shell, bundled data and map tiles.
 *
 * Caches:
 *   app-shell-v2  same-origin files (index.html, hashed /assets, /data/*.json, icons)
 *                 → stale-while-revalidate, so the app opens offline after one online visit
 *   map-tiles-v2  raster tiles / WMS / ArcGIS export images from any map host
 *                 → cache-first, filled while browsing and by "Save current view"
 *
 * Messages (MessageChannel reply on e.ports[0]):
 *   CACHE_REGION { urls }      pre-fetch a list of tile URLs, progress {done,total,failed,finished}
 *   CACHE_STATS                → { count, shell, data }
 *   CLEAR_TILE_CACHE           → { ok }
 *   WARM_DATA { urls }         → fetch bundled json files into the shell cache
 *   CACHE_URLS { urls }        → store same-origin resources the page already loaded
 */
const TILE_CACHE = "map-tiles-v2";
const APP_CACHE = "app-shell-v2";
const MAX_TILES = 60000; // soft cap; oldest entries are trimmed above this

const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icon.svg", "/bg.jpg", "/data/manifest.json"];

// Hosts whose responses are map imagery (tiles, WMS, ArcGIS export, terrain, vector tiles)
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "tile-a.openstreetmap.fr", "tile-b.openstreetmap.fr", "tile-c.openstreetmap.fr", "openstreetmap.fr",
  "basemaps.cartocdn.com",
  "server.arcgisonline.com",
  "tile.opentopomap.org",
  "gis.arso.gov.si",
  "ipi.eprostor.gov.si",
  "rkg.gov.si",
  "tile.waymarkedtrails.org",
  "tiles.openrailwaymap.org",
  "tile.openweathermap.org",
  "elevation-tiles-prod.s3.amazonaws.com",
  "tiles.openfreemap.org",
  "api.maptiler.com",
  "tiles.wmflabs.org",
  "ows.terrestris.de",
];

const isTileRequest = (url) => TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h));

// Vite dev-server internals must never be cached
const isDevInternal = (url) =>
  url.pathname.startsWith("/@") || url.pathname.startsWith("/src/") ||
  url.pathname.startsWith("/node_modules/") || url.searchParams.has("import") || url.pathname === "/sw.js";

// Precache the shell and the hashed assets index.html references (the first page load happens
// before this worker controls the page, so those assets would otherwise never reach the cache).
async function precacheShell() {
  const cache = await caches.open(APP_CACHE);
  await Promise.allSettled(APP_SHELL.map((u) => cache.add(u)));
  try {
    const html = await (await fetch("/index.html", { cache: "no-cache" })).text();
    const assets = Array.from(html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|svg|png|jpg|webp|woff2?))"/g)).map((m) => m[1]);
    await Promise.allSettled(assets.map((u) => cache.add(u)));
  } catch { /* offline during install */ }
}

self.addEventListener("install", (e) => {
  e.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== TILE_CACHE && k !== APP_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp.ok || resp.type === "opaque") cache.put(request, resp.clone()).catch(() => {});
    return resp;
  } catch {
    return new Response("", { status: 503, statusText: "offline" });
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then((resp) => {
      if (resp.ok) cache.put(request, resp.clone()).catch(() => {});
      return resp;
    })
    .catch(() => null);
  if (cached) return cached;
  const resp = await network;
  return resp || new Response("", { status: 503, statusText: "offline" });
}

async function navigationHandler(request) {
  try {
    const resp = await fetch(request);
    if (resp.ok) (await caches.open(APP_CACHE)).put("/index.html", resp.clone()).catch(() => {});
    return resp;
  } catch {
    const cache = await caches.open(APP_CACHE);
    return (await cache.match("/index.html")) || (await cache.match("/")) ||
      new Response("<h1>Offline</h1><p>Aplikacija še ni bila naložena s povezavo.</p>", { status: 503, headers: { "Content-Type": "text/html" } });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") { e.respondWith(navigationHandler(req)); return; }

  if (isTileRequest(url)) { e.respondWith(cacheFirst(TILE_CACHE, req)); return; }

  if (url.origin === self.location.origin) {
    if (isDevInternal(url)) return;
    e.respondWith(staleWhileRevalidate(APP_CACHE, req));
    return;
  }

  // Other cross-origin GETs (fonts, CDN scripts, Overpass…): network, fall back to cache if we have it
  e.respondWith(fetch(req).catch(async () => (await caches.match(req)) || new Response("", { status: 503 })));
});

// ── Messages ────────────────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  const port = e.ports && e.ports[0];
  const data = e.data || {};
  const reply = (m) => port && port.postMessage(m);

  if (data.type === "CACHE_REGION") { e.waitUntil(cacheRegion(data.urls || [], reply)); }
  else if (data.type === "CACHE_STATS") { e.waitUntil(cacheStats(reply)); }
  else if (data.type === "CLEAR_TILE_CACHE") { e.waitUntil(caches.delete(TILE_CACHE).then(() => reply({ ok: true }))); }
  else if (data.type === "WARM_DATA") { e.waitUntil(warmData(data.urls || [], reply)); }
  else if (data.type === "CACHE_URLS") { e.waitUntil(cacheUrls(data.urls || [])); }
});

// Same-origin resources the page already loaded (before the worker took control)
async function cacheUrls(urls) {
  const cache = await caches.open(APP_CACHE);
  for (const url of urls) {
    try {
      const u = new URL(url, self.location.origin);
      if (u.origin !== self.location.origin || isDevInternal(u)) continue;
      if (await cache.match(u.href, { ignoreVary: true })) continue;
      const r = await fetch(u.href);
      if (r.ok) await cache.put(u.href, r);
    } catch { /* ignore */ }
  }
}

async function cacheRegion(urls, reply) {
  const cache = await caches.open(TILE_CACHE);
  const total = urls.length;
  let done = 0, failed = 0;
  const CONCURRENCY = 4;
  let idx = 0;
  const worker = async () => {
    while (idx < urls.length) {
      const url = urls[idx++];
      try {
        const existing = await cache.match(url, { ignoreVary: true });
        if (!existing) {
          const r = await fetch(url, { mode: "cors" }).catch(() => fetch(url, { mode: "no-cors" }));
          if (r && (r.ok || r.type === "opaque")) await cache.put(url, r);
          else failed++;
        }
      } catch { failed++; }
      done++;
      if (done % 5 === 0 || done === total) reply({ done, total, failed });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  await trimCache(cache);
  reply({ done: total, total, failed, finished: true });
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_TILES) return;
  const extra = keys.slice(0, keys.length - MAX_TILES); // oldest first
  await Promise.all(extra.map((k) => cache.delete(k)));
}

async function cacheStats(reply) {
  const tiles = (await (await caches.open(TILE_CACHE)).keys()).length;
  const shellKeys = await (await caches.open(APP_CACHE)).keys();
  const data = shellKeys.filter((r) => new URL(r.url).pathname.startsWith("/data/")).length;
  reply({ count: tiles, shell: shellKeys.length, data });
}

async function warmData(urls, reply) {
  const cache = await caches.open(APP_CACHE);
  let done = 0;
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (r.ok) await cache.put(url, r);
    } catch { /* offline */ }
    done++;
    reply({ done, total: urls.length });
  }
  reply({ done, total: urls.length, finished: true });
}
