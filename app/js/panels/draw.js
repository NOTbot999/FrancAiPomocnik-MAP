import { map } from "../map.js";
import { store } from "../api.js";
import { state, on, emit } from "../state.js";
import { esc, uid, pathLength, polygonArea, fmtDist, fmtArea, COLORS, toast, saveTextFile, openTextFiles, $, h } from "../util.js";
import { icon } from "../icons.js";
import { setHint, setActions, cancelPick, pinIcon } from "../tools.js";
import { toGeoJSON, toGPX, toKML, parseFile } from "../geoio.js";
import { showProfile } from "../profile.js";

let features = [];
let projects = [];
let group;              // rendered features
const layerOf = new Map();
let color = COLORS[0];
let tool = null;        // active drawing tool
let editing = null;     // { id, handles: [] }
let selected = null;
let panelEl = null;
let measureResult = null;

export async function initDraw() {
  group = L.featureGroup().addTo(map);
  [features, projects] = await Promise.all([store.get("drawings", []), store.get("projects", [])]);
  renderAll();
  on("add-marker", ({ latlng, name }) => addFeature({ type: "marker", coords: latlng, name: name || "Oznaka" }, true));
}

const persist = () => store.set("drawings", features);

function measureText(f) {
  if (f.type === "line") return fmtDist(pathLength(f.coords));
  if (f.type === "polygon") return `${fmtArea(polygonArea(f.coords))} · obseg ${fmtDist(pathLength([...f.coords, f.coords[0]]))}`;
  return `${f.coords[0].toFixed(5)}, ${f.coords[1].toFixed(5)}`;
}

