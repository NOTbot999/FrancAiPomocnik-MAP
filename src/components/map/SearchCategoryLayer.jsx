import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getMarkerSize, resolveEmoji, SETTINGS_EVENT } from "@/lib/searchCatSettings";

/**
 * Renders point features as emoji glyphs on a single canvas overlay pane.
 * Performant for thousands of points (one canvas, drawn via fillText).
 * Non-point features (LineString/Polygon) are ignored — handled elsewhere.
 * Supports hover tooltips via proximity hit-testing.
 *
 * Performance notes:
 *  - On each `draw()` we cache the screen-space container points for all
 *    features so the mousemove hit-test runs in pure screen space (no
 *    per-event latLngToContainerPoint projection) and can cheaply cull
 *    off-screen points.
 *  - mousemove is throttled (~60ms) and uses the cached points, keeping the
 *    hover loop O(visible) even for layers with tens of thousands of markers.
 */
const DEFAULT_EMOJI = "📍";

export default function SearchCategoryLayer({ layer }) {
  const map = useMap();
  const tooltipRef = useRef(null);
  const pointsRef = useRef([]);       // lat/lng/label features
  const screenRef = useRef([]);      // cached {x,y,label,lat,lng} for current view
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    if (!layer || !layer.features || layer.features.length === 0) return;

    const emojiFor = () => resolveEmoji(layer.id, layer.emoji || DEFAULT_EMOJI);
    const points = layer.features
      .filter(f => f.type === "Point" && Array.isArray(f.coords) && f.coords.length >= 2 && Number.isFinite(f.coords[0]) && Number.isFinite(f.coords[1]))
      .map(f => ({ lat: f.coords[0], lng: f.coords[1], label: f.label || "" }));
    if (points.length === 0) return;
    pointsRef.current = points;

    // Dedicated high-z pane so "Označi na karti" emoji always render above
    // base map and all WMS/tile overlays (overlayPane z=400), yet below the
    // marker pane (z=600) so map markers stay clickable.
    let pane = map.getPane("searchCatPane");
    if (!pane) {
      pane = map.createPane("searchCatPane");
      pane.style.zIndex = 450;
    }
    const canvas = L.DomUtil.create("canvas", "leaflet-emoji-canvas-layer");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "auto";
    pane.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, size.x * dpr);
      canvas.height = Math.max(1, size.y * dpr);
      canvas.style.width = size.x + "px";
      canvas.style.height = size.y + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
      ctx.clearRect(0, 0, size.x, size.y);
      const emoji = emojiFor();
      ctx.font = `${getMarkerSize()}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";

      // Cache screen-space coords for the hit-test; cull off-screen so the
      // hover loop only iterates over visible markers.
      const screen = new Array(points.length);
      const pad = getMarkerSize();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const cp = map.latLngToContainerPoint(L.latLng(p.lat, p.lng));
        const inView = cp.x > -pad && cp.x < size.x + pad && cp.y > -pad && cp.y < size.y + pad;
        screen[i] = { x: cp.x, y: cp.y, label: p.label, lat: p.lat, lng: p.lng, inView };
        if (inView) {
          ctx.strokeText(emoji, cp.x, cp.y);
          ctx.fillText(emoji, cp.x, cp.y);
        }
      }
      screenRef.current = screen;
    };

    const onZoomStart = () => { canvas.style.opacity = "0"; };
    const onZoomEnd = () => { canvas.style.opacity = "1"; draw(); };

    draw();
    map.on("moveend", draw);
    map.on("zoomend", onZoomEnd);
    map.on("zoomstart", onZoomStart);
    map.on("resize", draw);
    const onSettingsChange = () => draw();
    window.addEventListener(SETTINGS_EVENT, onSettingsChange);

    // Hover tooltip via proximity hit-test — throttled, uses cached screen points.
    const tooltip = L.tooltip({ permanent: false, direction: "top", offset: [0, -10], className: "search-cat-tooltip" });
    tooltipRef.current = tooltip;

    const runHitTest = (cp) => {
      const screen = screenRef.current;
      let nearest = null;
      let bestDist = 14;
      for (let i = 0; i < screen.length; i++) {
        const s = screen[i];
        if (!s.inView) continue;
        const d = Math.hypot(s.x - cp.x, s.y - cp.y);
        if (d < bestDist) { bestDist = d; nearest = s; }
      }
      if (nearest) {
        tooltip.setLatLng(L.latLng(nearest.lat, nearest.lng));
        tooltip.setContent(nearest.label || emojiFor());
        if (!tooltip._map) map.addLayer(tooltip);
      } else if (tooltip._map) {
        map.removeLayer(tooltip);
      }
    };

    const onMove = (e) => {
      const cp = e.containerPoint || map.mouseEventToContainerPoint(e);
      // Throttle hit-test so a fast mouse sweep doesn't re-run O(visible) per event.
      if (hoverTimerRef.current) return;
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        runHitTest(cp);
      }, 55);
    };
    const onLeave = () => {
      if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
      if (tooltip._map) map.removeLayer(tooltip);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      map.off("moveend", draw);
      map.off("zoomend", onZoomEnd);
      map.off("zoomstart", onZoomStart);
      map.off("resize", draw);
      window.removeEventListener(SETTINGS_EVENT, onSettingsChange);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (tooltip._map) map.removeLayer(tooltip);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      tooltipRef.current = null;
    };
  }, [layer, map]);

  return null;
}