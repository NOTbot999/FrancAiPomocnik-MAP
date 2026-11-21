// Talks to the app's backend: Python (desktop), Java (inside the Android app) or — for the web
// version (spletna različica) — a browser-only backend that calls the map services directly.
// All three expose the same /api/… endpoints.
import { webApi, tileUrl, getLayerCfg } from "./webbackend.js";

const params = new URLSearchParams(location.search);
const bridge = window.FrancAndroid || null;          // Android JavaScript interface
export const IS_ANDROID = !!bridge;
export const TOKEN = (bridge && bridge.token()) || params.get("t") || sessionStorage.getItem("fm_token") || "";
if (TOKEN) sessionStorage.setItem("fm_token", TOKEN);
// No local backend (no token, no Android bridge) → we're running as a normal website
export const IS_WEB = !bridge && !TOKEN;
if (IS_WEB) document.documentElement.classList.add("web");
const PORT = location.port;

// ── Android bridge: async request/response by id ──
const waiting = new Map();
let seq = 0;
window.__fmResolve = (id, status, text) => {
  const w = waiting.get(id);
  if (!w) return;
  waiting.delete(id);
  w(status, text);
};
function bridgeCall(fn, ...args) {
  return new Promise((resolve) => {
    const id = `r${++seq}`;
    waiting.set(id, (status, text) => resolve({ status, text }));
    bridge[fn](id, ...args);
  });
}

export async function api(path, { method = "GET", body } = {}) {
  let status, text;
  if (bridge) {
    ({ status, text } = await bridgeCall("request", method, path, body !== undefined ? JSON.stringify(body) : ""));
  } else if (IS_WEB) {
    ({ status, text } = await webApi(method, path, body !== undefined ? JSON.stringify(body) : ""));
  } else {
    const res = await fetch(path, {
      method,
      headers: { "X-Token": TOKEN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    text = await res.text();
  }
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (status < 200 || status >= 300) {
    const err = new Error((data && data.error) || `HTTP ${status}`);
    err.status = status;
    err.data = data;
    throw err;
  }
  return data;
}

export function androidCopy(text) { bridge.copy(text); }

// Native file dialogs on Android (resolve with saved name / [{name, content}])
export async function androidSave(filename, content) {
  const { text } = await bridgeCall("saveText", filename, content);
  return JSON.parse(text);
}
export async function androidOpen() {
  const { text } = await bridgeCall("openText");
  try { return JSON.parse(text) || []; } catch { return []; }
}

// Cached GET of an allowed external URL (JSON). ttl in seconds.
export function fetchJSON(url, ttl = 86400) {
  return api(`/api/fetch?url=${encodeURIComponent(url)}&ttl=${ttl}`);
}

export function overpass(query, ttl = 7 * 86400) {
  return api("/api/overpass", { method: "POST", body: { query, ttl } });
}

// Tile URLs served by the local cache. Several host aliases lift the browser's
// 6-connections-per-host limit so tiles load in parallel.
export const TILE_SUBDOMAINS = ["t1", "t2", "t3", "t4"];
export function tileHost(sub = "{s}") {
  return bridge ? `https://${sub}.francmap.local` : `${location.protocol}//${sub}.localhost:${PORT}`;
}
export function tileTemplate(layerId) {
  return `${tileHost()}/tiles/${layerId}/{z}/{x}/{y}`;
}
// Web version: tiles come straight from the map service (no local cache)
export function directTileUrl(layerId, z, x, y) {
  const cfg = getLayerCfg(layerId);
  return cfg ? tileUrl(cfg, z, x, y) : "";
}
// An external image (e.g. a WMS legend): through the local cache in the apps, direct on the web
export function proxiedImage(url, ttl = 2592000) {
  return IS_WEB ? url : `/api/fetch?url=${encodeURIComponent(url)}&ttl=${ttl}&t=${TOKEN}`;
}

// Simple persisted key/value store (JSON files in the app's data folder)
const pending = new Map();
export const store = {
  async get(name, fallback) {
    try {
      const v = await api(`/api/store/${name}`);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(name, value, delay = 400) {
    clearTimeout(pending.get(name));
    pending.set(name, setTimeout(() => {
      pending.delete(name);
      api(`/api/store/${name}`, { method: "PUT", body: value }).catch(() => {});
    }, delay));
  },
};