function renderFeature(f) {
  layerOf.get(f.id) && group.removeLayer(layerOf.get(f.id));
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
  const nf = { id: uid("f"), color, note: "", ...f };
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

function openFeaturePopup(f, at) {
  selected = f.id;
  const pos = at || (f.type === "marker" ? f.coords : layerOf.get(f.id).getBounds().getCenter());
  const swatches = COLORS.map((c) => `<button class="swatch" style="background:${c};width:18px;height:18px;border:2px solid ${c === f.color ? "var(--text)" : "transparent"}" data-color="${c}"></button>`).join("");
  const html = `<div class="pop stack" style="min-width:240px">
    <input class="field" data-k="name" value="${esc(f.name)}" placeholder="Ime">
    <div class="small muted">${measureText(f)}</div>
    <div class="row wrap" style="gap:4px">${swatches}</div>
    <textarea class="field" data-k="note" placeholder="Opomba…">${esc(f.note || "")}</textarea>
    <div class="actions">
      ${f.type === "line" ? `<button class="btn sm" data-a="profile">${icon("mountain")} Profil</button>` : ""}
      ${f.type !== "marker" ? `<button class="btn sm" data-a="edit">${icon("edit")} Uredi točke</button>` : `<button class="btn sm" data-a="move">${icon("edit")} Premakni</button><button class="btn sm" data-a="route">${icon("route")} Pot do sem</button>`}
      <button class="btn sm danger" data-a="del">${icon("trash")}</button>
    </div></div>`;
  const p = L.popup({ maxWidth: 320, autoPanPadding: [40, 40] }).setLatLng(pos).setContent(html).openOn(map);
  renderFeature(f);
  refreshPanel();
  const el = p.getElement();
  el.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k) { f[k] = e.target.value; persist(); refreshPanel(); layerOf.get(f.id)?.setTooltipContent(`<b>${esc(f.name)}</b><br>${measureText(f)}`); }
  });
  el.addEventListener("click", (e) => {
    const c = e.target.closest("[data-color]");
    if (c) { updateFeature(f.id, { color: c.dataset.color }); map.closePopup(); return openFeaturePopup(f, pos); }
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (!a) return;
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
  tool.pts.push(p);
  drawPreview(p);
}

function onMove(e) { if (tool?.pts.length) drawPreview([e.latlng.lat, e.latlng.lng]); }
function onDbl(e) { L.DomEvent.stop(e); finishTool(); }

function drawPreview(cursor) {
  const pts = [...tool.pts, cursor];
  tool.preview.clearLayers();
  const c = tool.kind.startsWith("measure") ? "#f97316" : color;
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

// ── Import / export / projects ──
async function exportAs(fmt, list = features) {
  if (!list.length) return toast("Ni elementov za izvoz.");
  const stamp = new Date().toISOString().slice(0, 10);
  if (fmt === "geojson") await saveTextFile(`risbe-${stamp}.geojson`, toGeoJSON(list), "application/geo+json");
  if (fmt === "gpx") await saveTextFile(`risbe-${stamp}.gpx`, toGPX(list), "application/gpx+xml");
  if (fmt === "kml") await saveTextFile(`risbe-${stamp}.kml`, toKML(list), "application/vnd.google-earth.kml+xml");
}

async function importFiles() {
  const files = await openTextFiles();
  let n = 0;
  for (const f of files || []) {
    try {
      const feats = parseFile(f.name, f.content);
      feats.forEach((x) => { features.push(x); n++; });
    } catch (e) { toast(`${f.name}: ${e.message}`, "err"); }
  }
  if (n) {
    renderAll(); persist();
    map.flyToBounds(group.getBounds(), { padding: [50, 50] });
    toast(`Uvoženih elementov: ${n}`, "ok");
  }
}

function saveProject(name) {
  if (!features.length) return toast("Ni risb za shranjevanje.");
  projects.unshift({ id: uid("p"), name: name || `Projekt ${projects.length + 1}`, date: new Date().toLocaleString("sl-SI"), features: structuredClone(features) });
  store.set("projects", projects, 0);
  toast("Projekt shranjen", "ok");
  refreshPanel();
}

function refreshPanel() { if (panelEl?.isConnected) drawPanel.render(panelEl); }

export const drawPanel = {
  id: "draw",
  title: "Risanje in merjenje",
  render(el) {
    panelEl = el;
    const tk = tool?.kind;
    const tb = (k, ic, label) => `<button class="${tk === k ? "on" : ""}" data-tool="${k}">${icon(ic)} ${label}</button>`;
    const list = features.length ? features.map((f) => `
      <div class="list-item ${selected === f.id ? "sel" : ""}" data-id="${f.id}">
        <span class="swatch" style="background:${f.color}"></span>
        <div class="grow" style="min-width:0;cursor:pointer" data-open="${f.id}">
          <div class="ellipsis" style="font-weight:600">${esc(f.name)}</div>
          <div class="small muted ellipsis">${measureText(f)}</div>
        </div>
        <button class="icon-btn sm" data-zoom="${f.id}" title="Približaj">${icon("zoom")}</button>
        ${f.type === "line" ? `<button class="icon-btn sm" data-prof="${f.id}" title="Višinski profil">${icon("mountain")}</button>` : ""}
        <button class="icon-btn sm" data-del="${f.id}" title="Izbriši">${icon("trash")}</button>
      </div>`).join("") : `<div class="empty"><div class="big">✏️</div>Ni risb. Izberi orodje zgoraj.</div>`;

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

    el.innerHTML = `
      <div class="section">
        <div class="section-title">Riši</div>
        <div class="seg">${tb("marker", "marker", "Oznaka")}${tb("line", "line", "Črta")}${tb("polygon", "polygon", "Območje")}</div>
        <div class="section-title" style="margin-top:12px">Meri</div>
        <div class="seg">${tb("measure-line", "ruler", "Razdalja")}${tb("measure-area", "area", "Površina")}</div>
        ${mr}
        <div class="row" style="margin-top:10px"><span class="small muted">Barva</span>
          ${COLORS.map((c) => `<button class="swatch" data-pick="${c}" style="background:${c};width:18px;height:18px;border:2px solid ${c === color ? "var(--text)" : "transparent"}"></button>`).join("")}
        </div>
      </div>
      <div class="section">
        <div class="section-title"><span>Elementi (${features.length})</span>
          ${features.length ? `<button class="btn sm danger" id="d-clear">Počisti</button>` : ""}</div>
        ${list}
      </div>
      <div class="section">
        <div class="section-title">Uvoz / izvoz</div>
        <div class="row wrap">
          <button class="btn sm" id="d-import">${icon("upload")} Uvozi</button>
          <button class="btn sm" data-exp="geojson">GeoJSON</button>
          <button class="btn sm" data-exp="gpx">GPX</button>
          <button class="btn sm" data-exp="kml">KML</button>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Projekti</div>
        <div class="row"><input class="field grow" id="p-name" placeholder="Ime projekta…"><button class="btn primary" id="p-save">${icon("save")} Shrani</button></div>
        <div style="margin-top:8px">${projects.map((p) => `
          <div class="list-item">
            <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:600">${esc(p.name)}</div><div class="small muted">${p.features.length} elementov · ${esc(p.date)}</div></div>
            <button class="btn sm" data-pload="${p.id}" title="Zamenjaj trenutne risbe">Odpri</button>
            <button class="btn sm" data-pmerge="${p.id}" title="Dodaj k trenutnim risbam">+</button>
            <button class="icon-btn sm" data-pdel="${p.id}">${icon("trash")}</button>
          </div>`).join("") || `<div class="help">Shranjeni projekti ostanejo na tem računalniku.</div>`}</div>
      </div>`;

    el.onclick = (e) => {
      const t = e.target.closest("button, [data-open]");
      if (!t) return;
      const d = t.dataset;
      if (d.tool) return tool?.kind === d.tool ? stopTool() : startTool(d.tool);
      if (d.pick) { color = d.pick; return refreshPanel(); }
      if (d.open) { const f = features.find((x) => x.id === d.open); zoomTo(f); return openFeaturePopup(f); }
      if (d.zoom) return zoomTo(features.find((x) => x.id === d.zoom));
      if (d.prof) { const f = features.find((x) => x.id === d.prof); return showProfile(f.name, f.coords, f.color); }
      if (d.del) return deleteFeature(d.del);
      if (d.exp) return exportAs(d.exp);
      if (d.pload || d.pmerge) {
        const p = projects.find((x) => x.id === (d.pload || d.pmerge));
        const copy = structuredClone(p.features).map((f) => ({ ...f, id: uid("f") }));
        features = d.pload ? copy : [...features, ...copy];
        renderAll(); persist();
        if (features.length) map.flyToBounds(group.getBounds(), { padding: [50, 50] });
        return toast(`Odprt projekt: ${p.name}`, "ok");
      }
      if (d.pdel) { projects = projects.filter((x) => x.id !== d.pdel); store.set("projects", projects, 0); return refreshPanel(); }
      switch (t.id) {
        case "d-clear": if (confirm("Izbrišem vse risbe? (Shranjeni projekti ostanejo.)")) { features = []; stopEditing(); renderAll(); persist(); } break;
        case "d-import": importFiles(); break;
        case "p-save": saveProject($("#p-name", el).value.trim()); break;
        case "m-clear": clearMeasure(); break;
        case "m-keep": { const { kind, pts } = measureResult; clearMeasure(); addFeature({ type: kind === "measure-area" ? "polygon" : "line", coords: pts }, true); break; }
        case "m-prof": showProfile("Meritev", measureResult.pts, "#f97316"); break;
      }
    };
  },
  onClose() { stopTool(); },
};
