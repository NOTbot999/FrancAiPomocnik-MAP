// Shared map popups: POI details and "what's here" location info
import { map } from "../map/map.js";
import { emit, state } from "../runtime/state.js";
import { nominatim, openMeteo } from "../services/external.js";
import { esc, fmtLatLng, toD96, copyText, h } from "../shared/util.js";
import { icon } from "../shared/icons.js";

const TAG_LABELS = {
  "cave:ref": "Kataster št.", "cave:length": "Dolžina", "cave:depth": "Globina",
  ele: "Nadm. višina", opening_hours: "Odprto", website: "Splet", phone: "Telefon", "contact:phone": "Telefon",
  operator: "Upravljavec", description: "Opis", "addr:street": "Ulica", "addr:housenumber": "Hišna št.",
  "addr:city": "Kraj", "addr:postcode": "Pošta", wikipedia: "Wikipedija", heritage: "Dediščina", denomination: "Veroizpoved",
  capacity: "Kapaciteta", fee: "Plačljivo", access: "Dostop", brand: "Znamka", length: "Dolžina", height: "Višina",
  // defibrillators (AED)
  "defibrillator:location": "Kje je AED", "defibrillator:location:sl": "Kje je AED", indoor: "V stavbi", level: "Nadstropje",
  "defibrillator:code": "Koda omarice", "emergency:phone": "Klic v sili", note: "Opomba",
};
const YES_NO = { yes: "da", no: "ne", public: "javno", private: "zasebno", customers: "strankam", permissive: "dovoljeno" };

function coordBlock(lat, lng) {
  const { e, n } = toD96(lat, lng);
  return `<div class="coord" data-copy="${lat.toFixed(6)}, ${lng.toFixed(6)}" title="Klikni za kopiranje">WGS84 ${fmtLatLng(lat, lng, state.settings.coordFormat)}</div>
    <div class="coord" data-copy="${Math.round(e)} ${Math.round(n)}" title="Klikni za kopiranje">D96/TM e ${Math.round(e)} n ${Math.round(n)}</div>`;
}

function actions(lat, lng, name) {
  return `<div class="actions">
    <button class="btn sm" data-act="to">${icon("route")} Pot do sem</button>
    <button class="btn sm" data-act="from">Pot od tu</button>
    <button class="btn sm" data-act="mark">${icon("marker")} Oznaka</button>
  </div>`;
}

function wire(popup, lat, lng, name) {
  const el = popup.getElement();
  if (!el) return;
  el.addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]");
    if (c) return copyText(c.dataset.copy);
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const ll = [lat, lng];
    if (a.dataset.act === "to") emit("route-point", { which: "to", latlng: ll, label: name });
    if (a.dataset.act === "from") emit("route-point", { which: "from", latlng: ll, label: name });
    if (a.dataset.act === "mark") emit("add-marker", { latlng: ll, name });
    map.closePopup();
  });
}

export function pointPopup(latlng, { title, subtitle = "", tags = {} }) {
  const [lat, lng] = latlng;
  const rows = Object.entries(tags)
    .filter(([k]) => TAG_LABELS[k])
    .map(([k, v]) => {
      let val = esc(YES_NO[v] || v);
      if (k === "website") val = `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, ""))}</a>`;
      if (k === "wikipedia") { const [lang, t] = v.split(":"); val = `<a href="https://${esc(lang)}.wikipedia.org/wiki/${encodeURIComponent(t || "")}" target="_blank" rel="noopener">${esc(t || v)}</a>`; }
      return `<div><b>${TAG_LABELS[k]}</b><span>${val}</span></div>`;
    }).join("");
  const html = `<div class="pop"><h3>${esc(title)}</h3><div class="sub">${esc(subtitle)}</div>
    ${rows ? `<div class="tags">${rows}</div>` : ""}${coordBlock(lat, lng)}${actions(lat, lng, title)}</div>`;
  const p = L.popup({ maxWidth: 320, autoPanPadding: [40, 40] }).setLatLng(latlng).setContent(html).openOn(map);
  wire(p, lat, lng, title);
}

// Right-click "what's here": address, D96, elevation, current weather (all cached)
export async function locationInfo(latlng) {
  const [lat, lng] = latlng;
  const html = `<div class="pop"><h3 id="li-title"><span class="spinner"></span></h3><div class="sub" id="li-sub">&nbsp;</div>
    ${coordBlock(lat, lng)}
    <div class="kv" style="margin-top:8px" id="li-kv"><dt>Nadm. višina</dt><dd id="li-ele">…</dd><dt>Vreme zdaj</dt><dd id="li-wx">…</dd></div>
    ${actions(lat, lng, "")}</div>`;
  const p = L.popup({ maxWidth: 330, autoPanPadding: [40, 40] }).setLatLng(latlng).setContent(html).openOn(map);
  let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  wire(p, lat, lng, label);
  const el = p.getElement();
  const set = (id, v) => { const x = el?.querySelector("#" + id); if (x) x.innerHTML = v; };

  nominatim.reverse(lat, lng)
    .then((d) => {
      const a = d.address || {};
      const place = a.village || a.town || a.city || a.hamlet || a.suburb || a.municipality || "";
      const street = a.road || a.pedestrian || a.path || a.footway || "";
      label = d.namedetails?.name || (street ? `${street}${a.house_number ? " " + a.house_number : ""}` : place) || label;
      set("li-title", esc(label));
      set("li-sub", esc([place && place !== label ? place : "", a.municipality, a.county].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ")));
    })
    .catch(() => set("li-title", "Neznana lokacija <span class='muted small'>(brez povezave)</span>"));

  openMeteo.elevation([[lat, lng]])
    .then((d) => set("li-ele", d.elevation?.[0] != null ? `${Math.round(d.elevation[0])} m` : "—"))
    .catch(() => set("li-ele", "—"));

  openMeteo.current(lat, lng)
    .then((d) => {
      const c = d.current || {};
      set("li-wx", `${weatherEmoji(c.weather_code)} ${Math.round(c.temperature_2m)} °C · veter ${Math.round(c.wind_speed_10m)} km/h`);
    })
    .catch(() => set("li-wx", "—"));
}

function weatherEmoji(code) {
  if (code == null) return "";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}
