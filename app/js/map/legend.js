// Map legends: what each colour / symbol of a layer means.
//   WMS (GURS, PIS, EEA …)  → live GetLegendGraphic image per sub-layer (cached by the app backend)
//   ArcGIS (GeoHub)          → bundled web/data/legends.json (tools/build_legends.py) — GeoHub does
//                              not allow the web version to read legends directly, and bundled works offline
//   weather, grid, flights   → drawn here
//   points of interest       → colour dot per active category (+ hydrant types)
// Shown in the "Legenda" box on the map (button in the right column) and under active layers.
import { state, saveSettings, on } from "../runtime/state.js";
import { proxiedImage } from "../services/api.js";
import { esc } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { TEMP_STOPS, WIND_STEPS } from "../explore/weather.js";

let bundle = null;
const loadBundle = () => (bundle ||= fetch("data/legends.json").then((r) => r.json()).catch(() => ({})));

const wmsLegendUrl = (cfg, layer) => {
  const sep = cfg.url.includes("?") ? "&" : "?";
  return proxiedImage(`${cfg.url}${sep}SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=${cfg.version || "1.1.1"}&FORMAT=image/png`
    + `&LAYER=${encodeURIComponent(layer)}&LEGEND_OPTIONS=${encodeURIComponent("fontAntiAliasing:true;fontSize:11;dpi:96")}`);
};

const items = (list) => `<div class="lg-items">${list.map(([sw, label]) => `<div class="lg-item">${sw}<span>${esc(label)}</span></div>`).join("")}</div>`;
const dot = (c) => `<i class="lg-dot" style="background:${c}"></i>`;
const bar = (stops, from, to) => `<div class="lg-bar" style="background:linear-gradient(90deg,${stops.join(",")})"></div><div class="lg-scale"><span>${from}</span><span>${to}</span></div>`;

/** HTML legend of one layer config ("" when there is nothing to show). */
export async function legendHtml(cfg) {
  if (!cfg) return "";
  if (cfg.type === "wms") {
    const subs = (cfg.layers || "").split(",").filter(Boolean);
    return subs.map((l) => `<img class="lg-img" src="${wmsLegendUrl(cfg, l)}" alt="" loading="lazy" onerror="this.remove()">`).join("");
  }
  if (cfg.type === "arcgis_export") {
    const groups = (await loadBundle())[cfg.id];
    if (!groups) return "";
    return groups.map((g) => `${g.items.length > 1 ? `<div class="lg-sub">${esc(g.title)}</div>` : ""}`
      + items(g.items.map((e) => [`<img class="lg-sym" src="${e.img}" alt="">`, e.label || g.title]))).join("");
  }
  if (cfg.type === "weather" && cfg.kind === "temp") {
    return bar(TEMP_STOPS.map(([t, c]) => `rgb(${c.join(",")}) ${((t + 20) / 62 * 100).toFixed(0)}%`), "−20 °C", "42 °C");
  }
  if (cfg.type === "weather" && cfg.kind === "wind") {
    return items(WIND_STEPS.map(([v, c], i) => [dot(c), i === WIND_STEPS.length - 1 ? `nad ${WIND_STEPS[i - 1][0]} km/h` : `do ${v} km/h`]))
      + `<div class="lg-note">Puščica kaže, kam piha veter.</div>`;
  }
  if (cfg.type === "weather" && cfg.kind === "clouds") {
    return bar(["rgba(236,241,247,0)", "rgba(236,241,247,.85)"], "jasno 0 %", "oblačno 100 %");
  }
  if (cfg.type === "rainviewer") {
    return bar(["#9be1ff", "#0077ff", "#00b050", "#ffee00", "#ff8800", "#e60000", "#c800c8"], "rahle padavine", "zelo močne / toča");
  }
  if (cfg.type === "grid_d96") {
    return `<div class="lg-note">Kvadrati 1 × 1 km v sistemu D96/TM (enaki kot LIDAR in DOF). Oznaka celice, npr. 462_101, je spodnji levi vogal v km (vzhod_sever).</div>`;
  }
  if (cfg.type === "arso_stations" && cfg.kind === "meteo") {
    return items([[dot("#2563eb"), "pod 0 °C"], [dot("#16a34a"), "0–20 °C"], [dot("#f97316"), "20–30 °C"], [dot("#dc2626"), "nad 30 °C"], [dot("#94a3b8"), "ni meritve"]])
      + `<div class="lg-note">Številka v krogu = temperatura. Ko je pomanjšano, so bližnje postaje združene (število postaj).</div>`;
  }
  if (cfg.type === "arso_stations" && cfg.kind === "voda") return items([[dot("#2563eb"), "pretok pod 1. visokovodnim pretokom"], [dot("#dc2626"), "pretok ≥ 1. visokovodni pretok"]]);
  if (cfg.type === "arso_stations" && cfg.kind === "zrak") {
    return items([[dot("#16a34a"), "PM10 pod 20 µg/m³"], [dot("#eab308"), "PM10 20–50 µg/m³"], [dot("#dc2626"), "PM10 nad 50 µg/m³"], [dot("#94a3b8"), "ni meritve"]]);
  }
  if (cfg.type === "nap") return `<div class="lg-note">Promet: NAP Slovenija (CC BY-SA 4.0). Barve po vrsti dogodka bodo dodane, ko bodo znana imena polj; zdaj so vsi elementi sivi.</div>`;
  if (cfg.type === "arcgis_d96" && cfg.level) return `<div class="lg-note">Barvna Državna topografska karta 1:25.000 (GURS): zeleno gozd, modro vode, rjavo plastnice in skale, črno ceste, stavbe in imena.</div>`;
  if (cfg.type === "arcgis_d96") return `<div class="lg-note">Črno-bela Državna topografska karta 1:25.000 (GURS). Najbolje se vidi nad ortofotom, LIDAR senčenjem ali svetlo podlago.</div>`;
  if (cfg.type === "live_flights") return items([[dot("#2563eb"), "letalo v zraku"], [dot("#94a3b8"), "na tleh"]]);
  return "";
}

