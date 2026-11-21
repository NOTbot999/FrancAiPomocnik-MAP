import { state, saveSettings, emit, on } from "../runtime/state.js";

// category emoji, honouring "Označba po izbiri" overrides from the settings menu
export const emo = (cat) => state.settings.ui?.emoji?.[cat.id] || cat.emoji;
import { map } from "../map/map.js";
import { overpass } from "../services/external.js";
import { esc, toast, fmtNum, fmtLatLng, toD96, $ } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { pointPopup } from "./popup.js";
import { PointLayer } from "../map/pointlayer.js";

const loaded = new Map();   // catId -> { features, layer }
const loading = new Set();
const showGen = new Map();  // catId -> latest showCategory() call (older overlapping calls bail out)
let panelEl = null;

export function poiCategories() { return state.db.pois; }

// ── Cave cadastre (kataster jam) — bundled with the app, replaces OSM for "Jame" ──
let caveDb = null;          // { count, imported, source, caves: [{...}] }
let caveDbPromise = null;
const CAVE_FILTERS = [
  ["all", "Vse"], ["100", "≥ 100 m"], ["1000", "≥ 1 km"], ["d100", "Globina ≥ 100 m"],
];

export function loadCaves() {
  caveDbPromise ||= fetch("data/caves.json").then((r) => r.json()).then((d) => {
    caveDb = { ...d, caves: d.caves.map(([id, name, lat, lng, len, depth]) => ({
      id: `cave/${id}`, ref: id, name, lat, lng, len, depth,
      tags: { "cave:ref": String(id), ...(len ? { "cave:length": `${fmtNum(len)} m` } : {}), ...(depth ? { "cave:depth": `${fmtNum(depth)} m` } : {}) },
    })) };
    return caveDb;
  });
  return caveDbPromise;
}
export const getCaves = () => caveDb?.caves || [];

function caveFilter() {
  const f = state.settings.caveFilter || "all";
  const all = getCaves();
  if (f === "100") return all.filter((c) => c.len >= 100);
  if (f === "1000") return all.filter((c) => c.len >= 1000);
  if (f === "d100") return all.filter((c) => c.depth >= 100);
  return all;
}
const caveInfo = (c) => [c.len ? `dolžina ${fmtNum(c.len)} m` : "", c.depth ? `globina ${fmtNum(c.depth)} m` : ""].filter(Boolean).join(" · ");

// Hover card for a cave: name, length, depth, WGS84 + D96/TM coordinates
function caveTooltip(c) {
  const { e, n } = toD96(c.lat, c.lng);
  return `<div class="cave-tip"><b>🕳️ ${esc(c.name)}</b>
    <div class="kv"><dt>Dolžina</dt><dd>${c.len ? fmtNum(c.len) + " m" : "—"}</dd>
    <dt>Globina</dt><dd>${c.depth ? fmtNum(c.depth) + " m" : "—"}</dd>
    <dt>WGS84</dt><dd>${fmtLatLng(c.lat, c.lng, state.settings.coordFormat)}</dd>
    <dt>D96/TM</dt><dd>e ${Math.round(e)} n ${Math.round(n)}</dd>
    <dt>Kataster št.</dt><dd>${c.ref}</dd></div></div>`;
}

// ── Hydrants — state utility cadastre (zbirni kataster GJI), bundled like the cave cadastre ──
let hydDb = null;           // { count, imported, newestChange, source, accuracy, items: [...] }
let hydDbPromise = null;
const HYD_FILTERS = [["all", "Vsi aktivni"], ["above", "Nadzemni"], ["below", "Podzemni"], ["abandoned", "Opuščeni"]];
const HYD_TYPE = { 1: "nadzemni", 2: "podzemni", 0: "vrsta ni podana" };
const HYD_COLOR = { 1: "#dc2626", 2: "#2563eb", 0: "#f97316", abandoned: "#9ca3af" };

export function loadHydrants() {
  hydDbPromise ||= fetch("data/hydrants.json").then((r) => r.json()).then((d) => {
    hydDb = { ...d, items: d.rows.map(([lat, lng, type, year, acc, abandoned], i) => ({
      id: `hydrant/${i}`, lat, lng, type, year, acc, abandoned: !!abandoned, name: `Hidrant (${HYD_TYPE[type]})`,
    })) };
    return hydDb;
  });
  hydDbPromise.catch(() => { hydDbPromise = null; });
  return hydDbPromise;
}

