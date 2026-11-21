// AI asistent — plugin slot. Plugins are ES modules (a .js file) that export:
//   export default { name: "…", description: "…", activate(api) { … }, deactivate?() }
// `api` gives safe access to the map and data plus a ready-made chat UI, so an AI model
// (local or online) can be connected without touching the app. See plugins/primer-asistent.js.
import { map } from "../map/map.js";
import { state, saveSettings } from "./state.js";
import { fetchJSON, store } from "../services/api.js";
import { esc, uid, toast, openTextFiles, haversine, h, $ } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { getCaves, getLoadedFeatures } from "../explore/poi.js";
import { getDrawings, addFeature } from "../create/draw.js";
import { getTracks } from "../create/tracks.js";
import { geocode } from "../explore/search.js";

const running = new Map();   // plugin id -> { mod, host }
let panelEl = null;
let activeId = null;

function makeApi(plugin, host) {
  const layers = [];
  return {
    version: 1,
    L, map,
    panel: host,
    getView() {
      const b = map.getBounds(), c = map.getCenter();
      return { center: [c.lat, c.lng], zoom: map.getZoom(), bounds: [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()] };
    },
    // points visible on screen: caves + loaded categories + markers (max `limit`, nearest to the centre first)
    getVisibleFeatures(limit = 300) {
      const b = map.getBounds(), c = map.getCenter();
      const out = [];
      for (const cv of getCaves()) if (b.contains([cv.lat, cv.lng])) out.push({ kind: "jama", name: cv.name, lat: cv.lat, lng: cv.lng, length_m: cv.len, depth_m: cv.depth, ref: cv.ref });
      for (const f of getLoadedFeatures()) if (!f.id?.startsWith("cave/") && b.contains([f.lat, f.lng])) out.push({ kind: f.catLabel, name: f.name, lat: f.lat, lng: f.lng, tags: f.tags });
      for (const d of getDrawings()) if (d.type === "marker" && b.contains(d.coords)) out.push({ kind: "oznaka", name: d.name, lat: d.coords[0], lng: d.coords[1], note: d.note });
      for (const o of out) o.distance_m = Math.round(haversine([c.lat, c.lng], [o.lat, o.lng]));
      return out.sort((a, z) => a.distance_m - z.distance_m).slice(0, limit);
    },
    getCaves, getDrawings, getTracks,
    activeLayers: () => ({ base: state.settings.base, overlays: state.settings.overlays.map((o) => state.layerIndex[o.id]?.name) }),
    flyTo: (lat, lng, zoom = 15) => map.flyTo([lat, lng], zoom),
    addMarker: (lat, lng, name = "AI oznaka", note = "") => addFeature({ type: "marker", coords: [lat, lng], name, note }),
    addLayer(geojson, { color = "#8b5cf6", name = plugin.name } = {}) {
      const l = L.geoJSON(geojson, { pane: "vectors", style: { color, weight: 3 }, pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 6, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }) })
        .bindTooltip((x) => esc(x.feature?.properties?.name || name)).addTo(map);
      layers.push(l);
      return () => { map.removeLayer(l); };
    },
    clearLayers() { layers.splice(0).forEach((l) => map.removeLayer(l)); },
    search: (q) => geocode(q),
    fetchJSON,                              // cached GET for the app's allowed data sources
    http: (url, opts) => window.fetch(url, opts),   // direct network access (e.g. an AI API)
    toast,
    storage: {
      get: (k, d) => store.get(`plugin_${plugin.id}_${k}`.replace(/[^a-z0-9_-]/gi, "_").toLowerCase().slice(0, 64), d),
      set: (k, v) => store.set(`plugin_${plugin.id}_${k}`.replace(/[^a-z0-9_-]/gi, "_").toLowerCase().slice(0, 64), v, 0),
    },
    // Ready-made chat UI: onSend(text, history) → Promise<string | {text, markers:[{lat,lng,name}]}>
    chat({ title = plugin.name, placeholder = "Vprašaj o karti…", greeting = "", onSend }) {
      host.innerHTML = `<div class="ai-chat"><div class="ai-log"></div>
        <div class="row ai-input"><input class="field grow" placeholder="${esc(placeholder)}"><button class="btn primary">${icon("send")}</button></div></div>`;
      const log = host.querySelector(".ai-log"), inp = host.querySelector("input"), btn = host.querySelector("button");
      const history = [];
      const add = (who, text) => {
        log.insertAdjacentHTML("beforeend", `<div class="ai-msg ${who}">${esc(text).replace(/\n/g, "<br>")}</div>`);
        log.scrollTop = log.scrollHeight;
      };
      if (greeting) add("bot", greeting);
      const send = async () => {
        const text = inp.value.trim();
        if (!text) return;
        inp.value = ""; add("me", text); history.push({ role: "user", content: text });
        btn.disabled = true;
        add("bot wait", "…");
        try {
          const r = await onSend(text, history);
          log.lastChild.remove();
          const reply = typeof r === "string" ? r : r?.text || "";
          add("bot", reply); history.push({ role: "assistant", content: reply });
          for (const m of r?.markers || []) this.addMarker(m.lat, m.lng, m.name, m.note);
        } catch (e) { log.lastChild.remove(); add("bot err", "Napaka: " + e.message); }
        btn.disabled = false; inp.focus();
      };
      btn.onclick = send;
      inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
    },
  };
}