// Points of interest: one dot per active category; hydrants and caves get their own keys
function poiLegend() {
  const ids = state.settings.pois || [];
  if (!ids.length) return "";
  const list = [];
  for (const id of ids) {
    const c = state.db.pois.find((x) => x.id === id);
    if (!c) continue;
    if (id === "hydrant") {
      list.push([dot("#dc2626"), "hidrant — nadzemni"], [dot("#2563eb"), "hidrant — podzemni"], [dot("#f97316"), "hidrant — vrsta ni podana"], [dot("#9ca3af"), "hidrant — opuščen"]);
    } else if (id === "defibrillator") {
      list.push([dot("#16a34a"), "AED — dostop 24 ur"], [dot("#eab308"), "AED — omejen urnik"], [dot("#0ea5e9"), "AED — samo v OSM"], [dot("#9ca3af"), "AED — ne deluje"]);
    } else if (id === "cave") {
      list.push([dot("#f59e0b"), "jama (večja pika = daljša jama)"]);
    } else list.push([dot(c.color), `${c.emoji || ""} ${c.label}`]);
  }
  return `<div class="lg-layer"><div class="lg-name">Točke zanimanja</div>${items(list)}</div>`;
}

// ── Legend box on the map ──
let box = null;
export function initLegend(container) {
  box = document.createElement("div");
  box.id = "map-legend";
  box.className = "map-legend";
  box.hidden = true;
  container.appendChild(box);
  L.DomEvent.disableClickPropagation(box);
  L.DomEvent.disableScrollPropagation(box);
  box.addEventListener("click", (e) => { if (e.target.closest("[data-legend-close]")) toggleLegend(false); });
  on("layers-changed", renderLegend);
  on("poi-changed", renderLegend);
  renderLegend();
}

export const isLegendOpen = () => !!state.settings.ui?.legendOpen;

export function toggleLegend(force) {
  state.settings.ui.legendOpen = force ?? !state.settings.ui.legendOpen;
  saveSettings();
  renderLegend();
}

let gen = 0;
export async function renderLegend() {
  if (!box) return;
  box.hidden = !isLegendOpen();
  if (box.hidden) return;
  const my = ++gen;
  const overlays = [...state.settings.overlays].filter((o) => o.visible !== false).reverse();   // top-most first
  const parts = await Promise.all(overlays.map(async (o) => {
    const cfg = state.layerIndex[o.id];
    if (!cfg) return "";
    const body = await legendHtml(cfg);
    return `<div class="lg-layer"><div class="lg-name">${esc(cfg.name)}</div>${body || `<div class="lg-note">${esc(cfg.description || "Ta vir nima legende.")}</div>`}</div>`;
  }));
  if (my !== gen) return;   // a newer render started meanwhile
  const content = parts.join("") + poiLegend();
  box.innerHTML = `<div class="lg-head"><b>${icon("legend")} Legenda</b><button class="icon-btn sm" data-legend-close title="Zapri legendo">${icon("x")}</button></div>
    <div class="lg-body">${content || `<div class="lg-note">Vklopi sloj ali točke zanimanja — tu bo razloženo, kaj pomenijo barve in oznake.</div>`}</div>`;
}
