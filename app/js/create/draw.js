import { map } from "../map/map.js";
import { store } from "../services/api.js";
import { state, on, emit } from "../runtime/state.js";
import { esc, uid, pathLength, polygonArea, fmtDist, fmtArea, COLORS, toast, saveTextFile, openTextFiles, $, h, toD96, copyText } from "../shared/util.js";
import { openMeteo } from "../services/external.js";
import { icon } from "../shared/icons.js";
import { setHint, setActions, cancelPick, pinIcon } from "../shared/tools.js";
import { toGeoJSON, toGPX, toKML, parseFile } from "./geoio.js";
import { showProfile } from "../explore/profile.js";
import { showCentre, showAlongPath, showMidpoints, centroid, clearMidpoints, hasMidpoints, pathButtonsHtml, splitCount, pointLetter } from "./midpoint.js";
import { loadMyMap, saveMyMap, emptyMap, newLayer, normalizeMap, adoptFeatures, layerByName } from "./mymaps.js";

let features = [];
let projects = [];
let group;              // rendered features
const layerOf = new Map();
let mymap = null;       // "Moje karte": title, description, layers (see mymaps.js)
let tool = null;        // active drawing tool
let editing = null;     // { id, handles: [] }
let selected = null;
let panelEl = null;
let measureResult = null;

export async function initDraw() {
  group = L.featureGroup().addTo(map);
  [features, projects, mymap] = await Promise.all([store.get("drawings", []), store.get("projects", []), loadMyMap()]);
  if (adoptFeatures(mymap, features)) persist();
  saveMyMap(mymap);
  renderAll();
  on("add-marker", ({ latlng, name }) => addFeature({ type: "marker", coords: latlng, name: name || "Oznaka" }, true));
  on("midpoints", () => refreshPanel());
}

const persist = () => store.set("drawings", features);
const persistMap = () => saveMyMap(mymap);

// ── layers of the current map ──
const layerOfFeature = (f) => mymap.layers.find((l) => l.id === f.layer) || mymap.layers[0];
const activeLayer = () => mymap.layers.find((l) => l.id === mymap.active) || mymap.layers[0];
const isVisible = (f) => layerOfFeature(f).visible !== false;
export const getMyMap = () => mymap;

function setLayerColor(l, c) {      // features that still use the layer colour follow it
  for (const f of features) if (f.layer === l.id && f.color === l.color) f.color = c;
  l.color = c;
  persistMap(); persist(); renderAll();
}
function deleteLayer(id) {
  if (mymap.layers.length === 1) return toast("Karta mora imeti vsaj en sloj.");
  const l = mymap.layers.find((x) => x.id === id);
  const n = features.filter((f) => f.layer === id).length;
  if (n && !confirm(`Izbrišem sloj »${l.name}« in ${n} elementov v njem?`)) return;
  if (editing && features.find((f) => f.id === editing.id)?.layer === id) stopEditing();
  features = features.filter((f) => f.layer !== id);
  mymap.layers = mymap.layers.filter((x) => x.id !== id);
  if (mymap.active === id) mymap.active = mymap.layers[0].id;
  persistMap(); persist(); renderAll();
}
function zoomToLayer(id) {
  const fs = features.filter((f) => f.layer === id);
  if (!fs.length) return toast("Sloj je prazen.");
  const b = L.latLngBounds(fs.flatMap((f) => (f.type === "marker" ? [f.coords] : f.coords).map((p) => [p[0], p[1]])));
  map.flyToBounds(b, { padding: [60, 60], maxZoom: 16, duration: 0.6 });
}

function measureText(f) {
  if (f.type === "line") return fmtDist(pathLength(f.coords));
  if (f.type === "polygon") return `${fmtArea(polygonArea(f.coords))} · obseg ${fmtDist(pathLength([...f.coords, f.coords[0]]))}`;
  return `${f.coords[0].toFixed(5)}, ${f.coords[1].toFixed(5)}`;
}

function renderFeature(f) {
  layerOf.get(f.id) && group.removeLayer(layerOf.get(f.id));
  layerOf.delete(f.id);
  if (!isVisible(f)) return;          // its layer is hidden
  let l;
  const sel = selected === f.id;
  if (f.type === "marker") l = L.marker(f.coords, { icon: pinIcon(f.color, f.emoji || ""), pane: "top", draggable: false });
  else if (f.type === "line") l = L.polyline(f.coords.map((p) => [p[0], p[1]]), { pane: "vectors", color: f.color, weight: sel ? 6 : 4, opacity: 0.95, lineCap: "round" });
  else l = L.polygon(f.coords.map((p) => [p[0], p[1]]), { pane: "vectors", color: f.color, weight: sel ? 4 : 2.5, fillOpacity: 0.18 });
  l.bindTooltip(`<b>${esc(f.name)}</b><br>${measureText(f)}`, { sticky: f.type !== "marker", direction: "top" });
  l.on("click", (e) => { L.DomEvent.stop(e); if (!tool) openFeaturePopup(f, e.latlng); });
  group.addLayer(l);
  layerOf.set(f.id, l);
}

