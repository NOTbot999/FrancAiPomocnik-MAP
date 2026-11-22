// Browser-only backend for the web version (spletna različica): no local server, so the app talks
// to the map services directly and keeps settings / drawings / tracks in this browser's storage.
// Mirrors the endpoints of app.py (desktop) and Backend.java (Android) that make sense on the web.
const VERSION = "1.6.3";
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const HALF = 20037508.342789244;
let layers = null;

async function layerIndex() {
  if (layers) return layers;
  const db = await fetch("data/layers.json").then((r) => r.json());
  layers = {};
  for (const l of db.base) layers[l.id] = l;
  for (const c of db.categories) for (const l of c.layers) layers[l.id] = l;
  for (const l of db.internal || []) layers[l.id] = l;
  return layers;
}
export const getLayerCfg = (id) => layers?.[id];
export const preloadLayers = layerIndex;

// ── tile URLs (same maths as build_upstream_url in app.py) ──
function bounds3857(z, x, y) {
  const res = 2 * HALF / 2 ** z, minx = -HALF + x * res, maxy = HALF - y * res;
  return [minx, maxy - res, minx + res, maxy];
}
function bounds4326(z, x, y) {
  const n = 2 ** z, lat = (yy) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI;
  return [x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)];
}
function toD96(lat, lng) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9999, lon0 = 15 * Math.PI / 180, fe = 500000, fn = -5000000;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2), phi = lat * Math.PI / 180, lam = lng * Math.PI / 180;
  const nn = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), t = Math.tan(phi) ** 2, c = ep2 * Math.cos(phi) ** 2, aa = (lam - lon0) * Math.cos(phi);
  const e4 = e2 * e2, e6 = e4 * e2;
  const m = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) - (35 * e6 / 3072) * Math.sin(6 * phi));
  return [fe + k0 * nn * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * aa ** 5 / 120),
    fn + k0 * (m + nn * Math.tan(phi) * (aa * aa / 2 + (5 - t + 9 * c + 4 * c * c) * aa ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * aa ** 6 / 720))];
}
export function tileUrl(cfg, z, x, y) {
  if (cfg.type === "tile") {
    let u = cfg.url;
    if (u.includes("{s}")) { const s = cfg.subdomains || "abc"; u = u.replace("{s}", s[(x + y) % s.length]); }
    return u.replace("{z}", z).replace("{x}", x).replace("{y}", y).replace("{r}", "");
  }
  if (cfg.type === "wms") {
    const ver = cfg.version || "1.1.1";
    let crs = "EPSG:3857", bbox = bounds3857(z, x, y).map((v) => v.toFixed(6)).join(",");
    if (cfg.crs === "EPSG:3794") {
      const [w, s, e, n] = bounds4326(z, x, y);
      const pts = [toD96(s, w), toD96(s, e), toD96(n, w), toD96(n, e)];
      crs = "EPSG:3794";
      bbox = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))].map((v) => v.toFixed(2)).join(",");
    }
    const q = new URLSearchParams({ SERVICE: "WMS", REQUEST: "GetMap", VERSION: ver, LAYERS: cfg.layers, STYLES: "", FORMAT: cfg.format || "image/png",
      TRANSPARENT: cfg.transparent === false ? "FALSE" : "TRUE", WIDTH: 256, HEIGHT: 256, [ver === "1.3.0" ? "CRS" : "SRS"]: crs, BBOX: bbox });
    if (cfg.time) q.set("TIME", cfg.time);   // WMS time dimension (GURS historical orthophoto)
    return cfg.url + (cfg.url.includes("?") ? "&" : "?") + q;
  }
  if (cfg.type === "arcgis_export") {
    const sr = cfg.bboxSR || 3857, transparent = cfg.transparent !== false;
    const b = sr === 4326 ? bounds4326(z, x, y) : bounds3857(z, x, y);
    const q = new URLSearchParams({ bbox: b.map((v) => v.toFixed(8)).join(","), bboxSR: sr, imageSR: cfg.imageSR || sr, size: "256,256", f: "image",
      format: cfg.format || (transparent ? "png32" : "jpg"), transparent: String(transparent) });
    if (cfg.layers) q.set("layers", cfg.layers);   // sub-layer selection, e.g. "show:5664"
    return `${cfg.url}?${q}`;
  }
  return "";
}

// ── storage (this browser only) ──
const KEY = (n) => `francmap:${n}`;
const lsGet = (n) => { try { const v = localStorage.getItem(KEY(n)); return v == null ? null : JSON.parse(v); } catch { return null; } };
const lsSet = (n, v) => { try { localStorage.setItem(KEY(n), JSON.stringify(v)); return true; } catch { return false; } };

// Nominatim usage policy: max 1 request / second
let nominatimLast = 0;
async function politeFetch(url, init) {
  if (url.includes("nominatim.openstreetmap.org")) {
    const wait = 1050 - (Date.now() - nominatimLast);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nominatimLast = Date.now();
  }
  return fetch(url, init);
}
const json = (status, data) => ({ status, text: JSON.stringify(data) });

