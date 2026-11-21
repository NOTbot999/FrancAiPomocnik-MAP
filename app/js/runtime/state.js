import { store } from "../services/api.js";

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];

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
  // drop layers that no longer exist
  state.settings.overlays = state.settings.overlays.filter((o) => state.layerIndex[o.id]);
  if (!state.layerIndex[state.settings.base]) state.settings.base = "osm";
}

export function saveSettings() {
  store.set("settings", state.settings, 600);
}
