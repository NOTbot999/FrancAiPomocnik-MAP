import { map } from "../map/map.js";
import { store } from "../services/api.js";
import { routing } from "../services/external.js";
import { on, emit } from "../runtime/state.js";
import { esc, debounce, fmtDist, fmtDur, toast, saveTextFile, $, $$ } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { pickPoint, pinIcon } from "../shared/tools.js";
import { geocode, localMatches } from "./search.js";
import { showProfile, elevationStats } from "./profile.js";
import { toGPX } from "../create/geoio.js";
import { addFeature } from "../create/draw.js";

const PROFILES = [
  { id: "foot", label: "Peš", em: "🥾", brouter: "hiking-mountain" },
  { id: "bike", label: "Kolo", em: "🚲", brouter: "trekking" },
  { id: "road", label: "Cestno", em: "🚴", brouter: "fastbike" },
  { id: "main", label: "Glavne", em: "🛵", brouter: "moped" },
  { id: "car", label: "Avto", em: "🚗", brouter: "car-fast" },
];
const ALT_COLORS = ["#2563eb", "#9333ea", "#0891b2"];

let wps = [{ latlng: null, label: "" }, { latlng: null, label: "" }];
let profile = "car";
let result = null;   // { alts: [...], sel }
let busy = false;
let layer, wpLayer, panelEl;
let openAc = -1;

export function initRoute() {
  layer = L.layerGroup().addTo(map);
  wpLayer = L.layerGroup().addTo(map);
  store.get("route", null).then((r) => {
    if (r?.wps) { wps = r.wps; profile = r.profile || profile; drawWaypoints(); if (wps.filter((w) => w.latlng).length >= 2) compute(); }
  });
  on("route-point", ({ which, latlng, label }) => {
    if (which === "from") wps[0] = { latlng, label: label || coordLabel(latlng) };
    else wps[wps.length - 1] = { latlng, label: label || coordLabel(latlng) };
    emit("open-panel", "route");
    changed();
  });
}

const coordLabel = (ll) => `${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`;
const persist = () => store.set("route", { wps, profile });

function changed() {
  persist();
  drawWaypoints();
  refreshPanel();
  if (wps.filter((w) => w.latlng).length >= 2) compute();
  else { result = null; layer.clearLayers(); refreshPanel(); }
}

function wpLetter(i) { return i === 0 ? "A" : i === wps.length - 1 ? "B" : String(i); }
function wpColor(i) { return i === 0 ? "#16a34a" : i === wps.length - 1 ? "#dc2626" : "#f59e0b"; }

function drawWaypoints() {
  wpLayer.clearLayers();
  wps.forEach((w, i) => {
    if (!w.latlng) return;
    const m = L.marker(w.latlng, { icon: pinIcon(wpColor(i), wpLetter(i)), draggable: true, pane: "top", zIndexOffset: 500 });
    m.bindTooltip(esc(w.label), { direction: "top" });
    m.on("dragend", (e) => { const ll = e.target.getLatLng(); wps[i] = { latlng: [ll.lat, ll.lng], label: coordLabel([ll.lat, ll.lng]) }; changed(); });
    wpLayer.addLayer(m);
  });
}

async function brouter(points, prof, alt) {
  const geo = await routing.brouter(points, prof, alt);
  const f = geo?.features?.[0];
  if (!f) throw new Error(typeof geo === "string" ? geo.slice(0, 120) : "Ni poti");
  const pts = f.geometry.coordinates.map((c) => [c[1], c[0], c[2] ?? null]);
  return { pts, meters: +f.properties["track-length"] || 0, seconds: +f.properties["total-time"] || 0, ascend: null };
}

async function osrm(points) {
  const d = await routing.osrm(points);
  const r = d.routes?.[0];
  if (!r) throw new Error("Ni poti");
  return { pts: r.geometry.coordinates.map((c) => [c[1], c[0], null]), meters: r.distance, seconds: r.duration, ascend: null };
}

