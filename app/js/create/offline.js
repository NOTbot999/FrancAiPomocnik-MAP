import { map } from "../map/map.js";
import { api, store, IS_WEB } from "../services/api.js";
import { state, emit, layerName } from "../runtime/state.js";
import { esc, fmtBytes, fmtNum, toast, $, $$ } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { pickPoint } from "../shared/tools.js";
import { loadCategory } from "../explore/poi.js";

let panelEl;
let bbox = null;          // [s, w, n, e]
let rect = null;
let selLayers = null;     // Set of layer ids
let zmin = 8, zmax = 15;
let areaName = "";
let stats = null, areas = [];
let poiJob = null;        // { done, total }
let pollTimer = null;
export let netStatus = { online: true, forcedOffline: false, job: null };

function tileCount(b, z0, z1) {
  const [s, w, n, e] = b;
  let total = 0;
  for (let z = z0; z <= z1; z++) {
    const N = 2 ** z;
    const x = (lng) => Math.floor((lng + 180) / 360 * N);
    const y = (lat) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * N);
    total += (x(e) - x(w) + 1) * (y(s) - y(n) + 1);
  }
  return total;
}

function setBbox(b) {
  bbox = b;
  rect && map.removeLayer(rect);
  rect = L.rectangle([[b[0], b[1]], [b[2], b[3]]], { color: "#0d9488", weight: 2, dashArray: "6,6", fillOpacity: 0.06, interactive: false, pane: "vectors" }).addTo(map);
  refresh();
}

