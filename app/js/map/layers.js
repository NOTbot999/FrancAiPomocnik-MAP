import { state, saveSettings, emit, isBroken, layerName, brokenReason } from "../runtime/state.js";
import { map, setBase, setBaseOpacity, toggleOverlay, setOverlayOpacity, setOverlayVisible, moveOverlay, isOverlayOn, tileXY, syncOverlays } from "./map.js";
import { TOKEN, TILE_SUBDOMAINS, tileHost, IS_WEB, proxiedImage } from "../services/api.js";
import { tileUrl } from "../services/webbackend.js";
import { esc, h, $, $$ } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { legendHtml } from "./legend.js";

let filter = "";

function thumbUrl(id) {
  const { x, y } = tileXY(46.12, 14.82, 9);
  if (IS_WEB) return tileUrl(state.layerIndex[id], 9, x, y);   // web version: straight from the map service
  return `${tileHost(TILE_SUBDOMAINS[0])}/tiles/${id}/9/${x}/${y}`;
}

// Picture view ("Slike"): a map tile of Ljubljana with the layer on top of the current base map.
// Layers that only draw from a certain zoom are shown at that zoom.
const PREVIEW_AT = [46.045, 14.505];
function tileAt(id, z, x, y) {
  if (IS_WEB) return tileUrl(state.layerIndex[id], z, x, y);
  return `${tileHost(TILE_SUBDOMAINS[(x + y) % TILE_SUBDOMAINS.length])}/tiles/${id}/${z}/${x}/${y}`;
}
function previewHtml(l) {
  if (!["wms", "tile", "arcgis_export"].includes(l.type)) {
    const ic = { live_flights: "navigation", weather: "sun", rainviewer: "sun", grid_d96: "grid", arso_stations: "sun", nap: "traffic" }[l.type] || "route";
    return `<div class="lt lt-icon">${icon(ic)}</div>`;
  }
  const z = Math.max(l.minZoom || 0, 13);
  const { x, y } = tileXY(PREVIEW_AT[0], PREVIEW_AT[1], z);
  return `<div class="lt">
    <img src="${tileAt(state.settings.base, z, x, y)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">
    <img src="${tileAt(l.id, z, x, y)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">
  </div>`;
}

function legendUrl(cfg) {
  if (cfg.type !== "wms") return null;
  const lyr = cfg.layers.split(",")[0];
  const u = `${cfg.url}${cfg.url.includes("?") ? "&" : "?"}SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.1.1&FORMAT=image/png&LAYER=${encodeURIComponent(lyr)}`;
  return proxiedImage(u);
}

