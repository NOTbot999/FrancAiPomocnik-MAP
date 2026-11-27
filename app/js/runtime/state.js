import { store } from "../services/api.js";

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];
// Wider box that regional tile layers (GURS, GeoHub …) are clipped to — no requests outside it
export const SI_TILE_BOUNDS = [[45.25, 13.2], [46.98, 16.75]];

const DEFAULT_SETTINGS = {
  theme: "auto",            // auto | light | dark
  coordFormat: "dec",       // dec | dms
  base: "osm",
  baseOpacity: 1,
  overlays: [],             // [{ id, opacity, visible }] bottom → top
  favorites: [],
  pois: [],                 // active POI category ids
  view: { center: SLOVENIA_CENTER, zoom: 9 },
  startView: null,
  openCats: ["karte"],
  showLegends: false,
  // original-app style map UI (floating buttons, settings menu)
  ui: {
    order: [],               // floating button order (ids), filled from FAB_BUTTONS
    hidden: [],              // floating buttons switched off
    buttonScale: 1,          // 0.5 – 3
    scaleBarVisible: true,
    scaleBarScale: 1,        // 0.5 – 2
    markerSize: 18,          // POI marker size in px (10 – 40)
    emoji: {},               // POI category id -> custom emoji
    colors: {},              // interface colour overrides (Barve vmesnika)
  },
  collab: { server: "", name: "" },
  plugins: [],               // AI / custom plugins [{ id, name, source, enabled }]
};

export const state = {
  settings: structuredClone(DEFAULT_SETTINGS),
  db: null,          // layers.json
  layerIndex: {},    // id -> { ...cfg, cat, isBase }
  health: {},        // id -> { status: ok|empty|fail, detail }
  healthRunning: false,
};

// A layer whose source currently fails (or returns only blank images)
export function isBroken(id) {
  const h = state.health[id];
  return !!h && h.status !== "ok";
}
// Display name — broken layers are marked "X Name X"
export function layerName(idOrCfg) {
  const cfg = typeof idOrCfg === "string" ? state.layerIndex[idOrCfg] : idOrCfg;
  if (!cfg) return "";
  return isBroken(cfg.id) ? `X ${cfg.name} X` : cfg.name;
}
export function brokenReason(id) {
  const h = state.health[id];
  if (!h || h.status === "ok") return "";
  return h.status === "empty" ? "Vir trenutno vrača samo prazne slike" : (h.detail || "Vir trenutno ne deluje");
}

const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));

export async function loadState() {
  const [db, saved] = await Promise.all([
    fetch("data/layers.json").then((r) => r.json()),
    store.get("settings", null),
  ]);
  state.db = db;
  for (const l of db.base) state.layerIndex[l.id] = { ...l, isBase: true, cat: "Osnovne karte" };
  for (const c of db.categories) for (const l of c.layers) state.layerIndex[l.id] = { ...l, cat: c.name };
  if (saved) {
    const defUi = state.settings.ui, defCollab = state.settings.collab;
    Object.assign(state.settings, saved);
    state.settings.ui = { ...defUi, ...(saved.ui || {}) };          // new UI keys keep defaults
    state.settings.collab = { ...defCollab, ...(saved.collab || {}) };
    state.settings.plugins ||= [];
  }
  migrateLayers(state.settings);
  // drop layers that no longer exist
  state.settings.overlays = state.settings.overlays.filter((o) => state.layerIndex[o.id]);
  if (!state.layerIndex[state.settings.base]) state.settings.base = "osm";
}

// 1.7.2: four base maps; the others live on as overlays. Duplicate layers were merged.
const BASE_TO_OVERLAY = { carto_voyager: "ol_carto_voyager", esri_topo: "ol_esri_topo", dark: "ol_dark", arso_topo_nova: "arso_topo_overlay" };
const LAYER_ALIASES = { ol_lidar: "gurs_lidar", lidar_overlay: "gurs_lidar", ol_arso_topo: "arso_topo_overlay", ol_waymarked_slopes: "slopes_waymarked" };
function migrateLayers(s) {
  const ov = BASE_TO_OVERLAY[s.base];
  if (ov) {                       // keep the same look: OSM underneath, the old base on top at full strength
    s.base = "osm";
    if (!s.overlays.some((o) => o.id === ov)) s.overlays.unshift({ id: ov, opacity: s.baseOpacity ?? 1, visible: true });
  }
  const seen = new Set();
  s.overlays = s.overlays.map((o) => ({ ...o, id: LAYER_ALIASES[o.id] || o.id })).filter((o) => !seen.has(o.id) && seen.add(o.id));
  s.favorites = [...new Set((s.favorites || []).map((id) => LAYER_ALIASES[id] || BASE_TO_OVERLAY[id] || id))];
  const cats = new Set(state.db.categories.map((c) => c.id));
  s.openCats = (s.openCats || []).filter((id) => cats.has(id));
}

export function saveSettings() {
  store.set("settings", state.settings, 600);
}