function hydrantFilter() {
  const f = state.settings.hydrantFilter || "all";
  const all = hydDb?.items || [];
  if (f === "abandoned") return all.filter((h) => h.abandoned);
  const active = all.filter((h) => !h.abandoned);
  if (f === "above") return active.filter((h) => h.type === 1);
  if (f === "below") return active.filter((h) => h.type === 2);
  return active;
}

function hydrantTags(h) {
  return {
    "Vrsta": HYD_TYPE[h.type], "Stanje": h.abandoned ? "opuščen" : "v uporabi",
    ...(h.year ? { "Leto izgradnje": String(h.year) } : {}),
    ...(h.acc && hydDb?.accuracy?.[h.acc] ? { "Natančnost položaja": hydDb.accuracy[h.acc] } : {}),
    "Vir": "Zbirni kataster GJI (GURS)",
  };
}

function hydrantTooltip(h) {
  const { e, n } = toD96(h.lat, h.lng);
  const acc = h.acc && hydDb?.accuracy?.[h.acc];
  return `<div class="cave-tip"><b>🧯 Hidrant — ${HYD_TYPE[h.type]}${h.abandoned ? " (opuščen)" : ""}</b>
    <div class="kv"><dt>Leto izgradnje</dt><dd>${h.year || "—"}</dd>
    ${acc ? `<dt>Natančnost</dt><dd>${esc(acc.replace(/^Koordinate so določene s točnostjo /, "").replace(/ ob 95%.*$/, ""))}</dd>` : ""}
    <dt>WGS84</dt><dd>${fmtLatLng(h.lat, h.lng, state.settings.coordFormat)}</dd>
    <dt>D96/TM</dt><dd>e ${Math.round(e)} n ${Math.round(n)}</dd></div></div>`;
}

export function flyToCave(c) {
  map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
  setTimeout(() => pointPopup([c.lat, c.lng], { title: `🕳️ ${c.name}`, subtitle: `Kataster jam · št. ${c.ref}`, tags: c.tags }), 750);
}

export function getLoadedFeatures() {
  const out = [];
  for (const [catId, { features }] of loaded) {
    const cat = state.db.pois.find((c) => c.id === catId);
    for (const f of features) if (f.name) out.push({ ...f, emoji: emo(cat), catLabel: cat.label });
  }
  return out;
}

function toFeatures(json) {
  const out = [];
  for (const el of json.elements || []) {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const t = el.tags || {};
    out.push({ id: `${el.type}/${el.id}`, lat, lng, name: t.name || t["name:sl"] || "", tags: t });
  }
  return out;
}

export async function loadCategory(cat, { force = false, silent = false } = {}) {
  loading.add(cat.id);
  refreshPanel();
  try {
    if (cat.id === "cave") {
      await loadCaves();
      loading.delete(cat.id);
      return caveFilter();
    }
    if (cat.id === "hydrant") {
      await loadHydrants();
      loading.delete(cat.id);
      return hydrantFilter();
    }
    const json = await overpass(cat.query, force ? 0 : 14 * 86400);
    const features = toFeatures(json);
    loading.delete(cat.id);
    return features;
  } catch (e) {
    loading.delete(cat.id);
    if (!silent) toast(`${cat.label}: ${e.message}`, "err", 4000);
    throw e;
  } finally {
    refreshPanel();
  }
}

