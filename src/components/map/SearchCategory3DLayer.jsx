import { useEffect, useRef } from "react";

// Emoji mapping for categories
const EMOJI_MAP = {
  castle: "🏰",
  peak: "⛰️",
  waterfall: "💧",
  church: "⛪",
  museum: "🏛️",
  viewpoint: "👁️",
  cave: "🕳️",
  bridge: "🌉",
  monument: "🗿",
  lake: "🏞️",
  river: "🌊",
  forest: "🌲",
  vineyard: "🍇",
  municipality: "🏘️",
};

const DEFAULT_EMOJI = "📍";

/**
 * Renders search category points as 3D symbols/emojis on MapLibre map.
 * Uses symbol layers with text-field for emoji display.
 * Always rendered above terrain in the symbol pane.
 */
export default function SearchCategory3DLayer({ layer, map, mapReady }) {
  const layerIdRef = useRef(null);

  useEffect(() => {
    if (!map || !mapReady || !layer || !layer.features || layer.features.length === 0) return;

    const sourceId = `search_cat_${layer._searchCat || layer.id}`;
    const layerId = `search_cat_symbol_${layer._searchCat || layer.id}`;
    layerIdRef.current = layerId;

    // Add source with GeoJSON
    if (!map.getSource(sourceId)) {
      const geojson = {
        type: "FeatureCollection",
        features: layer.features
          .filter(f => f.type === "Point" && f.coords && f.coords.length >= 2)
          .map(f => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [f.coords[1], f.coords[0]] },
            properties: {
              label: f.label || "",
              emoji: EMOJI_MAP[layer._searchCat] || DEFAULT_EMOJI,
            },
          })),
      };

      map.addSource(sourceId, {
        type: "geojson",
        data: geojson,
        cluster: false,
      });
    }

    // Add symbol layer for emoji display
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": ["get", "emoji"],
          "text-size": 24,
          "text-offset": [0, -1.5],
          "text-anchor": "bottom",
          "text-allow-overlap": true,
          "text-ignore-placement": false,
          "text-pitch-alignment": "viewport",
          "text-max-width": 1,
        },
        paint: {
          "text-color": layer.color || "#e11d48",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
          "text-halo-blur": 1,
        },
      }, "waterway-label"); // Insert below labels but above terrain
    }

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {}
      layerIdRef.current = null;
    };
  }, [layer, map, mapReady]);

  return null;
}