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
// MapLibre always requests tiles in EPSG:3857 bbox.
// We always use bboxSR=3857 and imageSR=3857 so ArcGIS reprojects output — no client reprojection needed.
// NOTE: bboxSR/imageSR from layer config are intentionally IGNORED here — MapLibre only speaks 3857.
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

// Returns the id of the first custom/search layer currently on the map,
// so that base/overlay rasters are always inserted BELOW custom layers.
function getFirstCustomLayerId(map) {
  const layers = map.getStyle()?.layers || [];
  for (const l of layers) {
    if (
      l.id.startsWith("ml-custom_") ||
      l.id.startsWith("ml-search_") ||
      l.id.startsWith("search_cat_") ||
      l.id.startsWith("ml-gps")
    ) return l.id;
  }
  return undefined; // no custom layers → add on top
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
  } else if (config.type === "maptiler_tile") {
    const key = window.__maptilerKey;
    if (!key) return; // key not yet available — Map3DView sets window.__maptilerKey on init
    tileUrl = config.urlTemplate.replace("{key}", key);
  } else if (config.type === "wms") {
    tileUrl = wmsUrl(config);
  } else if (config.type === "arcgis_export") {
    tileUrl = arcgisUrl(config);
  }

  if (!tileUrl) return;

  try {
    if (!map.getSource(sourceId)) {
      // ArcGIS export servers typically cap at zoom 18; WMS at 19
      const maxzoom = config.type === "arcgis_export" ? 18 : 19;
      map.addSource(sourceId, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: config.tileSize || 256,
        minzoom: 0,
        maxzoom,
      });
    }

    // Insert below any custom/GPS layers so they always stay on top
    const beforeId = getFirstCustomLayerId(map);
    map.addLayer({
      id: mlLayerId,
      type: "raster",
      source: sourceId,
      paint: {
        "raster-opacity": opacity,
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    }, beforeId);
  } catch (err) {
    console.warn(`[MapLibre] addLayerToMap failed for ${layerId}:`, err.message);
  }
}

