// Fast point layer: thousands of circle markers drawn on ONE canvas in a few batched paths.
// Replaces one L.circleMarker (+ tooltip) per point, which made the cave cadastre (13k points)
// slow to switch on and caused a ~30 ms redraw on every pan/zoom.
//
//   new PointLayer(points, { tooltip(p) → html, onClick(p) })
//   points: [{ lat, lng, r, fill, stroke, w, ...anything }]   (larger r is drawn on top)

import { getBearing, onBearing, offBearing } from "./rotate.js";

const CELL = 32;   // hit-test grid size (px)
// Emoji badges (category emoji on a round badge with a coloured rim) instead of dots, as soon as the
// view is close enough to read them; far out, thousands of points stay plain dots.
const EMOJI_MIN_ZOOM = 12;
const EMOJI_MAX_VISIBLE = 3000;
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const sprites = new Map();   // "emoji|rim|size|dpr" → canvas

function badgeSprite(emoji, rim, R, dpr, faded) {
  const key = `${emoji}|${rim}|${R}|${dpr}|${faded ? 1 : 0}`;
  let c = sprites.get(key);
  if (c) return c;
  const S = Math.ceil((R + 3) * 2);
  c = document.createElement("canvas");
  c.width = c.height = S * dpr;
  const x = c.getContext("2d");
  x.scale(dpr, dpr);
  x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 3; x.shadowOffsetY = 1;
  x.beginPath(); x.arc(S / 2, S / 2, R, 0, Math.PI * 2);
  x.fillStyle = faded ? "#e5e7eb" : "#ffffff"; x.fill();
  x.shadowColor = "transparent";
  x.lineWidth = Math.max(2, R / 5); x.strokeStyle = rim; x.stroke();
  x.globalAlpha = faded ? 0.55 : 1;
  x.font = `${Math.round(R * 1.15)}px ${EMOJI_FONT}`;
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(emoji, S / 2, S / 2 + R * 0.08);
  c._s = S;
  sprites.set(key, c);
  return c;
}

