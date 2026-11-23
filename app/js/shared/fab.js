// Floating map buttons (right column) — the app's only menu (the old left bar was merged into it):
// grip + fold toggle on top, settings gear, then the user's buttons in their chosen order,
// each can be hidden, all scaled by "Velikost gumbov".
import { state } from "../runtime/state.js";
import { icon } from "./icons.js";
import { esc } from "./util.js";

export const FAB_BUTTONS = [
  { id: "layers", label: "Sloji", icon: "layers" },
  { id: "legend", label: "Legenda", icon: "legend" },
  { id: "zoom", label: "Zoom", icon: "plus" },
  { id: "compass", label: "Kompas", icon: "compass" },
  { id: "search", label: "Iskanje", icon: "search" },
  { id: "locate", label: "Moja lokacija", icon: "locate" },
  { id: "gps", label: "GPS sled", icon: "navigation" },
  { id: "ruler", label: "Merilo", icon: "ruler" },
  { id: "nav", label: "Navigacija", icon: "route" },
  { id: "offline", label: "Offline karte", icon: "wifiOff" },
  { id: "ai", label: "AI Asistent", icon: "brain" },
  { id: "trackanalyzer", label: "Sledi GPX", icon: "footprints" },
  { id: "lidar", label: "LIDAR Terrain", icon: "mountain" },
  { id: "collab", label: "Skupno delo", icon: "users" },
  { id: "traffic", label: "Promet v živo", icon: "traffic" },
  // 3D pogled removed; AR pogled disabled (code kept in tools/disabled/ar.js)
  { id: "poi", label: "Točke zanimanja", icon: "pin" },
  { id: "draw", label: "Risanje", icon: "pencil" },
  { id: "compare", label: "Primerjava slojev", icon: "columns" },
  { id: "home", label: "Celotna Slovenija", icon: "home" },
];
const DEFAULT_HIDDEN = ["search", "home"];
// buttons that used to live in the left bar — shown again once when the bar was merged in
const FROM_RAIL = ["layers", "poi", "nav", "draw", "trackanalyzer", "compare", "offline", "collab", "ai"];

// Make sure every known button is in the saved order (new buttons appear at the end, visible
// unless they're one of the default-hidden extras).
export function normalizeUiPrefs() {
  const ui = state.settings.ui;
  const ids = FAB_BUTTONS.map((b) => b.id);
  if (!ui.order?.length) { ui.order = [...ids]; ui.hidden = [...DEFAULT_HIDDEN]; ui.railMerged = true; return; }
  ui.order = ui.order.filter((id) => ids.includes(id));
  // a new button goes right after its predecessor in FAB_BUTTONS (e.g. compass next to zoom), not at the very end
  ids.forEach((id, i) => {
    if (ui.order.includes(id)) return;
    const prev = ids.slice(0, i).reverse().find((x) => ui.order.includes(x));
    ui.order.splice(prev ? ui.order.indexOf(prev) + 1 : ui.order.length, 0, id);
    if (DEFAULT_HIDDEN.includes(id)) ui.hidden.push(id);
  });
  if (!ui.railMerged) {   // 1.5.2: the left bar is gone → its panels must be reachable from the column
    ui.hidden = ui.hidden.filter((id) => !FROM_RAIL.includes(id));
    ui.railMerged = true;
  }
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
    if (e.target.closest("[data-fold]")) return toggleFold();
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

// Fold the column down to its toggle button (and back); remembered between launches
export function toggleFold(force) {
  const ui = state.settings.ui;
  ui.fabFolded = force ?? !ui.fabFolded;
  opts?.onMoved?.();
  renderFab();
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
  const folded = !!ui.fabFolded;
  el.classList.toggle("folded", folded);
  const total = folded ? opts.badge?.("any") : 0;
  const foldLabel = folded ? "Pokaži meni" : "Skrij meni";
  const parts = [
    `<div class="fab-grip" data-grip title="Povleci za premik gumbov · dvoklik vrne na privzeto mesto" aria-label="Premakni gumbe">${icon("grip")}</div>`,
    `<button class="fab fab-fold" data-fold title="${foldLabel}" aria-label="${foldLabel}" aria-expanded="${!folded}">${icon(folded ? "menu" : "chevronUp")}${total ? `<span class="fab-badge">${total}</span>` : ""}</button>`,
  ];
  if (folded) { el.innerHTML = parts.join(""); placeFab(); return; }
  parts.push(btn("settings", "settings", "Nastavitve"));
  for (const id of ui.order) {
    if (ui.hidden.includes(id)) continue;
    const b = FAB_BUTTONS.find((x) => x.id === id);
    if (!b) continue;
    if (id === "zoom") {
      parts.push(`<div class="fab-zoom"><button class="fab" data-fab="zoomIn" title="Povečaj" aria-label="Povečaj">${icon("plus")}</button><button class="fab" data-fab="zoomOut" title="Pomanjšaj" aria-label="Pomanjšaj">${icon("minus")}</button></div>`);
    } else parts.push(btn(id, b.icon, b.label));
  }
  el.innerHTML = parts.join("");
  opts.afterRender?.(el);
  placeFab();
}
