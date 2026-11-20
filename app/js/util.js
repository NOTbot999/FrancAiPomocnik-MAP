// Shared helpers: formatting, geodesy, D96/TM, toasts, file I/O
import { IS_ANDROID, androidSave, androidOpen, androidCopy } from "./api.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ── Geodesy ──
const R = 6371008.8;
const rad = (d) => d * Math.PI / 180;
export function haversine(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
export function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return d;
}
// Geodesic polygon area (spherical excess approximation, good for local areas)
export function polygonArea(pts) {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    area += rad(p2[1] - p1[1]) * (2 + Math.sin(rad(p1[0])) + Math.sin(rad(p2[0])));
  }
  return Math.abs(area * R * R / 2);
}

export function fmtDist(m) {
  if (m == null || isNaN(m)) return "—";
  if (m >= 10000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}
export function fmtArea(m2) {
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2)} km²`;
  if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(2)} ha`;
  return `${Math.round(m2)} m²`;
}
export function fmtDur(s) {
  if (s == null || isNaN(s)) return "—";
  s = Math.round(s);
  const hh = Math.floor(s / 3600), mm = Math.round((s % 3600) / 60);
  return hh ? `${hh} h ${mm} min` : `${mm} min`;
}
export function fmtBytes(b) {
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b > 1e3) return `${Math.round(b / 1e3)} kB`;
  return `${b} B`;
}
export const fmtNum = (n) => Number(n).toLocaleString("sl-SI");

// ── D96/TM (EPSG:3794) — Transverse Mercator on GRS80 ──
const A = 6378137, F = 1 / 298.257222101, K0 = 0.9999, LON0 = rad(15), FE = 500000, FN = -5000000;
const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
function meridionalArc(phi) {
  const e4 = E2 * E2, e6 = e4 * E2;
  return A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
}
export function toD96(lat, lng) {
  const phi = rad(lat), lam = rad(lng);
  const N = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2, C = EP2 * Math.cos(phi) ** 2, Aa = (lam - LON0) * Math.cos(phi);
  const M = meridionalArc(phi);
  const e = FE + K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120);
  const n = FN + K0 * (M + N * Math.tan(phi) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
  return { e, n };
}
export function fromD96(e, n) {
  const M = (n - FN) / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2), T1 = Math.tan(phi1) ** 2, C1 = EP2 * Math.cos(phi1) ** 2;
  const R1 = A * (1 - E2) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5, D = (e - FE) / (N1 * K0);
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lng = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(phi1);
  return [lat * 180 / Math.PI, lng * 180 / Math.PI];
}

export function fmtDMS(v, pos, neg) {
  const s = v < 0 ? neg : pos; v = Math.abs(v);
  const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), sec = (mf - m) * 60;
  return `${d}°${String(m).padStart(2, "0")}′${sec.toFixed(1).padStart(4, "0")}″${s}`;
}
export function fmtLatLng(lat, lng, mode = "dec") {
  if (mode === "dms") return `${fmtDMS(lat, "N", "S")} ${fmtDMS(lng, "E", "W")}`;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
export function fmtD96(lat, lng) {
  const { e, n } = toD96(lat, lng);
  return `e ${Math.round(e)}  n ${Math.round(n)}`;
}

// Parse "46.05, 14.5", "46°03'N 14°30'E" or D96 "e 462000 n 101000" / "462000 101000"
export function parseCoords(q) {
  const s = q.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  let m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s+(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
  }
  m = s.match(/^e?\s*(\d{6}(?:\.\d+)?)\s+n?\s*(\d{5,6}(?:\.\d+)?)$/i);
  if (m) {
    const e = +m[1], n = +m[2];
    if (e > 350000 && e < 650000 && n > 0 && n < 200000) return fromD96(e, n);
  }
  m = q.match(/(\d+)[°\s]+(\d+)['′\s]+([\d.]+)?["″]?\s*([NS])[\s,]+(\d+)[°\s]+(\d+)['′\s]+([\d.]+)?["″]?\s*([EW])/i);
  if (m) {
    const lat = (+m[1] + m[2] / 60 + (+m[3] || 0) / 3600) * (/s/i.test(m[4]) ? -1 : 1);
    const lng = (+m[5] + m[6] / 60 + (+m[7] || 0) / 3600) * (/w/i.test(m[8]) ? -1 : 1);
    return [lat, lng];
  }
  return null;
}

// ── Toasts ──
export function toast(msg, kind = "", ms = 2800) {
  const el = h(`<div class="toast ${kind}">${esc(msg)}</div>`);
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export async function copyText(text) {
  if (IS_ANDROID) { androidCopy(text); toast("Kopirano: " + text, "ok", 1800); return; }
  try { await navigator.clipboard.writeText(text); toast("Kopirano: " + text, "ok", 1800); }
  catch { toast("Kopiranje ni uspelo", "err"); }
}

// ── Files (native dialogs via pywebview on desktop, system file picker on Android) ──
const native = () => window.pywebview?.api;
export async function saveTextFile(filename, content, mime = "text/plain") {
  if (IS_ANDROID) {
    const p = await androidSave(filename, content);
    if (p) toast("Shranjeno: " + p, "ok");
    return p;
  }
  if (native()?.save_text) {
    const p = await native().save_text(filename, content);
    if (p) toast("Shranjeno: " + p, "ok");
    return p;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return filename;
}
export function openTextFiles(accept = ".gpx,.geojson,.json,.kml") {
  if (IS_ANDROID) return androidOpen();
  if (native()?.open_text) return native().open_text();
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = accept; inp.multiple = true;
    inp.onchange = async () => {
      const out = [];
      for (const f of inp.files) out.push({ name: f.name, content: await f.text() });
      resolve(out);
    };
    inp.click();
  });
}

export const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#0f766e", "#4b5563"];
