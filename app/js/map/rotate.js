// Map rotation ("camera" turned around the compass axis, 0–360°) without a rotation library.
//
// How it works: when the bearing is not 0 the map element is enlarged to the viewport diagonal
// (so the corners stay covered), centred, and turned with a CSS rotate(). Leaflet itself keeps
// working in its own un-rotated frame; we only translate the pointer into that frame:
//   • L.DomEvent.getMousePosition → every click / hover / wheel / pinch lands on the right spot
//   • L.Draggable._onMove        → dragging the map or a marker moves the way the finger moves
// Things that must stay readable (pins, emoji markers, labels, popups, tooltips) are turned back
// with CSS (class fm-rotated + --fm-neg). Wind arrows and plane icons turn with the map on purpose.
//
// Input: compass button (click → north / phone compass), Q / E keys, two-finger twist on touch.
import { map } from "./map.js";
import { state, saveSettings } from "../runtime/state.js";
import { toast } from "../shared/util.js";

let bearing = 0;            // degrees, clockwise, 0 = north up
let el = null, wrap = null, enlarged = false;
let following = false, orientHandler = null, gotOrientation = false;
const listeners = new Set();

export const getBearing = () => bearing;
export const isFollowingCompass = () => following;
export const onBearing = (fn) => listeners.add(fn);
export const offBearing = (fn) => listeners.delete(fn);
const norm = (d) => ((d % 360) + 360) % 360;
const comparing = () => !document.getElementById("compare-slider")?.classList.contains("hidden");

/** Turn a screen-space vector (dx, dy) into the map's own frame. */
export function screenToMap(dx, dy) {
  if (!bearing) return [dx, dy];
  const a = bearing * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [c * dx + s * dy, -s * dx + c * dy];
}

function layout() {
  if (!el) return;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (bearing) {
    const d = Math.ceil(Math.hypot(w, h)) + 2;
    Object.assign(el.style, { inset: "auto", width: d + "px", height: d + "px", left: (w - d) / 2 + "px", top: (h - d) / 2 + "px" });
  } else {
    Object.assign(el.style, { inset: "", width: "", height: "", left: "", top: "" });
  }
}

function applyTransform() {
  el.style.transform = bearing ? `rotate(${bearing}deg)` : "";
  el.style.setProperty("--fm-neg", `${-bearing}deg`);
  el.classList.toggle("fm-rotated", !!bearing);
  listeners.forEach((fn) => fn(bearing));
}

/** Set the map bearing in degrees (clockwise). */
export function setBearing(deg, { save = true } = {}) {
  if (!el) return;
  let b = norm(deg);
  if (b > 359.5 || b < 0.5) b = 0;
  const need = !!b;
  bearing = b;
  if (need !== enlarged) {           // switching between normal and rotated layout: keep the centre
    const c = map.getCenter(), z = map.getZoom();
    enlarged = need;
    layout();
    map.invalidateSize({ pan: false });
    map.setView(c, z, { animate: false });
  }
  applyTransform();
  if (save) {
    state.settings.view = { ...(state.settings.view || {}), bearing: Math.round(b * 10) / 10 };
    saveSettings();
  }
}

export function rotateBy(delta) {
  if (comparing()) return;
  if (following) stopFollowing();
  setBearing(bearing + delta);
}

