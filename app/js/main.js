import { loadState, state, on, emit, saveSettings, SLOVENIA_BOUNDS } from "./runtime/state.js";
import { initMap, map, fitSlovenia } from "./map/map.js";
import { hydrateIcons, icon } from "./shared/icons.js";
import { $, $$, h, esc, fmtLatLng, fmtD96, toD96, copyText, toast, fmtNum } from "./shared/util.js";
import { initSearch } from "./explore/search.js";
import { initProfile } from "./explore/profile.js";
import { locationInfo } from "./explore/popup.js";
import { initFeatureInfo } from "./explore/featureinfo.js";
import { d96Cell } from "./explore/grid.js";
import { layersPanel } from "./map/layers.js";
import { poiPanel, restorePois, loadCaves } from "./explore/poi.js";
import { drawPanel, initDraw, startTool, stopTool, drawKeydown, getDrawings, isDrawing } from "./create/draw.js";
import { routePanel, initRoute } from "./explore/route.js";
import { tracksPanel, initTracks } from "./create/tracks.js";
import { comparePanel, initCompare } from "./map/compare.js";
import { offlinePanel, pollStatus, netStatus } from "./create/offline.js";
import { settingsPanel, applyTheme, applyScaleBar } from "./runtime/settings.js";
import { collabPanel, isCollabConnected } from "./create/collab.js";
import { aiPanel, initPlugins } from "./runtime/ai.js";
import { initFab, renderFab, normalizeUiPrefs } from "./shared/fab.js";
import { initLegend, toggleLegend, isLegendOpen } from "./map/legend.js";
import { initRotate, rotateBy, resetNorth, toggleCompassFollow, getBearing, isFollowingCompass, onBearing, screenToMap } from "./map/rotate.js";
import { toggleRecording, isRecording } from "./create/tracks.js";
import { toggleOverlay, isOverlayOn } from "./map/map.js";
import { cancelPick } from "./shared/tools.js";
import { api, IS_ANDROID } from "./services/api.js";
if (IS_ANDROID) document.documentElement.classList.add("android");

const PANELS = Object.fromEntries([layersPanel, poiPanel, routePanel, drawPanel, tracksPanel, comparePanel, offlinePanel, collabPanel, aiPanel, settingsPanel].map((p) => [p.id, p]));
let current = null;
const PAN_KEYS = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const ROT_KEYS = { KeyQ: -1, KeyE: 1 };   // turn the map anticlockwise / clockwise
// compass button: needle points to map north; shows the angle when rotated
function updateCompass() {
  const b = document.querySelector('.fab-col [data-fab="compass"]');
  if (!b) return;
  const svg = b.querySelector("svg");
  if (svg) svg.style.transform = `rotate(${getBearing()}deg)`;
  b.classList.toggle("on", isFollowingCompass());
  b.title = getBearing() ? `Zasukano ${Math.round(getBearing())}° — klik vrne sever` : "Kompas — klik: sledi kompasu naprave · Q / E ali dva prsta: zasukaj";
}
const panHeld = new Set();
let panRaf = 0, panFast = false;

function openPanel(id) {
  if (current === id) return renderPanel();
  const prev = PANELS[current];
  prev?.onClose?.();
  current = id;
  const p = PANELS[id];
  $("#panel").classList.remove("hidden");
  document.body.classList.toggle("panel-open", true);
  $("#panel").classList.toggle("layers-mode", id === "layers");      // original dark layer menu
  $("#panel").classList.toggle("settings-mode", id === "settings");
  $("#panel-title").innerHTML = id === "layers" ? `<span class="ph-icon">${icon("layers")}</span>${p.title}` : p.title;
  p.onOpen?.();
  renderPanel();
  $("#panel-body").scrollTop = 0;
  renderFab();
  setTimeout(() => map.invalidateSize({ pan: false }), 0);
}

function closePanel({ keepTools = false } = {}) {
  if (!current) return;
  if (!keepTools) PANELS[current].onClose?.();   // onClose cancels a panel's active tool
  current = null;
  $("#panel").classList.add("hidden");
  document.body.classList.toggle("panel-open", false);
  renderFab();
  setTimeout(() => map.invalidateSize({ pan: false }), 0);
}

function renderPanel() {
  if (!current) return;
  PANELS[current].render($("#panel-body"));
  hydrateIcons($("#panel-body"));
}

// counts on the column's buttons (layers, points, drawings); "any" = total, shown on the folded toggle
function badgeCount(id) {
  const c = { layers: state.settings.overlays.length, poi: state.settings.pois.length, draw: getDrawings().length };
  return id === "any" ? c.layers + c.poi + c.draw : c[id] || 0;
}
function updateBadges() { renderFab(); }

