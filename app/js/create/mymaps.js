// "Moje karte" — the drawings form a map (like Google My Maps): a title, a description and layers.
// Every drawn feature belongs to exactly one layer (feature.layer = layer id).
//
// Stored under "mymap":
//   { v: 1, id, title, description, active, layers: [{ id, name, color, visible, style: {} }] }
// Saved maps (store "projects") keep { id, name, date, features, map } — "map" is the object above.
//
// Room to grow: layer.style is free for later options (line width, icon set, style by attribute,
// labels…); v lets a later version migrate the data.
import { store } from "../services/api.js";
import { uid, COLORS } from "../shared/util.js";

export const MYMAP_VERSION = 1;

export function newLayer(name, color) {
  return { id: uid("ly"), name: name || "Sloj", color: color || COLORS[0], visible: true, style: {} };
}

export function emptyMap(title = "Moja karta") {
  const l = newLayer("Sloj 1", COLORS[0]);
  return { v: MYMAP_VERSION, id: uid("m"), title, description: "", active: l.id, layers: [l] };
}

export async function loadMyMap() {
  const m = await store.get("mymap", null);
  return normalizeMap(m);
}

export function saveMyMap(m) {
  store.set("mymap", m, 0);
}

export function normalizeMap(m) {
  if (!m || !Array.isArray(m.layers) || !m.layers.length) m = { ...emptyMap(), ...(m || {}), layers: emptyMap().layers };
  m.v = MYMAP_VERSION;
  m.layers = m.layers.map((l) => ({ visible: true, style: {}, color: COLORS[0], ...l }));
  if (!m.layers.some((l) => l.id === m.active)) m.active = m.layers[0].id;
  m.title ||= "Moja karta";
  m.description ||= "";
  return m;
}

// Features without a (known) layer go to the active one — old drawings, shared/collab drawings, AI pins…
export function adoptFeatures(m, features) {
  const ids = new Set(m.layers.map((l) => l.id));
  let changed = false;
  for (const f of features) if (!ids.has(f.layer)) { f.layer = m.active; changed = true; }
  return changed;
}

export function layerByName(m, name, color) {
  let l = m.layers.find((x) => x.name === name);
  if (!l) { l = newLayer(name, color || COLORS[m.layers.length % COLORS.length]); m.layers.push(l); }
  return l;
}
