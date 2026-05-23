import { useEffect, useRef } from "react";
import { BASE_LAYERS, OVERLAY_CATEGORIES } from "./layerConfig";

// Resolve tile URL (replace {s} with 'a', remove {r})
function resolveTileUrl(url) {
  return url.replace("{s}", "a").replace("{r}", "");
}

// Build a WMS tile URL for MapLibre
function wmsUrl(layer) {
  const params = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    version: layer.version || "1.1.1",
    layers: layer.layers,
    styles: "",
    format: layer.format || "image/png",
    transparent: layer.transparent !== false ? "true" : "false",
    width: "256",
    height: "256",
    srs: "EPSG:3857",
    bbox: "{bbox-epsg-3857}",
  });
  return `${layer.url}?${params.toString()}`;
}

// Build an ArcGIS export tile URL for MapLibre
function arcgisUrl(layer) {
  const base = layer.url || layer.arcgisUrl;
  if (!base) return null;
  return (
    base +
    "?bbox={bbox-epsg-3857}" +
    "&bboxSR=3857&imageSR=3857" +
    "&size=256,256&f=image" +
    `&format=${layer.format || "png32"}` +
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
 * Hook that syncs activeBaseLayers + activeLayers from the LayerPanel into a MapLibre map instance.
 * Pass mapReady (boolean state) so React re-runs effects when map becomes ready.
 */
export function useMapLibreLayers(mapRef, mapReadyRef, {
  activeBaseLayers = {},
  activeLayers = {},
  layerOpacities = {},
  baseLayerOpacities = {},
  mapReady = false,
}) {
  // Sync base layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    for (const [id, active] of Object.entries(activeBaseLayers)) {
      if (!active) {
        removeLayerFromMap(map, id);
        continue;
      }
      const config = getLayerConfig(id);
      if (!config) continue;
      const opacity = baseLayerOpacities[id] ?? config.opacity ?? 1;
      if (!map.getLayer(`ml-${id}`)) {
        addLayerToMap(map, id, config, opacity);
      } else {
        map.setPaintProperty(`ml-${id}`, "raster-opacity", opacity);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBaseLayers, baseLayerOpacities, mapReady]);

  // Sync overlay layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    for (const [id, active] of Object.entries(activeLayers)) {
      if (!active) {
        removeLayerFromMap(map, id);
        continue;
      }
      const config = getLayerConfig(id);
      if (!config) continue;
      const opacity = layerOpacities[id] ?? config.opacity ?? 1;
      if (!map.getLayer(`ml-${id}`)) {
        addLayerToMap(map, id, config, opacity);
      } else {
        map.setPaintProperty(`ml-${id}`, "raster-opacity", opacity);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, layerOpacities, mapReady]);
}