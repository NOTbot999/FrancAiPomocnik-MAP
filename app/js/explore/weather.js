// Weather overlays that need no API key (they replace the original app's OpenWeatherMap layers,
// whose key no longer works):
//   weather  — temperature / wind / cloud cover over Slovenia from Open-Meteo (a coarse grid,
//              interpolated into a smooth image; wind as arrows)
//   rainviewer — precipitation radar and infrared satellite clouds from RainViewer (tiles)
import { openMeteo, rainviewer as radar } from "../services/external.js";
import { esc, toast } from "../shared/util.js";

// ── Open-Meteo grid (one request shared by all weather layers, cached 30 min) ──
const G = { s: 45.3, n: 46.9, w: 13.3, e: 16.7, rows: 9, cols: 12 };
const REFRESH_MS = 30 * 60 * 1000;
let gridCache = null;   // { at, promise }

function gridPoints() {
  const pts = [];
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
    pts.push([+(G.s + (G.n - G.s) * r / (G.rows - 1)).toFixed(3), +(G.w + (G.e - G.w) * c / (G.cols - 1)).toFixed(3)]);
  }
  return pts;
}

function loadGrid() {
  if (gridCache && Date.now() - gridCache.at < REFRESH_MS) return gridCache.promise;
  const pts = gridPoints();
  const promise = openMeteo.currentGrid(pts).then((res) => {
    const list = Array.isArray(res) ? res : [res];
    if (list.length !== pts.length) throw new Error("nepopolni podatki");
    return {
      time: list[0].current?.time || "",
      cells: list.map((r, i) => ({ lat: pts[i][0], lng: pts[i][1], ...r.current })),
    };
  });
  gridCache = { at: Date.now(), promise };
  promise.catch(() => { gridCache = null; });
  return promise;
}

// bilinear value of `key` at (lat, lng) inside the grid
function sample(cells, key, lat, lng) {
  const fr = Math.min(G.rows - 1.0001, Math.max(0, (lat - G.s) / (G.n - G.s) * (G.rows - 1)));
  const fc = Math.min(G.cols - 1.0001, Math.max(0, (lng - G.w) / (G.e - G.w) * (G.cols - 1)));
  const r0 = Math.floor(fr), c0 = Math.floor(fc), dr = fr - r0, dc = fc - c0;
  const v = (r, c) => cells[r * G.cols + c][key];
  return (v(r0, c0) * (1 - dc) + v(r0, c0 + 1) * dc) * (1 - dr) + (v(r0 + 1, c0) * (1 - dc) + v(r0 + 1, c0 + 1) * dc) * dr;
}

// smooth field → image overlay; canvas rows are spaced in web-mercator so the image lines up with the map
function fieldImage(cells, key, color) {
  const W = 220, H = 160;
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const ys = merc(G.s), yn = merc(G.n);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(W, H);
  for (let py = 0; py < H; py++) {
    const y = yn - (py + 0.5) / H * (yn - ys);
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
    for (let px = 0; px < W; px++) {
      const lng = G.w + (px + 0.5) / W * (G.e - G.w);
      const [r, g, b, a] = color(sample(cells, key, lat, lng));
      // fade out towards the edges of the data area instead of a hard rectangle
      const edge = Math.min(1, Math.min(px, W - 1 - px) / (W * 0.07), Math.min(py, H - 1 - py) / (H * 0.07));
      const o = (py * W + px) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = Math.round(a * edge);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

const TEMP_STOPS = [[-20, [91, 33, 182]], [-10, [37, 99, 235]], [0, [56, 189, 248]], [8, [52, 211, 153]],
  [15, [163, 230, 53]], [22, [250, 204, 21]], [28, [249, 115, 22]], [35, [220, 38, 38]], [42, [127, 29, 29]]];
function tempColor(t) {
  if (t <= TEMP_STOPS[0][0]) return [...TEMP_STOPS[0][1], 190];
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = TEMP_STOPS[i - 1], f = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)).concat(190);
    }
  }
  return [...TEMP_STOPS.at(-1)[1], 190];
}
const cloudColor = (c) => [236, 241, 247, Math.round(Math.max(0, Math.min(100, c)) / 100 * 215)];

