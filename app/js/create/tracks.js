import { map } from "../map/map.js";
import { store } from "../services/api.js";
import { emit } from "../runtime/state.js";
import { esc, uid, haversine, fmtDist, fmtDur, toast, openTextFiles, saveTextFile, COLORS } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { parseFile, toGPX } from "./geoio.js";
import { showProfile, elevationStats } from "../explore/profile.js";

let tracks = [];
let group;
const layerOf = new Map();
let panelEl;
let selected = null;
let rec = null; // { watchId, track }

export async function initTracks() {
  group = L.featureGroup().addTo(map);
  tracks = await store.get("tracks", []);
  tracks.forEach(drawTrack);
}
const persist = () => store.set("tracks", tracks, 800);

export function trackStats(pts) {
  let dist = 0, moving = 0, maxSpd = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1], pts[i]);
    dist += d;
    const t0 = pts[i - 1][3], t1 = pts[i][3];
    if (t0 && t1 && t1 > t0) {
      const dt = (t1 - t0) / 1000, v = d / dt * 3.6;
      if (v > 1 && v < 250) { moving += dt; maxSpd = Math.max(maxSpd, v); }
    }
  }
  const el = elevationStats(pts);
  const t0 = pts.find((p) => p[3])?.[3], t1 = [...pts].reverse().find((p) => p[3])?.[3];
  const total = t0 && t1 ? (t1 - t0) / 1000 : null;
  return { dist, total, moving: moving || null, avg: moving ? dist / moving * 3.6 : null, maxSpd: maxSpd || null, ...el, date: t0 ? new Date(t0).toLocaleDateString("sl-SI") : null, hasEle: pts.some((p) => p[2] != null) };
}

function drawTrack(t) {
  layerOf.get(t.id) && group.removeLayer(layerOf.get(t.id));
  if (t.visible === false) { layerOf.delete(t.id); return; }
  const ll = t.coords.map((p) => [p[0], p[1]]);
  const g = L.featureGroup([
    L.polyline(ll, { color: "#fff", weight: selected === t.id ? 9 : 7, opacity: 0.8, pane: "vectors", interactive: false }),
    L.polyline(ll, { color: t.color, weight: selected === t.id ? 5.5 : 4, pane: "vectors" }),
    L.circleMarker(ll[0], { radius: 5, color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1, pane: "top", interactive: false }),
    L.circleMarker(ll[ll.length - 1], { radius: 5, color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1, pane: "top", interactive: false }),
  ]);
  g.bindTooltip(`<b>${esc(t.name)}</b><br>${fmtDist(trackStats(t.coords).dist)}`, { sticky: true });
  g.on("click", () => { select(t.id); emit("open-panel", "tracks"); });
  group.addLayer(g);
  layerOf.set(t.id, g);
}

function select(id, zoom = false) {
  const prev = selected;
  selected = id;
  [prev, id].forEach((x) => { const t = tracks.find((y) => y.id === x); if (t) drawTrack(t); });
  const t = tracks.find((x) => x.id === id);
  if (t && zoom) map.flyToBounds(L.latLngBounds(t.coords.map((p) => [p[0], p[1]])), { padding: [60, 60], duration: 0.7 });
  refresh();
}

export function addTracks(list) {
  for (const t of list) {
    const nt = { id: uid("t"), name: t.name, color: t.color || COLORS[(tracks.length + 1) % COLORS.length], coords: t.coords, visible: true, added: Date.now() };
    tracks.unshift(nt);
    drawTrack(nt);
  }
  persist();
  refresh();
}

async function importFiles() {
  const files = await openTextFiles(".gpx,.kml,.geojson,.json");
  const lines = [];
  for (const f of files || []) {
    try {
      const feats = parseFile(f.name, f.content).filter((x) => x.type === "line");
      feats.forEach((x) => { if (!x.name || x.name === "Sled") x.name = f.name.replace(/\.\w+$/, ""); });
      lines.push(...feats);
    } catch (e) { toast(`${f.name}: ${e.message}`, "err"); }
  }
  if (!lines.length) return files?.length && toast("V datotekah ni sledi.");
  addTracks(lines);
  select(tracks[0].id, true);
  toast(`Uvoženih sledi: ${lines.length}`, "ok");
}

// GPS recording (works when Windows location services are available)
export const getTracks = () => tracks;
export const isRecording = () => !!rec;

export function toggleRecording() {
  if (rec) {
    navigator.geolocation.clearWatch(rec.watchId);
    if (rec.coords.length > 1) addTracks([{ name: `Posnetek ${new Date().toLocaleString("sl-SI")}`, coords: rec.coords }]);
    else toast("Sled je prekratka in ni shranjena.");
    rec.line && map.removeLayer(rec.line);
    rec.dot && map.removeLayer(rec.dot);
    rec = null;
    emit("gps-tracking", false);
    return refresh();
  }
  if (!navigator.geolocation) return toast("Lokacija ni na voljo.", "err");
  rec = { coords: [], line: L.polyline([], { color: "#e11d48", weight: 4, pane: "vectors" }).addTo(map) };
  rec.watchId = navigator.geolocation.watchPosition((p) => {
    const pt = [p.coords.latitude, p.coords.longitude, p.coords.altitude, Date.now()];
    const last = rec.coords[rec.coords.length - 1];
    // live position dot; the map follows you while tracking
    rec.dot ||= L.circleMarker([pt[0], pt[1]], { radius: 8, color: "#fff", weight: 3, fillColor: "#e11d48", fillOpacity: 1, pane: "top" }).bindTooltip("GPS sled — snemam").addTo(map);
    rec.dot.setLatLng([pt[0], pt[1]]);
    if (!rec.followed || map.getBounds().pad(-0.25).contains([pt[0], pt[1]]) === false) { map.panTo([pt[0], pt[1]]); rec.followed = true; }
    if (!last || haversine(last, pt) > 3) { rec.coords.push(pt); rec.line.addLatLng([pt[0], pt[1]]); refresh(); }
  }, (err) => { toast("Lokacija ni na voljo: " + err.message, "err"); }, { enableHighAccuracy: true, maximumAge: 2000 });
  emit("gps-tracking", true);
  toast("GPS sled: snemam pot — ponovni pritisk konča in shrani.", "ok", 3500);
  refresh();
}

