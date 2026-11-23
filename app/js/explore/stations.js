// "Vremenske postaje" — all public ARSO stations: weather (main + automatic), water (hydro), air.
// Sources are ARSO XML files (refreshed by ARSO every ~30 min) read directly by the browser —
// ARSO sends "Access-Control-Allow-Origin: *", so no proxy is needed. If a browser ever blocks a
// source (CORS) or it fails, that source shows a warning and the others keep working.
// Last good data is kept locally (works offline); auto refresh every 15 min + "Osveži".
import { map } from "../map/map.js";
import { store } from "../services/api.js";
import { esc } from "../shared/util.js";
import { setLiveStatus, removeLiveStatus, fmtTime } from "../map/livestatus.js";

const ATTR = "Vir: Agencija RS za okolje (ARSO), meteo.si";
const SOURCES = {
  meteoMain: { kind: "meteo", label: "meteo – glavne postaje", url: "https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_si_latest.xml" },
  meteoAms: { kind: "meteo", label: "meteo – samodejne postaje", url: "https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observationAms_si_latest.xml" },
  hidro: { kind: "voda", label: "hidrološke postaje", url: "https://www.arso.gov.si/xml/vode/hidro_podatki_zadnji.xml" },
  zrak: { kind: "zrak", label: "kakovost zraka", url: "https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml" },
};
const REFRESH_MS = 15 * 60 * 1000;
const CLUSTER_BELOW_ZOOM = 10;   // below this zoom nearby stations are grouped
const CLUSTER_PX = 64;

let cache = null;          // { sources: { key: { ts, items } } }
let errors = {};           // key → message
let loading = null, timer = null, busy = false;
const active = new Map();  // kind → layer (only layers that are on)

// ── parsing ──
const val = (s) => { const t = (s ?? "").trim(); return t === "" ? null : t; };   // empty → null, "<2" stays text
const num = (s) => (s == null ? null : (isFinite(+String(s).replace(",", ".")) ? +String(s).replace(",", ".") : null));

function parseMeteo(doc) {
  return [...doc.getElementsByTagName("metData")].map((m) => {
    const p = {};
    for (const c of m.children) p[c.tagName] = val(c.textContent);   // ALL sub-elements, nothing left out
    return { id: p.domain_meteosiId || p.domain_title, lat: num(p.domain_lat), lng: num(p.domain_lon), name: p.domain_longTitle || p.domain_title, props: p };
  }).filter((s) => s.lat != null && s.lng != null);
}

function parsePostaja(doc) {
  return [...doc.getElementsByTagName("postaja")].map((el) => {
    const p = {};
    for (const a of el.attributes) p[a.name] = val(a.value);
    for (const c of el.children) p[c.tagName] = val(c.textContent);
    return { id: p.sifra, lat: num(p.wgs84_sirina), lng: num(p.wgs84_dolzina), name: p.merilno_mesto || p.sifra, props: p };
  }).filter((s) => s.lat != null && s.lng != null);
}