export const layersPanel = {
  id: "layers",
  title: "Sloji karte",
  render(el) {
    const s = state.settings;
    const db = state.db;
    const q = filter.trim().toLowerCase();

    const baseCards = db.base.map((b) => `
      <button class="base-card ${s.base === b.id ? "on" : ""} ${isBroken(b.id) ? "broken" : ""}" data-base="${b.id}" title="${esc(brokenReason(b.id) || b.name)}">
        <div class="thumb" style="background-image:url('${thumbUrl(b.id)}')"></div>${esc(layerName(b))}
      </button>`).join("");
    const nBroken = Object.values(state.health).filter((x) => x.status !== "ok").length;
    const healthLine = state.healthRunning
      ? `<span class="spinner"></span> Preverjam delovanje slojev…`
      : nBroken ? `${nBroken} slojev trenutno ne deluje — označeni so z X … X.` : Object.keys(state.health).length ? "Vsi sloji delujejo." : "";

    const active = [...s.overlays].reverse();
    const activeHtml = active.length ? active.map((o) => {
      const cfg = state.layerIndex[o.id];

      return `<div class="active-layer" draggable="true" data-id="${o.id}">
        <div class="row">
          <span class="grip" title="Povleci za vrstni red">${icon("grip")}</span>
          <button class="icon-btn sm ${o.visible === false ? "" : "on"}" data-vis="${o.id}" title="Pokaži / skrij">${icon(o.visible === false ? "eyeOff" : "eye")}</button>
          <span class="nm grow ellipsis ${isBroken(o.id) ? "broken" : ""}" title="${esc(brokenReason(o.id) || cfg.description || cfg.name)}">${esc(layerName(cfg))}</span>
          <button class="icon-btn sm" data-off="${o.id}" title="Odstrani">${icon("x")}</button>
        </div>
        ${cfg.minZoom && map.getZoom() < cfg.minZoom ? `<button class="zoom-hint" data-zoomto="${cfg.minZoom}">${icon("zoom")} Viden od povečave ${cfg.minZoom} — klikni za približanje</button>` : ""}
        ${isBroken(o.id) ? `<div class="broken-hint">${esc(brokenReason(o.id))}</div>` : ""}
        <div class="op"><input type="range" min="0" max="1" step="0.05" value="${o.opacity}" data-op="${o.id}"><span>${Math.round(o.opacity * 100)}%</span></div>
        ${s.showLegends ? `<div class="legend-slot" data-legend="${o.id}"></div>` : ""}
      </div>`;
    }).join("") : `<div class="help">Ni vklopljenih slojev. Izberi jih spodaj — vrstni red spreminjaš s potegom.</div>`;

    const row = (l) => `
      <div class="layer-row ${isOverlayOn(l.id) ? "on" : ""} ${isBroken(l.id) ? "broken" : ""}" title="${esc(brokenReason(l.id))}">
        <input type="checkbox" ${isOverlayOn(l.id) ? "checked" : ""} data-toggle="${l.id}">
        <div class="name" data-toggle-name="${l.id}">${esc(layerName(l))}<span class="d" title="${esc(brokenReason(l.id) || l.description || "")}">${esc(isBroken(l.id) ? brokenReason(l.id) : l.description || "")}</span></div>
        <button class="icon-btn sm star ${s.favorites.includes(l.id) ? "on" : ""}" data-fav="${l.id}" title="Priljubljen">${icon("star")}</button>
      </div>`;

    const card = (l) => `
      <div class="layer-card ${isOverlayOn(l.id) ? "on" : ""} ${isBroken(l.id) ? "broken" : ""}" data-toggle-name="${l.id}" title="${esc(brokenReason(l.id) || l.description || l.name)}">
        ${previewHtml(l)}
        <span class="lc-check">${icon("check")}</span>
        <button class="icon-btn sm star ${s.favorites.includes(l.id) ? "on" : ""}" data-fav="${l.id}" title="Priljubljen">${icon("star")}</button>
        <div class="lc-name">${esc(layerName(l))}</div>
      </div>`;
    const thumbs = s.layerView === "thumbs";
    const list = (layers) => thumbs ? `<div class="layer-grid">${layers.map(card).join("")}</div>` : layers.map(row).join("");
    const viewSeg = `<div class="seg view-seg" role="group" aria-label="Prikaz slojev">
        <button class="${thumbs ? "" : "on"}" data-view="list" title="Seznam (samo imena)">${icon("menu")}</button>
        <button class="${thumbs ? "on" : ""}" data-view="thumbs" title="Slike (predogled sloja na karti)">${icon("image")}</button></div>`;

    const favs = s.favorites.map((id) => state.layerIndex[id]).filter((l) => l && !l.isBase);
    const cats = db.categories.map((c) => {
      const layers = c.layers.filter((l) => !q || l.name.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q));
      if (!layers.length) return "";
      const n = c.layers.filter((l) => isOverlayOn(l.id)).length;
      const open = q || s.openCats.includes(c.id);
      return `<div class="cat ${open ? "open" : ""}" data-cat="${c.id}">
        <button class="cat-head" data-cat-toggle="${c.id}">${icon("chevron", "chev")}<span>${esc(c.name)}</span><span class="n">${n ? n + "/" + c.layers.length : c.layers.length}</span></button>
        <div class="cat-body">${list(layers)}</div>
      </div>`;
    }).join("");

    el.innerHTML = `
      <div class="section">
        <div class="section-title">Osnovna karta</div>
        <div class="base-grid">${baseCards}</div>
        <div class="row" style="margin-top:8px"><span class="small muted">Prosojnost</span><input type="range" min="0.1" max="1" step="0.05" value="${s.baseOpacity}" id="base-op" class="grow"></div>
      </div>
      <div class="section">
        <div class="section-title"><span>Aktivni sloji (${s.overlays.length})</span>
          <span class="row">
            <button class="btn sm" id="toggle-legends" title="Legende aktivnih slojev">${icon("legend")} ${s.showLegends ? "Skrij legende" : "Legende"}</button>
            ${s.overlays.length ? `<button class="btn sm danger" id="clear-overlays">Počisti</button>` : ""}
          </span>
        </div>
        <div id="active-list">${activeHtml}</div>
      </div>
      ${favs.length ? `<div class="section"><div class="section-title">Priljubljeni</div><div class="card" style="padding:4px">${list(favs)}</div></div>` : ""}
      <div class="section">
        <div class="section-title"><span>Vsi sloji</span><span class="row">${viewSeg}<button class="btn sm" id="health-run" title="Ponovno preveri, kateri viri delujejo" ${state.healthRunning ? "disabled" : ""}>${icon("refresh")} Preveri</button></span></div>
        ${healthLine ? `<div class="help">${healthLine}</div>` : ""}
        <input type="text" class="field" id="layer-filter" placeholder="Filtriraj sloje…" value="${esc(filter)}">
        <div style="margin-top:8px">${cats || `<div class="empty">Ni zadetkov.</div>`}</div>
      </div>
      <div class="section ext-links">
        <div class="section-title">Uporabne povezave</div>
        ${[["KatasterJam – Jame", "https://www.katasterjam.si"], ["ARSO Atlas okolja", "https://gis.arso.gov.si/atlasokolja/profile.aspx?id=Atlas_Okolja_AXL@Arso&culture=en-US"],
           ["Old Maps Online", "https://www.oldmapsonline.org/en/Slovenia"], ["e-Prostor javni vpogled", "https://ipi.eprostor.gov.si/jv/"]]
          .map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${icon("link")} ${l}</a>`).join("")}
      </div>`;

    // legends of active layers (async: GeoHub legends come from the bundled file)
    for (const slot of $$("[data-legend]", el)) {
      legendHtml(state.layerIndex[slot.dataset.legend]).then((html) => { slot.innerHTML = html || '<div class="lg-note">Ta vir nima legende.</div>'; });
    }

    // events
    el.onclick = (e) => {
      const t = e.target.closest("[data-base],[data-off],[data-vis],[data-fav],[data-cat-toggle],[data-toggle-name],[data-zoomto],[data-view],#clear-overlays,#toggle-legends,#health-run");
      if (!t) return;
      if (t.dataset.view) { s.layerView = t.dataset.view; saveSettings(); this.render(el); }
      else if (t.dataset.base) { setBase(t.dataset.base); }
      else if (t.dataset.zoomto) map.setZoom(+t.dataset.zoomto);
      else if (t.id === "health-run") emit("health-run");
      else if (t.dataset.off) toggleOverlay(t.dataset.off, false);
      else if (t.dataset.vis) {
        const o = s.overlays.find((x) => x.id === t.dataset.vis);
        setOverlayVisible(o.id, o.visible === false);
        this.render(el);
      } else if (t.dataset.fav) {
        const id = t.dataset.fav;
        s.favorites = s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id];
        saveSettings();
        this.render(el);
      } else if (t.dataset.catToggle) {
        const id = t.dataset.catToggle;
        s.openCats = s.openCats.includes(id) ? s.openCats.filter((x) => x !== id) : [...s.openCats, id];
        saveSettings();
        t.closest(".cat").classList.toggle("open");
      } else if (t.dataset.toggleName) toggleOverlay(t.dataset.toggleName);
      else if (t.id === "clear-overlays") { s.overlays.splice(0); syncOverlays(); saveSettings(); emit("layers-changed"); }
      else if (t.id === "toggle-legends") { s.showLegends = !s.showLegends; saveSettings(); this.render(el); }
    };
    el.onchange = (e) => {
      if (e.target.dataset.toggle) toggleOverlay(e.target.dataset.toggle, e.target.checked);
    };
    el.oninput = (e) => {
      const t = e.target;
      if (t.id === "base-op") setBaseOpacity(+t.value);
      else if (t.dataset.op) { setOverlayOpacity(t.dataset.op, +t.value); t.nextElementSibling.textContent = Math.round(t.value * 100) + "%"; }
      else if (t.id === "layer-filter") {
        filter = t.value;
        const pos = t.selectionStart;
        this.render(el);
        const f = $("#layer-filter", el); f.focus(); f.setSelectionRange(pos, pos);
      }
    };

    // drag & drop ordering (list is displayed top-most first)
    let dragId = null;
    $$(".active-layer", el).forEach((item) => {
      item.addEventListener("dragstart", (e) => { dragId = item.dataset.id; item.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
      item.addEventListener("dragend", () => { item.classList.remove("dragging"); $$(".drop-before", el).forEach((x) => x.classList.remove("drop-before")); });
      item.addEventListener("dragover", (e) => { e.preventDefault(); $$(".drop-before", el).forEach((x) => x.classList.remove("drop-before")); item.classList.add("drop-before"); });
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragId || dragId === item.dataset.id) return;
        // dropping "before" item in the visual (reversed) list == placing above it in z-order
        const list = s.overlays;
        const targetIdx = list.findIndex((o) => o.id === item.dataset.id);
        const above = list[targetIdx + 1];
        if (above?.id === dragId) return;
        moveOverlay(dragId, above ? above.id : null);
      });
    });
  },
};
