import { tileTemplate, TILE_SUBDOMAINS, IS_WEB } from "./api.js";
import { tileUrl } from "./webbackend.js";
import { state, emit, saveSettings, SLOVENIA_BOUNDS } from "./state.js";
import { createSpecialLayer } from "./special.js";

export let map;
let baseLayer = null;
const overlayLayers = new Map(); // id -> leaflet layer
const SI_BOUNDS = L.latLngBounds([[45.25, 13.2], [46.98, 16.75]]);

export function initMap(el) {
  const { center, zoom } = state.settings.startView || state.settings.view;
  map = L.map(el, {
    center, zoom,
    zoomControl: false,
    preferCanvas: true,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 110,
    maxZoom: 20,
    minZoom: 5,
    doubleClickZoom: true,
    attributionControl: true,
    fadeAnimation: true,
    tapHold: true,          // long-press on touch screens → location menu
  });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank">Leaflet</a>');
  // zoom +/− live in the floating button column (ui/fab.js)
  scaleControl = L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 140 }).addTo(map);
  installDoubleTapZoom();

  map.createPane("overlays").style.zIndex = 300;
  map.createPane("cmpA").style.zIndex = 360;
  map.createPane("cmpB").style.zIndex = 370;
  map.createPane("vectors").style.zIndex = 450;
  map.createPane("top").style.zIndex = 650;

  injectLidarFilter();

  map.on("moveend", () => {
    const c = map.getCenter();
    state.settings.view = { center: [+c.lat.toFixed(5), +c.lng.toFixed(5)], zoom: map.getZoom() };
    saveSettings();
  });

  setBase(state.settings.base, true);
  syncOverlays();
  return map;
}

export let scaleControl = null;

// Double-tap to zoom on touch screens. Browsers/WebViews with disabled page zoom often don't
// deliver a usable `dblclick` from touch, so detect two quick taps ourselves. Respects
// map.doubleClickZoom.enabled() (drawing tools switch it off while active).
function installDoubleTapZoom() {
  let last = null; // { t, x, y }
  let down = null;
  let suppressDblclickUntil = 0;
  const el = map.getContainer();
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    down = { x: e.clientX, y: e.clientY, t: e.timeStamp, n: 1 };
  }, true);
  el.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && !e.isPrimary && down) down.n = 2; }, true);
  el.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch" || !down || down.n > 1) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const isTap = moved < 12 && e.timeStamp - down.t < 300;
    down = null;
    if (!isTap) { last = null; return; }
    if (e.target.closest(".leaflet-control, .leaflet-popup, .fab-col, .tool-actions, button, input")) { last = null; return; }
    if (last && e.timeStamp - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40) {
      last = null;
      if (!map.doubleClickZoom.enabled()) return;
      const r = el.getBoundingClientRect();
      const pt = L.point(e.clientX - r.left, e.clientY - r.top);
      map.setZoomAround(map.containerPointToLatLng(pt), Math.min(map.getMaxZoom(), Math.round(map.getZoom()) + 1));
      suppressDblclickUntil = Date.now() + 500;
    } else last = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  }, true);
  // if the platform *also* fires a native dblclick, don't zoom twice
  const h = map.doubleClickZoom;
  const wasOn = h.enabled();
  if (wasOn) h.disable();                       // detach the original listener first
  const orig = L.Map.DoubleClickZoom.prototype._onDoubleClick;
  h._onDoubleClick = function (e) {
    if (Date.now() < suppressDblclickUntil) return;
    return orig.call(this, e);
  };
  if (wasOn) h.enable();                        // re-attach with the patched handler
}

function injectLidarFilter() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  svg.innerHTML = `<defs><filter id="lidar-sharpen" color-interpolation-filters="linearRGB">
    <feConvolveMatrix order="3" kernelMatrix="0 -0.5 0 -0.5 3 -0.5 0 -0.5 0" preserveAlpha="true"/></filter></defs>`;
  document.body.appendChild(svg);
  const st = document.createElement("style");
  st.textContent = ".fm-enhance img{filter:contrast(1.3) brightness(1.04) url(#lidar-sharpen)}";
  document.head.appendChild(st);
}

// Web version: a tile layer whose URLs are built in the browser (WMS / ArcGIS / XYZ) instead of
// coming from the local cache server.
const DirectTileLayer = L.TileLayer.extend({
  getTileUrl(coords) { return tileUrl(this.options.cfg, coords.z, coords.x, coords.y); },
});

