// "Nastavitve karte" — modelled on the original app's settings menu (MobileSettingsPanel):
// on-screen buttons (order + visibility), button size, scale bar, marker size, custom emoji per
// category, GPS tracks, interface colours, device linking — plus the desktop-only general settings.
import { map, scaleControl } from "../map.js";
import { state, saveSettings, emit } from "../state.js";
import { esc, toast, $, $$ } from "../util.js";
import { icon } from "../icons.js";
import { netStatus } from "./offline.js";
import { FAB_BUTTONS, renderFab, resetFabPos } from "../ui/fab.js";

export function applyTheme() {
  const t = state.settings.theme;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const btn = document.getElementById("theme-btn");
  if (btn) { btn.dataset.icon = dark ? "sun" : "moon"; emit("icons"); }
  applyColors();
}

// ── Barve vmesnika (interface colours) — same fields as the original ThemeCustomizer ──
export const COLOR_FIELDS = [
  ["toolbarBg", "Ozadje gumbov", "--fab-bg"],
  ["toolbarText", "Ikone gumbov", "--fab-fg"],
  ["buttonActiveBg", "Aktiven gumb", "--fab-active-bg"],
  ["buttonActiveText", "Besedilo aktivnega gumba", "--fab-active-fg"],
  ["menuBg", "Ozadje menijev", "--menu-bg"],
  ["menuText", "Besedilo menijev", "--menu-fg"],
  ["popupBg", "Ozadje oblačkov", "--popup-bg"],
  ["panelBg", "Ozadje panela slojev", "--layers-bg"],
  ["panelText", "Besedilo panela slojev", "--layers-fg"],
  ["accentColor", "Poudarki", "--accent"],
];
export function applyColors() {
  const root = document.documentElement;
  const c = state.settings.ui?.colors || {};
  for (const [key, , cssVar] of COLOR_FIELDS) {
    if (c[key]) root.style.setProperty(cssVar, c[key]);
    else root.style.removeProperty(cssVar);
  }
  if (c.accentColor) root.style.setProperty("--accent-soft", c.accentColor + "26");
  else root.style.removeProperty("--accent-soft");
}
function currentColor(cssVar) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + [...v.slice(1)].map((x) => x + x).join("");
  const m = v.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/);
  return m ? "#" + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("") : "#888888";
}

export function applyScaleBar() {
  const ui = state.settings.ui;
  const el = scaleControl?.getContainer();
  if (!el) return;
  el.style.display = ui.scaleBarVisible === false ? "none" : "";
  el.style.transform = `scale(${ui.scaleBarScale || 1})`;
  el.style.transformOrigin = "bottom left";
}

const SHORTCUTS = [
  ["Ctrl + K", "Iskanje"], ["L / P / N / D / T / C / O", "Sloji / Točke / Pot / Riši / Sledi / Primerjaj / Offline"],
  ["M", "Meri razdaljo"], ["A", "Meri površino"], ["Esc", "Prekliči orodje / zapri"], ["Enter", "Končaj črto ali območje"],
  ["Backspace", "Odstrani zadnjo točko"], ["Desni klik / dolg pritisk", "Meni lokacije"], ["Dvoklik / dvojni dotik", "Povečaj"],
];

const open = new Set(); // expanded sections
let emojiCat = null;

const toggle = (on, attrs) => `<button class="switch ${on ? "on" : ""}" ${attrs} role="switch" aria-checked="${on}"><span></span></button>`;