function renderAll() {
  group.clearLayers();
  layerOf.clear();
  features.forEach(renderFeature);
  refreshPanel();
  emit("drawings-changed", features.length);
}

export function getDrawings() { return features; }

export function addFeature(f, open = false) {
  const ids = new Set(mymap.layers.map((l) => l.id));
  const ly = ids.has(f.layer) ? mymap.layers.find((l) => l.id === f.layer) : activeLayer();
  const nf = { id: uid("f"), color: ly.color, note: "", ...f, layer: ly.id };
  if (!nf.name) nf.name = { marker: "Oznaka", line: "Črta", polygon: "Območje" }[nf.type] + " " + (features.filter((x) => x.type === nf.type).length + 1);
  features.push(nf);
  renderFeature(nf);
  persist();
  refreshPanel();
  emit("drawings-changed", features.length);
  if (open) openFeaturePopup(nf);
  return nf;
}

function updateFeature(id, patch) {
  const f = features.find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, patch);
  renderFeature(f);
  persist();
  refreshPanel();
}

function deleteFeature(id) {
  if (editing?.id === id) stopEditing();
  features = features.filter((x) => x.id !== id);
  const l = layerOf.get(id);
  if (l) { group.removeLayer(l); layerOf.delete(id); }
  persist();
  refreshPanel();
  emit("drawings-changed", features.length);
}

function zoomTo(f) {
  if (f.type === "marker") map.flyTo(f.coords, Math.max(map.getZoom(), 15), { duration: 0.6 });
  else map.flyToBounds(L.latLngBounds(f.coords.map((p) => [p[0], p[1]])), { padding: [60, 60], duration: 0.6 });
}