export function makeRasterLayer(cfg, opts = {}) {
  const regional = cfg.type === "wms" || cfg.type === "arcgis_export";
  const make = IS_WEB ? (url, o) => new DirectTileLayer(url, { ...o, cfg }) : L.tileLayer;
  return make(IS_WEB ? "" : tileTemplate(cfg.id), {
    subdomains: TILE_SUBDOMAINS,
    maxZoom: 20,
    maxNativeZoom: cfg.maxNativeZoom || 19,
    minZoom: cfg.minZoom || 0,   // the server draws nothing below this zoom → don't request blank tiles
    opacity: opts.opacity ?? cfg.opacity ?? 1,
    keepBuffer: 3,
    updateWhenIdle: false,
    updateWhenZooming: false,
    bounds: regional ? SI_BOUNDS : undefined,
    attribution: cfg.attribution || "",
    className: cfg.enhance ? "fm-enhance" : "",
    pane: opts.pane || "overlays",
    zIndex: opts.zIndex,
  });
}

// ── Base layer (radio) ──
export function setBase(id, initial = false) {
  const cfg = state.layerIndex[id];
  if (!cfg) return;
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = makeRasterLayer(cfg, { pane: "tilePane", opacity: state.settings.baseOpacity });
  baseLayer.addTo(map);
  baseLayer.bringToBack();
  state.settings.base = id;
  if (!initial) { saveSettings(); emit("layers-changed"); }
}
export function setBaseOpacity(v) {
  state.settings.baseOpacity = v;
  baseLayer?.setOpacity(v);
  saveSettings();
}

// ── Overlays ──
export function isOverlayOn(id) {
  return state.settings.overlays.some((o) => o.id === id);
}

export function toggleOverlay(id, force) {
  const list = state.settings.overlays;
  const idx = list.findIndex((o) => o.id === id);
  const turnOn = force ?? idx < 0;
  if (turnOn && idx < 0) {
    const cfg = state.layerIndex[id];
    list.push({ id, opacity: cfg.opacity ?? 0.8, visible: true });
  } else if (!turnOn && idx >= 0) {
    list.splice(idx, 1);
  } else return;
  syncOverlays();
  saveSettings();
  emit("layers-changed");
}

export function setOverlayOpacity(id, v) {
  const o = state.settings.overlays.find((x) => x.id === id);
  if (!o) return;
  o.opacity = v;
  overlayLayers.get(id)?.setOpacity?.(v);
  saveSettings();
}

export function setOverlayVisible(id, visible) {
  const o = state.settings.overlays.find((x) => x.id === id);
  if (!o) return;
  o.visible = visible;
  syncOverlays();
  saveSettings();
}

export function moveOverlay(id, beforeId) {
  const list = state.settings.overlays;
  const from = list.findIndex((o) => o.id === id);
  if (from < 0) return;
  const [item] = list.splice(from, 1);
  const to = beforeId ? list.findIndex((o) => o.id === beforeId) : list.length;
  list.splice(to < 0 ? list.length : to, 0, item);
  syncOverlays();
  saveSettings();
  emit("layers-changed");
}

export function syncOverlays() {
  const wanted = new Map(state.settings.overlays.filter((o) => o.visible !== false).map((o, i) => [o.id, { ...o, z: 10 + i }]));
  for (const [id, layer] of overlayLayers) {
    if (!wanted.has(id)) { map.removeLayer(layer); overlayLayers.delete(id); }
  }
  for (const [id, o] of wanted) {
    let layer = overlayLayers.get(id);
    const cfg = state.layerIndex[id];
    if (!layer) {
      layer = cfg.type === "third_dev_axis" || cfg.type === "live_flights"
        ? createSpecialLayer(cfg, o.opacity)
        : makeRasterLayer(cfg, { opacity: o.opacity, zIndex: o.z });
      overlayLayers.set(id, layer);
      layer.addTo(map);
    }
    layer.setZIndex?.(o.z);
  }
}

export function getOverlayLayer(id) {
  return overlayLayers.get(id);
}

export function fitSlovenia() {
  map.flyToBounds(SLOVENIA_BOUNDS, { duration: 0.8 });
}

// Tile x/y for thumbnails
export function tileXY(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x, y };
}