async function overpass(query) {
  const ctrl = new AbortController();
  const attempts = OVERPASS_MIRRORS.map(async (m) => {
    const r = await fetch(m, { method: "POST", body: new URLSearchParams({ data: query }), signal: ctrl.signal });
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });
  try {
    const text = await Promise.any(attempts);
    ctrl.abort();
    return { status: 200, text };
  } catch {
    return json(503, { error: "Overpass trenutno ni dosegljiv.", elements: [] });
  }
}

// ── layer health (which map sources work) — like check_layer() in app.py, but from the browser:
// a sample tile per layer is loaded as an <img>; a source that answers with an error page
// (e.g. ARSO during maintenance) fails to decode → the layer is marked "X Name X".
// Results are kept for 6 h in this browser.
const HEALTH_MAX_AGE = 6 * 3600;
const HEALTH_PTS = [[46.0569, 14.5058], [46.2389, 14.3556], [46.5547, 15.6459]];   // Ljubljana, Kranj, Maribor
const savedHealth = lsGet("health");
const health = { checked: 0, results: {}, ...(savedHealth?.version === VERSION ? savedHealth : {}), running: false };
let healthScheduled = false;

function probeImage(url, ms = 15000) {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => { img.src = ""; resolve("timeout"); }, ms);
    img.onload = () => { clearTimeout(t); resolve(img.naturalWidth ? "ok" : "empty"); };
    img.onerror = () => { clearTimeout(t); resolve("error"); };
    img.src = url;
  });
}

async function checkLayerWeb(cfg) {
  const z = Math.max(cfg.minZoom || 0, 13);
  let last = "error";
  for (const [lat, lng] of HEALTH_PTS) {
    const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    last = await probeImage(tileUrl(cfg, z, x, y));
    if (last === "ok") return { status: "ok" };
  }
  return { status: "fail", detail: last === "timeout" ? "Ni odziva (vir ne deluje)" : "Strežnik ne vrača slike (vir ne deluje)" };
}

async function runHealthWeb() {
  if (health.running) return;
  health.running = true;
  try {
    const todo = Object.values(await layerIndex()).filter((l) => ["tile", "wms", "arcgis_export"].includes(l.type));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const l = todo[i++];
        health.results[l.id] = await checkLayerWeb(l);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    health.checked = Date.now() / 1000;
    lsSet("health", { checked: health.checked, version: VERSION, results: health.results });
  } finally {
    health.running = false;
  }
}

function healthStatus() {
  // first call after page load: re-check when the saved result is old, after the map's own tiles had a head start
  if (!healthScheduled && !health.running && Date.now() / 1000 - health.checked > HEALTH_MAX_AGE) {
    healthScheduled = true;
    setTimeout(runHealthWeb, 8000);
  }
  return { running: health.running, checked: health.checked, results: health.results };
}

const APP_ONLY = "Na voljo samo v aplikaciji za Windows ali Android.";

/** Handle an /api/… call in the browser. Returns { status, text }. */
export async function webApi(method, path, body) {
  const u = new URL(path, location.href);
  const p = u.pathname.replace(/^.*\/api\//, "/api/");
  try {
    if (p === "/api/status") return json(200, { online: navigator.onLine, forcedOffline: false, version: VERSION, dataDir: "ta brskalnik", job: null, platform: "web" });
    if (p === "/api/health") return json(200, healthStatus());
    if (p === "/api/health/run") { runHealthWeb(); return json(200, { running: true }); }
    if (p.startsWith("/api/store/")) {
      const name = p.slice("/api/store/".length);
      if (method === "GET") return json(200, lsGet(name));
      return lsSet(name, body ? JSON.parse(body) : null) ? json(200, { ok: true }) : json(507, { error: "Shramba brskalnika je polna." });
    }
    if (p === "/api/fetch") {
      const r = await politeFetch(u.searchParams.get("url"), { headers: { Accept: "application/json" } });
      return { status: r.status, text: await r.text() };
    }
    if (p === "/api/overpass") return overpass(JSON.parse(body || "{}").query || "");
    if (p === "/api/network") return json(200, { online: navigator.onLine, forcedOffline: false });
    if (p === "/api/cache/stats") return json(200, { layers: [], http: { entries: 0, bytes: 0 }, fileBytes: 0, path: "", web: true });
    if (p === "/api/cache/clear") return json(200, { layers: [], http: { entries: 0, bytes: 0 }, fileBytes: 0, path: "", web: true });
    if (p === "/api/offline/status") return json(200, null);
    if (p.startsWith("/api/offline/")) return json(400, { error: APP_ONLY });
    if (p === "/api/collab/hostinfo") return json(200, { hosting: false });
    if (p === "/api/collab/host") return json(400, { error: APP_ONLY });
    if (p === "/api/collab/call") {
      const c = JSON.parse(body || "{}");
      if (location.protocol === "https:" && c.server?.startsWith("http:"))
        return json(400, { error: "Spletna stran se lahko poveže le s strežnikom HTTPS. Za sejo v domačem Wi-Fi uporabi aplikacijo." });
      const r = await fetch(c.server.replace(/\/+$/, "") + c.path, c.method === "GET" ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.body || {}) });
      return { status: r.status, text: await r.text() };
    }
    return json(404, { error: "unknown endpoint" });
  } catch (e) {
    return json(503, { error: `Ni povezave (${e.message}).` });
  }
}