// Marker details: WGS84, D96/TM and elevation (Open-Meteo, cached on the marker so it also works offline)
const eleKey = (f) => `${f.coords[0].toFixed(5)},${f.coords[1].toFixed(5)}`;
const fmtEle = (f) => (f.ele != null && f.eleAt === eleKey(f) ? `${Math.round(f.ele)} m` : null);
function pinInfoHtml(f) {
  const [lat, lng] = f.coords, { e, n } = toD96(lat, lng);
  return `<div class="pin-info">
    <span>WGS84</span><b>${lat.toFixed(6)}, ${lng.toFixed(6)}</b>
    <span>D96/TM</span><b>e ${Math.round(e)}, n ${Math.round(n)}</b>
    <span>Nadm. višina</span><b data-ele>${fmtEle(f) || '<span class="muted">nalagam …</span>'}</b>
  </div>`;
}
async function ensureElevation(f) {
  if (fmtEle(f)) return fmtEle(f);
  try {
    const d = await openMeteo.elevation([f.coords]);
    const v = d.elevation?.[0];
    if (v == null) return null;
    f.ele = v; f.eleAt = eleKey(f);
    persist();
    return fmtEle(f);
  } catch { return null; }
}
function pinCopyText(f) {
  const [lat, lng] = f.coords, { e, n } = toD96(lat, lng);
  return [f.name, `WGS84: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, `D96/TM: e ${Math.round(e)}, n ${Math.round(n)}`,
    `Nadmorska višina: ${fmtEle(f) || "ni podatka"}`, f.note ? `Opomba: ${f.note}` : ""].filter(Boolean).join("\n");
}

function openFeaturePopup(f, at) {
  selected = f.id;
  if (!isVisible(f)) { layerOfFeature(f).visible = true; persistMap(); renderAll(); }
  const pos = at || (f.type === "marker" ? f.coords : layerOf.get(f.id).getBounds().getCenter());
  const swatches = COLORS.map((c) => `<button class="swatch" style="background:${c};width:18px;height:18px;border:2px solid ${c === f.color ? "var(--text)" : "transparent"}" data-color="${c}"></button>`).join("");
  const html = `<div class="pop stack" style="min-width:240px">
    <input class="field" data-k="name" value="${esc(f.name)}" placeholder="Ime">
    ${f.type === "marker" ? pinInfoHtml(f) : `<div class="small muted">${measureText(f)}</div>`}
    <div class="row wrap" style="gap:4px">${swatches}</div>
    ${mymap.layers.length > 1 ? `<label class="row small" style="gap:6px"><span class="muted">Sloj</span><select class="field grow" data-layer-sel>${mymap.layers.map((l) => `<option value="${l.id}" ${l.id === f.layer ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>` : ""}
    <textarea class="field" data-k="note" placeholder="Opomba…">${esc(f.note || "")}</textarea>
    ${f.type === "line" ? `<div class="actions">${pathButtonsHtml("data-a")}</div>` : ""}
    <div class="actions">
      ${f.type === "line" ? `<button class="btn sm" data-a="profile">${icon("mountain")} Profil</button>` : ""}
      ${f.type === "polygon" ? `<button class="btn sm" data-a="centre" title="Središče območja">🎯 Središče</button>` : ""}
      ${f.type !== "marker" ? `<button class="btn sm" data-a="edit">${icon("edit")} Uredi točke</button>` : `<button class="btn sm" data-a="copy" title="Ime, koordinate WGS84 in D96/TM, nadmorska višina in opomba">${icon("copy")} Kopiraj vse</button><button class="btn sm" data-a="move">${icon("edit")} Premakni</button><button class="btn sm" data-a="route">${icon("route")} Pot do sem</button>`}
      <button class="btn sm danger" data-a="del">${icon("trash")}</button>
    </div></div>`;
  const p = L.popup({ maxWidth: 320, autoPanPadding: [40, 40] }).setLatLng(pos).setContent(html).openOn(map);
  renderFeature(f);
  refreshPanel();
  const el = p.getElement();
  if (f.type === "marker" && !fmtEle(f)) {
    ensureElevation(f).then((txt) => { const s = el.querySelector("[data-ele]"); if (s) s.textContent = txt || "ni podatka"; });
  }
  el.querySelector("[data-layer-sel]")?.addEventListener("change", (e) => {
    const to = mymap.layers.find((l) => l.id === e.target.value);
    const from = layerOfFeature(f);
    updateFeature(f.id, { layer: to.id, ...(f.color === from.color ? { color: to.color } : {}) });
    if (to.visible === false) map.closePopup();
  });
  el.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k) { f[k] = e.target.value; persist(); refreshPanel(); layerOf.get(f.id)?.setTooltipContent(`<b>${esc(f.name)}</b><br>${measureText(f)}`); }
  });
  el.addEventListener("click", (e) => {
    const c = e.target.closest("[data-color]");
    if (c) { updateFeature(f.id, { color: c.dataset.color }); map.closePopup(); return openFeaturePopup(f, pos); }
    const btn = e.target.closest("[data-a]"), a = btn?.dataset.a;
    if (!a) return;
    if (a === "mid" || a === "split") { map.closePopup(); showAlongPath(f.coords, f.name, a === "mid" ? 2 : splitCount(btn)); return; }
    if (a === "centre") { map.closePopup(); showMidpoints([{ latlng: centroid(f.coords), title: `Središče ${f.name}`, info: `Povprečje ${f.coords.length} oglišč območja` }]); return; }
    if (a === "copy") {   // keep the popup open
      ensureElevation(f).then(() => copyText(pinCopyText(f), `${f.name} (koordinate in višina)`));
      return;
    }
    map.closePopup();
    if (a === "del") deleteFeature(f.id);
    if (a === "profile") showProfile(f.name, f.coords, f.color);
    if (a === "edit" || a === "move") startEditing(f);
    if (a === "route") emit("route-point", { which: "to", latlng: f.coords, label: f.name });
  });
  p.on("remove", () => { if (selected === f.id) { selected = null; renderFeature(f); refreshPanel(); } });
}

// ── Vertex editing ──
function startEditing(f) {
  stopEditing();
  stopTool();
  editing = { id: f.id, handles: [] };
  const pts = f.type === "marker" ? [f.coords] : f.coords;
  const hIcon = L.divIcon({ className: "", html: '<div class="vertex-handle"></div>', iconSize: [12, 12] });
  pts.forEach((p, i) => {
    const m = L.marker([p[0], p[1]], { icon: hIcon, draggable: true, pane: "top", zIndexOffset: 1000 }).addTo(map);
    m.on("drag", (e) => {
      const ll = e.target.getLatLng();
      if (f.type === "marker") f.coords = [ll.lat, ll.lng];
      else f.coords[i] = [ll.lat, ll.lng];
      const l = layerOf.get(f.id);
      if (f.type === "marker") l.setLatLng(ll); else l.setLatLngs(f.coords.map((q) => [q[0], q[1]]));
    });
    m.on("dragend", () => { renderFeature(f); persist(); refreshPanel(); });
    m.on("contextmenu", (e) => {
      L.DomEvent.stop(e);
      const min = f.type === "polygon" ? 3 : 2;
      if (f.type === "marker" || f.coords.length <= min) return;
      f.coords.splice(i, 1);
      renderFeature(f); persist(); startEditing(f);
    });
    editing.handles.push(m);
  });
  setHint(`Povleci točke · desni klik izbriše točko · <kbd>Enter</kbd>/<kbd>Esc</kbd> konča`);
  setActions([{ label: "Končaj urejanje", run: stopEditing, primary: true }]);
  emit("tool-start");
}