async function startPlugin(p) {
  stopPlugin(p.id);
  const host = h(`<div class="plugin-host"></div>`);
  let mod;
  try {
    const url = URL.createObjectURL(new Blob([p.source], { type: "text/javascript" }));
    mod = (await import(/* @vite-ignore */ url)).default;
    URL.revokeObjectURL(url);
    if (!mod?.activate) throw new Error("Vtičnik nima funkcije activate(api)");
    running.set(p.id, { mod, host, api: null });
    const api = makeApi(p, host);
    running.get(p.id).api = api;
    await mod.activate(api);
    p.name = mod.name || p.name;
    p.description = mod.description || p.description || "";
  } catch (e) {
    running.delete(p.id);
    toast(`Vtičnik »${p.name}«: ${e.message}`, "err", 6000);
    p.error = e.message;
  }
}

function stopPlugin(id) {
  const r = running.get(id);
  if (!r) return;
  try { r.mod.deactivate?.(); } catch { /* ignore */ }
  r.api?.clearLayers();
  running.delete(id);
}

export async function initPlugins() {
  for (const p of state.settings.plugins) if (p.enabled) await startPlugin(p);
}

async function installFromSource(name, source) {
  const p = { id: uid("plg"), name: name.replace(/\.m?js$/i, ""), source, enabled: true };
  state.settings.plugins.push(p);
  await startPlugin(p);
  activeId = p.id;
  saveSettings();
  refresh();
}

function refresh() { if (panelEl?.isConnected) aiPanel.render(panelEl); }

export const aiPanel = {
  id: "ai",
  title: "AI asistent",
  render(el) {
    panelEl = el;
    const plugins = state.settings.plugins;
    if (!activeId || !running.has(activeId)) activeId = plugins.find((p) => running.has(p.id))?.id || null;
    el.innerHTML = `
      ${plugins.length ? `<div class="plugin-tabs">${plugins.map((p) => `
        <div class="plugin-row ${p.id === activeId ? "sel" : ""}">
          <button class="grow plugin-name" data-show="${p.id}">${icon("brain")} ${esc(p.name)}${p.error ? ` <span style="color:var(--danger)">⚠</span>` : ""}</button>
          <button class="switch ${p.enabled ? "on" : ""}" data-toggle="${p.id}" title="Vklopi / izklopi"><span></span></button>
          <button class="icon-btn sm" data-remove="${p.id}" title="Odstrani">${icon("trash")}</button>
        </div>`).join("")}</div>` : ""}
      <div id="plugin-slot">${activeId ? "" : `
        <div class="empty"><div class="big">🧠</div><b>Prostor za AI asistenta</b><br>
        <span class="small">Naloži vtičnik (datoteka .js), ki doda AI pomočnika ali druga orodja. Vtičnik dobi dostop do karte, vidnih točk, jam, risb in sledi ter pripravljen pogovorni vmesnik.</span></div>`}</div>
      <div class="section row wrap">
        <button class="btn sm primary" id="p-load">${icon("upload")} Naloži vtičnik (.js)</button>
        <button class="btn sm" id="p-example">${icon("plug")} Dodaj primer asistenta</button>
      </div>
      <div class="help">Vtičnik je navaden ES modul: <code>export default { name, activate(api) }</code>. API: <code>getView, getVisibleFeatures, getCaves, getDrawings, getTracks, flyTo, addMarker, addLayer, search, http, storage, chat</code>. Nalagaj samo vtičnike, ki jim zaupaš.</div>`;
    if (activeId) $("#plugin-slot", el).appendChild(running.get(activeId).host);

    el.onclick = async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      const d = t.dataset;
      const p = plugins.find((x) => x.id === (d.show || d.toggle || d.remove));
      if (d.show) { activeId = d.show; return refresh(); }
      if (d.toggle) { p.enabled = !p.enabled; p.error = null; if (p.enabled) await startPlugin(p); else stopPlugin(p.id); saveSettings(); return refresh(); }
      if (d.remove && confirm(`Odstranim vtičnik »${p.name}«?`)) { stopPlugin(p.id); state.settings.plugins = plugins.filter((x) => x !== p); saveSettings(); return refresh(); }
      if (t.id === "p-load") {
        const files = await openTextFiles(".js,.mjs");
        for (const f of files || []) await installFromSource(f.name, f.content);
      }
      if (t.id === "p-example") {
        const src = await fetch("plugins/primer-asistent.js").then((r) => r.text());
        await installFromSource("Primer asistenta", src);
      }
    };
  },
};
