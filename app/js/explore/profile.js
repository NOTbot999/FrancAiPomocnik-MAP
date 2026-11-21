// Elevation profile drawer (canvas chart, hover syncs a marker on the map)
import { map } from "../map/map.js";
import { openMeteo } from "../services/external.js";
import { haversine, fmtDist, $, toast } from "../shared/util.js";

let data = null;     // { pts: [[lat,lng,ele]], dist: [m] }
let hoverMarker = null;

export async function sampleElevations(pts, maxSamples = 200) {
  // resample along the line to <= maxSamples points, then query Open-Meteo (100 per request)
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const n = Math.min(maxSamples, Math.max(2, Math.ceil(total / 20)));
  const samples = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = total * k / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1, t = Math.min(1, Math.max(0, (d - cum[j]) / seg));
    samples.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  const out = [];
  for (let i = 0; i < samples.length; i += 100) {
    const chunk = samples.slice(i, i + 100);
    const res = await openMeteo.elevation(chunk);
    chunk.forEach((p, k) => out.push([p[0], p[1], res.elevation?.[k] ?? null]));
  }
  return out;
}

export function elevationStats(pts) {
  let up = 0, down = 0, min = Infinity, max = -Infinity, last = null;
  for (const p of pts) {
    const e = p[2];
    if (e == null) continue;
    min = Math.min(min, e); max = Math.max(max, e);
    if (last != null) {
      const d = e - last;
      // 10 m hysteresis filters DEM noise (similar to BRouter "filtered ascend")
      if (Math.abs(d) >= 10) { if (d > 0) up += d; else down -= d; last = e; }
    } else last = e;
  }
  return { up, down, min: isFinite(min) ? min : null, max: isFinite(max) ? max : null };
}

export async function showProfile(title, pts, color = "#0d9488") {
  const box = $("#profile");
  box.classList.remove("hidden");
  $("#profile-title").textContent = title;
  $("#profile-stats").innerHTML = '<span class="spinner"></span> Nalagam višine…';
  try {
    if (!pts.some((p) => p[2] != null)) pts = await sampleElevations(pts);
  } catch (e) {
    $("#profile-stats").textContent = "Višine niso na voljo (ni povezave?)";
    return;
  }
  const dist = [0];
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + haversine(pts[i - 1], pts[i]));
  data = { pts, dist, color };
  const st = elevationStats(pts);
  $("#profile-stats").innerHTML = `Dolžina <b>${fmtDist(dist[dist.length - 1])}</b> · ↗ <b>${Math.round(st.up)} m</b> · ↘ <b>${Math.round(st.down)} m</b> · min <b>${Math.round(st.min)} m</b> · max <b>${Math.round(st.max)} m</b>`;
  draw();
}

export function hideProfile() {
  $("#profile").classList.add("hidden");
  data = null;
  if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; }
}

function draw(hoverX = null) {
  const cv = $("#profile-canvas");
  if (!data || !cv.offsetWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.offsetWidth, H = cv.offsetHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const textC = css.getPropertyValue("--text-3"), gridC = css.getPropertyValue("--border");
  const pad = { l: 44, r: 10, t: 8, b: 20 };
  const els = data.pts.map((p) => p[2] ?? 0);
  let min = Math.min(...els), max = Math.max(...els);
  const span = Math.max(20, max - min);
  min = Math.floor((min - span * 0.08) / 10) * 10; max = Math.ceil((max + span * 0.08) / 10) * 10;
  const total = data.dist[data.dist.length - 1] || 1;
  const X = (d) => pad.l + (d / total) * (W - pad.l - pad.r);
  const Y = (e) => pad.t + (1 - (e - min) / (max - min)) * (H - pad.t - pad.b);

  ctx.font = "10.5px Segoe UI, sans-serif";
  ctx.fillStyle = textC; ctx.strokeStyle = gridC; ctx.lineWidth = 1;
  const step = niceStep((max - min) / 4);
  for (let e = Math.ceil(min / step) * step; e <= max; e += step) {
    ctx.beginPath(); ctx.moveTo(pad.l, Y(e) + .5); ctx.lineTo(W - pad.r, Y(e) + .5); ctx.stroke();
    ctx.fillText(`${e} m`, 4, Y(e) + 4);
  }
  const dStep = niceStep(total / 6);
  for (let d = 0; d <= total; d += dStep) ctx.fillText(fmtDist(d), X(d) - 10, H - 5);

  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, data.color + "88"); grad.addColorStop(1, data.color + "08");
  ctx.beginPath();
  ctx.moveTo(X(0), Y(els[0]));
  els.forEach((e, i) => ctx.lineTo(X(data.dist[i]), Y(e)));
  ctx.lineTo(X(total), H - pad.b); ctx.lineTo(X(0), H - pad.b); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  els.forEach((e, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(data.dist[i]), Y(e)));
  ctx.strokeStyle = data.color; ctx.lineWidth = 2; ctx.stroke();

  if (hoverX != null) {
    const d = ((hoverX - pad.l) / (W - pad.l - pad.r)) * total;
    let i = data.dist.findIndex((x) => x >= d);
    if (i < 0) i = data.dist.length - 1;
    const p = data.pts[i];
    ctx.strokeStyle = textC; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(data.dist[i]), pad.t); ctx.lineTo(X(data.dist[i]), H - pad.b); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = data.color; ctx.beginPath(); ctx.arc(X(data.dist[i]), Y(els[i]), 4, 0, 7); ctx.fill();
    const label = `${fmtDist(data.dist[i])} · ${Math.round(els[i])} m`;
    const tw = ctx.measureText(label).width + 12, tx = Math.min(W - tw - 4, X(data.dist[i]) + 8);
    ctx.fillStyle = "rgba(15,23,42,.85)"; ctx.fillRect(tx, pad.t, tw, 18);
    ctx.fillStyle = "#fff"; ctx.fillText(label, tx + 6, pad.t + 13);
    hoverMarker ||= L.marker(p, { icon: L.divIcon({ className: "", html: '<div class="hover-dot"></div>', iconSize: [14, 14] }), pane: "top", interactive: false }).addTo(map);
    hoverMarker.setLatLng([p[0], p[1]]);
  }
}

function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(x || 1)), n = x / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

export function initProfile() {
  const cv = $("#profile-canvas");
  cv.addEventListener("mousemove", (e) => draw(e.offsetX));
  cv.addEventListener("mouseleave", () => { draw(); if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; } });
  cv.addEventListener("click", (e) => {
    if (!data) return;
    const W = cv.offsetWidth, total = data.dist[data.dist.length - 1];
    const d = ((e.offsetX - 44) / (W - 54)) * total;
    const i = Math.max(0, data.dist.findIndex((x) => x >= d));
    map.panTo([data.pts[i][0], data.pts[i][1]]);
  });
  $("#profile-close").onclick = hideProfile;
  new ResizeObserver(() => draw()).observe(cv);
}