function stopEditing() {
  if (!editing) return;
  editing.handles.forEach((m) => map.removeLayer(m));
  editing = null;
  setHint(null);
  setActions(null);
  refreshPanel();
}

// ── Drawing / measuring tool ──
const TOOL_INFO = {
  marker: { hint: "Klikni na karto za oznako" },
  line: { hint: "Klikaj točke črte · dvoklik ali <kbd>Enter</kbd> konča · <kbd>Backspace</kbd> razveljavi" },
  polygon: { hint: "Klikaj oglišča območja · dvoklik ali <kbd>Enter</kbd> konča" },
  "measure-line": { hint: "Merjenje razdalje · klikaj točke · <kbd>Enter</kbd> konča" },
  "measure-area": { hint: "Merjenje površine · klikaj oglišča · <kbd>Enter</kbd> konča" },
  midpoint: { hint: "Sredina · klikaj 2 ali več točk (klik na oznako jo uporabi) · <kbd>Enter</kbd> izračuna" },
};

export function startTool(kind) {
  cancelPick();
  stopTool();
  stopEditing();
  map.closePopup();
  measureResult = null;
  tool = { kind, pts: [], preview: L.layerGroup().addTo(map), label: null, lastClick: 0 };
  map.getContainer().style.cursor = "crosshair";
  map.doubleClickZoom.disable();
  setHint(`${TOOL_INFO[kind].hint} · <kbd>Esc</kbd> prekliče`);
  setActions(kind === "marker"
    ? [{ label: "Prekliči", run: stopTool }]
    : [{ label: "Razveljavi", run: undoPoint }, { label: "Končaj", run: finishTool, primary: true }, { label: "Prekliči", run: stopTool }]);
  emit("tool-start");
  map.on("click", onClick);
  map.on("mousemove", onMove);
  map.on("dblclick", onDbl);
  refreshPanel();
}

// a drawing / measuring tool or vertex editing is in progress (keyboard shortcuts must not cancel it)
export const isDrawing = () => !!tool || !!editing;

export function stopTool() {
  if (!tool) return;
  map.off("click", onClick); map.off("mousemove", onMove); map.off("dblclick", onDbl);
  map.removeLayer(tool.preview);
  tool = null;
  map.getContainer().style.cursor = "";
  map.doubleClickZoom.enable();
  setHint(null);
  setActions(null);
  refreshPanel();
}

function undoPoint() {
  if (!tool?.pts.length) return;
  tool.pts.pop();
  tool.preview.clearLayers();
  if (tool.pts.length) drawPreview(tool.pts[tool.pts.length - 1]);
}

const isArea = () => tool && (tool.kind === "polygon" || tool.kind === "measure-area");

function onClick(e) {
  const p = [e.latlng.lat, e.latlng.lng];
  if (tool.kind === "marker") { addFeature({ type: "marker", coords: p }, true); stopTool(); return; }
  const last = tool.pts[tool.pts.length - 1];
  if (last && map.latLngToContainerPoint(last).distanceTo(e.containerPoint) < 4) return; // dblclick duplicate
  if (tool.kind === "midpoint") {
    const cp = e.containerPoint;
    const hit = features.find((f) => f.type === "marker" && map.latLngToContainerPoint(f.coords).distanceTo(cp) < 16);
    tool.names ||= [];
    if (hit) { p[0] = hit.coords[0]; p[1] = hit.coords[1]; }
    tool.names.push(hit ? hit.name : pointLetter(tool.pts.length));
  }
  tool.pts.push(p);
  drawPreview(p);
}

function onMove(e) { if (tool?.pts.length) drawPreview([e.latlng.lat, e.latlng.lng]); }
function onDbl(e) { L.DomEvent.stop(e); finishTool(); }