// smooth turn back to north
export function resetNorth() {
  if (!bearing) return;
  const start = bearing > 180 ? bearing - 360 : bearing, t0 = performance.now(), dur = 350;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    setBearing(start * (1 - e), { save: k === 1 });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── phone compass: the map turns so that "up" is the direction the phone points ──
export function toggleCompassFollow() {
  if (following) { stopFollowing(); resetNorth(); return; }
  if (comparing()) return;
  following = true;
  gotOrientation = false;
  let smooth = null;
  orientHandler = (e) => {
    let heading = null;
    if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;            // iOS
    else if (e.absolute !== false && typeof e.alpha === "number") heading = 360 - e.alpha;       // Android / Chromium
    if (heading == null) return;
    gotOrientation = true;
    if (smooth == null) smooth = heading;
    let d = heading - smooth;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    smooth = norm(smooth + d * 0.25);                                                             // low-pass against jitter
    setBearing(-smooth, { save: false });
  };
  window.addEventListener("deviceorientationabsolute", orientHandler);
  window.addEventListener("deviceorientation", orientHandler);
  listeners.forEach((fn) => fn(bearing));
  toast("Karta sledi kompasu naprave. Ponoven klik vrne sever.", "", 2500);
  setTimeout(() => {
    if (following && !gotOrientation) { stopFollowing(); toast("Ta naprava nima kompasa. Zasukaj s tipkama Q / E ali z dvema prstoma.", "", 4000); }
  }, 1800);
}

function stopFollowing() {
  following = false;
  if (orientHandler) {
    window.removeEventListener("deviceorientationabsolute", orientHandler);
    window.removeEventListener("deviceorientation", orientHandler);
    orientHandler = null;
  }
  listeners.forEach((fn) => fn(bearing));
}

// ── pointer translation (the only Leaflet internals we touch) ──
function patchLeaflet() {
  // every Leaflet handler (clicks, hover, wheel, pinch, box zoom) asks the map for this
  const origPos = L.Map.prototype.mouseEventToContainerPoint;
  L.Map.prototype.mouseEventToContainerPoint = function (e) {
    if (!bearing || this !== map) return origPos.call(this, e);
    const r = wrap.getBoundingClientRect();
    const [x, y] = screenToMap(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    return new L.Point(el.offsetWidth / 2 + x, el.offsetHeight / 2 + y);
  };

  const origMove = L.Draggable.prototype._onMove;
  L.Draggable.prototype._onMove = function (e) {
    if (!bearing || !el.contains(this._element) || (e.touches && e.touches.length > 1) || !this._startPoint) return origMove.call(this, e);
    const f = e.touches && e.touches.length === 1 ? e.touches[0] : e;
    const s = this._startPoint;
    const [dx, dy] = screenToMap(f.clientX - s.x, f.clientY - s.y);
    this._parentScale = { x: 1, y: 1 };     // the rotated parent's bounding box would distort the scale
    return origMove.call(this, {
      clientX: s.x + dx, clientY: s.y + dy, type: e.type, target: e.target, srcElement: e.srcElement,
      preventDefault: () => e.preventDefault?.(), stopPropagation: () => e.stopPropagation?.(),
    });
  };

  // tooltips: content in its own box so it can be turned upright while the map is rotated
  const origContent = L.Tooltip.prototype._updateContent;
  L.Tooltip.prototype._updateContent = function () {
    origContent.call(this);
    const c = this._contentNode;
    if (!c || (c.childNodes.length === 1 && c.firstElementChild?.classList.contains("tt-in"))) return;
    const inner = document.createElement("div");
    inner.className = "tt-in";
    while (c.firstChild) inner.appendChild(c.firstChild);
    c.appendChild(inner);
  };
}

// two-finger twist on touch screens
function installTouchRotate() {
  let start = null;
  const angle = (t) => Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX) * 180 / Math.PI;
  el.addEventListener("touchstart", (e) => {
    start = e.touches.length === 2 && !comparing() ? { a: angle(e.touches), b: bearing, active: false } : null;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!start || e.touches.length !== 2) return;
    let d = angle(e.touches) - start.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    if (!start.active && Math.abs(d) < 12) return;     // small twists during a pinch-zoom don't rotate
    if (!start.active) { start.active = true; start.a += Math.sign(d) * 12; d -= Math.sign(d) * 12; if (following) stopFollowing(); }
    setBearing(start.b + d, { save: false });
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (start?.active && e.touches.length < 2) setBearing(bearing);   // save
    if (e.touches.length < 2) start = null;
  }, { passive: true });
}

export function initRotate() {
  el = map.getContainer();
  wrap = el.parentElement;
  patchLeaflet();
  // Leaflet's controls (scale bar, attribution) live outside the turning element so they stay put
  const host = document.createElement("div");
  host.className = "leaflet-container fm-ctrl-host";
  host.appendChild(map._controlContainer);
  wrap.appendChild(host);
  new ResizeObserver(() => { if (enlarged) layout(); }).observe(wrap);
  installTouchRotate();
  const saved = +state.settings.view?.bearing || 0;
  if (saved) setBearing(saved, { save: false });
  else applyTransform();
}
