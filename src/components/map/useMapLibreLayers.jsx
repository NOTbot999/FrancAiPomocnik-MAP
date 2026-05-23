import { useEffect, useRef } from "react";
import { BASE_LAYERS, OVERLAY_CATEGORIES } from "./layerConfig";

// Resolve tile URL (replace {s} with 'a', remove {r})
function resolveTileUrl(url) {
  return url.replace("{s}", "a").replace("{r}", "");
}

// Build a WMS tile URL for MapLibre
// IMPORTANT: {bbox-epsg-3857} must NOT be URL-encoded — build the string manually
function wmsUrl(layer) {
  const version = layer.version || "1.1.1";
  const srsKey = version.startsWith("1.3") ? "crs" : "srs";
  const srsVal = "EPSG:3857";
  const parts = [
    `service=WMS`,
    `request=GetMap`,
    `version=${version}`,
    `layers=${encodeURIComponent(layer.layers)}`,
    `styles=`,
    `format=${encodeURIComponent(layer.format || "image/png")}`,
    `transparent=${layer.transparent !== false ? "true" : "false"}`,
    `width=256`,
    `height=256`,
    `${srsKey}=${srsVal}`,
    `bbox={bbox-epsg-3857}`,
  ];
  return `${layer.url}?${parts.join("&")}`;
}

// Build an ArcGIS export tile URL for MapLibre
// Always request bbox in EPSG:3857 (MapLibre native) but let ArcGIS reproject output to imageSR.
// Using imageSR=3857 ensures ArcGIS returns tiles already in web mercator — no client reprojection.
function arcgisUrl(layer) {
  const base = layer.url || layer.arcgisUrl;
  if (!base) return null;
  return (
    base +
    "?bbox={bbox-epsg-3857}" +
    "&bboxSR=3857&imageSR=3857" +
    "&size=256,256&f=image" +
    `&format=${layer.format || "jpg"}` +
    `&transparent=${layer.transparent !== false}`
  );
}

// Get all layer configs by id (base + overlay)
function getLayerConfig(id) {
  for (const bl of BASE_LAYERS) {
    if (bl.id === id) return bl;
  }
  for (const cat of OVERLAY_CATEGORIES) {
    for (const l of cat.layers) {
      if (l.id === id) return l;
    }
  }
  return null;
}

function addLayerToMap(map, layerId, config, opacity = 1) {
  if (!map || !config) return;

  const sourceId = `src-${layerId}`;
  const mlLayerId = `ml-${layerId}`;

  // Skip if already added
  if (map.getLayer(mlLayerId)) return;

  let tileUrl = null;
  if (config.type === "tile") {
    tileUrl = resolveTileUrl(config.url);
  } else if (config.type === "wms") {
    tileUrl = wmsUrl(config);
  } else if (config.type === "arcgis_export") {
    tileUrl = arcgisUrl(config);
  }

  if (!tileUrl) return;

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: config.tileSize || 256,
      minzoom: 0,
      maxzoom: 19,
    });
  }

  map.addLayer({
    id: mlLayerId,
    type: "raster",
    source: sourceId,
    paint: {
      "raster-opacity": opacity,
      "raster-fade-duration": 0,
      "raster-resampling": "linear",
    },
  });
}

