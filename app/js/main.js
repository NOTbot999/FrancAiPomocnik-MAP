import { loadState, state, on, emit, saveSettings, SLOVENIA_BOUNDS } from "./state.js";
import { initMap, map, fitSlovenia } from "./map.js";
import { hydrateIcons, icon } from "./icons.js";
import { $, $$, h, esc, fmtLatLng, fmtD96, toD96, copyText, toast, fmtNum } from "./util.js";
import { initSearch } from "./search.js";
import { initProfile } from "./profile.js";
import { locationInfo } from "./popup.js";
import { layersPanel } from "./panels/layers.js";
import { poiPanel, restorePois, loadCaves } from "./panels/poi.js";
import { drawPanel, initDraw, startTool, stopTool, drawKeydown, getDrawings } from "./panels/draw.js";
import { routePanel, initRoute } from "./panels/route.js";
import { tracksPanel, initTracks } from "./panels/tracks.js";
import { comparePanel, initCompare } from "./panels/compare.js";
import { offlinePanel, pollStatus, netStatus } from "./panels/offline.js";
import { settingsPanel, applyTheme, applyScaleBar } from "./panels/settings.js";
import { collabPanel, isCollabConnected } from "./panels/collab.js";
import { aiPanel, initPlugins } from "./panels/ai.js";
import { initFab, renderFab, normalizeUiPrefs } from "./ui/fab.js";
import { toggleRecording, isRecording } from "./panels/tracks.js";
import { toggleOverlay, isOverlayOn } from "./map.js";
import { cancelPick } from "./tools.js";
import { api, IS_ANDROID } from "./api.js";
if (IS_ANDROID) document.documentElement.classList.add("android");

const PANELS = Object.fromEntries([layersPanel, poiPanel, routePanel, drawPanel, tracksPanel, comparePanel, offlinePanel, collabPanel, aiPanel, settingsPanel].map((p) => [p.id, p]));
let current = null;

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
  $$("#rail button").forEach((b) => b.classList.toggle("active", b.dataset.panel === id));
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
  $$("#rail button").forEach((b) => b.classList.remove("active"));
  renderFab();
  setTimeout(() => map.invalidateSize({ pan: false }), 0);
}

function renderPanel() {
  if (!current) return;
  PANELS[current].render($("#panel-body"));
  hydrateIcons($("#panel-body"));
}

function updateBadges() {
  const counts = { layers: state.settings.overlays.length, poi: state.settings.pois.length, draw: getDrawings().length };
  $$("#rail button").forEach((b) => {
    b.querySelector(".count")?.remove();
    const n = counts[b.dataset.panel];
    if (n) b.insertAdjacentHTML("beforeend", `<span class="count">${n}</span>`);
  });
}

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

  // ── floating map buttons (original-app style) ──
  const togglePanel = (id) => (current === id ? closePanel() : openPanel(id));
  initFab($("#map-wrap"), {
    actions: {
      settings: () => togglePanel("settings"),
      layers: () => togglePanel("layers"),
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
      gps: isRecording(), lidar: isOverlayOn("gurs_lidar"),
    })[id] || false,
    badge: (id) => (id === "layers" ? state.settings.overlays.length : 0),
    onMoved: saveSettings,      // column dragged to a new spot
  });
  on("gps-tracking", renderFab);
  on("collab", renderFab);

  // rail / panel
  $("#rail").addEventListener("click", (e) => {
    const b = e.target.closest("[data-panel]");
    if (!b) return;
    current === b.dataset.panel ? closePanel() : openPanel(b.dataset.panel);
  });
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
      sbD.textContent = "D96/TM " + fmtD96(e.latlng.lat, e.latlng.lng);
    });
  });
  const zoomText = () => { sbZ.textContent = `Povečava ${map.getZoom()}`; };
  map.on("zoomend", zoomText); zoomText();
  // "visible from zoom N" hints in the layer panel depend on the current zoom
  map.on("zoomend", () => { if (current === "layers" && state.settings.overlays.some((o) => state.layerIndex[o.id]?.minZoom)) renderPanel(); });

  // layer health (which sources work) — checked by the backend in the background
  const pollHealth = async () => {
    try {
      const h = await api("/api/health");
      state.health = h.results || {};
      state.healthRunning = h.running;
      if (current === "layers" || current === "compare") renderPanel();
      if (h.running) setTimeout(pollHealth, 3000);
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
    const k = e.key.toLowerCase();
    const map2 = { l: "layers", p: "poi", n: "route", d: "draw", t: "tracks", c: "compare", o: "offline" };
    if (map2[k]) { current === map2[k] ? closePanel() : openPanel(map2[k]); return; }
    if (k === "m") { openPanel("draw"); startTool("measure-line"); }
    if (k === "a") { openPanel("draw"); startTool("measure-area"); }
  });

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
