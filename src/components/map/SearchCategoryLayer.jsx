import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Renders thousands of points as a single Leaflet LayerGroup
 * using L.Canvas renderer — no React per-marker overhead.
 * Always on top (tooltipPane z-index).
 */
export default function SearchCategoryLayer({ layer }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    if (!layer || !layer.features || layer.features.length === 0) return;

    // Canvas renderer for performance
    const renderer = L.canvas({ padding: 0.5 });
    const group = L.layerGroup();
    const color = layer.color || "#e11d48";

    // Batch add — don't re-render per point
    const markers = layer.features.map(f => {
      if (f.type !== "Point" || !f.coords || f.coords.length < 2) return null;
      const cm = L.circleMarker([f.coords[0], f.coords[1]], {
        renderer,
        radius: 5,
        color: "white",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.92,
        pane: "markerPane",
      });
      if (f.label) {
        cm.bindTooltip(f.label, { sticky: true, direction: "top", offset: [0, -6], className: "search-cat-tooltip" });
      }
      return cm;
    }).filter(Boolean);

    markers.forEach(m => group.addLayer(m));
    group.addTo(map);
    groupRef.current = group;

    return () => {
      group.remove();
      groupRef.current = null;
    };
  }, [layer, map]);

  return null;
}