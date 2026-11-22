// Swipe comparison of two raster layers (e.g. historical orthophotos 1990 vs 2024)
import { map, makeRasterLayer } from "./map.js";
import { setBearing } from "./rotate.js";
import { state, layerName } from "../runtime/state.js";
import { esc, $, h } from "../shared/util.js";
import { icon } from "../shared/icons.js";

let left = "dof_1990_1994", right = "dof_2022_2024";
let layerA = null, layerB = null, active = false, pos = 0.5;
let labels = [];

function rasterOptions(selected) {
  const groups = [`<optgroup label="Osnovne karte">${state.db.base.map((l) => `<option value="${l.id}" ${l.id === selected ? "selected" : ""}>${esc(layerName(l))}</option>`).join("")}</optgroup>`];
  for (const c of state.db.categories) {
    const ls = c.layers.filter((l) => ["tile", "wms", "arcgis_export"].includes(l.type));
    groups.push(`<optgroup label="${esc(c.name)}">${ls.map((l) => `<option value="${l.id}" ${l.id === selected ? "selected" : ""}>${esc(layerName(l))}</option>`).join("")}</optgroup>`);
  }
  return groups.join("");
}

function clip() {
  if (!active || !layerB) return;
  const size = map.getSize();
  const x = size.x * pos;
  const nw = map.containerPointToLayerPoint([0, 0]);
  const se = map.containerPointToLayerPoint(size);
  const cx = map.containerPointToLayerPoint([x, 0]).x;
  map.getPane("cmpB").style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${cx}px)`;
  const slider = $("#compare-slider");
  slider.style.left = `${x}px`;
  labels[0] && (labels[0].style.right = `${size.x - x + 10}px`);
  labels[1] && (labels[1].style.left = `${x + 10}px`);
}

function start() {
  stop();
  setBearing(0);   // the swipe divides the screen vertically — needs a north-up map
  active = true;
  layerA = makeRasterLayer(state.layerIndex[left], { pane: "cmpA", opacity: 1 }).addTo(map);
  layerB = makeRasterLayer(state.layerIndex[right], { pane: "cmpB", opacity: 1 }).addTo(map);
  $("#compare-slider").classList.remove("hidden");
  const wrap = $("#map-wrap");
  labels = [
    h(`<div class="cmp-label">${esc(state.layerIndex[left].name)}</div>`),
    h(`<div class="cmp-label">${esc(state.layerIndex[right].name)}</div>`),
  ];
  labels.forEach((l) => wrap.appendChild(l));
  map.on("move zoom resize", clip);
  clip();
}

export function stop() {
  if (!active) return;
  active = false;
  layerA && map.removeLayer(layerA);
  layerB && map.removeLayer(layerB);
  layerA = layerB = null;
  map.getPane("cmpB").style.clip = "";
  map.off("move zoom resize", clip);
  $("#compare-slider").classList.add("hidden");
  labels.forEach((l) => l.remove());
  labels = [];
}

export function initCompare() {
  const slider = $("#compare-slider");
  let drag = false;
  slider.addEventListener("pointerdown", (e) => { drag = true; slider.setPointerCapture(e.pointerId); e.stopPropagation(); });
  slider.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = $("#map-wrap").getBoundingClientRect();
    pos = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width));
    clip();
  });
  slider.addEventListener("pointerup", () => { drag = false; });
  ["mousedown", "dblclick", "wheel", "click"].forEach((ev) => slider.addEventListener(ev, (e) => e.stopPropagation()));
}

export const comparePanel = {
  id: "compare",
  title: "Primerjava slojev",
  render(el) {
    el.innerHTML = `
      <div class="help">Povleci drsnik na karti za primerjavo dveh slojev — npr. ortofoto 1990 in 2024 za iskanje sprememb, opuščenih objektov ali starih poti.</div>
      <div class="section stack">
        <label class="small muted">Levo</label>
        <select class="field" id="c-left">${rasterOptions(left)}</select>
        <div class="row" style="justify-content:center"><button class="btn sm" id="c-swap">${icon("swap")} Zamenjaj</button></div>
        <label class="small muted">Desno</label>
        <select class="field" id="c-right">${rasterOptions(right)}</select>
        <button class="btn ${active ? "danger" : "primary"} block" id="c-toggle">${active ? "Ustavi primerjavo" : "Začni primerjavo"}</button>
      </div>
      <div class="section">
        <div class="section-title">Hitre izbire</div>
        <div class="row wrap">
          <button class="btn sm" data-q="dof_1990_1994|dof_2022_2024">1996 ↔ 2024</button>
          <button class="btn sm" data-q="dof_2006|dof_2022_2024">2006 ↔ 2024</button>
          <button class="btn sm" data-q="satellite|lidar_hillshade">Satelit ↔ LIDAR</button>
          <button class="btn sm" data-q="osm|gurs_orthophoto">OSM ↔ Ortofoto</button>
        </div>
      </div>`;
    el.onchange = (e) => {
      if (e.target.id === "c-left") left = e.target.value;
      if (e.target.id === "c-right") right = e.target.value;
      if (active) start();
    };
    el.onclick = (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.id === "c-toggle") { active ? stop() : start(); }
      if (t.id === "c-swap") { [left, right] = [right, left]; if (active) start(); }
      if (t.dataset.q) { [left, right] = t.dataset.q.split("|"); start(); }
      this.render(el);
    };
  },
};