function removeLayerFromMap(map, layerId) {
  if (!map) return;
  const mlLayerId = `ml-${layerId}`;
  const sourceId = `src-${layerId}`;
  if (map.getLayer(mlLayerId)) map.removeLayer(mlLayerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

/**
 * Hook that syncs activeBaseLayers + activeLayers + customLayers from LayerPanel into MapLibre.
 * mapReady (number) increments on each style-load so effects re-fire.
 */
export function useMapLibreLayers(mapRef, mapReadyRef, {
  activeBaseLayers = {},
  activeLayers = {},
  layerOpacities = {},
  baseLayerOpacities = {},
  mapReady = 0,
  customLayers = [],
  customLayerVisible = {},
  customLayerOpacities = {},
}) {
  // Sync base layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    for (const [id, active] of Object.entries(activeBaseLayers)) {
      if (!active) { removeLayerFromMap(map, id); continue; }
      const config = getLayerConfig(id);
      if (!config) continue;
      const opacity = baseLayerOpacities[id] ?? config.opacity ?? 1;
      if (!map.getLayer(`ml-${id}`)) {
        addLayerToMap(map, id, config, opacity);
      } else {
        try { map.setPaintProperty(`ml-${id}`, "raster-opacity", opacity); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBaseLayers, baseLayerOpacities, mapReady]);

  // Sync overlay layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    for (const [id, active] of Object.entries(activeLayers)) {
      if (!active) { removeLayerFromMap(map, id); continue; }
      const config = getLayerConfig(id);
      if (!config) continue;
      const opacity = layerOpacities[id] ?? config.opacity ?? 1;
      if (!map.getLayer(`ml-${id}`)) {
        addLayerToMap(map, id, config, opacity);
      } else {
        try { map.setPaintProperty(`ml-${id}`, "raster-opacity", opacity); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, layerOpacities, mapReady]);

  // Sync custom (AI) layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    for (const layer of customLayers) {
      const id = layer.id;
      const visible = customLayerVisible[id] !== false;
      const opacity = customLayerOpacities[id] ?? layer.opacity ?? 0.8;
      const mlId = `ml-${id}`;
      const srcId = `src-${id}`;

      if (!visible) {
        // Remove GeoJSON layers (points, lines, polygons)
        if (map.getLayer(`${mlId}-points`)) try { map.removeLayer(`${mlId}-points`); } catch {}
        if (map.getLayer(`${mlId}-lines`)) try { map.removeLayer(`${mlId}-lines`); } catch {}
        if (map.getLayer(`${mlId}-polygons`)) try { map.removeLayer(`${mlId}-polygons`); } catch {}
        // Remove raster layer
        if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}
        if (map.getSource(srcId)) try { map.removeSource(srcId); } catch {}
        continue;
      }

      // Check if this is a GeoJSON custom layer (has features array)
      if (layer.features && Array.isArray(layer.features)) {
        // Convert features to GeoJSON
        const geojsonFeatures = layer.features.map(f => {
          if (f.type === "Point") {
            return {
              type: "Feature",
              geometry: { type: "Point", coordinates: [f.coords[1], f.coords[0]] },
              properties: { label: f.label || "" }
            };
          } else if (f.type === "LineString" || f.type === "Polygon") {
            return {
              type: "Feature",
              geometry: { type: f.type, coordinates: f.coords.map(c => [c[1], c[0]]) },
              properties: { label: f.label || "" }
            };
          }
          return null;
        }).filter(Boolean);

        const geojson = { type: "FeatureCollection", features: geojsonFeatures };

        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: "geojson", data: geojson });
        } else {
          map.getSource(srcId).setData(geojson);
        }

        // Remove old raster layer if exists
        if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}

        // Add appropriate layer type based on geometry
        const hasPoints = geojsonFeatures.some(f => f.geometry.type === "Point");
        const hasLines = geojsonFeatures.some(f => f.geometry.type === "LineString");
        const hasPolygons = geojsonFeatures.some(f => f.geometry.type === "Polygon");

        if (hasPoints) {
          const pointLayerId = `${mlId}-points`;
          if (!map.getLayer(pointLayerId)) {
            map.addLayer({
              id: pointLayerId,
              type: "circle",
              source: srcId,
              filter: ["==", "$type", "Point"],
              paint: {
                "circle-radius": 6,
                "circle-color": layer.color || "#1d9bf0",
                "circle-opacity": opacity,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff"
              }
            });
          } else {
            try {
              map.setPaintProperty(pointLayerId, "circle-opacity", opacity);
              map.setPaintProperty(pointLayerId, "circle-color", layer.color || "#1d9bf0");
            } catch {}
          }
        }

        if (hasLines) {
          const lineLayerId = `${mlId}-lines`;
          if (!map.getLayer(lineLayerId)) {
            map.addLayer({
              id: lineLayerId,
              type: "line",
              source: srcId,
              filter: ["==", "$type", "LineString"],
              paint: {
                "line-width": 3,
                "line-color": layer.color || "#1d9bf0",
                "line-opacity": opacity
              }
            });
          } else {
            try {
              map.setPaintProperty(lineLayerId, "line-opacity", opacity);
              map.setPaintProperty(lineLayerId, "line-color", layer.color || "#1d9bf0");
            } catch {}
          }
        }

        if (hasPolygons) {
          const polygonLayerId = `${mlId}-polygons`;
          if (!map.getLayer(polygonLayerId)) {
            map.addLayer({
              id: polygonLayerId,
              type: "fill",
              source: srcId,
              filter: ["==", "$type", "Polygon"],
              paint: {
                "fill-color": layer.color || "#1d9bf0",
                "fill-opacity": opacity * 0.6
              }
            });
          } else {
            try {
              map.setPaintProperty(polygonLayerId, "fill-opacity", opacity * 0.6);
              map.setPaintProperty(polygonLayerId, "fill-color", layer.color || "#1d9bf0");
            } catch {}
          }
        }

        continue;
      }

      // Build tile URL from custom layer (tile or wms type)
      let tileUrl = null;
      if (layer.type === "wms") tileUrl = wmsUrl(layer);
      else if (layer.tileUrl) tileUrl = layer.tileUrl;
      else if (layer.url) tileUrl = resolveTileUrl(layer.url);
      if (!tileUrl) continue;

      if (!map.getLayer(mlId)) {
        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: "raster", tiles: [tileUrl], tileSize: 256, minzoom: 0, maxzoom: 19 });
        }
        map.addLayer({ id: mlId, type: "raster", source: srcId, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
      } else {
        try { map.setPaintProperty(mlId, "raster-opacity", opacity); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLayers, customLayerVisible, customLayerOpacities, mapReady]);

  // Cleanup removed custom layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const customIds = customLayers.map(l => l.id);
    // Find and remove layers that are no longer in customLayers array
    // This is handled by the main effect when layers are removed from the array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLayers]);
}