const compute = debounce(async () => {
  const pts = wps.filter((w) => w.latlng).map((w) => w.latlng);
  if (pts.length < 2) return;
  const prof = PROFILES.find((p) => p.id === profile);
  busy = true; refreshPanel();
  const altIdx = pts.length === 2 ? [0, 1, 2] : [0];
  let alts = (await Promise.all(altIdx.map((i) => brouter(pts, prof.brouter, i).catch((e) => ({ error: e })))));
  const err = alts.find((a) => a.error)?.error;
  alts = alts.filter((a) => !a.error && a.pts.length > 1);
  // drop duplicate alternatives
  alts = alts.filter((a, i) => alts.findIndex((b) => Math.abs(b.meters - a.meters) < 30) === i);
  if (!alts.length && (profile === "car" || profile === "main")) {
    try { alts = [await osrm(pts)]; } catch { /* ignore */ }
  }
  busy = false;
  if (!alts.length) {
    result = null; layer.clearLayers();
    toast(err?.status === 503 ? "Usmerjanje ni na voljo brez povezave (ta pot še ni v predpomnilniku)." : `Poti ni mogoče izračunati: ${err?.message || "napaka"}`, "err", 4500);
    refreshPanel();
    return;
  }
  for (const a of alts) {
    a.ascend = a.pts.some((p) => p[2] != null) ? elevationStats(a.pts).up : null;
    if (profile === "foot") {
      // walking time: 4.5 km/h + 1 h per 600 m ascent (DIN 33466-like)
      const up = a.ascend ?? elevationStats(a.pts).up;
      a.seconds = (a.meters / 4500 + up / 600) * 3600;
    }
  }
  result = { alts, sel: 0 };
  drawRoute();
  map.flyToBounds(L.latLngBounds(alts[0].pts.map((p) => [p[0], p[1]])), { padding: [60, 60], duration: 0.7, maxZoom: 16 });
  refreshPanel();
}, 250);

function drawRoute() {
  layer.clearLayers();
  if (!result) return;
  result.alts.forEach((a, i) => {
    if (i === result.sel) return;
    L.polyline(a.pts.map((p) => [p[0], p[1]]), { color: "#64748b", weight: 5, opacity: 0.6, pane: "vectors" })
      .on("click", () => { result.sel = i; drawRoute(); refreshPanel(); })
      .bindTooltip(`Alternativa · ${fmtDist(a.meters)} · ${fmtDur(a.seconds)}`, { sticky: true })
      .addTo(layer);
  });
  const a = result.alts[result.sel];
  const ll = a.pts.map((p) => [p[0], p[1]]);
  L.polyline(ll, { color: "#fff", weight: 9, opacity: 0.9, pane: "vectors", interactive: false }).addTo(layer);
  L.polyline(ll, { color: ALT_COLORS[result.sel % 3], weight: 5.5, pane: "vectors" })
    .bindTooltip(`${fmtDist(a.meters)} · ${fmtDur(a.seconds)}`, { sticky: true }).addTo(layer);
}

async function pick(i) {
  const ll = await pickPoint(`Izberi točko ${wpLetter(i)} na karti`);
  if (!ll) return;
  wps[i] = { latlng: ll, label: coordLabel(ll) };
  changed();
}

function refreshPanel() { if (panelEl?.isConnected) routePanel.render(panelEl); }