const DIRS = ["S", "SV", "V", "JV", "J", "JZ", "Z", "SZ"];
const dirName = (deg) => DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
function windColor(kmh) {
  return kmh < 10 ? "#22c55e" : kmh < 20 ? "#84cc16" : kmh < 30 ? "#eab308" : kmh < 45 ? "#f97316" : kmh < 65 ? "#dc2626" : "#7e22ce";
}
const fmtTime = (iso) => (iso ? iso.replace("T", " ob ").replace(/^(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${+d}. ${+m}. ${y}`) : "");

function gridLayer(kind, opacity) {
  const g = L.layerGroup();
  let op = opacity, timer = null, image = null;
  const marks = [];

  async function refresh() {
    let data;
    try { data = await loadGrid(); } catch (e) {
      toast(`Vreme (Open-Meteo): podatki trenutno niso na voljo (${e.message})`, "err", 4000);
      return;
    }
    g.clearLayers(); marks.length = 0; image = null;
    const when = fmtTime(data.time);
    if (kind === "temp" || kind === "clouds") {
      const url = fieldImage(data.cells, kind === "temp" ? "temperature_2m" : "cloud_cover", kind === "temp" ? tempColor : cloudColor);
      image = L.imageOverlay(url, [[G.s, G.w], [G.n, G.e]], { opacity: op, pane: "overlays", interactive: false, className: "wx-field" }).addTo(g);
    }
    data.cells.forEach((c, i) => {
      const row = Math.floor(i / G.cols), col = i % G.cols;
      if (kind === "temp" && (row + col) % 2) return;            // thin out the labels
      if (kind === "clouds" && ((row % 2) || (col % 2))) return;
      let html, tip;
      if (kind === "wind") {
        const col2 = windColor(c.wind_speed_10m);
        html = `<svg class="wx-arrow" width="26" height="26" viewBox="0 0 24 24" style="transform:rotate(${c.wind_direction_10m + 180}deg)"><path d="M12 3 7 11h3.5v10h3V11H17Z" fill="${col2}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
        tip = `<b>💨 ${Math.round(c.wind_speed_10m)} km/h</b><br>iz smeri ${dirName(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m)}°)`;
      } else if (kind === "temp") {
        html = `<div class="wx-label">${Math.round(c.temperature_2m)}°</div>`;
        tip = `<b>🌡️ ${c.temperature_2m.toFixed(1)} °C</b>`;
      } else {
        html = `<div class="wx-label cloud">${Math.round(c.cloud_cover)}%</div>`;
        tip = `<b>☁️ oblačnost ${Math.round(c.cloud_cover)} %</b>`;
      }
      const m = L.marker([c.lat, c.lng], {
        pane: "top", opacity: Math.max(op, 0.6), keyboard: false,
        icon: L.divIcon({ html, className: "", iconSize: kind === "wind" ? [26, 26] : [40, 18], iconAnchor: kind === "wind" ? [13, 13] : [20, 9] }),
      }).bindTooltip(`${tip}<br><span class="muted">Open-Meteo · ${esc(when)}</span>`, { direction: "top", offset: [0, -8] });
      marks.push(m);
      g.addLayer(m);
    });
  }

  g.on("add", () => { refresh(); timer = setInterval(refresh, REFRESH_MS); });
  g.on("remove", () => clearInterval(timer));
  g.setOpacity = (v) => { op = v; image?.setOpacity(v); marks.forEach((m) => m.setOpacity(Math.max(v, 0.6))); };
  return g;
}

// ── RainViewer: radar (precipitation) or infrared satellite (clouds) tiles ──
function rainviewer(kind, opacity) {
  const g = L.layerGroup();
  let op = opacity, tiles = null, timer = null;
  async function refresh() {
    try {
      const j = await radar.maps();
      const frame = (kind === "satellite" ? j.satellite?.infrared : j.radar?.past)?.at(-1);
      if (!frame) throw new Error("ni posnetka");
      const url = kind === "satellite"
        ? `${j.host}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`
        : `${j.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      const when = new Date(frame.time * 1000).toLocaleString("sl-SI", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });
      const next = L.tileLayer(url, {
        opacity: op, pane: "overlays", maxZoom: 20, maxNativeZoom: 7, zIndex: 50,
        attribution: `<a href="https://www.rainviewer.com" target="_blank">RainViewer</a> (${esc(when)})`,
      });
      g.addLayer(next);
      if (tiles) { const old = tiles; setTimeout(() => g.removeLayer(old), 1500); }   // swap without flicker
      tiles = next;
    } catch (e) {
      toast(`RainViewer: podatki trenutno niso na voljo (${e.message})`, "err", 4000);
    }
  }
  g.on("add", () => { refresh(); timer = setInterval(refresh, 10 * 60 * 1000); });
  g.on("remove", () => clearInterval(timer));
  g.setOpacity = (v) => { op = v; tiles?.setOpacity(v); };
  return g;
}

export function createWeatherLayer(cfg, opacity) {
  if (cfg.type === "rainviewer") return rainviewer(cfg.kind, opacity);
  return gridLayer(cfg.kind, opacity);
}