function refresh() { if (panelEl?.isConnected) tracksPanel.render(panelEl); }

export const tracksPanel = {
  id: "tracks",
  title: "Sledi",
  render(el) {
    panelEl = el;
    const sel = tracks.find((t) => t.id === selected);
    let detail = "";
    if (sel) {
      const s = trackStats(sel.coords);
      detail = `<div class="card" style="margin-top:10px">
        <div class="row" style="margin-bottom:8px"><input type="color" value="${sel.color}" id="t-color"><input class="field grow" id="t-name" value="${esc(sel.name)}"></div>
        <div class="stat-grid">
          <div class="stat"><span>Razdalja</span><b>${fmtDist(s.dist)}</b></div>
          <div class="stat"><span>Vzpon</span><b>${s.hasEle ? Math.round(s.up) + " m" : "—"}</b></div>
          <div class="stat"><span>Spust</span><b>${s.hasEle ? Math.round(s.down) + " m" : "—"}</b></div>
          <div class="stat"><span>Skupni čas</span><b>${s.total ? fmtDur(s.total) : "—"}</b></div>
          <div class="stat"><span>V gibanju</span><b>${s.moving ? fmtDur(s.moving) : "—"}</b></div>
          <div class="stat"><span>Povpr. hitrost</span><b>${s.avg ? s.avg.toFixed(1) + " km/h" : "—"}</b></div>
          <div class="stat"><span>Najv. višina</span><b>${s.max != null ? Math.round(s.max) + " m" : "—"}</b></div>
          <div class="stat"><span>Najn. višina</span><b>${s.min != null ? Math.round(s.min) + " m" : "—"}</b></div>
          <div class="stat"><span>Točk</span><b>${sel.coords.length}</b></div>
        </div>
        ${s.date ? `<div class="small muted" style="margin-top:6px">Posneto ${s.date}</div>` : ""}
        <div class="row wrap" style="margin-top:10px">
          <button class="btn sm" data-a="profile">${icon("mountain")} Profil</button>
          <button class="btn sm" data-a="zoom">${icon("zoom")} Približaj</button>
          <button class="btn sm" data-a="gpx">${icon("download")} GPX</button>
          <button class="btn sm danger" data-a="del">${icon("trash")} Izbriši</button>
        </div></div>`;
    }
    el.innerHTML = `
      <div class="section row">
        <button class="btn primary grow" id="t-import">${icon("upload")} Uvozi GPX / KML / GeoJSON</button>
        <button class="btn ${rec ? "danger" : ""}" id="t-rec" title="Snemaj sled z lokacijo naprave">${rec ? `⏹ ${rec.coords.length}` : "⏺ Snemaj"}</button>
      </div>
      ${detail}
      <div class="section">
        <div class="section-title">Moje sledi (${tracks.length})</div>
        ${tracks.map((t) => `
          <div class="list-item ${t.id === selected ? "sel" : ""}">
            <span class="swatch" style="background:${t.color}"></span>
            <div class="grow" style="min-width:0;cursor:pointer" data-sel="${t.id}">
              <div class="ellipsis" style="font-weight:600">${esc(t.name)}</div>
              <div class="small muted">${fmtDist(trackStats(t.coords).dist)}</div>
            </div>
            <button class="icon-btn sm ${t.visible === false ? "" : "on"}" data-vis="${t.id}" title="Pokaži / skrij">${icon(t.visible === false ? "eyeOff" : "eye")}</button>
          </div>`).join("") || `<div class="empty"><div class="big">🥾</div>Uvozi sledi iz ure, telefona ali Strave (GPX).</div>`}
      </div>`;

    el.onclick = (e) => {
      const t = e.target.closest("button, [data-sel]");
      if (!t) return;
      if (t.id === "t-import") return importFiles();
      if (t.id === "t-rec") return toggleRecording();
      if (t.dataset.sel) return select(t.dataset.sel, true);
      if (t.dataset.vis) {
        const tr = tracks.find((x) => x.id === t.dataset.vis);
        tr.visible = tr.visible === false; drawTrack(tr); persist(); return refresh();
      }
      const a = t.dataset.a;
      if (!a || !sel) return;
      if (a === "profile") showProfile(sel.name, sel.coords, sel.color);
      if (a === "zoom") select(sel.id, true);
      if (a === "gpx") saveTextFile(`${sel.name.replace(/[\\/:*?"<>|]/g, "_")}.gpx`, toGPX([{ type: "line", name: sel.name, coords: sel.coords }], sel.name), "application/gpx+xml");
      if (a === "del" && confirm(`Izbrišem sled »${sel.name}«?`)) {
        tracks = tracks.filter((x) => x.id !== sel.id);
        layerOf.get(sel.id) && group.removeLayer(layerOf.get(sel.id));
        selected = null; persist(); refresh();
      }
    };
    el.onchange = (e) => {
      if (!sel) return;
      if (e.target.id === "t-name") { sel.name = e.target.value; persist(); drawTrack(sel); refresh(); }
      if (e.target.id === "t-color") { sel.color = e.target.value; persist(); drawTrack(sel); refresh(); }
    };
  },
};
