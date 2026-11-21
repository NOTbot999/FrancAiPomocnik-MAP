// Podatki ob kliku na karto: for active GURS (e-prostor) WMS layers, ask the server what lies under
// the click (WMS GetFeatureInfo, JSON) and show it in a popup — e.g. a water pipe or sewer from the
// utility cadastre (GJI). The public service only returns IDs and type codes, no pipe diameter.
import { map } from "../map/map.js";
import { state } from "../runtime/state.js";
import { fetchJSON } from "../services/api.js";
import { esc, copyText, fmtLatLng, toD96 } from "../shared/util.js";
import { icon } from "../shared/icons.js";

const GURS_HOST = /(^|\.)ipi\.eprostor\.gov\.si$/;
const PX = 101;               // size of the query window around the click (pixels)
const TAP_DELAY = 300;        // wait so a double tap (zoom) doesn't trigger a query

// friendlier names for attributes the GURS services return
const KEY_LABELS = {
  EID_LINIJA: "ID linije", EID_TOCKA: "ID točke", EID_POLIGON: "ID poligona", FEATUREID: null,   // null = hide
  GJI_TEMATIKA_ID: "Vrsta omrežja", GJI_ATR1_SIFRA: "Šifra vrste",
  PARCELA: "Parcela", ST_PARCELE: "Številka parcele", KO_ID: "Katastrska občina (šifra)", IME_KO: "Katastrska občina",
  ST_STAVBE: "Številka stavbe", POVRSINA: "Površina (m²)", NAZIV: "Naziv", IME: "Ime",
};
// GJI theme ids seen in the public data (10 = vodovod, 11 = kanalizacija)
const GJI_THEMES = { 10: "Vodovod", 11: "Kanalizacija" };

let timer = null;

export function initFeatureInfo() {
  map.on("click", (e) => {
    clearTimeout(timer);
    if (map.getContainer().style.cursor === "crosshair") return;   // a drawing / picking tool owns the click
    timer = setTimeout(() => query(e.latlng), TAP_DELAY);
  });
  map.on("zoomstart dblclick", () => clearTimeout(timer));
}

function activeGursLayers() {
  const z = map.getZoom();
  const out = [];
  for (const o of state.settings.overlays) {
    if (o.visible === false) continue;
    const cfg = state.layerIndex[o.id];
    if (!cfg || cfg.type !== "wms") continue;
    let host = "";
    try { host = new URL(cfg.url).hostname; } catch { continue; }
    if (!GURS_HOST.test(host) || (cfg.minZoom && z < cfg.minZoom)) continue;
    out.push(cfg);
  }
  return out;
}

function getFeatureInfoUrl(cfg, latlng) {
  const z = map.getZoom();
  const res = 2 * 20037508.342789244 / (256 * 2 ** z);          // metres per pixel in EPSG:3857
  const p = L.CRS.EPSG3857.project(latlng);
  const half = (PX / 2) * res;
  const params = new URLSearchParams({
    SERVICE: "WMS", REQUEST: "GetFeatureInfo", VERSION: "1.3.0", LAYERS: cfg.layers, QUERY_LAYERS: cfg.layers, STYLES: "",
    CRS: "EPSG:3857", BBOX: [p.x - half, p.y - half, p.x + half, p.y + half].map((v) => v.toFixed(2)).join(","),
    WIDTH: PX, HEIGHT: PX, I: Math.floor(PX / 2), J: Math.floor(PX / 2),
    INFO_FORMAT: "application/json", FEATURE_COUNT: 5, BUFFER: 6,
  });
  return `${cfg.url}${cfg.url.includes("?") ? "&" : "?"}${params}`;
}

async function query(latlng) {
  const layers = activeGursLayers();
  if (!layers.length) return;
  const results = await Promise.all(layers.map(async (cfg) => {
    try {
      const r = await fetchJSON(getFeatureInfoUrl(cfg, latlng), 7 * 86400);
      return { cfg, features: r?.features || [] };
    } catch { return { cfg, features: [] }; }
  }));
  const hits = results.filter((r) => r.features.length);
  if (!hits.length) return;
  showPopup(latlng, hits);
}

function featureTitle(f, cfg) {
  const p = f.properties || {};
  if (p.GJI_TEMATIKA_ID != null) return GJI_THEMES[p.GJI_TEMATIKA_ID] || `Gospodarska infrastruktura (tema ${p.GJI_TEMATIKA_ID})`;
  return cfg.name;
}

function showPopup(latlng, hits) {
  const ids = [];
  const blocks = hits.flatMap(({ cfg, features }) => features.slice(0, 5).map((f) => {
    const p = f.properties || {};
    const rows = Object.entries(p).filter(([k, v]) => KEY_LABELS[k] !== null && v !== null && v !== "").map(([k, v]) => {
      let val = esc(v);
      if (k === "GJI_TEMATIKA_ID" && GJI_THEMES[v]) val = `${esc(GJI_THEMES[v])} (${esc(v)})`;
      return `<div><b>${esc(KEY_LABELS[k] || k)}</b><span>${val}</span></div>`;
    }).join("");
    const id = p.EID_LINIJA || p.EID_TOCKA || p.EID_POLIGON || f.id || "";
    if (id) ids.push(String(id));
    return `<div class="fi-block"><div class="fi-title">${esc(featureTitle(f, cfg))}</div>
      <div class="sub">${esc(cfg.name)}</div><div class="tags">${rows}</div>
      ${id ? `<button class="btn sm" data-copy="${esc(id)}">${icon("copy")} Kopiraj ID</button>` : ""}</div>`;
  }));
  const isGji = hits.some(({ features }) => features.some((f) => f.properties?.GJI_TEMATIKA_ID != null));
  const { e, n } = toD96(latlng.lat, latlng.lng);
  const html = `<div class="pop fi-pop">
    <h3>Podatki na tem mestu</h3>
    ${blocks.join("")}
    ${isGji ? `<div class="fi-note">Premer, material in globina cevi niso javno dostopni. Za podrobnosti se obrni na upravljavca omrežja (komunalno podjetje) in navedi ID linije.</div>` : ""}
    <div class="coord" data-copy="${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}">WGS84 ${fmtLatLng(latlng.lat, latlng.lng, state.settings.coordFormat)}</div>
    <div class="coord" data-copy="${Math.round(e)} ${Math.round(n)}">D96/TM e ${Math.round(e)} n ${Math.round(n)}</div>
    <div class="small muted" style="margin-top:6px">Vir: GURS, kataster GJI / e-prostor</div>
  </div>`;
  const pop = L.popup({ maxWidth: 320, autoPanPadding: [40, 40] }).setLatLng(latlng).setContent(html).openOn(map);
  pop.getElement()?.addEventListener("click", (ev) => {
    const c = ev.target.closest("[data-copy]");
    if (c) copyText(c.dataset.copy);
  });
}