export async function showCategory(id, force = false) {
  const cat = state.db.pois.find((c) => c.id === id);
  if (!cat) return;
  const gen = (showGen.get(id) || 0) + 1;
  showGen.set(id, gen);
  let features;
  try { features = await loadCategory(cat, { force }); } catch { return; }
  if (showGen.get(id) !== gen) return;               // a newer call (filter change, refresh) took over
  if (!state.settings.pois.includes(id)) return;     // toggled off while loading
  hideLayer(id);
  const isCave = id === "cave", isHyd = id === "hydrant";
  const ms = state.settings.ui?.markerSize || 18;    // "Velikost označb" (px diameter)
  // caves: marker size grows with cave length (log scale) so big systems stand out
  const points = features.map((f) => isHyd ? {
    lat: f.lat, lng: f.lng, f, r: ms / 4, w: 1.5, stroke: "#ffffff",
    fill: f.abandoned ? HYD_COLOR.abandoned : HYD_COLOR[f.type],
  } : {
    lat: f.lat, lng: f.lng, f,
    r: isCave ? ms / 6 + Math.min(6, Math.log10((f.len || 0) + 1) * 1.5) * ms / 18 : ms / 3,
    w: isCave ? 1 : 2, stroke: isCave ? "#3b1d06" : "#fff", fill: isCave ? "#f59e0b" : cat.color,
  });
  const layer = new PointLayer(points, {
    tooltip: ({ f }) => isCave ? caveTooltip(f) : isHyd ? hydrantTooltip(f) : `${emo(cat)} ${esc(f.name || cat.label)}`,
    onClick: ({ f }) => isHyd
      ? pointPopup([f.lat, f.lng], { title: `${emo(cat)} Hidrant — ${HYD_TYPE[f.type]}`, subtitle: "Zbirni kataster GJI", tags: hydrantTags(f) })
      : isCave
      ? pointPopup([f.lat, f.lng], { title: `${emo(cat)} ${f.name}`, subtitle: `Kataster jam · št. ${f.ref}`, tags: f.tags })
      : pointPopup([f.lat, f.lng], { title: `${emo(cat)} ${f.name || cat.label}`, subtitle: cat.label, tags: f.tags }),
  });
  layer.addTo(map);
  loaded.set(id, { features, layer });
  if (isCave && caveDb && features.length < caveDb.count && !quietReload) {
    const fl = CAVE_FILTERS.find(([v]) => v === state.settings.caveFilter)?.[1] || "";
    toast(`Jame: prikazanih ${fmtNum(features.length)} od ${fmtNum(caveDb.count)} — vklopljen je filter »${fl}« (Točke → Kataster jam)`, "", 6000);
  }
  refreshPanel();
  emit("poi-changed");
}

function hideLayer(id) {
  const l = loaded.get(id);
  if (l) { map.removeLayer(l.layer); loaded.delete(id); }
}

export function togglePoi(id, force) {
  const s = state.settings;
  const on = force ?? !s.pois.includes(id);
  s.pois = s.pois.filter((x) => x !== id);
  if (on) { s.pois.push(id); showCategory(id); }
  else hideLayer(id);
  saveSettings();
  refreshPanel();
  emit("poi-changed");
}

export function restorePois() {
  // categories that no longer exist (removed from the list) are dropped from the saved selection
  const known = new Set(state.db.pois.map((c) => c.id));
  state.settings.pois = state.settings.pois.filter((id) => known.has(id));
  for (const id of state.settings.pois) showCategory(id);
}

// marker size / emoji changed in the settings menu → redraw active categories (debounced)
let restyleTimer = null;
on("poi-style", () => {
  clearTimeout(restyleTimer);
  restyleTimer = setTimeout(() => { quietReload = true; restorePois(); setTimeout(() => { quietReload = false; }, 1500); refreshPanel(); }, 250);
});
let quietReload = false;

function refreshPanel() {
  if (panelEl?.isConnected) poiPanel.render(panelEl);
}

