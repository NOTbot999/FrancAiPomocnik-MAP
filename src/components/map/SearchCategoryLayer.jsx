import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Renders point features as emoji glyphs on a single canvas overlay pane.
 * Performant for thousands of points (one canvas, drawn via fillText).
 * Non-point features (LineString/Polygon) are ignored — handled elsewhere.
 * Supports hover tooltips via proximity hit-testing.
 */
const DEFAULT_EMOJI = "📍";

export default function SearchCategoryLayer({ layer }) {
  const map = useMap();
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!layer || !layer.features || layer.features.length === 0) return;

    const emoji = layer.emoji || DEFAULT_EMOJI;
    const points = layer.features
      .filter(f => f.type === "Point" && Array.isArray(f.coords) && f.coords.length >= 2 && Number.isFinite(f.coords[0]) && Number.isFinite(f.coords[1]))
      .map(f => ({ lat: f.coords[0], lng: f.coords[1], label: f.label || "" }));
    if (points.length === 0) return;

    const pane = map.getPanes().overlayPane;
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
      ctx.font = "15px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      for (const p of points) {
        const cp = map.latLngToContainerPoint(L.latLng(p.lat, p.lng));
        if (cp.x < -20 || cp.x > size.x + 20 || cp.y < -20 || cp.y > size.y + 20) continue;
        ctx.strokeText(emoji, cp.x, cp.y);
        ctx.fillText(emoji, cp.x, cp.y);
      }
    };

    const onZoomStart = () => { canvas.style.opacity = "0"; };
    const onZoomEnd = () => { canvas.style.opacity = "1"; draw(); };

    draw();
    map.on("moveend", draw);
    map.on("zoomend", onZoomEnd);
    map.on("zoomstart", onZoomStart);
    map.on("resize", draw);

    // Hover tooltip via proximity hit-test
    const tooltip = L.tooltip({ permanent: false, direction: "top", offset: [0, -10], className: "search-cat-tooltip" });
    tooltipRef.current = tooltip;

    const onMove = (e) => {
      const cp = e.containerPoint || map.mouseEventToContainerPoint(e);
      let nearest = null;
      let bestDist = 14;
      for (const p of points) {
        const pp = map.latLngToContainerPoint(L.latLng(p.lat, p.lng));
        const d = Math.hypot(pp.x - cp.x, pp.y - cp.y);
        if (d < bestDist) { bestDist = d; nearest = p; }
      }
      if (nearest) {
        if (!tooltip._map) map.addLayer(tooltip);
        tooltip.setLatLng(L.latLng(nearest.lat, nearest.lng));
        tooltip.setContent(nearest.label || emoji);
      } else if (tooltip._map) {
        map.removeLayer(tooltip);
      }
    };
    const onLeave = () => { if (tooltip._map) map.removeLayer(tooltip); };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      map.off("moveend", draw);
      map.off("zoomend", onZoomEnd);
      map.off("zoomstart", onZoomStart);
      map.off("resize", draw);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      if (tooltip._map) map.removeLayer(tooltip);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      tooltipRef.current = null;
    };
  }, [layer, map]);

  return null;
}