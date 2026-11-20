// Special vector overlays: 3. razvojna os (3RO) and live flights (ADS-B via adsb.lol)
import { overpass, fetchJSON } from "./api.js";
import { esc, toast } from "./util.js";

const emojiIcon = (emoji, size = 18) => L.divIcon({
  html: `<div class="emoji-marker" style="font-size:${size}px">${emoji}</div>`,
  className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

export function createSpecialLayer(cfg, opacity) {
  if (cfg.type === "third_dev_axis") return thirdDevAxis(opacity);
  if (cfg.type === "live_flights") return flights(opacity);
  return L.layerGroup();
}

// ───────────── 3RO ─────────────
const NORTH_ODSEK1 = [[46.270, 15.030], [46.285, 15.045], [46.305, 15.065], [46.325, 15.085], [46.340, 15.095]];
const SOUTH_ODSEK1 = [[45.803, 15.168], [45.790, 15.180], [45.775, 15.195], [45.760, 15.210], [45.745, 15.225], [45.730, 15.240], [45.710, 15.265], [45.695, 15.280], [45.685, 15.290]];
const SOUTH_ODSEK2 = [[45.685, 15.290], [45.660, 15.280], [45.620, 15.250], [45.585, 15.215], [45.560, 15.195], [45.555, 15.190], [45.500, 15.190], [45.440, 15.185], [45.390, 15.180], [45.350, 15.175]];
const STRUCTURES = [
  [[46.38, 15.09], "🚇", "Predor H8 (1/6)"], [[46.42, 15.09], "🚇", "Predor H8 (2/6)"], [[46.45, 15.09], "🚇", "Predor H8 (3/6)"],
  [[46.40, 15.09], "🌉", "Vijadukt H8 (1/26)"], [[46.43, 15.10], "🌉", "Vijadukt H8 (2/26)"], [[46.48, 15.10], "🌉", "Vijadukt H8 (3/26)"],
  [[45.720, 15.252], "🚇", "Predor Gorjanci (2341 m)"], [[45.785, 15.185], "🌉", "Most čez Krko"],
  [[45.740, 15.225], "🌉", "Viadukt Gorjanci (vhod)"], [[45.600, 15.220], "🌉", "Most pri Metliki"],
];
const JUNCTIONS = [
  [[46.270, 15.030], "Šentrupert (A1)"], [[46.340, 15.095], "Velenje jug"], [[46.505, 15.090], "Slovenj Gradec jug"],
  [[45.803, 15.168], "Novo mesto (A2)"], [[45.745, 15.225], "Osredek"], [[45.685, 15.290], "Maline"],
  [[45.560, 15.195], "Metlika sever"], [[45.555, 15.190], "MMP Metlika"], [[45.350, 15.175], "Črnomelj jug"],
];
const SECTIONS = [
  [[46.40, 15.09], "🚧", "SEVERNI KRAK — Odsek 2", "Velenje → Slovenj Gradec (17,5 km, v gradnji)"],
  [[46.30, 15.06], "📐", "SEVERNI KRAK — Odsek 1", "Šentrupert → Velenje (14 km, v načrtovanju)"],
  [[45.745, 15.225], "🚧", "JUŽNI KRAK — Odsek 1", "Novo mesto → Maline (17,9 km, v načrtovanju)"],
  [[45.480, 15.190], "📐", "JUŽNI KRAK — Odsek 2", "Maline → Metlika → Črnomelj (26,7 km, v načrtovanju)"],
];
const H8_QUERY = `[out:json][timeout:25];
(
  way["highway"="construction"]["construction"="trunk"]["opening_date"="2029"](45.0,13.0,47.0,17.0);
  way["name"="H8"]["highway"="construction"](45.0,13.0,47.0,17.0);
);
out geom;`;

function thirdDevAxis(opacity) {
  const g = L.featureGroup();
  const lines = L.featureGroup().addTo(g);
  const pane = "vectors";
  const draw = (pts, color, weight, dash) => {
    L.polyline(pts, { pane, color: "#fff", weight: weight + 3, opacity: 0.35, lineCap: "round" }).addTo(lines);
    L.polyline(pts, { pane, color, weight, dashArray: dash, lineCap: "round" }).addTo(lines);
  };
  draw(NORTH_ODSEK1, "#f87171", 3, "6,8");
  draw(SOUTH_ODSEK1, "#7c3aed", 3.5, "8,6");
  draw(SOUTH_ODSEK2, "#a78bfa", 3, "6,8");
  for (const [pos, em, name] of STRUCTURES) L.marker(pos, { icon: emojiIcon(em, 17), pane: "top" }).bindTooltip(name, { direction: "top", offset: [0, -8] }).addTo(g);
  for (const [pos, name] of JUNCTIONS) L.marker(pos, { icon: emojiIcon("🚏", 14), pane: "top" }).bindTooltip(name, { direction: "top", offset: [0, -6] }).addTo(g);
  for (const [pos, em, t, d] of SECTIONS) L.marker(pos, { icon: emojiIcon(em, 20), pane: "top" }).bindTooltip(`<b>${t}</b><br><span class="muted">${d}</span>`, { direction: "top", offset: [0, -10] }).addTo(g);

  overpass(H8_QUERY, 14 * 86400).then((json) => {
    const ways = (json.elements || []).filter((e) => e.type === "way" && e.geometry);
    for (const w of ways) draw(w.geometry.map((p) => [p.lat, p.lon]), "#dc2626", 4.5);
  }).catch(() => toast("3RO: odsek H8 iz OSM ni dosegljiv — prikazana je načrtovana trasa", "", 4000));

  g.setOpacity = (v) => lines.eachLayer((l) => l.setStyle({ opacity: v }));
  g.setOpacity(opacity);
  return g;
}

// ───────────── Flights ─────────────
const SLO = { lamin: 45.0, lomin: 12.8, lamax: 47.0, lomax: 17.2 };

function planeIcon(heading, onGround) {
  const color = onGround ? "#94a3b8" : "#2563eb";
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45);display:grid;place-items:center">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" style="transform:rotate(${heading || 0}deg)"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z"/></svg></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  });
}

function flights(opacity) {
  const g = L.layerGroup();
  const markers = new Map();
  let timer = null;
  let op = opacity;

  async function refresh() {
    try {
      const data = await fetchJSON("https://api.adsb.lol/v2/lat/46.15/lon/14.99/dist/200", 45);
      const seen = new Set();
      for (const a of data.ac || []) {
        if (a.lat == null || a.lon == null || a.lat < SLO.lamin || a.lat > SLO.lamax || a.lon < SLO.lomin || a.lon > SLO.lomax) continue;
        const id = a.hex;
        seen.add(id);
        const onGround = a.alt_baro === "ground" || a.alt_baro == null;
        const alt = onGround ? 0 : Math.round(a.alt_baro * 0.3048);
        const spd = a.gs != null ? Math.round(a.gs * 1.852) : null;
        const cs = (a.flight || "").trim() || id;
        const tip = `<b>✈️ ${esc(cs)}</b><br>${a.t ? esc(a.t) + " · " : ""}${a.r ? esc(a.r) : ""}<br>Višina: ${onGround ? "na tleh" : alt.toLocaleString("sl-SI") + " m"}${spd != null ? "<br>Hitrost: " + spd + " km/h" : ""}`;
        let m = markers.get(id);
        if (m) {
          m.setLatLng([a.lat, a.lon]).setIcon(planeIcon(a.track, onGround)).setTooltipContent(tip);
        } else {
          m = L.marker([a.lat, a.lon], { icon: planeIcon(a.track, onGround), pane: "top", opacity: op }).bindTooltip(tip, { direction: "top", offset: [0, -10] });
          markers.set(id, m);
          g.addLayer(m);
        }
      }
      for (const [id, m] of markers) if (!seen.has(id)) { g.removeLayer(m); markers.delete(id); }
    } catch (e) {
      toast("Leti: podatki trenutno niso na voljo", "err");
    }
  }

  g.on("add", () => { refresh(); timer = setInterval(refresh, 60000); });
  g.on("remove", () => { clearInterval(timer); });
  g.setOpacity = (v) => { op = v; markers.forEach((m) => m.setOpacity(v)); };
  return g;
}