export const settingsPanel = {
  id: "settings",
  title: "Nastavitve karte",
  render(el) {
    const s = state.settings, ui = s.ui;
    const cats = state.db.pois;
    emojiCat ||= cats[0]?.id;
    const ec = cats.find((c) => c.id === emojiCat);
    const btnRows = ui.order.map((id) => {
      const b = FAB_BUTTONS.find((x) => x.id === id);
      if (!b) return "";
      const vis = !ui.hidden.includes(id);
      return `<div class="sbtn-row ${vis ? "" : "off"}" data-id="${id}">
        <span class="grip" data-grip>${icon("grip")}</span>${icon(b.icon)}
        <span class="grow">${esc(b.label)}</span>${toggle(vis, `data-vis="${id}"`)}</div>`;
    }).join("");
    const sec = (id, ic, title, body) => `
      <div class="ssec ${open.has(id) ? "open" : ""}">
        <button class="ssec-head" data-sec="${id}">${icon(ic)}<span class="grow">${title}</span>${icon("chevron", "chev")}</button>
        ${open.has(id) ? `<div class="ssec-body">${body}</div>` : ""}
      </div>`;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${s[key] === v ? "on" : ""}" data-set="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;

    el.innerHTML = `
      <div class="smenu">
        <div class="slabel">Gumbi na zaslonu</div>
        <div class="shelp">Povleci za vrstni red · preklopi za prikaz na zaslonu</div>
        <div id="sbtn-list">${btnRows}</div>
        <div class="row" style="margin-top:8px"><span class="shelp grow" style="margin:0">Stolpec gumbov premakneš tako, da povlečeš ročico nad njim.</span>
          <button class="btn sm" id="fab-reset" ${ui.fabPos ? "" : "disabled"}>${icon("rotateCcw")} Ponastavi položaj</button></div>

        <div class="sdiv"></div>
        <div class="srow"><span class="slabel">Velikost gumbov</span><b class="sval">${Math.round(ui.buttonScale * 100)}%</b></div>
        <input type="range" min="50" max="300" step="5" value="${Math.round(ui.buttonScale * 100)}" data-range="buttonScale">
        <div class="sminmax"><span>50%</span><span>300%</span></div>

        <div class="sdiv"></div>
        <div class="srow"><span class="slabel">Merilo</span>${toggle(ui.scaleBarVisible !== false, "data-scalebar")}</div>
        ${ui.scaleBarVisible !== false ? `
          <div class="srow"><span class="shelp" style="margin:0">Velikost merila</span><b class="sval">${Math.round(ui.scaleBarScale * 100)}%</b></div>
          <input type="range" min="50" max="200" step="5" value="${Math.round(ui.scaleBarScale * 100)}" data-range="scaleBarScale">
          <div class="sminmax"><span>50%</span><span>200%</span></div>` : ""}

        <div class="sdiv"></div>
        <div class="srow"><span class="slabel">Velikost označb</span><b class="sval">${ui.markerSize}px</b></div>
        <input type="range" min="10" max="40" step="1" value="${ui.markerSize}" data-range="markerSize">
        <div class="sminmax"><span>10px</span><span>40px</span></div>

        <div class="slabel" style="margin-top:10px">Označba po izbiri</div>
        <div class="row">
          <select class="field grow" id="emoji-cat">${cats.map((c) => `<option value="${c.id}" ${c.id === emojiCat ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
          <input class="field" id="emoji-in" maxlength="4" style="width:58px;text-align:center;font-size:18px" value="${esc(ui.emoji[emojiCat] || ec?.emoji || "")}">
        </div>
        <div class="row" style="margin-top:6px"><button class="btn sm primary grow" id="emoji-apply">Uporabi</button><button class="btn sm grow" id="emoji-clear">Počisti</button></div>

        <div class="sdiv"></div>
        ${sec("tracks", "route", "Moje GPS sledi", `<div class="shelp" style="margin:0 0 8px">Uvoz, snemanje in analiza sledi.</div><button class="btn sm block" data-open="tracks">${icon("footprints")} Odpri sledi</button>`)}
        ${sec("colors", "palette", "Barve vmesnika", `
          ${COLOR_FIELDS.map(([key, label, cssVar]) => `<label class="color-row"><span class="grow">${label}</span>
            <input type="color" data-color="${key}" value="${ui.colors[key] || currentColor(cssVar)}"></label>`).join("")}
          <button class="btn sm block" id="colors-reset" style="margin-top:8px">${icon("rotateCcw")} Ponastavi barve</button>`)}
        ${sec("link", "link", "Poveži naprave", `<div class="shelp" style="margin:0 0 8px">Deli zemljevid, oznake in sporočila z napravami v istem omrežju Wi-Fi ali prek strežnika.</div><button class="btn sm block" data-open="collab">${icon("users")} Odpri skupno delo</button>`)}
        ${sec("plugins", "plug", "AI in vtičniki", `<div class="shelp" style="margin:0 0 8px">Prostor za AI asistenta in druge vtičnike.</div><button class="btn sm block" data-open="ai">${icon("brain")} Odpri vtičnike</button>`)}

        ${sec("general", "settings", "Splošno", `
          <div class="slabel">Tema</div>${seg("theme", [["auto", "Sistemska"], ["light", "Svetla"], ["dark", "Temna"]])}
          <div class="slabel" style="margin-top:10px">Zapis koordinat</div>${seg("coordFormat", [["dec", "46.0512, 14.5051"], ["dms", "46°03′04″N"]])}
          <div class="slabel" style="margin-top:10px">Začetni pogled</div>
          <div class="row wrap"><button class="btn sm" id="s-start">${icon("save")} Shrani trenutni pogled</button>
            ${s.startView ? `<button class="btn sm" id="s-start-reset">Ponastavi</button>` : ""}</div>
          <div class="shelp">${s.startView ? "Ob zagonu se odpre shranjeni pogled." : "Ob zagonu se odpre zadnji pogled."}</div>`)}
        ${sec("shortcuts", "info", "Bližnjice", `<dl class="kv">${SHORTCUTS.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd style="font-weight:500">${esc(d)}</dd>`).join("")}</dl>`)}
        ${sec("data", "folder", "Podatki in o programu", `
          <div class="small">Vse je shranjeno lokalno:<br><code style="word-break:break-all">${esc(netStatus.dataDir || "")}</code></div>
          ${window.pywebview?.api ? `<button class="btn sm" id="s-folder" style="margin-top:6px">${icon("folder")} Odpri mapo</button>` : ""}
          <div class="small muted" style="margin-top:8px">Franc Map ${esc(netStatus.version || "")} · Viri: © OpenStreetMap · GURS · ARSO · EEA · Esri · CARTO · OpenTopoMap · WaymarkedTrails · OpenRailwayMap · BRouter · Open-Meteo · adsb.lol</div>`)}
      </div>`;

    el.onclick = (e) => {
      const t = e.target.closest("button, [data-sec]");
      if (!t) return;
      const d = t.dataset;
      if (d.vis) {
        ui.hidden = ui.hidden.includes(d.vis) ? ui.hidden.filter((x) => x !== d.vis) : [...ui.hidden, d.vis];
        saveSettings(); renderFab(); return this.render(el);
      }
      if ("scalebar" in d) { ui.scaleBarVisible = ui.scaleBarVisible === false; saveSettings(); applyScaleBar(); return this.render(el); }
      if (d.sec) { open.has(d.sec) ? open.delete(d.sec) : open.add(d.sec); return this.render(el); }
      if (d.open) return emit("open-panel", d.open);
      if (d.set) {
        s[d.set] = d.v; saveSettings();
        if (d.set === "theme") applyTheme();
        emit("settings-changed");
        return this.render(el);
      }
      switch (t.id) {
        case "emoji-apply": { const v = $("#emoji-in", el).value.trim(); if (v) ui.emoji[emojiCat] = v; else delete ui.emoji[emojiCat]; saveSettings(); emit("poi-style"); toast("Označba posodobljena", "ok", 1500); break; }
        case "emoji-clear": delete ui.emoji[emojiCat]; saveSettings(); emit("poi-style"); this.render(el); break;
        case "fab-reset": resetFabPos(); this.render(el); break;
        case "colors-reset": ui.colors = {}; saveSettings(); applyColors(); renderFab(); this.render(el); break;
        case "s-start": { const c = map.getCenter(); s.startView = { center: [c.lat, c.lng], zoom: map.getZoom() }; saveSettings(); toast("Začetni pogled shranjen", "ok"); this.render(el); break; }
        case "s-start-reset": s.startView = null; saveSettings(); this.render(el); break;
        case "s-folder": window.pywebview.api.open_data_dir(); break;
      }
    };
    el.oninput = (e) => {
      const t = e.target;
      if (t.dataset.range) {
        const k = t.dataset.range;
        ui[k] = k === "markerSize" ? +t.value : +t.value / 100;
        t.previousElementSibling.querySelector(".sval").textContent = k === "markerSize" ? `${t.value}px` : `${t.value}%`;
        if (k === "buttonScale") renderFab();
        if (k === "scaleBarScale") applyScaleBar();
        if (k === "markerSize") emit("poi-style");
        saveSettings();
      }
      if (t.dataset.color) { ui.colors[t.dataset.color] = t.value; applyColors(); renderFab(); saveSettings(); }
    };
    el.onchange = (e) => {
      if (e.target.id === "emoji-cat") { emojiCat = e.target.value; this.render(el); }
    };
    enableReorder($("#sbtn-list", el), (order) => { ui.order = order; saveSettings(); renderFab(); });
  },
};

// Pointer-based drag to reorder (works with touch, unlike HTML5 drag & drop)
function enableReorder(list, onDone) {
  let drag = null;
  list.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest("[data-grip]");
    if (!grip) return;
    const row = grip.closest(".sbtn-row");
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch { /* synthetic / already released pointer */ }
    drag = { row, startY: e.clientY };
    row.classList.add("dragging");
  });
  list.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const rows = $$(".sbtn-row", list);
    const dy = e.clientY - drag.startY;
    drag.row.style.transform = `translateY(${dy}px)`;
    // swap with the neighbour once the dragged row's centre passes the neighbour's centre
    const visTop = drag.row.getBoundingClientRect().top;          // where the row is drawn now
    const mid = visTop + drag.row.offsetHeight / 2;
    const i = rows.indexOf(drag.row);
    const prev = rows[i - 1], next = rows[i + 1];
    const centre = (r) => { const rr = r.getBoundingClientRect(); return rr.top + rr.height / 2; };
    let moved = false;
    if (prev && mid < centre(prev)) { prev.before(drag.row); moved = true; }
    else if (next && mid > centre(next)) { next.after(drag.row); moved = true; }
    if (moved) {
      // keep the row under the finger: same visual position, offset measured from its new slot
      drag.row.style.transform = "";
      const off = visTop - drag.row.getBoundingClientRect().top;
      drag.row.style.transform = `translateY(${off}px)`;
      drag.startY = e.clientY - off;
    }
  });
  const end = () => {
    if (!drag) return;
    drag.row.classList.remove("dragging");
    drag.row.style.transform = "";
    drag = null;
    onDone($$(".sbtn-row", list).map((r) => r.dataset.id));
  };
  list.addEventListener("pointerup", end);
  list.addEventListener("pointercancel", end);
}