export const PointLayer = L.Layer.extend({
  options: { pane: "vectors", padding: 0.4, emojiSize: 12 },

  initialize(points, opts) {
    L.setOptions(this, opts);
    this.setPoints(points);
  },

  setPoints(points) {
    // world coordinates at zoom 0 are computed once; per frame we only scale + offset
    this._pts = points.slice().sort((a, b) => a.r - b.r);
    for (const p of this._pts) {
      const s = Math.sin(p.lat * Math.PI / 180);
      p._wx = (p.lng + 180) / 360 * 256;
      p._wy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256;
    }
    // group by style → one beginPath/fill/stroke per group
    const groups = new Map();
    for (const p of this._pts) {
      const k = `${p.fill}|${p.stroke}|${p.w}`;
      if (!groups.has(k)) groups.set(k, { fill: p.fill, stroke: p.stroke, w: p.w, pts: [] });
      groups.get(k).pts.push(p);
    }
    this._groups = [...groups.values()];
    if (this._map) this._reset();
    return this;
  },

  onAdd(map) {
    const c = this._canvas = L.DomUtil.create("canvas", "fm-points");
    c.style.pointerEvents = "none";            // events are read from the map container
    if (map.options.zoomAnimation) L.DomUtil.addClass(c, "leaflet-zoom-animated");
    this.getPane().appendChild(c);
    c.style.zIndex = String(Math.max(1, 200000 - this._pts.length));   // fewer points (e.g. fire stations) draw above dense layers (hydrants)
    this._ctx = c.getContext("2d");
    const el = map.getContainer();
    this._onMoveDom = (e) => this._hover(e);
    this._onClickDom = (e) => this._click(e);
    this._onLeave = () => this._hideTip();
    el.addEventListener("mousemove", this._onMoveDom, { passive: true });
    el.addEventListener("click", this._onClickDom, true);   // capture: a hit wins over the map's own click
    el.addEventListener("mouseleave", this._onLeave);
    this._onBearing = () => { if (this._emojiMode) this._reset(); };
    onBearing(this._onBearing);
    this._reset();
  },

  onRemove(map) {
    const el = map.getContainer();
    el.removeEventListener("mousemove", this._onMoveDom);
    el.removeEventListener("click", this._onClickDom, true);
    el.removeEventListener("mouseleave", this._onLeave);
    offBearing(this._onBearing);
    this._hideTip();
    L.DomUtil.remove(this._canvas);
    this._canvas = this._ctx = this._grid = null;
  },

  getEvents() {
    const ev = { moveend: this._reset, zoomend: this._reset, resize: this._reset, viewreset: this._reset, zoom: this._onZoom };
    if (this._map.options.zoomAnimation) ev.zoomanim = this._onZoomAnim;
    return ev;
  },

  // keep the canvas glued to the map during zoom animations / pinch (same maths as L.Renderer)
  _onZoomAnim(e) { this._transform(e.center, e.zoom); },
  _onZoom() { this._transform(this._map.getCenter(), this._map.getZoom()); },
  _transform(center, zoom) {
    if (!this._center) return;
    const map = this._map;
    const scale = map.getZoomScale(zoom, this._zoom);
    const viewHalf = map.getSize().multiplyBy(0.5 + this.options.padding);
    const off = viewHalf.multiplyBy(-scale).add(map.project(this._center, zoom)).subtract(map._getNewPixelOrigin(center, zoom));
    L.DomUtil.setTransform(this._canvas, off, scale);
  },

  _reset() {
    const map = this._map;
    if (!map || !this._canvas) return;
    const p = this.options.padding, size = map.getSize();
    const min = map.containerPointToLayerPoint(size.multiplyBy(-p)).round();
    const dim = size.multiplyBy(1 + p * 2).round();
    this._min = min;
    this._center = map.getCenter();
    this._zoom = map.getZoom();
    const dpr = window.devicePixelRatio || 1, c = this._canvas;
    L.DomUtil.setPosition(c, min);
    if (c.width !== Math.round(dim.x * dpr) || c.height !== Math.round(dim.y * dpr)) {
      c.width = Math.round(dim.x * dpr); c.height = Math.round(dim.y * dpr);
      c.style.width = dim.x + "px"; c.style.height = dim.y + "px";
    }
    this._draw(dim, dpr);
  },

  _draw(dim, dpr) {
    const ctx = this._ctx, map = this._map;
    const scale = 2 ** this._zoom;
    const org = map.getPixelOrigin();
    const ox = org.x + this._min.x, oy = org.y + this._min.y;   // world px → canvas px
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dim.x, dim.y);
    const grid = this._grid = new Map();
    const W = dim.x, H = dim.y, TAU = Math.PI * 2;
    const R = this.options.emojiSize;
    // emoji badges when close enough and not too crowded (count what's on screen first)
    this._emojiMode = false;
    if (this._zoom >= EMOJI_MIN_ZOOM && this._pts.some((p) => p.emoji)) {
      let n = 0;
      for (const pt of this._pts) {
        const x = pt._wx * scale - ox, y = pt._wy * scale - oy;
        if (x > -R && y > -R && x < W + R && y < H + R && ++n > EMOJI_MAX_VISIBLE) break;
      }
      this._emojiMode = n <= EMOJI_MAX_VISIBLE;
    }
    if (this._emojiMode) {
      const turn = -getBearing() * Math.PI / 180;   // keep the emoji upright on a rotated map
      // declutter: a badge only where it doesn't cover another badge; the rest stay small dots
      const D = R * 1.75, occ = new Map(), badges = [], dots = [];
      for (let i = this._pts.length - 1; i >= 0; i--) {   // large (important) points claim space first
        const pt = this._pts[i];
        const x = pt._wx * scale - ox, y = pt._wy * scale - oy;
        if (x < -R || y < -R || x > W + R || y > H + R) continue;
        pt._cx = x; pt._cy = y;
        const k = ((x / CELL) | 0) + "," + ((y / CELL) | 0);
        let cell = grid.get(k);
        if (!cell) grid.set(k, cell = []);
        cell.push(pt);
        const gx = Math.floor(x / D), gy = Math.floor(y / D);
        let free = true;
        for (let a = -1; a <= 1 && free; a++) for (let b = -1; b <= 1 && free; b++) {
          for (const q of occ.get((gx + a) + "," + (gy + b)) || []) if (Math.hypot(q._cx - x, q._cy - y) < D) { free = false; break; }
        }
        if (free) {
          const ok = gx + "," + gy;
          if (!occ.has(ok)) occ.set(ok, []);
          occ.get(ok).push(pt);
          pt._hr = R + 2; badges.push(pt);
        } else { pt._hr = Math.max(pt.r, 6) + 2; dots.push(pt); }
      }
      // dots underneath …
      ctx.globalAlpha = 0.95;
      for (const pt of dots) {
        const r = Math.min(pt.r, R * 0.45);
        ctx.beginPath(); ctx.arc(pt._cx, pt._cy, r, 0, TAU);
        ctx.fillStyle = pt.fill; ctx.fill();
        if (pt.w) { ctx.lineWidth = 1.2; ctx.strokeStyle = "#ffffff"; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      // … emoji badges on top (drawn small → large)
      for (let i = badges.length - 1; i >= 0; i--) {
        const pt = badges[i], spr = badgeSprite(pt.emoji || "•", pt.fill, R, dpr, pt.faded), s = spr._s;
        if (turn) { ctx.save(); ctx.translate(pt._cx, pt._cy); ctx.rotate(turn); ctx.drawImage(spr, -s / 2, -s / 2, s, s); ctx.restore(); }
        else ctx.drawImage(spr, pt._cx - s / 2, pt._cy - s / 2, s, s);
      }
      return;
    }
    for (const g of this._groups) {
      ctx.beginPath();
      let any = false;
      for (const pt of g.pts) {
        const x = pt._wx * scale - ox, y = pt._wy * scale - oy, r = pt.r;
        if (x < -r || y < -r || x > W + r || y > H + r) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
        any = true;
        pt._cx = x; pt._cy = y;
        const k = ((x / CELL) | 0) + "," + ((y / CELL) | 0);
        let cell = grid.get(k);
        if (!cell) grid.set(k, cell = []);
        cell.push(pt);
      }
      if (!any) continue;
      ctx.fillStyle = g.fill; ctx.globalAlpha = 0.95; ctx.fill();
      if (g.w) { ctx.strokeStyle = g.stroke; ctx.lineWidth = g.w; ctx.globalAlpha = 1; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  },

  // nearest point under the cursor (topmost = largest wins ties)
  _hit(e) {
    if (!this._grid || this._map._animatingZoom) return null;
    const lp = this._map.containerPointToLayerPoint(this._map.mouseEventToContainerPoint(e));   // rotation-aware
    const x = lp.x - this._min.x, y = lp.y - this._min.y;
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    let best = null, bestD = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cell = this._grid.get((cx + i) + "," + (cy + j));
      if (!cell) continue;
      for (const p of cell) {
        const d = Math.hypot(p._cx - x, p._cy - y);
        const reach = this._emojiMode ? (p._hr || this.options.emojiSize + 2) : Math.max(p.r, 6) + 2;   // small dots stay easy to hit (touch)
        if (d <= reach && d - p.r * 0.01 <= bestD) { best = p; bestD = d; }
      }
    }
    return best;
  },

  _hover(e) {
    if (e.buttons) return this._hideTip();       // dragging the map
    const now = performance.now();
    if (now - (this._lastHover || 0) < 30) return; // ~30 fps is plenty for hit-testing
    this._lastHover = now;
    const p = this._hit(e);
    if (p === this._hot) return;
    this._hot = p;
    this._map.getContainer().classList.toggle("fm-pt-hover", !!p && !this._toolActive());
    if (!p || !this.options.tooltip) return this._hideTip();
    this._tip ||= L.tooltip({ direction: "top", opacity: 1 });
    this._tip.options.offset = [0, -(this._emojiMode ? this.options.emojiSize : p.r)];
    this._tip.setLatLng([p.lat, p.lng]).setContent(this.options.tooltip(p));
    if (!this._map.hasLayer(this._tip)) this._map.openTooltip(this._tip);
  },

  _toolActive() { return this._map.getContainer().style.cursor === "crosshair"; },

  _hideTip() {
    this._hot = null;
    this._map?.getContainer().classList.remove("fm-pt-hover");
    if (this._tip && this._map?.hasLayer(this._tip)) this._map.closeTooltip(this._tip);
  },

  _click(e) {
    if (!this.options.onClick || this._map.dragging?.moved()) return;
    if (e.target.closest(".leaflet-control, .leaflet-popup, .leaflet-tooltip, .fab-col, .tool-actions, button, input")) return;
    if (this._toolActive()) return;   // drawing / measuring / picking: the tool gets the click
    const p = this._hit(e);
    if (!p) return;
    e.stopPropagation();
    this._hideTip();
    this.options.onClick(p);
  },
});
