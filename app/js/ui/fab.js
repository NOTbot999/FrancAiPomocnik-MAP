// Floating map buttons (right column) — same idea as the original app's mobile toolbar:
// settings gear always on top, then the user's buttons in their chosen order, each can be hidden,
// all scaled by "Velikost gumbov".
import { state } from "../state.js";
import { icon } from "../icons.js";
import { esc } from "../util.js";

export const FAB_BUTTONS = [
  { id: "layers", label: "Sloji", icon: "layers" },
  { id: "zoom", label: "Zoom", icon: "plus" },
  { id: "search", label: "Iskanje", icon: "search" },
  { id: "locate", label: "Moja lokacija", icon: "locate" },
  { id: "gps", label: "GPS sled", icon: "navigation" },
  { id: "ruler", label: "Merilo", icon: "ruler" },
  { id: "nav", label: "Navigacija", icon: "route" },
  { id: "offline", label: "Offline karte", icon: "wifiOff" },
  { id: "ai", label: "AI Asistent", icon: "brain" },
  { id: "trackanalyzer", label: "Analiza sledi", icon: "trending" },
  { id: "lidar", label: "LIDAR Terrain", icon: "mountain" },
  { id: "collab", label: "Skupno delo", icon: "users" },
  // 3D pogled removed; AR pogled disabled (code kept in tools/disabled/ar.js)
  { id: "poi", label: "Točke zanimanja", icon: "pin" },
  { id: "draw", label: "Risanje", icon: "pencil" },
  { id: "compare", label: "Primerjava slojev", icon: "columns" },
  { id: "home", label: "Celotna Slovenija", icon: "home" },
];
const DEFAULT_HIDDEN = ["search", "trackanalyzer", "poi", "draw", "compare", "home"];

// Make sure every known button is in the saved order (new buttons appear at the end, visible
// unless they're one of the default-hidden extras).
export function normalizeUiPrefs() {
  const ui = state.settings.ui;
  const ids = FAB_BUTTONS.map((b) => b.id);
  if (!ui.order?.length) { ui.order = [...ids]; ui.hidden = [...DEFAULT_HIDDEN]; return; }
  ui.order = ui.order.filter((id) => ids.includes(id));
  for (const id of ids) if (!ui.order.includes(id)) { ui.order.push(id); if (DEFAULT_HIDDEN.includes(id)) ui.hidden.push(id); }
}

let el, opts, wrap;

/** opts: { actions: { id: fn }, isActive: (id) => bool, badge: (id) => number, onMoved: () => void } */
export function initFab(container, options) {
  opts = options;
  wrap = container;
  el = document.createElement("div");
  el.className = "fab-col";
  container.appendChild(el);
  L.DomEvent.disableClickPropagation(el);
  L.DomEvent.disableScrollPropagation(el);
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fab]");
    if (b) opts.actions[b.dataset.fab]?.();
  });
  installDrag();
  new ResizeObserver(() => placeFab()).observe(container);
  renderFab();
}

// ── Draggable column: drag the grip anywhere on the map; double-click/tap the grip to reset ──
// Position is saved as fractions of the map area (so it survives resizes and rotation).
function installDrag() {
  let drag = null, lastTap = 0;
  el.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-grip]")) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap < 350) { resetFabPos(); lastTap = 0; return; }   // double tap / double click
    lastTap = now;
    const r = el.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    try { e.target.closest("[data-grip]").setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    el.classList.add("dragging");
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const w = wrap.getBoundingClientRect();
    const x = e.clientX - w.left - drag.dx, y = e.clientY - w.top - drag.dy;
    drag.moved = true;
    setPos(x, y);
  });
  const end = () => {
    if (!drag) return;
    el.classList.remove("dragging");
    if (drag.moved) {
      const w = wrap.getBoundingClientRect(), r = el.getBoundingClientRect();
      state.settings.ui.fabPos = { x: (r.left - w.left) / Math.max(1, w.width - r.width), y: (r.top - w.top) / Math.max(1, w.height) };
      opts.onMoved?.();
    }
    drag = null;
    placeFab();
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function setPos(x, y) {
  const w = wrap.getBoundingClientRect();
  const maxX = Math.max(0, w.width - el.offsetWidth - 4);
  const maxY = Math.max(0, w.height - 60);
  el.style.left = `${Math.round(Math.min(Math.max(4, x), maxX))}px`;
  el.style.top = `${Math.round(Math.min(Math.max(4, y), maxY))}px`;
  el.style.right = "auto";
}

// Apply the saved position and keep the column inside the visible map area
export function placeFab() {
  if (!el || !wrap) return;
  if (el.classList.contains("dragging")) return;
  const p = state.settings.ui.fabPos;
  const w = wrap.getBoundingClientRect();
  if (p) setPos(p.x * Math.max(1, w.width - el.offsetWidth), p.y * w.height);
  else { el.style.left = ""; el.style.top = ""; el.style.right = ""; }
  // available height below the column's top (minus an open bottom sheet on phones)
  const top = el.offsetTop;
  const sheet = document.body.classList.contains("panel-open") && matchMedia("(max-width: 700px)").matches
    ? (document.getElementById("panel")?.offsetHeight || 0) : 0;
  el.style.maxHeight = `${Math.max(120, w.height - top - sheet - 12)}px`;
}

export function resetFabPos() {
  delete state.settings.ui.fabPos;
  opts?.onMoved?.();
  placeFab();
}

export function renderFab() {
  if (!el) return;
  const ui = state.settings.ui;
  const s = Math.max(0.5, Math.min(3, ui.buttonScale || 1));
  el.style.setProperty("--fab-size", `${Math.round(Math.max(40, 42 * s))}px`);
  el.style.setProperty("--fab-icon", `${Math.round(20 * s)}px`);
  el.style.setProperty("--fab-gap", `${Math.round(8 * Math.min(s, 1.5))}px`);
  const btn = (id, ic, label) => {
    const n = opts.badge?.(id);
    return `<button class="fab ${opts.isActive?.(id) ? "on" : ""}" data-fab="${id}" title="${esc(label)}" aria-label="${esc(label)}">${icon(ic)}${n ? `<span class="fab-badge">${n}</span>` : ""}</button>`;
  };
  const parts = [
    `<div class="fab-grip" data-grip title="Povleci za premik gumbov · dvoklik vrne na privzeto mesto" aria-label="Premakni gumbe">${icon("grip")}</div>`,
    btn("settings", "settings", "Nastavitve karte"),
  ];
  for (const id of ui.order) {
    if (ui.hidden.includes(id)) continue;
    const b = FAB_BUTTONS.find((x) => x.id === id);
    if (!b) continue;
    if (id === "zoom") {
      parts.push(`<div class="fab-zoom"><button class="fab" data-fab="zoomIn" title="Povečaj" aria-label="Povečaj">${icon("plus")}</button><button class="fab" data-fab="zoomOut" title="Pomanjšaj" aria-label="Pomanjšaj">${icon("minus")}</button></div>`);
    } else parts.push(btn(id, b.icon, b.label));
  }
  el.innerHTML = parts.join("");
  placeFab();
}
