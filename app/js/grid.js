// "Mreža 1 × 1 km (D96/TM)": black grid of the Slovenian national coordinate system — the same
// 1 km tiles as LIDAR / DOF blocks (named after the lower-left corner in km, e.g. 462_101).
// Drawn per map tile on canvas, so it stays sharp and exactly aligned at any zoom.
//   zoom ≥ 11: every 1 km line (10 km lines thicker)   zoom 8–10: 10 km lines only
//   zoom ≥ 13: cell labels  E_N (km)
import { toD96, fromD96 } from "./util.js";

const TILE = 256;

const GridD96 = L.GridLayer.extend({
  options: { pane: "overlays", minZoom: 8, maxZoom: 22, tileSize: TILE, updateWhenZooming: false, zIndex: 400, color: "#000000" },

  createTile(coords) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement("canvas");
    cv.width = cv.height = TILE * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const map = this._map, z = coords.z;
    const origin = coords.scaleBy(L.point(TILE, TILE));
    const toPx = (e, n) => { const [lat, lng] = fromD96(e, n); return map.project([lat, lng], z).subtract(origin); };

    // D96 extent of this tile (+ margin so lines enter/leave cleanly)
    const corners = [[0, 0], [TILE, 0], [0, TILE], [TILE, TILE]]
      .map(([dx, dy]) => map.unproject(origin.add([dx, dy]), z))
      .map((ll) => toD96(ll.lat, ll.lng));
    const minE = Math.min(...corners.map((c) => c.e)), maxE = Math.max(...corners.map((c) => c.e));
    const minN = Math.min(...corners.map((c) => c.n)), maxN = Math.max(...corners.map((c) => c.n));

    const fine = z >= 11;
    const step = fine ? 1000 : 10000;
    const lines = [];
    for (let e = Math.ceil(minE / step) * step; e <= maxE; e += step) {
      lines.push([toPx(e, minN - step), toPx(e, maxN + step), e % 10000 === 0]);
    }
    for (let n = Math.ceil(minN / step) * step; n <= maxN; n += step) {
      lines.push([toPx(minE - step, n), toPx(maxE + step, n), n % 10000 === 0]);
    }
    const stroke = (width, color, alpha) => {
      ctx.strokeStyle = color; ctx.globalAlpha = alpha;
      for (const [a, b, major] of lines) {
        ctx.lineWidth = width + (major && fine ? 1.2 : 0);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    };
    stroke(3, "#ffffff", 0.45);              // light halo: visible on dark orthophoto too
    stroke(1, this.options.color, 0.95);

    // cell labels (lower-left corner in km, like LIDAR / DOF tile names)
    if (z >= 13) {
      ctx.globalAlpha = 1;
      ctx.font = `600 ${z >= 15 ? 13 : 11}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (let e = Math.floor(minE / 1000) * 1000; e <= maxE; e += 1000) {
        for (let n = Math.floor(minN / 1000) * 1000; n <= maxN; n += 1000) {
          const c = toPx(e + 500, n + 500);
          // draw every label that reaches into this tile — the canvas clips it, so a label crossing a
          // tile edge is completed by the neighbouring tile instead of being cut off
          if (c.x < -50 || c.y < -12 || c.x >= TILE + 50 || c.y >= TILE + 12) continue;
          const label = `${e / 1000}_${n / 1000}`;
          ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.strokeText(label, c.x, c.y);
          ctx.fillStyle = this.options.color; ctx.fillText(label, c.x, c.y);
        }
      }
    }
    return cv;
  },
});

export function createGridLayer(cfg, opacity) {
  return new GridD96({ opacity, attribution: "Mreža D96/TM" });
}

// D96/TM 1 km cell under a point → { id: "462_101", e, n } (lower-left corner in metres)
export function d96Cell(lat, lng) {
  const { e, n } = toD96(lat, lng);
  const e0 = Math.floor(e / 1000) * 1000, n0 = Math.floor(n / 1000) * 1000;
  return { id: `${e0 / 1000}_${n0 / 1000}`, e: e0, n: n0 };
}