export const poiPanel = {
  id: "poi",
  title: "Točke zanimanja",
  render(el) {
    panelEl = el;
    const s = state.settings;
    const chips = state.db.pois.map((c) => {
      const on = s.pois.includes(c.id);
      const n = loaded.get(c.id)?.features.length;
      const filtered = c.id === "cave" && caveDb && n != null && n < caveDb.count;
      return `<button class="chip ${on ? "on" : ""} ${loading.has(c.id) ? "loading" : ""}" style="--c:${c.color}" data-poi="${c.id}" title="${esc(c.label)}">
        ${on && n != null ? `<span class="cnt ${filtered ? "filtered" : ""}">${fmtNum(n)}${filtered ? " ⚠" : ""}</span>` : ""}<span class="em">${emo(c)}</span><span class="ellipsis" style="max-width:100%">${esc(c.label)}</span></button>`;
    }).join("");
    let caveCard = "";
    if (s.pois.includes("cave") && caveDb) {
      const f = s.caveFilter || "all";
      const top = (key) => [...caveDb.caves].sort((a, b) => b[key] - a[key]).slice(0, 5)
        .map((c) => `<div class="dd-item" data-cave="${c.ref}"><span class="em">🕳️</span><div style="min-width:0"><div class="t ellipsis">${esc(c.name)}</div><div class="s">${caveInfo(c)}</div></div></div>`).join("");
      caveCard = `<div class="section"><div class="section-title"><span>🕳️ Kataster jam</span><span>${fmtNum(caveDb.count)} jam</span></div>
        <div class="card stack">
          <div class="small muted">Vir: ${esc(caveDb.source)} · uvoženo ${esc(caveDb.imported)}. Velikost pike = dolžina jame.</div>
          <div class="seg">${CAVE_FILTERS.map(([v, l]) => `<button class="${f === v ? "on" : ""}" data-cavef="${v}">${l}</button>`).join("")}</div>
          ${f !== "all"
            ? `<div class="filter-warn">⚠ Prikazanih je samo <b>${fmtNum(caveFilter().length)}</b> od ${fmtNum(caveDb.count)} jam (filter: ${CAVE_FILTERS.find(([v]) => v === f)[1]}). <button class="btn sm" data-cavef="all">Pokaži vse</button></div>`
            : `<div class="small">Prikazanih je vseh <b>${fmtNum(caveDb.count)}</b> jam.</div>`}
          <div class="small"><b>Najdaljše</b></div><div>${top("len")}</div>
          <div class="small"><b>Najgloblje</b></div><div>${top("depth")}</div>
        </div></div>`;
    }
    let hydCard = "";
    if (s.pois.includes("hydrant") && hydDb) {
      const f = s.hydrantFilter || "all";
      const c = (pred) => fmtNum(hydDb.items.filter(pred).length);
      hydCard = `<div class="section"><div class="section-title"><span>🧯 Hidranti</span><span>${fmtNum(hydDb.count)} hidrantov</span></div>
        <div class="card stack">
          <div class="small muted">Vir: zbirni kataster gospodarske javne infrastrukture (GURS), podatki vseh upravljavcev vodovodov · uvoženo ${esc(hydDb.imported)}, zadnja sprememba ${esc(hydDb.newestChange || "—")}.</div>
          <div class="seg">${HYD_FILTERS.map(([v, l]) => `<button class="${f === v ? "on" : ""}" data-hydf="${v}">${l}</button>`).join("")}</div>
          <div class="hyd-legend">
            <span><i style="background:${HYD_COLOR[1]}"></i>nadzemni ${c((h) => !h.abandoned && h.type === 1)}</span>
            <span><i style="background:${HYD_COLOR[2]}"></i>podzemni ${c((h) => !h.abandoned && h.type === 2)}</span>
            <span><i style="background:${HYD_COLOR[0]}"></i>ni podatka ${c((h) => !h.abandoned && h.type === 0)}</span>
            <span><i style="background:${HYD_COLOR.abandoned}"></i>opuščeni ${c((h) => h.abandoned)}</span>
          </div>
        </div></div>`;
    }
    el.innerHTML = `
      <div class="help">Točke iz OpenStreetMap (Overpass), jame iz katastra jam, hidranti iz državnega katastra GJI. Ko so enkrat naložene, delujejo brez povezave.</div>
      <div class="section">
        <div class="section-title"><span>Kategorije</span>
          <span class="row">${s.pois.length ? `<button class="btn sm" id="poi-refresh" title="Ponovno prenesi aktivne kategorije">${icon("refresh")} Osveži</button><button class="btn sm danger" id="poi-clear">Izklopi vse</button>` : ""}</span>
        </div>
        <div class="chip-grid">${chips}</div>
      </div>${hydCard}${caveCard}`;
    el.onclick = (e) => {
      const b = e.target.closest("[data-poi]");
      if (b) return togglePoi(b.dataset.poi);
      const cf = e.target.closest("[data-cavef]");
      if (cf) { s.caveFilter = cf.dataset.cavef; saveSettings(); return showCategory("cave"); }
      const hf = e.target.closest("[data-hydf]");
      if (hf) { s.hydrantFilter = hf.dataset.hydf; saveSettings(); return showCategory("hydrant"); }
      const cv = e.target.closest("[data-cave]");
      if (cv) return flyToCave(getCaves().find((c) => c.ref === +cv.dataset.cave));
      if (e.target.closest("#poi-clear")) [...s.pois].forEach((id) => togglePoi(id, false));
      if (e.target.closest("#poi-refresh")) s.pois.forEach((id) => showCategory(id, true));
    };
  },
};