export const routePanel = {
  id: "route",
  title: "Navigacija",
  render(el) {
    panelEl = el;
    const sel = result?.alts[result.sel];
    const rows = wps.map((w, i) => `
      <div class="wp" data-i="${i}">
        <span class="lbl" style="background:${wpColor(i)}">${wpLetter(i)}</span>
        <input class="field grow" data-wp="${i}" value="${esc(w.label)}" placeholder="${i === 0 ? "Začetek" : i === wps.length - 1 ? "Cilj" : "Vmesna točka"} — išči ali izberi na karti" autocomplete="off">
        <button class="icon-btn sm" data-pick="${i}" title="Izberi na karti">${icon("crosshair")}</button>
        ${wps.length > 2 ? `<button class="icon-btn sm" data-rm="${i}" title="Odstrani">${icon("x")}</button>` : ""}
        <div class="ac dropdown hidden" style="top:34px"></div>
      </div>`).join("");

    el.innerHTML = `
      <div class="section">
        <div class="seg prof" style="margin-bottom:10px">${PROFILES.map((p) => `<button class="${p.id === profile ? "on" : ""}" data-prof="${p.id}" title="${p.label}"><span style="font-size:15px">${p.em}</span>${p.label}</button>`).join("")}</div>
        ${rows}
        <div class="row" style="margin-top:4px">
          <button class="btn sm" id="r-add">${icon("plus")} Vmesna točka</button>
          <button class="btn sm" id="r-swap">${icon("swap")} Obrni</button>
          <span class="grow"></span>
          <button class="btn sm danger" id="r-clear">Počisti</button>
        </div>
      </div>
      ${busy ? `<div class="card" style="margin-top:12px"><span class="spinner"></span> Računam pot…</div>` : ""}
      ${sel && !busy ? `
      <div class="section">
        <div class="stat-grid">
          <div class="stat"><span>Razdalja</span><b>${fmtDist(sel.meters)}</b></div>
          <div class="stat"><span>Čas</span><b>${fmtDur(sel.seconds)}</b></div>
          <div class="stat"><span>Vzpon</span><b>${Math.round(sel.ascend ?? elevationStats(sel.pts).up)} m</b></div>
        </div>
        ${result.alts.length > 1 ? `<div class="section-title" style="margin-top:12px">Alternative</div>` + result.alts.map((a, i) => `
          <div class="list-item alt-route ${i === result.sel ? "sel" : ""}" data-alt="${i}">
            <span class="swatch" style="background:${i === result.sel ? ALT_COLORS[i % 3] : "#94a3b8"}"></span>
            <b class="grow">Pot ${i + 1}</b><span>${fmtDist(a.meters)}</span><span class="muted">${fmtDur(a.seconds)}</span>
          </div>`).join("") : ""}
        <div class="row wrap" style="margin-top:10px">
          <button class="btn sm" id="r-prof">${icon("mountain")} Profil</button>
          <button class="btn sm" id="r-gpx">${icon("download")} GPX</button>
          <button class="btn sm" id="r-save">${icon("save")} Shrani v risbe</button>
        </div>
      </div>` : ""}
      <div class="help" style="margin-top:14px">Usmerjanje: BRouter (OSM). Izračunane poti se shranijo in so na voljo tudi brez povezave. Desni klik na karto → »Pot do sem«.</div>`;

    el.onclick = async (e) => {
      const t = e.target.closest("button, [data-alt]");
      if (!t) return;
      const d = t.dataset;
      if (d.prof) { profile = d.prof; persist(); refreshPanel(); return compute(); }
      if (d.pick) return pick(+d.pick);
      if (d.rm) { wps.splice(+d.rm, 1); return changed(); }
      if (d.alt) { result.sel = +d.alt; drawRoute(); return refreshPanel(); }
      if (t.id === "r-add") { wps.splice(wps.length - 1, 0, { latlng: null, label: "" }); return refreshPanel(); }
      if (t.id === "r-swap") { wps.reverse(); return changed(); }
      if (t.id === "r-clear") { wps = [{ latlng: null, label: "" }, { latlng: null, label: "" }]; result = null; layer.clearLayers(); return changed(); }
      const s = result?.alts[result.sel];
      if (!s) return;
      const name = `${wps[0].label} → ${wps[wps.length - 1].label}`;
      if (t.id === "r-prof") showProfile(name, s.pts, ALT_COLORS[result.sel % 3]);
      if (t.id === "r-gpx") saveTextFile("pot.gpx", toGPX([{ type: "line", name, coords: s.pts }], name), "application/gpx+xml");
      if (t.id === "r-save") { addFeature({ type: "line", name, coords: s.pts, color: ALT_COLORS[result.sel % 3] }); toast("Pot shranjena med risbe", "ok"); }
    };

    // autocomplete
    $$("input[data-wp]", el).forEach((inp) => {
      const i = +inp.dataset.wp;
      const ac = inp.parentElement.querySelector(".ac");
      let found = [];
      const show = (list) => {
        found = list;
        ac.innerHTML = list.length ? list.map((r, k) => `<div class="dd-item" data-k="${k}"><span class="em">${r.emoji || "📍"}</span><div style="min-width:0"><div class="t ellipsis">${esc(r.title)}</div><div class="s">${esc(r.sub || "")}</div></div></div>`).join("") : `<div class="dd-empty">Ni zadetkov</div>`;
        ac.classList.remove("hidden");
      };
      const search = debounce(async (q) => {
        const local = localMatches(q, 4);
        show(local);
        try { show([...local, ...(await geocode(q, 6))]); } catch { /* offline */ }
      }, 400);
      inp.addEventListener("input", () => { if (inp.value.trim().length >= 2) search(inp.value.trim()); else ac.classList.add("hidden"); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && found[0]) choose(found[0]); if (e.key === "Escape") ac.classList.add("hidden"); });
      inp.addEventListener("blur", () => setTimeout(() => ac.classList.add("hidden"), 150));
      ac.addEventListener("mousedown", (e) => { const it = e.target.closest("[data-k]"); if (it) { e.preventDefault(); choose(found[+it.dataset.k]); } });
      function choose(r) { wps[i] = { latlng: [r.lat, r.lng], label: r.title }; ac.classList.add("hidden"); changed(); }
    });
  },
};