function updateNetBadge(st) {
  const b = $("#net-badge");
  const off = st.forcedOffline || !st.online;
  b.classList.toggle("off", off);
  b.innerHTML = `<span class="dot"></span>${st.forcedOffline ? "Brez povezave" : st.online ? "Na spletu" : "Ni povezave"}`;
  const j = st.job;
  $("#sb-job").textContent = j && !j.finished ? `⬇ ${j.name}: ${fmtNum(j.done + j.skipped + j.failed)} / ${fmtNum(j.total)}` : "";
}

// ── Context menu ──
function showContextMenu(e) {
  const ll = [e.latlng.lat, e.latlng.lng];
  const menu = $("#ctx-menu");
  const { e: E, n: N } = toD96(ll[0], ll[1]);
  menu.innerHTML = `
    <div class="hdr">${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}</div>
    <button data-c="info">${icon("info")} Kaj je tukaj?</button>
    <button data-c="from">${icon("route")} Pot od tukaj</button>
    <button data-c="to">${icon("pin")} Pot do sem</button>
    <hr>
    <button data-c="mark">${icon("marker")} Dodaj oznako</button>
    <button data-c="measure">${icon("ruler")} Meri od tukaj</button>
    ${isCollabConnected() ? `<button data-c="share">${icon("users")} Deli z ekipo</button>` : ""}
    <hr>
    <button data-c="cwgs">${icon("copy")} Kopiraj WGS84</button>
    <button data-c="cd96">${icon("copy")} Kopiraj D96/TM <span class="muted small">${Math.round(E)} ${Math.round(N)}</span></button>`;
  menu.classList.remove("hidden");
  const { clientX: x, clientY: y } = e.originalEvent;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 8) + "px";
  menu.style.top = Math.min(y, innerHeight - r.height - 8) + "px";
  menu.onclick = (ev) => {
    const c = ev.target.closest("[data-c]")?.dataset.c;
    if (!c) return;
    menu.classList.add("hidden");
    if (c === "info") locationInfo(ll);
    if (c === "from" || c === "to") emit("route-point", { which: c, latlng: ll });
    if (c === "mark") emit("add-marker", { latlng: ll });
    if (c === "measure") { startTool("measure-line"); map.fire("click", { latlng: L.latLng(ll), containerPoint: map.latLngToContainerPoint(ll) }); }
    if (c === "share") emit("collab-pin", ll);
    if (c === "cwgs") copyText(`${ll[0].toFixed(6)}, ${ll[1].toFixed(6)}`);
    if (c === "cd96") copyText(`${Math.round(E)} ${Math.round(N)}`);
  };
}

// ── Locate ──
let locLayer = null;
function locate() {
  if (!navigator.geolocation) return toast("Lokacija ni na voljo.", "err");
  $("#btn-locate").classList.add("on");
  navigator.geolocation.getCurrentPosition((p) => {
    const ll = [p.coords.latitude, p.coords.longitude];
    locLayer && map.removeLayer(locLayer);
    locLayer = L.layerGroup([
      L.circle(ll, { radius: p.coords.accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.1, pane: "vectors", interactive: false }),
      L.circleMarker(ll, { radius: 7, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1, pane: "top" }).bindTooltip("Moja lokacija"),
    ]).addTo(map);
    map.flyTo(ll, Math.max(map.getZoom(), 15));
  }, (err) => {
    $("#btn-locate").classList.remove("on");
    toast("Lokacije ni mogoče določiti (" + err.message + "). Preveri, ali je lokacija vklopljena in dovoljena.", "err", 5000);
  }, { enableHighAccuracy: true, timeout: 15000 });
}