async function fetchSource(key) {
  const src = SOURCES[key];
  let r;
  try {
    r = await fetch(src.url, { cache: "no-store" });
  } catch (e) {
    // a network-level failure: offline, or the browser blocked the response (CORS)
    throw new Error(navigator.onLine === false ? "brez povezave" : `brskalnik ne more prebrati vira (CORS ali omrežje): ${e.message}. Rešitev: majhen proxy v aplikaciji.`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const doc = new DOMParser().parseFromString(await r.text(), "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("neveljaven XML");
  return src.kind === "meteo" ? parseMeteo(doc) : parsePostaja(doc);
}

// same weather station in both meteo files → keep the record with more data
function mergeMeteo(a, b) {
  const filled = (s) => Object.values(s.props).filter((v) => v != null).length;
  const out = new Map();
  for (const s of [...a, ...b]) {
    const prev = out.get(s.id);
    if (!prev || filled(s) > filled(prev)) out.set(s.id, s);
  }
  return [...out.values()];
}

export function stationsOf(kind) {
  const S = cache?.sources || {};
  if (kind === "meteo") return mergeMeteo(S.meteoMain?.items || [], S.meteoAms?.items || []);
  if (kind === "voda") return S.hidro?.items || [];
  return S.zrak?.items || [];
}

async function loadCache() {
  if (!cache) cache = (await store.get("arso_stations", null)) || { sources: {} };
  return cache;
}

export async function refreshStations() {
  if (busy) return;
  busy = true;
  updateStatus();
  await loadCache();
  const keys = Object.keys(SOURCES);
  const res = await Promise.allSettled(keys.map(fetchSource));
  res.forEach((r, i) => {
    const k = keys[i];
    if (r.status === "fulfilled") { cache.sources[k] = { ts: Date.now(), items: r.value }; delete errors[k]; }
    else { errors[k] = r.reason?.message || String(r.reason); console.warn(`ARSO ${k}:`, errors[k]); }
  });
  store.set("arso_stations", cache, 0);
  busy = false;
  for (const l of active.values()) l._redraw();
  updateStatus();
}

function updateStatus() {
  if (!active.size) { removeLiveStatus("arso"); return; }
  const kinds = new Set(active.keys());
  const keys = Object.keys(SOURCES).filter((k) => kinds.has(SOURCES[k].kind));
  const times = keys.map((k) => cache?.sources?.[k]?.ts).filter(Boolean);
  const failed = keys.filter((k) => errors[k]);
  const offline = failed.length && failed.length === keys.length && times.length;
  setLiveStatus("arso", {
    label: "🌡️ Vremenske postaje",
    time: times.length ? Math.min(...times) : null,
    busy,
    note: offline ? `Podatki z dne ${fmtTime(Math.min(...times))}, brez povezave` : "",
    warn: failed.map((k) => `${SOURCES[k].label}: ${errors[k]}`),
    onRefresh: refreshStations,
  });
}

// ── markers ──
const tempColor = (t) => (t == null ? "#94a3b8" : t < 0 ? "#2563eb" : t < 20 ? "#16a34a" : t <= 30 ? "#f97316" : "#dc2626");
const pmColor = (v) => (v == null ? "#94a3b8" : v < 20 ? "#16a34a" : v <= 50 ? "#eab308" : "#dc2626");

function markerFor(kind, s) {
  const p = s.props;
  if (kind === "meteo") {
    const t = num(p.t);
    return L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17],
      html: `<div class="st-temp emoji-marker" style="background:${tempColor(t)}">${t == null ? "–" : Math.round(t) + "°"}</div>` });
  }
  if (kind === "voda") {
    const q = num(p.pretok), vv = num(p.prvi_vv_pretok), high = q != null && vv != null && q >= vv;
    return L.divIcon({ className: "", iconSize: [22, 28], iconAnchor: [11, 26],
      html: `<svg class="st-drop emoji-marker" width="22" height="28" viewBox="0 0 22 28"><path d="M11 1C11 1 2 12 2 18a9 9 0 0 0 18 0C20 12 11 1 11 1Z" fill="${high ? "#dc2626" : "#2563eb"}" stroke="#fff" stroke-width="2"/></svg>` });
  }
  const pm = num(p.pm10);
  return L.divIcon({ className: "", iconSize: [32, 32], iconAnchor: [16, 16],
    html: `<div class="st-air emoji-marker" style="background:${pmColor(pm)}">${pm == null ? "–" : Math.round(pm)}</div>` });
}

const MAIN = {   // what the popup shows first (only non-empty values)
  meteo: [["t", "Temperatura", "°C"], ["rh", "Vlažnost", "%"], ["ff_val", "Veter", "m/s"], ["dd_shortText", "Smer vetra", ""], ["msl", "Tlak (morje)", "hPa"], ["p", "Tlak", "hPa"], ["snow", "Snežna odeja", "cm"], ["rr_val", "Padavine", "mm"], ["nn_shortText", "Oblačnost", ""], ["wwsyn_shortText", "Pojavi", ""], ["vis_value", "Vidnost", "km"]],
  voda: [["reka", "Reka", ""], ["vodostaj", "Vodostaj", "cm"], ["pretok", "Pretok", "m³/s"], ["prvi_vv_pretok", "1. visokovodni pretok", "m³/s"], ["temp_vode", "Temperatura vode", "°C"], ["pretok_znacilni", "Značilni pretok", ""]],
  zrak: [["pm10", "PM10", "µg/m³"], ["pm2.5", "PM2,5", "µg/m³"], ["o3", "O₃", "µg/m³"], ["no2", "NO₂", "µg/m³"], ["so2", "SO₂", "µg/m³"], ["co", "CO", "mg/m³"]],
};
const TIME = { meteo: (p) => p.tsValid_issued || p.valid, voda: (p) => p.datum, zrak: (p) => p.datum_do || p.datum_od };
const TITLE = { meteo: "🌡️ Meteorološka postaja", voda: "💧 Hidrološka postaja", zrak: "🌫️ Postaja za kakovost zraka" };