function drawPreview(cursor) {
  const pts = [...tool.pts, cursor];
  tool.preview.clearLayers();
  if (tool.kind === "midpoint") {   // points + live centre
    tool.pts.forEach((p, i) => L.marker(p, { pane: "top", interactive: false, icon: L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11],
      html: `<div class="emoji-marker mid-pt">${esc(tool.names?.[i]?.length <= 2 ? tool.names[i] : pointLetter(i))}</div>` }) }).addTo(tool.preview));
    if (tool.pts.length >= 2) {
      const c = centroid(tool.pts);
      tool.pts.forEach((p) => L.polyline([p, c], { color: "#e11d48", weight: 2, dashArray: "5,6", interactive: false, pane: "vectors" }).addTo(tool.preview));
      L.circleMarker(c, { radius: 6, color: "#fff", weight: 2, fillColor: "#e11d48", fillOpacity: 1, interactive: false, pane: "top" }).addTo(tool.preview);
    }
    L.tooltip({ permanent: true, direction: "right", offset: [12, 0], className: "measure-label" }).setLatLng(cursor)
      .setContent(tool.pts.length < 2 ? `Točk: ${tool.pts.length} — klikni še ${2 - tool.pts.length}` : `Točk: ${tool.pts.length} · Enter = sredina`).addTo(tool.preview);
    return;
  }
  const c = tool.kind.startsWith("measure") ? "#f97316" : activeLayer().color;
  if (isArea() && pts.length > 2) L.polygon(pts, { color: c, weight: 2.5, dashArray: "6,5", fillOpacity: 0.15, interactive: false, pane: "vectors" }).addTo(tool.preview);
  else L.polyline(pts, { color: c, weight: 3, dashArray: "6,5", interactive: false, pane: "vectors" }).addTo(tool.preview);
  tool.pts.forEach((p) => L.circleMarker(p, { radius: 4, color: "#fff", weight: 2, fillColor: c, fillOpacity: 1, interactive: false, pane: "top" }).addTo(tool.preview));
  const txt = isArea() ? `${fmtArea(polygonArea(pts))}` + (pts.length > 1 ? ` · ${fmtDist(pathLength([...pts, pts[0]]))}` : "") : fmtDist(pathLength(pts));
  L.tooltip({ permanent: true, direction: "right", offset: [12, 0], className: "measure-label" }).setLatLng(cursor).setContent(txt).addTo(tool.preview);
}

function finishTool() {
  if (!tool) return;
  const { kind, pts } = tool;
  const need = isArea() ? 3 : 2;
  if (pts.length < need) { stopTool(); return; }
  if (kind === "midpoint") { const names = tool.names || []; stopTool(); showCentre(pts, names); return; }
  if (kind === "measure-line" || kind === "measure-area") {
    measureResult = { kind, pts };
    stopTool();
    showMeasureResult();
    return;
  }
  stopTool();
  addFeature({ type: kind, coords: pts }, true);
}

let measureLayer = null;
function showMeasureResult() {
  measureLayer && map.removeLayer(measureLayer);
  if (!measureResult) return;
  const { kind, pts } = measureResult;
  measureLayer = L.layerGroup().addTo(map);
  const style = { color: "#f97316", weight: 3, pane: "vectors" };
  if (kind === "measure-area") L.polygon(pts, { ...style, fillOpacity: 0.15 }).addTo(measureLayer);
  else {
    L.polyline(pts, style).addTo(measureLayer);
    // cumulative labels at each vertex
    let d = 0;
    pts.forEach((p, i) => { if (i) d += pathLength([pts[i - 1], p]); if (i) L.tooltip({ permanent: true, direction: "right", className: "measure-label", offset: [8, 0] }).setLatLng(p).setContent(fmtDist(d)).addTo(measureLayer); });
  }
  refreshPanel();
}

function clearMeasure() {
  measureResult = null;
  measureLayer && map.removeLayer(measureLayer);
  measureLayer = null;
  refreshPanel();
}

export function drawKeydown(e) {
  if (editing && (e.key === "Escape" || e.key === "Enter")) { stopEditing(); return true; }
  if (!tool) return false;
  if (e.key === "Escape") { stopTool(); return true; }
  if (e.key === "Enter") { finishTool(); return true; }
  if (e.key === "Backspace" && tool.pts.length) { undoPoint(); return true; }
  return false;
}

// ── Import / export / saved maps ("Moje karte") ──
const fileBase = () => (mymap.title || "karta").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || "karta";
const layerName = (f) => layerOfFeature(f).name;

async function exportAs(fmt, list = features, suffix = "") {
  if (!list.length) return toast("Ni elementov za izvoz.");
  const base = fileBase() + suffix;
  if (fmt === "geojson") await saveTextFile(`${base}.geojson`, toGeoJSON(list, { name: mymap.title, description: mymap.description, layerName }), "application/geo+json");
  if (fmt === "gpx") await saveTextFile(`${base}.gpx`, toGPX(list, mymap.title), "application/gpx+xml");
  if (fmt === "kml") await saveTextFile(`${base}.kml`, toKML(list, mymap.title, layerName, mymap.description), "application/vnd.google-earth.kml+xml");
}