function useView() {
  const b = map.getBounds();
  setBbox([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
  const z = Math.round(map.getZoom());
  zmin = Math.max(6, z - 3); zmax = Math.min(17, z + 3);
  refresh();
}

async function drawRect() {
  const a = await pickPoint("Klikni prvi vogal območja");
  if (!a) return;
  const b = await pickPoint("Klikni nasprotni vogal");
  if (!b) return;
  setBbox([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
}

export async function pollStatus() {
  try {
    netStatus = await api("/api/status");
    emit("net-status", netStatus);
    const j = netStatus.job;
    if (j && !j.finished) {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(pollStatus, 700);
    } else if (j?.finished && pollTimer) {
      pollTimer = null;
      toast(j.cancelled ? "Prenos preklican" : `Prenos končan: ${fmtNum(j.done + j.skipped)} ploščic${j.failed ? `, ${j.failed} neuspešnih` : ""}`, j.failed ? "" : "ok", 4500);
      loadStats();
    }
  } catch { /* backend unreachable */ }
  if (netStatus.job && !netStatus.job.finished) refresh();
}

async function loadStats() {
  [stats, areas] = await Promise.all([api("/api/cache/stats").catch(() => null), store.get("offline_areas", [])]);
  refresh();
}

async function startDownload() {
  if (!bbox) return toast("Najprej izberi območje.");
  const layers = [...selLayers].filter((id) => !state.layerIndex[id]?.noBulk);
  try {
    await api("/api/offline/start", { method: "POST", body: { layers, bbox, zmin, zmax, name: areaName || "Območje" } });
    pollTimer = setTimeout(pollStatus, 300);
    toast("Prenos se je začel — lahko nadaljuješ z delom.", "ok");
  } catch (e) { toast(e.message, "err", 5000); }
}

async function prefetchPois() {
  const cats = state.db.pois;
  poiJob = { done: 0, total: cats.length, failed: 0 };
  refresh();
  for (const c of cats) {
    try { await loadCategory(c, { silent: true }); } catch { poiJob.failed++; }
    poiJob.done++;
    refresh();
  }
  toast(`Točke pripravljene za offline (${poiJob.total - poiJob.failed}/${poiJob.total})`, "ok");
  poiJob = null;
  loadStats();
}

function refresh() { if (panelEl?.isConnected) offlinePanel.render(panelEl); }

const RASTER = ["tile", "wms", "arcgis_export"];   // live/vector layers (3RO, flights, weather) can't be saved as tiles
const rasterLayers = () => Object.values(state.layerIndex).filter((l) => RASTER.includes(l.type));

export const offlinePanel = {
  id: "offline",
  title: "Brez povezave",
  onOpen() {
    if (!selLayers) selLayers = new Set([state.settings.base, ...state.settings.overlays.map((o) => o.id)].filter((id) => state.layerIndex[id] && RASTER.includes(state.layerIndex[id].type)));
    loadStats();
  },
  onClose() { rect && map.removeLayer(rect); rect = null; bbox = null; },
  render(el) {
    panelEl = el;
    if (IS_WEB) {   // the web version has no local cache to download into
      el.innerHTML = `<div class="empty"><div class="big">📥</div><b>Karte brez povezave so na voljo v aplikaciji</b><br>
        <span class="small">Spletna različica nalaga karte sproti. Za prenos območij, delo brez signala in shranjeni predpomnilnik
        namesti aplikacijo za <b>Windows</b> ali <b>Android</b>.</span></div>
        <div class="help">Karte, ki si jih ogledaš, brskalnik za nekaj časa shrani sam, risbe in nastavitve pa ostanejo v tem brskalniku.</div>`;
      return;
    }
    const j = netStatus.job;
    const running = j && !j.finished;
    const perLayer = bbox ? tileCount(bbox, zmin, zmax) : 0;
    const okLayers = [...(selLayers || [])].filter((id) => !state.layerIndex[id]?.noBulk);
    const total = perLayer * okLayers.length;
    const nameOf = (id) => layerName(id) || id;

    el.innerHTML = `
      <div class="card" style="margin-top:4px">
        <div class="row"><span class="grow"><b>${netStatus.forcedOffline ? "Način brez povezave" : netStatus.online ? "Povezava deluje" : "Ni povezave"}</b><br>
          <span class="small muted">${netStatus.forcedOffline ? "Uporabljam samo shranjene podatke." : "Vse prikazano se samodejno shrani za kasnejšo rabo."}</span></span>
          <label class="check small"><input type="checkbox" id="o-force" ${netStatus.forcedOffline ? "checked" : ""}> Offline</label></div>
      </div>

      <div class="section">
        <div class="section-title">Prenesi območje</div>
        ${running ? `
          <div class="card stack">
            <div class="row"><b class="grow">${esc(j.name)}</b><span class="small muted">${fmtNum(j.done + j.skipped + j.failed)} / ${fmtNum(j.total)}</span></div>
            <div class="progress"><div style="width:${Math.round((j.done + j.skipped + j.failed) / Math.max(1, j.total) * 100)}%"></div></div>
            <div class="small muted">Novih ${fmtNum(j.done)} · že shranjenih ${fmtNum(j.skipped)} · neuspešnih ${fmtNum(j.failed)} · ${Math.round(j.elapsed)} s</div>
            <button class="btn danger sm" id="o-cancel">Prekliči</button>
          </div>` : `
          <div class="row"><button class="btn sm grow" id="o-view">${icon("rect")} Trenutni pogled</button><button class="btn sm grow" id="o-rect">${icon("crosshair")} Nariši območje</button></div>
          ${bbox ? `
          <div class="card stack" style="margin-top:8px">
            <input class="field" id="o-name" placeholder="Ime območja (npr. Triglavski NP)" value="${esc(areaName)}">
            <div class="row"><span class="small muted" style="width:90px">Povečava od</span><input type="range" min="5" max="19" value="${zmin}" id="o-zmin" class="grow"><b style="width:22px">${zmin}</b></div>
            <div class="row"><span class="small muted" style="width:90px">do</span><input type="range" min="5" max="19" value="${zmax}" id="o-zmax" class="grow"><b style="width:22px">${zmax}</b></div>
            <div class="small muted">Sloji za prenos:</div>
            <div style="max-height:180px;overflow:auto">
              ${[...selLayers].map((id) => `<label class="check small" style="padding:3px 0"><input type="checkbox" checked data-l="${id}" ${state.layerIndex[id]?.noBulk ? "disabled" : ""}> ${esc(nameOf(id))}${state.layerIndex[id]?.noBulk ? ' <span class="muted">(ni dovoljen množični prenos — shrani se ob ogledu)</span>' : ""}</label>`).join("")}
            </div>
            <select class="field" id="o-add"><option value="">+ Dodaj sloj…</option>${rasterLayers().filter((l) => !selLayers.has(l.id) && !l.noBulk).map((l) => `<option value="${l.id}">${esc(layerName(l))}</option>`).join("")}</select>
            <div class="row"><span class="grow">Ploščic: <b id="o-count">${fmtNum(total)}</b></span><span class="muted" id="o-size">≈ ${fmtBytes(total * 22000)}</span></div>
            <div class="small ${total > 60000 ? "" : "hidden"}" id="o-warn" style="color:var(--danger)">Preveč ploščic (največ 60.000). Zmanjšaj območje ali največjo povečavo.</div>
            <button class="btn primary block" id="o-start" ${total === 0 || total > 60000 ? "disabled" : ""}>${icon("download")} Prenesi</button>
          </div>` : `<div class="help">Izberi območje, nato sloje in razpon povečave. Prenesene karte delujejo brez interneta.</div>`}`}
      </div>

      <div class="section">
        <div class="section-title">Točke zanimanja</div>
        ${poiJob ? `<div class="card stack"><div class="small">Prenašam kategorije ${poiJob.done}/${poiJob.total}…</div><div class="progress"><div style="width:${poiJob.done / poiJob.total * 100}%"></div></div></div>`
          : `<button class="btn block" id="o-pois">${icon("pin")} Pripravi vse kategorije točk za offline</button>`}
      </div>

      ${areas?.length ? `<div class="section"><div class="section-title">Prenesena območja</div>
        ${[...areas].reverse().map((a, i) => `<div class="list-item"><div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:600">${esc(a.name)}</div>
          <div class="small muted">${fmtNum(a.tiles)} ploščic · z${a.zmin}–${a.zmax} · ${esc(a.date)}</div></div>
          <button class="icon-btn sm" data-area="${areas.length - 1 - i}" title="Pokaži">${icon("zoom")}</button></div>`).join("")}</div>` : ""}

      <div class="section">
        <div class="section-title"><span>Predpomnilnik</span>${stats ? `<span>${fmtBytes(stats.fileBytes)}</span>` : ""}</div>
        ${stats ? `${stats.layers.sort((a, b) => b.bytes - a.bytes).map((l) => `
          <div class="list-item"><div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:600">${esc(nameOf(l.layer))}</div>
          <div class="small muted">${fmtNum(l.tiles)} ploščic · ${fmtBytes(l.bytes)}</div></div>
          <button class="icon-btn sm" data-clear="${l.layer}" title="Izbriši">${icon("trash")}</button></div>`).join("") || `<div class="help">Predpomnilnik je prazen.</div>`}
          <div class="small muted" style="margin:6px 4px">Podatki (iskanja, poti, točke): ${fmtNum(stats.http.entries)} · ${fmtBytes(stats.http.bytes)}</div>
          <div class="row wrap">
            <button class="btn sm danger" id="o-clear-all">Izbriši vse ploščice</button>
            <button class="btn sm danger" id="o-clear-http">Izbriši podatke</button>
            ${window.pywebview?.api ? `<button class="btn sm" id="o-folder">${icon("folder")} Mapa</button>` : ""}
          </div>` : `<span class="spinner"></span>`}
      </div>`;

    el.onclick = async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.id === "o-view") useView();
      if (t.id === "o-rect") drawRect();
      if (t.id === "o-start") startDownload();
      if (t.id === "o-cancel") { await api("/api/offline/cancel", { method: "POST", body: {} }); pollStatus(); }
      if (t.id === "o-pois") prefetchPois();
      if (t.id === "o-folder") window.pywebview.api.open_data_dir();
      if (t.dataset.area) {
        const a = areas[+t.dataset.area];
        setBbox(a.bbox); map.flyToBounds([[a.bbox[0], a.bbox[1]], [a.bbox[2], a.bbox[3]]], { padding: [30, 30] });
      }
      if (t.dataset.clear) { stats = await api("/api/cache/clear", { method: "POST", body: { layer: t.dataset.clear } }); refresh(); }
      if (t.id === "o-clear-all" && confirm("Izbrišem vse shranjene ploščice kart?")) { stats = await api("/api/cache/clear", { method: "POST", body: {} }); refresh(); }
      if (t.id === "o-clear-http" && confirm("Izbrišem shranjena iskanja, poti in točke?")) { stats = await api("/api/cache/clear", { method: "POST", body: { what: "http" } }); refresh(); }
    };
    el.onchange = async (e) => {
      const t = e.target;
      if (t.id === "o-force") {
        netStatus = { ...netStatus, ...(await api("/api/network", { method: "POST", body: { forcedOffline: t.checked } })) };
        emit("net-status", netStatus);
        refresh();
      }
      if (t.dataset.l) { t.checked ? selLayers.add(t.dataset.l) : selLayers.delete(t.dataset.l); refresh(); }
      if (t.id === "o-add" && t.value) { selLayers.add(t.value); refresh(); }
    };
    el.oninput = (e) => {
      const t = e.target;
      if (t.id === "o-name") { areaName = t.value; return; }
      if (t.id !== "o-zmin" && t.id !== "o-zmax") return;
      if (t.id === "o-zmin") { zmin = +t.value; if (zmax < zmin) { zmax = zmin; $("#o-zmax", el).value = zmax; } }
      if (t.id === "o-zmax") { zmax = +t.value; if (zmin > zmax) { zmin = zmax; $("#o-zmin", el).value = zmin; } }
      $("#o-zmin", el).nextElementSibling.textContent = zmin;
      $("#o-zmax", el).nextElementSibling.textContent = zmax;
      const n = tileCount(bbox, zmin, zmax) * okLayers.length;
      $("#o-count", el).textContent = fmtNum(n);
      $("#o-size", el).textContent = "≈ " + fmtBytes(n * 22000);
      $("#o-start", el).disabled = n === 0 || n > 60000;
      $("#o-warn", el).classList.toggle("hidden", n <= 60000);
    };
    // re-render once the slider is released
    $$("#o-zmin, #o-zmax", el).forEach((r) => r.addEventListener("change", refresh));
  },
};