function popupHtml(kind, s) {
  const p = s.props;
  const main = MAIN[kind].filter(([k]) => p[k] != null)
    .map(([k, label, unit]) => `<dt>${esc(label)}</dt><dd>${esc(p[k])}${unit ? " " + unit : ""}</dd>`).join("");
  const all = Object.entries(p).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v == null ? '<span class="muted">—</span>' : esc(v)}</td></tr>`).join("");
  return `<div class="pop stack st-pop" style="min-width:230px">
    <b>${esc(s.name)}</b><div class="small muted">${TITLE[kind]}${s.id ? ` · ${esc(s.id)}` : ""}</div>
    ${main ? `<dl class="kv">${main}</dl>` : `<div class="small muted">Ni trenutnih meritev.</div>`}
    <div class="small muted">Meritev: ${esc(TIME[kind](p) || "—")}</div>
    <button class="btn sm" data-st-all>Vsi podatki</button>
    <div class="st-all" hidden><table>${all}</table></div>
  </div>`;
}

// ── layer with simple grid clustering when zoomed out ──
function stationsLayer(kind, opacity) {
  const g = L.layerGroup();
  let op = opacity;
  g.getAttribution = () => ATTR;   // shown in the map corner while any station layer is on
  g._redraw = () => {
    g.clearLayers();
    const list = stationsOf(kind);
    const z = map.getZoom();
    const groups = new Map();
    for (const s of list) {
      if (z >= CLUSTER_BELOW_ZOOM) { groups.set(s.id + Math.random(), [s]); continue; }
      const pt = map.project([s.lat, s.lng], z);
      const k = `${Math.floor(pt.x / CLUSTER_PX)},${Math.floor(pt.y / CLUSTER_PX)}`;
      (groups.get(k) || groups.set(k, []).get(k)).push(s);
    }
    for (const grp of groups.values()) {
      if (grp.length === 1) {
        const s = grp[0];
        const m = L.marker([s.lat, s.lng], { icon: markerFor(kind, s), pane: "top", opacity: op, keyboard: false })
          .bindPopup(() => popupHtml(kind, s), { maxWidth: 360 });
        m.on("popupopen", (e) => {
          e.popup.getElement().onclick = (ev) => {
            if (!ev.target.closest("[data-st-all]")) return;
            const t = e.popup.getElement().querySelector(".st-all");
            t.hidden = !t.hidden;
            ev.target.textContent = t.hidden ? "Vsi podatki" : "Skrij podatke";
            e.popup._updateLayout(); e.popup._updatePosition(); e.popup._adjustPan?.();   // resize without rebuilding the content
          };
        });
        g.addLayer(m);
      } else {
        const lat = grp.reduce((a, s) => a + s.lat, 0) / grp.length, lng = grp.reduce((a, s) => a + s.lng, 0) / grp.length;
        const c = L.marker([lat, lng], { pane: "top", opacity: op, keyboard: false,
          icon: L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="st-cluster st-${kind} emoji-marker">${grp.length}</div>` }) });
        c.on("click", () => map.fitBounds(L.latLngBounds(grp.map((s) => [s.lat, s.lng])), { padding: [60, 60], maxZoom: CLUSTER_BELOW_ZOOM + 1 }));
        c.bindTooltip(`${grp.length} postaj — klikni za približanje`, { direction: "top" });
        g.addLayer(c);
      }
    }
  };
  const onZoom = () => g._redraw();
  g.on("add", async () => {
    active.set(kind, g);
    map.on("zoomend", onZoom);
    await loadCache();
    g._redraw();
    updateStatus();
    const newest = Math.max(0, ...Object.values(cache.sources).map((x) => x.ts || 0));
    if (Date.now() - newest > 5 * 60 * 1000) refreshStations();   // stale or empty → fetch now
    timer ||= setInterval(() => { if (document.visibilityState === "visible") refreshStations(); }, REFRESH_MS);
  });
  g.on("remove", () => {
    active.delete(kind);
    map.off("zoomend", onZoom);
    if (!active.size) { clearInterval(timer); timer = null; }
    updateStatus();
  });
  g.setOpacity = (v) => { op = v; g.eachLayer((l) => l.setOpacity?.(v)); };
  return g;
}

export function createStationsLayer(cfg, opacity) {
  return stationsLayer(cfg.kind, opacity);
}