function removeLayerFromMap(map, layerId) {
  if (!map) return;
  const mlLayerId = `ml-${layerId}`;
  const sourceId = `src-${layerId}`;
  try { if (map.getLayer(mlLayerId)) map.removeLayer(mlLayerId); } catch {}
  try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch {}
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
  gpsTrack = [],
}) {
  // Store all layer state in refs so they persist across style changes
  const customLayersRef = useRef([]);
  const customVisibleRef = useRef({});
  const customOpacitiesRef = useRef({});
  const activeLayersRef = useRef({});
  const activeBLayersRef = useRef({});
  const layerOpacitiesRef = useRef({});
  const baseLayerOpacitiesRef = useRef({});

  // Update refs synchronously on every render so setTimeout callbacks always see latest state
  customLayersRef.current = customLayers;
  customVisibleRef.current = customLayerVisible;
  customOpacitiesRef.current = customLayerOpacities;
  activeLayersRef.current = activeLayers;
  activeBLayersRef.current = activeBaseLayers;
  layerOpacitiesRef.current = layerOpacities;
  baseLayerOpacitiesRef.current = baseLayerOpacities;
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

  // Sync base layers (also handles lidar_hillshade base layer)
  // Note: raba_farmland and gurs_lidar are overlay layers — handled above

  // Sync custom (AI) layers - INCLUDING search category layers ("OZNAČI NA KARTI")
  // Track which custom layer IDs are currently on the map
  const mountedCustomIdsRef = useRef(new Set());

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    // Remove layers that are no longer in customLayers
    const currentIds = new Set(customLayers.map(l => l.id));
    mountedCustomIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        const mlId = `ml-${id}`;
        const srcId = `src-${id}`;
        if (map.getLayer(`${mlId}-points`)) try { map.removeLayer(`${mlId}-points`); } catch {}
        if (map.getLayer(`${mlId}-lines`)) try { map.removeLayer(`${mlId}-lines`); } catch {}
        if (map.getLayer(`${mlId}-polygons`)) try { map.removeLayer(`${mlId}-polygons`); } catch {}
        if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}
        if (map.getSource(srcId)) try { map.removeSource(srcId); } catch {}
        mountedCustomIdsRef.current.delete(id);
      }
    });

    for (const layer of customLayers) {
      const id = layer.id;
      const visible = customLayerVisible[id] !== false;
      const opacity = customLayerOpacities[id] ?? layer.opacity ?? 0.8;
      const mlId = `ml-${id}`;
      const srcId = `src-${id}`;

      // Skip search category layers - handled separately in Map3DView
      if (layer._searchCat || layer._caveDbLayer || layer._municipalityLayer) continue;

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

        // Add appropriate layer type based on geometry — no beforeId, custom layers go on top
        const hasPoints = geojsonFeatures.some(f => f.geometry.type === "Point");
        const hasLines = geojsonFeatures.some(f => f.geometry.type === "LineString");
        const hasPolygons = geojsonFeatures.some(f => f.geometry.type === "Polygon");

        if (hasPoints) {
          const pointLayerId = `${mlId}-points`;
          if (!map.getLayer(pointLayerId)) {
            map.addLayer({ id: pointLayerId, type: "circle", source: srcId, filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": layer.color || "#1d9bf0", "circle-opacity": opacity, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff", "circle-pitch-alignment": "map", "circle-pitch-scale": "map" } });
          } else {
            try { map.setPaintProperty(pointLayerId, "circle-opacity", opacity); map.setPaintProperty(pointLayerId, "circle-color", layer.color || "#1d9bf0"); } catch {}
          }
        }

        if (hasLines) {
          const lineLayerId = `${mlId}-lines`;
          if (!map.getLayer(lineLayerId)) {
            map.addLayer({ id: lineLayerId, type: "line", source: srcId, filter: ["==", "$type", "LineString"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 3, "line-color": layer.color || "#1d9bf0", "line-opacity": opacity } });
          } else {
            try { map.setPaintProperty(lineLayerId, "line-opacity", opacity); map.setPaintProperty(lineLayerId, "line-color", layer.color || "#1d9bf0"); } catch {}
          }
        }

        if (hasPolygons) {
          const polygonLayerId = `${mlId}-polygons`;
          if (!map.getLayer(polygonLayerId)) {
            map.addLayer({ id: polygonLayerId, type: "fill", source: srcId, filter: ["==", "$type", "Polygon"], paint: { "fill-color": layer.color || "#1d9bf0", "fill-opacity": opacity * 0.6 } });
          } else {
            try { map.setPaintProperty(polygonLayerId, "fill-opacity", opacity * 0.6); map.setPaintProperty(polygonLayerId, "fill-color", layer.color || "#1d9bf0"); } catch {}
          }
        }

        mountedCustomIdsRef.current.add(id);
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
        // Custom raster tile layers also go on top (no beforeId)
        map.addLayer({ id: mlId, type: "raster", source: srcId, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
        mountedCustomIdsRef.current.add(id);
      } else {
        try { map.setPaintProperty(mlId, "raster-opacity", opacity); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLayers, customLayerVisible, customLayerOpacities, mapReady]);

  // Re-add ALL layers after style change (MapLibre removes all layers when setStyle is called)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;

    // Small delay to ensure style is fully loaded
    setTimeout(() => {
      // Re-add base layers
      for (const [id, active] of Object.entries(activeBLayersRef.current || {})) {
        if (!active) continue;
        const config = getLayerConfig(id);
        if (!config) continue;
        const opacity = (baseLayerOpacitiesRef.current || {})[id] ?? config.opacity ?? 1;
        if (!map.getLayer(`ml-${id}`)) addLayerToMap(map, id, config, opacity);
      }

      // Re-add overlay layers
      for (const [id, active] of Object.entries(activeLayersRef.current || {})) {
        if (!active) continue;
        const config = getLayerConfig(id);
        if (!config) continue;
        const opacity = (layerOpacitiesRef.current || {})[id] ?? config.opacity ?? 1;
        if (!map.getLayer(`ml-${id}`)) addLayerToMap(map, id, config, opacity);
      }

      // Re-sync custom GeoJSON layers (re-add visible, remove hidden/deleted)
      const layers = customLayersRef.current || [];
      const visible = customVisibleRef.current || {};
      const opacities = customOpacitiesRef.current || {};
      // After style switch all layers are gone — reset tracking
      mountedCustomIdsRef.current = new Set();

      for (const layer of layers) {
        if (layer._searchCat || layer._caveDbLayer || layer._municipalityLayer) continue;
        const id = layer.id;
        const isVisible = visible[id] !== false;
        const opacity = opacities[id] ?? layer.opacity ?? 0.8;
        const mlId = `ml-${id}`;
        const srcId = `src-${id}`;

        // After a real style switch everything is gone; after a visibility toggle layers may still exist.
        // Cleanly remove whatever is there before re-adding.
        try { if (map.getLayer(`${mlId}-points`)) map.removeLayer(`${mlId}-points`); } catch {}
        try { if (map.getLayer(`${mlId}-lines`)) map.removeLayer(`${mlId}-lines`); } catch {}
        try { if (map.getLayer(`${mlId}-polygons`)) map.removeLayer(`${mlId}-polygons`); } catch {}
        try { if (map.getLayer(mlId)) map.removeLayer(mlId); } catch {}
        try { if (map.getSource(srcId)) map.removeSource(srcId); } catch {}

        // Don't re-add if not visible or no features
        if (!isVisible || !layer.features || !Array.isArray(layer.features)) continue;

        // Convert features to GeoJSON
        const geojsonFeatures = layer.features.map(f => {
          if (f.type === "Point") {
            return { type: "Feature", geometry: { type: "Point", coordinates: [f.coords[1], f.coords[0]] }, properties: { label: f.label || "" } };
          } else if (f.type === "LineString" || f.type === "Polygon") {
            return { type: "Feature", geometry: { type: f.type, coordinates: f.coords.map(c => [c[1], c[0]]) }, properties: { label: f.label || "" } };
          }
          return null;
        }).filter(Boolean);

        if (geojsonFeatures.length === 0) continue;

        const geojson = { type: "FeatureCollection", features: geojsonFeatures };
        map.addSource(srcId, { type: "geojson", data: geojson });

        const hasPoints = geojsonFeatures.some(f => f.geometry.type === "Point");
        const hasLines = geojsonFeatures.some(f => f.geometry.type === "LineString");
        const hasPolygons = geojsonFeatures.some(f => f.geometry.type === "Polygon");

        if (hasPoints) {
          map.addLayer({ id: `${mlId}-points`, type: "circle", source: srcId, filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": layer.color || "#1d9bf0", "circle-opacity": opacity, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
        }
        if (hasLines) {
          map.addLayer({ id: `${mlId}-lines`, type: "line", source: srcId, filter: ["==", "$type", "LineString"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 3, "line-color": layer.color || "#1d9bf0", "line-opacity": opacity } });
        }
        if (hasPolygons) {
          map.addLayer({ id: `${mlId}-polygons`, type: "fill", source: srcId, filter: ["==", "$type", "Polygon"], paint: { "fill-color": layer.color || "#1d9bf0", "fill-opacity": opacity * 0.6 } });
        }
        mountedCustomIdsRef.current.add(id);
      }
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]); // Re-run when mapReady increments (after style load)

  // Sync GPS track
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;

    const gpsSourceId = "src-gps-track";
    const gpsLayerId = "ml-gps-track";

    // Remove existing
    if (map.getLayer(gpsLayerId)) try { map.removeLayer(gpsLayerId); } catch {}
    if (map.getSource(gpsSourceId)) try { map.removeSource(gpsSourceId); } catch {}

    // Add new track if has points
    if (gpsTrack && gpsTrack.length > 1) {
      const geojson = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: gpsTrack.map(pt => [pt[1] || pt.lng, pt[0] || pt.lat])
          },
          properties: {}
        }]
      };

      map.addSource(gpsSourceId, { type: "geojson", data: geojson });

      // GPS track goes on top (no beforeId)
      map.addLayer({
        id: gpsLayerId,
        type: "line",
        source: gpsSourceId,
        paint: {
          "line-width": 4,
          "line-color": "#10b981",
          "line-opacity": 0.9,
          "line-dasharray": [2, 2]
        }
      });

      // Add start/end markers
      const startMarkerId = "ml-gps-start";
      const endMarkerId = "ml-gps-end";
      if (map.getLayer(startMarkerId)) try { map.removeLayer(startMarkerId); } catch {}
      if (map.getLayer(endMarkerId)) try { map.removeLayer(endMarkerId); } catch {}
      if (map.getSource("src-gps-start")) try { map.removeSource("src-gps-start"); } catch {}
      if (map.getSource("src-gps-end")) try { map.removeSource("src-gps-end"); } catch {}

      // Start marker (green)
      const startPt = gpsTrack[0];
      map.addSource("src-gps-start", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: [startPt[1] || startPt.lng, startPt[0] || startPt.lat] },
          properties: {}
        }
      });
      map.addLayer({
        id: startMarkerId,
        type: "circle",
        source: "src-gps-start",
        paint: {
          "circle-radius": 6,
          "circle-color": "#10b981",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });

      // End marker (red)
      const endPt = gpsTrack[gpsTrack.length - 1];
      map.addSource("src-gps-end", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: [endPt[1] || endPt.lng, endPt[0] || endPt.lat] },
          properties: {}
        }
      });
      map.addLayer({
        id: endMarkerId,
        type: "circle",
        source: "src-gps-end",
        paint: {
          "circle-radius": 6,
          "circle-color": "#ef4444",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsTrack, mapReady]);
}