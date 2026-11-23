// Small status box for live data layers (weather stations, NAP traffic):
// one row per source group with the last update time, offline / error notes and an "Osveži" button.
import { esc } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { map } from "./map.js";

const rows = new Map();   // key → { label, time, note, warn, onRefresh, busy }
let box = null;

function ensureBox() {
  if (box) return box;
  box = document.createElement("div");
  box.className = "live-status";
  document.getElementById("map-wrap").appendChild(box);
  L.DomEvent.disableClickPropagation(box);
  L.DomEvent.disableScrollPropagation(box);
  // step aside while a popup is open (it would cover the popup's top)
  map.on("popupopen", () => box.classList.add("ls-away"));
  map.on("popupclose", () => box.classList.remove("ls-away"));
  box.addEventListener("click", (e) => {
    const k = e.target.closest("[data-live-refresh]")?.dataset.liveRefresh;
    if (k) rows.get(k)?.onRefresh?.();
  });
  return box;
}

export const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts), today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("sl-SI", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
};

function render() {
  const b = ensureBox();
  b.hidden = rows.size === 0;
  b.innerHTML = [...rows.entries()].map(([k, r]) => `
    <div class="ls-row">
      <div class="ls-main"><b>${esc(r.label)}</b> <span class="muted">${r.busy ? "osvežujem …" : `posodobljeno ${esc(fmtTime(r.time))}`}</span>
        ${r.note ? `<div class="ls-note">${esc(r.note)}</div>` : ""}
        ${(r.warn || []).map((w) => `<div class="ls-warn">⚠ ${esc(w)}</div>`).join("")}
      </div>
      ${r.onRefresh ? `<button class="icon-btn sm" data-live-refresh="${esc(k)}" title="Osveži">${icon("refresh")}</button>` : ""}
    </div>`).join("");
}

/** Show / update a row. */
export function setLiveStatus(key, data) { rows.set(key, { ...(rows.get(key) || {}), ...data }); render(); }
export function removeLiveStatus(key) { rows.delete(key); render(); }