function isTyping(e) {
  const t = e.target;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

async function boot() {
  await loadState();
  normalizeUiPrefs();
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  initMap($("#map"));
  initRotate();   // map rotation (compass button, Q / E, two-finger twist)
  applyScaleBar();
  hydrateIcons();
  initProfile();
  initCompare();
  initSearch();
  await Promise.all([initDraw(), initTracks()]);
  initRoute();
  restorePois();
  loadCaves(); // local cave cadastre for search (≈0.7 MB, loads in background)
  initPlugins();
  initFeatureInfo();   // podatki ob kliku na sloje GURS (npr. vodovod, kanalizacija)

  // ── floating map buttons (original-app style) ──
  const togglePanel = (id) => (current === id ? closePanel() : openPanel(id));
  initFab($("#map-wrap"), {
    actions: {
      settings: () => togglePanel("settings"),
      layers: () => togglePanel("layers"),
      legend: () => { toggleLegend(); renderFab(); },
      compass: () => { if (isFollowingCompass() || !getBearing()) toggleCompassFollow(); else resetNorth(); },
      zoomIn: () => map.zoomIn(1),
      zoomOut: () => map.zoomOut(1),
      search: () => { $("#search-input").focus(); $("#search-input").select(); },
      locate,
      gps: () => { toggleRecording(); renderFab(); },
      ruler: () => { if (current !== "draw") openPanel("draw"); startTool("measure-line"); },
      nav: () => togglePanel("route"),
      offline: () => togglePanel("offline"),
      ai: () => togglePanel("ai"),
      trackanalyzer: () => togglePanel("tracks"),
      lidar: () => { toggleOverlay("gurs_lidar"); renderFab(); toast(isOverlayOn("gurs_lidar") ? "LIDAR senčenje vklopljeno" : "LIDAR senčenje izklopljeno", "", 1500); },
      collab: () => togglePanel("collab"),
      poi: () => togglePanel("poi"),
      draw: () => togglePanel("draw"),
      compare: () => togglePanel("compare"),
      home: fitSlovenia,
    },
    isActive: (id) => ({
      settings: current === "settings", layers: current === "layers", nav: current === "route", offline: current === "offline",
      ai: current === "ai", trackanalyzer: current === "tracks", collab: current === "collab" || isCollabConnected(),
      poi: current === "poi", draw: current === "draw", compare: current === "compare",
      gps: isRecording(), lidar: isOverlayOn("gurs_lidar"), legend: isLegendOpen(), compass: isFollowingCompass(),
    })[id] || false,
    badge: badgeCount,
    afterRender: updateCompass,
    onMoved: saveSettings,      // column dragged to a new spot
  });
  on("gps-tracking", renderFab);
  on("collab", renderFab);
  initLegend($("#map-wrap"));
  onBearing(updateCompass);   // "Legenda" box: what colours / symbols of the visible layers mean

  // panel
  $("#panel-close").onclick = closePanel;
  $("#theme-btn").onclick = () => {
    state.settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    saveSettings(); applyTheme();
    if (current === "settings") renderPanel();
  };
  $("#net-badge").onclick = async () => {
    const st = await api("/api/network", { method: "POST", body: { forcedOffline: !netStatus.forcedOffline } });
    Object.assign(netStatus, st);
    updateNetBadge(netStatus);
    toast(st.forcedOffline ? "Način brez povezave: prikazujem samo shranjene podatke." : "Povezava vklopljena.", "", 3000);
    if (current === "offline") renderPanel();
  };
  $("#btn-locate").onclick = locate;
  $("#btn-home").onclick = fitSlovenia;

  on("layers-changed", () => { updateBadges(); renderFab(); if (current === "layers") renderPanel(); });
  on("poi-changed", updateBadges);
  on("drawings-changed", updateBadges);
  on("open-panel", (id) => openPanel(id));
  on("net-status", updateNetBadge);
  on("icons", () => hydrateIcons());
  updateBadges();

  // status bar: cursor coords
  const sbC = $("#sb-coords"), sbD = $("#sb-d96"), sbZ = $("#sb-zoom");
  let raf = 0;
  map.on("mousemove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      sbC.textContent = fmtLatLng(e.latlng.lat, e.latlng.lng, state.settings.coordFormat);
      sbD.textContent = "D96/TM " + fmtD96(e.latlng.lat, e.latlng.lng)
        + (isOverlayOn("grid_d96_1km") ? `  ·  celica ${d96Cell(e.latlng.lat, e.latlng.lng).id}` : "");
    });
  });
  const zoomText = () => { sbZ.textContent = `Povečava ${map.getZoom()}`; };
  map.on("zoomend", zoomText); zoomText();
  // "visible from zoom N" hints in the layer panel depend on the current zoom
  map.on("zoomend", () => { if (current === "layers" && state.settings.overlays.some((o) => state.layerIndex[o.id]?.minZoom)) renderPanel(); });

  // layer health (which sources work) — checked by the backend in the background
  let waitPolls = 0;   // no result yet (first start / web version): keep asking for up to ~3 min
  const pollHealth = async () => {
    try {
      const h = await api("/api/health");
      const changed = JSON.stringify(h.results || {}) !== JSON.stringify(state.health) || h.running !== state.healthRunning;
      state.health = h.results || {};
      state.healthRunning = h.running;
      if (changed && (current === "layers" || current === "compare")) renderPanel();   // don't disturb typing in the filter
      if (h.running || (!h.checked && waitPolls++ < 60)) setTimeout(pollHealth, 3000);
    } catch { /* ignore */ }
  };
  on("health-run", async () => { await api("/api/health/run", { method: "POST", body: {} }); state.healthRunning = true; renderPanel(); setTimeout(pollHealth, 1500); });
  pollHealth();
  setTimeout(pollHealth, 23000); // backend re-checks sources ~20 s after start

  map.on("contextmenu", showContextMenu);
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#ctx-menu")) $("#ctx-menu").classList.add("hidden"); });
  map.on("movestart", () => $("#ctx-menu").classList.add("hidden"));

  // keyboard
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "f")) { e.preventDefault(); $("#search-input").focus(); $("#search-input").select(); return; }
    if (isTyping(e)) return;
    if (drawKeydown(e)) { e.preventDefault(); return; }
    if (e.key === "Escape") {
      if (!$("#ctx-menu").classList.contains("hidden")) return $("#ctx-menu").classList.add("hidden");
      if (map._popup?.isOpen()) return map.closePopup();
      return closePanel();
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // W/A/S/D (physical keys, so QWERTZ/QWERTY both work): pan the map while held; never touches tools or drawings
    if (ROT_KEYS[e.code] || PAN_KEYS[e.code]) {
      e.preventDefault();
      panFast = e.shiftKey;
      if (!e.repeat && !panHeld.has(e.code)) {   // a short tap still does a clear step; holding keeps going smoothly
        if (ROT_KEYS[e.code]) rotateBy(ROT_KEYS[e.code] * (e.shiftKey ? 15 : 5));
        else { const [x, y] = PAN_KEYS[e.code]; map.panBy(screenToMap(x * 60, y * 60), { animate: false }); }
      }
      panHeld.add(e.code);
      panRaf ||= requestAnimationFrame(panLoop);
      return;
    }
    const k = e.key.toLowerCase();
    // panels that would cancel a drawing in progress don't toggle while drawing (use Esc / Enter first)
    const map2 = { l: "layers", p: "poi", n: "route", r: "draw", t: "tracks", c: "compare", o: "offline" };
    if (map2[k]) {
      if (isDrawing() && current === "draw") return toast("Najprej končaj risanje (Enter) ali ga prekliči (Esc).", "", 2200);
      current === map2[k] ? closePanel({ keepTools: isDrawing() }) : openPanel(map2[k]);
      return;
    }
    if (k === "m" && !isDrawing()) { openPanel("draw"); startTool(e.shiftKey ? "measure-area" : "measure-line"); }
  });
  document.addEventListener("keyup", (e) => { panHeld.delete(e.code); panFast = e.shiftKey; });
  window.addEventListener("blur", () => panHeld.clear());

  // smooth keyboard panning (W/A/S/D)
  function panLoop() {
    panRaf = 0;
    if (!panHeld.size) return;
    let dx = 0, dy = 0, rot = 0;
    for (const c of panHeld) { if (PAN_KEYS[c]) { dx += PAN_KEYS[c][0]; dy += PAN_KEYS[c][1]; } else rot += ROT_KEYS[c] || 0; }
    const sp = panFast ? 26 : 11;
    if (rot) rotateBy(rot * (panFast ? 4 : 1.5));
    if (dx || dy) map.panBy(screenToMap(dx * sp, dy * sp), { animate: false });   // "up" = up on screen, also when rotated
    panRaf = requestAnimationFrame(panLoop);
  }

  // network status polling
  let cacheNoteShown = "";
  const showCacheNote = () => {
    if (netStatus.cacheNote && netStatus.cacheNote !== cacheNoteShown) { cacheNoteShown = netStatus.cacheNote; toast(netStatus.cacheNote, "", 7000); }
  };
  on("net-status", showCacheNote);
  pollStatus().then(() => { updateNetBadge(netStatus); showCacheNote(); });
  setInterval(() => pollStatus(), 15000);
  window.addEventListener("online", () => pollStatus());
  window.addEventListener("offline", () => pollStatus());

  // phones: an interactive map tool needs the map visible → slide the panel away
  const isPhone = () => matchMedia("(max-width: 700px)").matches;
  on("tool-start", () => { if (isPhone()) closePanel({ keepTools: true }); });

  // Android back button: close the top-most thing; return false to let the app go to background
  window.fmBack = () => {
    if (!$("#ctx-menu").classList.contains("hidden")) { $("#ctx-menu").classList.add("hidden"); return true; }
    if (!$("#search-results").classList.contains("hidden")) { $("#search-results").classList.add("hidden"); $("#search-input").blur(); return true; }
    if (drawKeydown({ key: "Escape" })) return true;
    if (document.querySelector("#tool-hint:not(.hidden)")) { cancelPick(); return true; }
    if (map._popup?.isOpen()) { map.closePopup(); return true; }
    if (!$("#profile").classList.contains("hidden")) { $("#profile-close").click(); return true; }
    if (current) { closePanel(); return true; }
    return false;
  };

  document.body.classList.add("ready");
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML("beforeend", `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#0f172a;color:#fff;font:14px Segoe UI;z-index:9999"><div><h2>Napaka ob zagonu</h2><pre>${esc(e.stack || e.message)}</pre></div></div>`);
});