// Each file becomes its own layer; files that carry layers (KML folders, GeoJSON "layer") keep them.
async function importFiles() {
  const files = await openTextFiles();
  let n = 0;
  for (const file of files || []) {
    try {
      const feats = parseFile(file.name, file.content);
      const fileLayer = file.name.replace(/\.[^.]+$/, "");
      for (const x of feats) {
        const ly = layerByName(mymap, x.layerName || fileLayer, x.color);
        delete x.layerName;
        features.push({ ...x, layer: ly.id, color: x.color || ly.color });
        n++;
      }
    } catch (e) { toast(`${file.name}: ${e.message}`, "err"); }
  }
  if (n) {
    persistMap(); renderAll(); persist();
    if (group.getLayers().length) map.flyToBounds(group.getBounds(), { padding: [50, 50] });
    toast(`Uvoženih elementov: ${n}`, "ok");
  }
}

function saveCurrentMap(silent = false) {
  if (!features.length) { if (!silent) toast("Karta je prazna."); return; }
  const rec = { id: uid("p"), name: mymap.title, date: new Date().toLocaleString("sl-SI"), features: structuredClone(features), map: structuredClone(mymap) };
  const i = projects.findIndex((p) => p.map?.id === mymap.id);       // same map → update it
  if (i >= 0) projects.splice(i, 1);
  projects.unshift(rec);
  store.set("projects", projects, 0);
  if (!silent) toast(i >= 0 ? "Karta posodobljena" : "Karta shranjena", "ok");
  refreshPanel();
}

function newMap() {
  if (features.length && !confirm("Začnem novo karto? Trenutna se shrani med Moje karte.")) return;
  saveCurrentMap(true);
  stopEditing(); stopTool();
  mymap = emptyMap("Nova karta");
  features = [];
  persistMap(); persist(); renderAll();
}

function openSaved(p, merge) {
  const copy = structuredClone(p.features).map((f) => ({ ...f, id: uid("f") }));
  if (!merge) {
    saveCurrentMap(true);
    mymap = normalizeMap(p.map ? structuredClone(p.map) : { title: p.name });
    features = copy;
    adoptFeatures(mymap, features);
  } else {
    // add the saved map's layers next to ours (old projects without layers → one layer named after it)
    const src = p.map ? normalizeMap(structuredClone(p.map)) : null;
    const remap = new Map();
    for (const l of src?.layers || []) { const nl = { ...l, id: uid("ly"), name: `${l.name} (${p.name})` }; mymap.layers.push(nl); remap.set(l.id, nl.id); }
    const fallback = src ? null : layerByName(mymap, p.name);
    for (const f of copy) f.layer = remap.get(f.layer) || fallback?.id || mymap.active;
    features = [...features, ...copy];
  }
  persistMap(); renderAll(); persist();
  if (group.getLayers().length) map.flyToBounds(group.getBounds(), { padding: [50, 50] });
  toast(merge ? `Dodano: ${p.name}` : `Odprta karta: ${p.name}`, "ok");
}

function refreshPanel() { if (panelEl?.isConnected) drawPanel.render(panelEl); }

const featureRow = (f) => `
  <div class="list-item ${selected === f.id ? "sel" : ""}" data-id="${f.id}">
    <span class="swatch" style="background:${f.color}"></span>
    <div class="grow" style="min-width:0;cursor:pointer" data-open="${f.id}">
      <div class="ellipsis" style="font-weight:600">${f.emoji ? f.emoji + " " : ""}${esc(f.name)}</div>
      <div class="small muted ellipsis">${measureText(f)}</div>
    </div>
    <button class="icon-btn sm" data-zoom="${f.id}" title="Približaj">${icon("zoom")}</button>
    ${f.type === "line" ? `<button class="icon-btn sm" data-prof="${f.id}" title="Višinski profil">${icon("mountain")}</button>` : ""}
    <button class="icon-btn sm" data-del="${f.id}" title="Izbriši">${icon("trash")}</button>
  </div>`;

