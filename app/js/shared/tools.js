// Shared interactive-tool helpers: hint bubble, on-map action buttons, one-shot point picking
import { map } from "../map/map.js";
import { emit } from "../runtime/state.js";
import { $, esc } from "./util.js";

let pickCleanup = null;

export function setHint(html) {
  const el = $("#tool-hint");
  if (!html) { el.classList.add("hidden"); return; }
  if (matchMedia("(max-width: 700px)").matches) {
    // phones: keyboard shortcuts don't exist — keep only the touch instructions (buttons do the rest)
    html = html.split("·").map((p) => p.replace(/<kbd>.*$/s, "").trim()).filter(Boolean).join(" · ");
    html = html.replace(/(dvoklik ali|desni klik izbriše točko)\s*$/i, "").replace(/\s·\s*$/, "");
  }
  el.innerHTML = html;
  el.classList.remove("hidden");
}

// Floating buttons for the active tool (needed on touch screens: no Enter / Esc / Backspace)
// actions: [{ label, run, primary?, danger? }] or null to hide
export function setActions(actions) {
  const el = $("#tool-actions");
  if (!actions?.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.innerHTML = actions.map((a, i) => `<button class="btn ${a.primary ? "primary" : ""} ${a.danger ? "danger" : ""}" data-i="${i}">${esc(a.label)}</button>`).join("");
  el.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) actions[+b.dataset.i].run(); };
  L.DomEvent.disableClickPropagation(el);
  el.classList.remove("hidden");
}

export function cancelPick() {
  pickCleanup?.(null);
}

// Resolve with [lat, lng] on the next map click, or null on Esc / cancel
export function pickPoint(hint = "Klikni na karto") {
  cancelPick();
  emit("tool-start");
  return new Promise((resolve) => {
    const container = map.getContainer();
    container.style.cursor = "crosshair";
    setHint(`${hint} <kbd>Esc</kbd> prekliče`);
    setActions([{ label: "Prekliči", run: () => done(null) }]);
    const onClick = (e) => done([e.latlng.lat, e.latlng.lng]);
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    function done(v) {
      map.off("click", onClick);
      document.removeEventListener("keydown", onKey, true);
      container.style.cursor = "";
      setHint(null);
      setActions(null);
      pickCleanup = null;
      resolve(v);
    }
    pickCleanup = done;
    map.once("click", onClick);
    document.addEventListener("keydown", onKey, true);
  });
}

export function pinIcon(color, label = "") {
  return L.divIcon({
    className: "",
    html: `<div class="pin-marker" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [26, 26], iconAnchor: [13, 30], popupAnchor: [0, -28], tooltipAnchor: [0, -26],
  });
}
