// Midpoints ("Sredina"):
//   • between 2+ points — geographic centre (average on the sphere); for 2 points the exact middle
//   • along a path (drawn line / saved route, GPX track, current navigation) — the point at half the
//     length, or the path split into N equal parts
// Results are shown as 🎯 markers with coordinates, distances, copy / "add as marker" / "route here".
import { map } from "../map/map.js";
import { emit } from "../runtime/state.js";
import { esc, haversine, pathLength, fmtDist, toD96, copyText } from "../shared/util.js";
import { icon } from "../shared/icons.js";

let layer = null;
const RAD = Math.PI / 180;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const pointLetter = (i) => LETTERS[i] || String(i + 1);

/** Geographic centre of points [[lat, lng], …] (unit-vector average — correct also over long distances). */
export function centroid(pts) {
  let x = 0, y = 0, z = 0;
  for (const [lat, lng] of pts) {
    const a = lat * RAD, b = lng * RAD;
    x += Math.cos(a) * Math.cos(b); y += Math.cos(a) * Math.sin(b); z += Math.sin(a);
  }
  const n = pts.length;
  x /= n; y /= n; z /= n;
  return [Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD];
}

/** Point at distance d (m) along a path. */
function atDistance(pts, d) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = haversine(pts[i - 1], pts[i]);
    if (acc + seg >= d && seg > 0) {
      const f = (d - acc) / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  return [last[0], last[1]];
}

/** Split a path into n equal parts → the n − 1 division points with their distance from the start. */
export function divideAlong(pts, n) {
  const total = pathLength(pts), out = [];
  for (let k = 1; k < n; k++) out.push({ latlng: atDistance(pts, total * k / n), dist: total * k / n, total });
  return out;
}

const icn = (label) => L.divIcon({
  className: "", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
  html: `<div class="emoji-marker mid-marker">🎯${label ? `<b>${esc(label)}</b>` : ""}</div>`,
});

function popupHtml(r) {
  const [lat, lng] = r.latlng, { e, n } = toD96(lat, lng);
  return `<div class="pop stack" style="min-width:230px">
    <b>🎯 ${esc(r.title)}</b>
    <div class="pin-info">
      <span>WGS84</span><b>${lat.toFixed(6)}, ${lng.toFixed(6)}</b>
      <span>D96/TM</span><b>e ${Math.round(e)}, n ${Math.round(n)}</b>
    </div>
    ${r.info ? `<div class="small">${r.info}</div>` : ""}
    <div class="actions">
      <button class="btn sm" data-m="copy">${icon("copy")} Kopiraj</button>
      <button class="btn sm" data-m="mark">${icon("pin")} Dodaj kot oznako</button>
      <button class="btn sm" data-m="route">${icon("route")} Pot do sem</button>
    </div></div>`;
}

/**
 * Show results.
 *   results: [{ latlng, title, info, label }]
 *   sources: optional [[lat, lng], …] — dashed lines from each source to the (single) result
 */
export function showMidpoints(results, { sources = null, fit = true } = {}) {
  clearMidpoints();
  layer = L.layerGroup().addTo(map);
  if (sources && results.length === 1) {
    for (const s of sources) L.polyline([s, results[0].latlng], { color: "#e11d48", weight: 2, dashArray: "5,6", opacity: 0.8, interactive: false, pane: "vectors" }).addTo(layer);
  }
  const markers = results.map((r) => {
    const m = L.marker(r.latlng, { icon: icn(r.label), pane: "top", zIndexOffset: 900 }).addTo(layer);
    m.bindPopup(() => popupHtml(r), { maxWidth: 320 });
    m.on("popupopen", (ev) => {
      ev.popup.getElement().onclick = (e) => {
        const a = e.target.closest("[data-m]")?.dataset.m;
        if (!a) return;
        const [lat, lng] = r.latlng, { e: E, n: N } = toD96(lat, lng);
        if (a === "copy") copyText(`${r.title}\nWGS84: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nD96/TM: e ${Math.round(E)}, n ${Math.round(N)}`, r.title);
        if (a === "mark") { map.closePopup(); emit("add-marker", { latlng: [lat, lng], name: r.title }); }
        if (a === "route") { map.closePopup(); emit("route-point", { which: "to", latlng: [lat, lng], label: r.title }); }
      };
    });
    return m;
  });
  if (fit) {
    const all = [...results.map((r) => r.latlng), ...(sources || [])];
    if (all.length > 1) map.fitBounds(L.latLngBounds(all), { padding: [70, 70], maxZoom: 16 });
    else map.setView(all[0], Math.max(map.getZoom(), 15));
  }
  if (markers.length === 1) setTimeout(() => markers[0].openPopup(), 350);
  emit("midpoints", results.length);
}

export function clearMidpoints() {
  if (layer) { map.removeLayer(layer); layer = null; emit("midpoints", 0); }
}
export const hasMidpoints = () => !!layer;

/** Centre of several points (labels A, B, C …). */
export function showCentre(pts, names = []) {
  const c = centroid(pts);
  const label = (i) => names[i] || pointLetter(i);
  const dists = pts.map((p, i) => `${esc(label(i))} ${fmtDist(haversine(p, c))}`).join(" · ");
  showMidpoints([{
    latlng: c,
    title: pts.length === 2 ? `Sredina med ${label(0)} in ${label(1)}` : `Središče ${pts.length} točk`,
    info: `Zračna razdalja do točk: ${dists}`,
  }], { sources: pts });
}

/** Midpoint (n = 2) or n equal parts of a path. */
export function showAlongPath(pts, name, n = 2) {
  if (!pts || pts.length < 2) return;
  const parts = divideAlong(pts.map((p) => [p[0], p[1]]), Math.max(2, Math.min(50, n | 0)));
  showMidpoints(parts.map((p, i) => ({
    latlng: p.latlng,
    label: n > 2 ? String(i + 1) : "",
    title: n > 2 ? `${name} — ${i + 1}/${n}` : `Sredina poti ${name}`,
    info: `Od začetka ${fmtDist(p.dist)} · do konca ${fmtDist(p.total - p.dist)} (skupaj ${fmtDist(p.total)})`,
  })));
}

/** Buttons for a path: "Sredina" + "Razdeli na [N] delov". */
export const pathButtonsHtml = (attr) => `
  <span class="mid-row">
    <button class="btn sm" ${attr}="mid" title="Točka na polovici poti">🎯 Sredina</button>
    <button class="btn sm" ${attr}="split" title="Razdeli pot na enake dele">Razdeli na</button>
    <input class="field mid-n" type="number" min="2" max="50" value="3" title="Število delov"> <span class="small muted">delov</span>
  </span>`;
/** Read N from the input next to the clicked button. */
export const splitCount = (btn) => +(btn.closest(".mid-row")?.querySelector(".mid-n")?.value) || 3;