export const drawPanel = {
  id: "draw",
  title: "Risanje · Moje karte",
  render(el) {
    panelEl = el;
    const tk = tool?.kind;
    const tb = (k, ic, label) => `<button class="${tk === k ? "on" : ""}" data-tool="${k}">${icon(ic)} ${label}</button>`;
    const act = activeLayer();

    const layersHtml = mymap.layers.map((l) => {
      const fs = features.filter((f) => f.layer === l.id);
      const on = l.id === act.id, vis = l.visible !== false;
      return `<div class="mm-layer ${on ? "active" : ""} ${vis ? "" : "hidden"}" data-lact="${l.id}">
        <div class="mm-lhead">
          <button class="icon-btn sm ${vis ? "on" : ""}" data-lvis="${l.id}" title="${vis ? "Skrij sloj" : "Pokaži sloj"}">${icon(vis ? "eye" : "eyeOff")}</button>
          <span class="swatch" style="background:${l.color}"></span>
          <input class="mm-lname" data-lname="${l.id}" value="${esc(l.name)}" title="Ime sloja (klikni za preimenovanje)">
          <span class="n">${fs.length}</span>
          <button class="icon-btn sm" data-lzoom="${l.id}" title="Približaj sloj">${icon("zoom")}</button>
          <button class="icon-btn sm" data-lexp="${l.id}" title="Izvozi sloj (KML)">${icon("download")}</button>
          <button class="icon-btn sm" data-ldel="${l.id}" title="Izbriši sloj">${icon("trash")}</button>
        </div>
        <div class="mm-lnote">${on ? "✏️ Nove risbe gredo v ta sloj" : `<span class="muted">Klikni, da rišeš v ta sloj</span>`}</div>
        ${vis ? fs.map(featureRow).join("") : ""}
      </div>`;
    }).join("");

    let mr = "";
    if (measureResult) {
      const { kind, pts } = measureResult;
      mr = `<div class="card" style="margin-top:8px;border-color:#f97316">
        <div class="row"><b class="grow">${kind === "measure-area" ? "Površina" : "Razdalja"}</b><button class="icon-btn sm" id="m-clear">${icon("x")}</button></div>
        <div style="font-size:20px;font-weight:700;margin:2px 0">${kind === "measure-area" ? fmtArea(polygonArea(pts)) : fmtDist(pathLength(pts))}</div>
        <div class="small muted">${kind === "measure-area" ? "Obseg " + fmtDist(pathLength([...pts, pts[0]])) : pts.length + " točk"}</div>
        <div class="row" style="margin-top:8px">
          <button class="btn sm" id="m-keep">${icon("save")} Shrani kot ${kind === "measure-area" ? "območje" : "črto"}</button>
          ${kind === "measure-line" ? `<button class="btn sm" id="m-prof">${icon("mountain")} Profil</button>` : ""}
        </div></div>`;
    }

    const saved = projects.map((p) => `
      <div class="list-item ${p.map?.id === mymap.id ? "sel" : ""}">
        <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:600">${esc(p.name)}</div>
          <div class="small muted">${p.features.length} elementov · ${p.map?.layers?.length || 1} slojev · ${esc(p.date)}</div></div>
        <button class="btn sm" data-pload="${p.id}" title="Odpri to karto (trenutna se shrani)">Odpri</button>
        <button class="btn sm" data-pmerge="${p.id}" title="Dodaj njene sloje k trenutni karti">+</button>
        <button class="icon-btn sm" data-pdel="${p.id}">${icon("trash")}</button>
      </div>`).join("");

    el.innerHTML = `
      <div class="section mm-head">
        <input class="field mm-title" id="mm-title" value="${esc(mymap.title)}" placeholder="Ime karte">
        <textarea class="field mm-desc" id="mm-desc" rows="2" placeholder="Opis karte (neobvezno)…">${esc(mymap.description)}</textarea>
        <div class="row" style="margin-top:6px">
          <button class="btn sm primary" id="mm-save">${icon("save")} Shrani karto</button>
          <button class="btn sm" id="mm-new">+ Nova karta</button>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Riši v »${esc(act.name)}«</div>
        <div class="seg">${tb("marker", "marker", "Oznaka")}${tb("line", "line", "Črta")}${tb("polygon", "polygon", "Območje")}</div>
        <div class="row" style="margin-top:8px"><span class="small muted">Barva sloja</span>
          ${COLORS.map((c) => `<button class="swatch" data-pick="${c}" style="background:${c};width:18px;height:18px;border:2px solid ${c === act.color ? "var(--text)" : "transparent"}"></button>`).join("")}
        </div>
        <div class="section-title" style="margin-top:12px">Meri</div>
        <div class="seg">${tb("measure-line", "ruler", "Razdalja")}${tb("measure-area", "area", "Površina")}${tb("midpoint", "crosshair", "Sredina")}</div>
        ${hasMidpoints() ? `<div class="row" style="margin-top:6px"><span class="small muted grow">🎯 Sredina je prikazana na karti.</span><button class="btn sm" id="mid-clear">Skrij</button></div>` : ""}
        ${mr}
      </div>
      <div class="section">
        <div class="section-title"><span>Sloji (${mymap.layers.length}) · ${features.length} elementov</span>
          <span class="row"><button class="btn sm" id="ly-add">+ Sloj</button>${features.length ? `<button class="btn sm danger" id="d-clear" title="Izbriše vse elemente na tej karti">Počisti</button>` : ""}</span></div>
        ${layersHtml}
        ${features.length ? "" : `<div class="empty"><div class="big">✏️</div>Karta je prazna. Izberi orodje zgoraj ali uvozi datoteko.</div>`}
      </div>
      <div class="section">
        <div class="section-title">Uvoz / izvoz karte</div>
        <div class="row wrap">
          <button class="btn sm" id="d-import" title="GPX, KML (mape = sloji), GeoJSON — vsaka datoteka postane sloj">${icon("upload")} Uvozi</button>
          <button class="btn sm" data-exp="kml" title="Za Google My Maps / Earth — sloji kot mape">KML</button>
          <button class="btn sm" data-exp="geojson">GeoJSON</button>
          <button class="btn sm" data-exp="gpx">GPX</button>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Moje karte (${projects.length})</div>
        ${saved || `<div class="help">Shranjene karte ostanejo na tej napravi. Za skupno delo uporabi Sodelovanje.</div>`}
      </div>`;

    el.onclick = (e) => {
      if (e.target.closest("input, textarea, select")) return;
      const t = e.target.closest("button, [data-open], [data-lact]");
      if (!t) return;
      const d = t.dataset;
      if (d.tool) return tool?.kind === d.tool ? stopTool() : startTool(d.tool);
      if (d.pick) return setLayerColor(act, d.pick);
      if (d.open) { const f = features.find((x) => x.id === d.open); zoomTo(f); return openFeaturePopup(f); }
      if (d.zoom) return zoomTo(features.find((x) => x.id === d.zoom));
      if (d.prof) { const f = features.find((x) => x.id === d.prof); return showProfile(f.name, f.coords, f.color); }
      if (d.del) return deleteFeature(d.del);
      if (d.exp) return exportAs(d.exp);
      if (d.lvis) { const l = mymap.layers.find((x) => x.id === d.lvis); l.visible = l.visible === false; persistMap(); return renderAll(); }
      if (d.lzoom) return zoomToLayer(d.lzoom);
      if (d.lexp) { const l = mymap.layers.find((x) => x.id === d.lexp); return exportAs("kml", features.filter((f) => f.layer === l.id), ` - ${l.name}`); }
      if (d.ldel) return deleteLayer(d.ldel);
      if (d.pload || d.pmerge) return openSaved(projects.find((x) => x.id === (d.pload || d.pmerge)), !!d.pmerge);
      if (d.pdel) {
        const p = projects.find((x) => x.id === d.pdel);
        if (!confirm(`Izbrišem shranjeno karto »${p.name}«?`)) return;
        projects = projects.filter((x) => x.id !== d.pdel); store.set("projects", projects, 0); return refreshPanel();
      }
      if (d.lact) { if (mymap.active !== d.lact) { mymap.active = d.lact; persistMap(); refreshPanel(); } return; }
      switch (t.id) {
        case "mm-save": saveCurrentMap(); break;
        case "mm-new": newMap(); break;
        case "ly-add": { const l = newLayer(`Sloj ${mymap.layers.length + 1}`, COLORS[mymap.layers.length % COLORS.length]); mymap.layers.push(l); mymap.active = l.id; persistMap(); refreshPanel(); break; }
        case "d-clear": if (confirm("Izbrišem vse elemente na tej karti? (Shranjene karte ostanejo.)")) { features = []; stopEditing(); renderAll(); persist(); } break;
        case "d-import": importFiles(); break;
        case "m-clear": clearMeasure(); break;
        case "mid-clear": clearMidpoints(); refreshPanel(); break;
        case "m-keep": { const { kind, pts } = measureResult; clearMeasure(); addFeature({ type: kind === "measure-area" ? "polygon" : "line", coords: pts }, true); break; }
        case "m-prof": showProfile("Meritev", measureResult.pts, "#f97316"); break;
      }
    };
    el.oninput = (e) => {   // title / description saved as you type (no re-render, keeps the cursor)
      if (e.target.id === "mm-title") { mymap.title = e.target.value; persistMap(); }
      if (e.target.id === "mm-desc") { mymap.description = e.target.value; persistMap(); }
    };
    el.onchange = (e) => {
      const id = e.target.dataset.lname;
      if (id) { const l = mymap.layers.find((x) => x.id === id); l.name = e.target.value.trim() || l.name; persistMap(); renderAll(); }
    };
  },
  onClose() { stopTool(); },
};
