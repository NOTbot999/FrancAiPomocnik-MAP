import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, useMemo } from "react";
import { RotateCcw, RotateCw, Compass, ChevronUp, ChevronDown, Mountain, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { BASE_LAYERS, OVERLAY_CATEGORIES } from "./layerConfig";

// MapLibre base map styles
export const ML_BASE_STYLES = [
  { id: "satellite", label: "Satelit",     style: (key) => `https://api.maptiler.com/maps/satellite/style.json?key=${key}` },
  { id: "topo",      label: "Topografija", style: (key) => `https://api.maptiler.com/maps/topo-v2/style.json?key=${key}` },
  { id: "outdoor",   label: "Outdoor",     style: (key) => `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}` },
  { id: "osm",       label: "OSM",         style: (key) => `https://api.maptiler.com/maps/openstreetmap/style.json?key=${key}` },
  { id: "hybrid",    label: "Hibrid",      style: (key) => `https://api.maptiler.com/maps/hybrid/style.json?key=${key}` },
];

const Map3DView = forwardRef(function Map3DView({
  center, zoom, onClose, is3D = true, isVisible = true,
  activeBaseLayers = {}, activeLayers = {},
  layerOpacities = {}, baseLayerOpacities = {},
  activeMLBase, onMLBaseChange,
  customLayers = [], customLayerVisible = {}, customLayerOpacities = {},
  searchCategoryLayers = [],
  gpsTrack = [],
  onPinPicked,
}, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const apiKeyRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pitch, setPitch] = useState(is3D ? 60 : 0);
  const [bearing, setBearing] = useState(0);
  const [activeBase, setActiveBase] = useState(activeMLBase || "satellite");
  const autoRotate = useRef(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const mapReadyRef = useRef(false);
  // Use a counter so incrementing triggers re-sync without a false→true flip delay
  const [mapReady, setMapReady] = useState(0);



  // Keep a ref to searchCategoryLayers so the map load callback can access latest value
  const searchCategoryLayersRef = useRef(searchCategoryLayers);
  useEffect(() => { searchCategoryLayersRef.current = searchCategoryLayers; }, [searchCategoryLayers]);

  const EMOJI_MAP = {
    castle: "🏰", peak: "⛰️", waterfall: "💧", viewpoint: "👁️", cave: "🕳️",
    caves_db: "🕳️", museum: "🏛️", ruins: "🗿", spring: "💦", lake: "🌊",
    park: "🌳", chapel: "⛪", church: "🕌", fuel: "⛽", parking: "🅿️",
    supermarket: "🛒", atm: "💳", hospital: "🏥", clinic: "🩺", dentist: "🦷",
    pharmacy: "💊", fire_station: "🚒", police: "🚔", pipe: "🚰",
    bus_station: "🚌", train_station: "🚂", camp: "🏕️", aerodrome: "✈️",
    cemetery: "⚰️", municipality: "🏘️", motorway_jct: "🛣️",
  };

  // Track which category layer IDs are currently on the map
  const activeCatLayerIds = useRef(new Set());

  const syncSearchCategoryLayers = useCallback((map, layers) => {
    if (!map || !map.isStyleLoaded()) return;

    console.log("[Map3D] Sync search layers:", layers?.length, "layers");
    console.log("[Map3D] Layer data:", layers);

    // Build the set of layer IDs that SHOULD exist right now
    const desiredIds = new Set(
      (layers || []).map(catLayer => {
        const catId = catLayer._searchCat || Object.keys(EMOJI_MAP).find(k => catLayer.name?.toLowerCase().includes(k));
        return `search_cat_symbol_${catId || catLayer.id}`;
      })
    );

    // Remove layers that are no longer desired
    activeCatLayerIds.current.forEach(layerId => {
      if (!desiredIds.has(layerId)) {
        const sourceId = layerId.replace("search_cat_symbol_", "search_cat_");
        try { if (map.getLayer(layerId)) map.removeLayer(layerId); } catch {}
        try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch {}
        activeCatLayerIds.current.delete(layerId);
      }
    });

    // Add or update desired layers
    (layers || []).forEach(catLayer => {
      try {
        const catId = catLayer._searchCat || Object.keys(EMOJI_MAP).find(k => catLayer.name?.toLowerCase().includes(k));
        const sourceId = `search_cat_${catId || catLayer.id}`;
        const layerId = `search_cat_symbol_${catId || catLayer.id}`;
        const emoji = EMOJI_MAP[catId] || "📍";

        console.log(`[Map3D] Processing layer: ${catLayer.id}, catId: ${catId}, features: ${catLayer.features?.length}`);

        const geojsonFeatures = (catLayer.features || [])
          .filter(f => f?.type === "Point" && f?.coords && Array.isArray(f.coords) && f.coords.length >= 2)
          .map(f => {
            // coords is [lat, lng], GeoJSON needs [lng, lat]
            const lat = f.coords[0];
            const lng = f.coords[1];
            return {
              type: "Feature",
              geometry: { type: "Point", coordinates: [lng, lat] },
              properties: { label: f.label || "", emoji }
            };
          });

        console.log(`[Map3D] GeoJSON features: ${geojsonFeatures.length}`);

        if (geojsonFeatures.length === 0) {
          console.warn(`[Map3D] No valid features for layer ${catLayer.id}`);
          return;
        }

        const geojson = { type: "FeatureCollection", features: geojsonFeatures };
        console.log(`[Map3D] GeoJSON data: ${JSON.stringify(geojson.features.slice(0, 2))}`);

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: "geojson", data: geojson, cluster: false });
          console.log(`[Map3D] Added source: ${sourceId}`);
        } else {
          map.getSource(sourceId).setData(geojson);
          console.log(`[Map3D] Updated source: ${sourceId}`);
        }

        if (!map.getLayer(layerId)) {
          const allLayers = map.getStyle()?.layers || [];
          const topLayerId = allLayers.length > 0 ? allLayers[allLayers.length - 1].id : undefined;
          console.log(`[Map3D] Adding layer: ${layerId} on top of ${topLayerId}`);
          map.addLayer({
            id: layerId,
            type: "symbol",
            source: sourceId,
            layout: {
              "text-field": ["get", "emoji"],
              "text-size": 26,
              "text-anchor": "center",
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "text-pitch-alignment": "viewport",
              "text-rotation-alignment": "viewport",
              "text-max-width": 1,
              "icon-allow-overlap": true,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1,
              "text-halo-blur": 0.5,
              "text-translate": [0, -18],
              "text-translate-anchor": "viewport",
              "text-opacity": catLayer.opacity ?? 1,
            }
          }, topLayerId);
          activeCatLayerIds.current.add(layerId);
          console.log(`[Map3D] Layer added successfully: ${layerId}`);
        } else {
          try { map.setPaintProperty(layerId, "text-opacity", catLayer.opacity ?? 1); } catch {}
          console.log(`[Map3D] Layer already exists, updated opacity: ${layerId}`);
        }
      } catch (err) {
        console.error("[Map3D] Error syncing search layer:", catLayer?.id, err);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync search category layers whenever they change OR map becomes ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;
    const t = setTimeout(() => syncSearchCategoryLayers(map, searchCategoryLayersRef.current), 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCategoryLayers, mapReady]);

  // Helper to resolve tile URL
  const resolveTileUrl = (url) => url.replace("{s}", "a").replace("{r}", "");

  // Helper to build WMS URL
  const buildWmsUrl = (layer) => {
    const version = layer.version || "1.1.1";
    const srsKey = version.startsWith("1.3") ? "crs" : "srs";
    return `${layer.url}?service=WMS&request=GetMap&version=${version}&layers=${encodeURIComponent(layer.layers)}&styles=&format=${encodeURIComponent(layer.format || "image/png")}&transparent=${layer.transparent !== false ? "true" : "false"}&width=256&height=256&${srsKey}=EPSG:3857&bbox={bbox-epsg-3857}`;
  };

  // Helper to build ArcGIS export URL
  const buildArcgisUrl = (layer) => {
    const base = layer.url || layer.arcgisUrl;
    if (!base) return null;
    return `${base}?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&format=${layer.format || "jpg"}&transparent=${layer.transparent !== false}`;
  };

  // Get layer config by ID
  const getLayerConfig = useCallback((id) => {
    for (const bl of BASE_LAYERS) {
      if (bl.id === id) return bl;
    }
    for (const cat of OVERLAY_CATEGORIES) {
      for (const l of cat.layers) {
        if (l.id === id) return l;
      }
    }
    return null;
  }, []);

  // Sync base layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;

    for (const [id, active] of Object.entries(activeBaseLayers)) {
      const mlId = `ml-${id}`;
      const srcId = `src-${id}`;
      if (!active) {
        if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}
        if (map.getSource(srcId)) try { map.removeSource(srcId); } catch {}
        continue;
      }
      const config = getLayerConfig(id);
      if (!config) continue;
      const opacity = baseLayerOpacities[id] ?? config.opacity ?? 1;
      let tileUrl = null;
      if (config.type === "tile") tileUrl = resolveTileUrl(config.url);
      else if (config.type === "wms") tileUrl = buildWmsUrl(config);
      else if (config.type === "arcgis_export") tileUrl = buildArcgisUrl(config);
      if (!tileUrl) continue;
      if (!map.getSource(srcId)) {
        const maxzoom = config.type === "arcgis_export" ? 18 : 19;
        map.addSource(srcId, { type: "raster", tiles: [tileUrl], tileSize: config.tileSize || 256, minzoom: 0, maxzoom });
      }
      if (!map.getLayer(mlId)) {
        map.addLayer({ id: mlId, type: "raster", source: srcId, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
      } else {
        try { map.setPaintProperty(mlId, "raster-opacity", opacity); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBaseLayers, baseLayerOpacities, mapReady, getLayerConfig]);

  // Sync overlay layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;

    for (const [id, active] of Object.entries(activeLayers)) {
      const mlId = `ml-${id}`;
      const srcId = `src-${id}`;
      if (!active) {
        if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}
        if (map.getSource(srcId)) try { map.removeSource(srcId); } catch {}
        continue;
      }
      const config = getLayerConfig(id);
      if (!config) continue;
      const opacity = layerOpacities[id] ?? config.opacity ?? 1;
      let tileUrl = null;
      if (config.type === "tile") tileUrl = resolveTileUrl(config.url);
      else if (config.type === "wms") tileUrl = buildWmsUrl(config);
      else if (config.type === "arcgis_export") tileUrl = buildArcgisUrl(config);
      if (!tileUrl) continue;
      if (!map.getSource(srcId)) {
        const maxzoom = config.type === "arcgis_export" ? 18 : 19;
        map.addSource(srcId, { type: "raster", tiles: [tileUrl], tileSize: config.tileSize || 256, minzoom: 0, maxzoom });
      }
      if (!map.getLayer(mlId)) {
        map.addLayer({ id: mlId, type: "raster", source: srcId, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
      } else {
        try { map.setPaintProperty(mlId, "raster-opacity", opacity); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, layerOpacities, mapReady, getLayerConfig]);

  // Sync GPS track
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;

    const gpsSourceId = "src-gps-track";
    const gpsLayerId = "ml-gps-track";
    const startMarkerId = "ml-gps-start";
    const endMarkerId = "ml-gps-end";

    // Remove existing
    if (map.getLayer(gpsLayerId)) try { map.removeLayer(gpsLayerId); } catch {}
    if (map.getSource(gpsSourceId)) try { map.removeSource(gpsSourceId); } catch {}
    if (map.getLayer(startMarkerId)) try { map.removeLayer(startMarkerId); } catch {}
    if (map.getLayer(endMarkerId)) try { map.removeLayer(endMarkerId); } catch {}
    if (map.getSource("src-gps-start")) try { map.removeSource("src-gps-start"); } catch {}
    if (map.getSource("src-gps-end")) try { map.removeSource("src-gps-end"); } catch {}

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
      map.addLayer({
        id: gpsLayerId,
        type: "line",
        source: gpsSourceId,
        paint: { "line-width": 4, "line-color": "#10b981", "line-opacity": 0.9, "line-dasharray": [2, 2] }
      });

      // Start marker (green)
      const startPt = gpsTrack[0];
      map.addSource("src-gps-start", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: [startPt[1] || startPt.lng, startPt[0] || startPt.lat] }, properties: {} }
      });
      map.addLayer({
        id: startMarkerId,
        type: "circle",
        source: "src-gps-start",
        paint: { "circle-radius": 6, "circle-color": "#10b981", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" }
      });

      // End marker (red)
      const endPt = gpsTrack[gpsTrack.length - 1];
      map.addSource("src-gps-end", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: [endPt[1] || endPt.lng, endPt[0] || endPt.lat] }, properties: {} }
      });
      map.addLayer({
        id: endMarkerId,
        type: "circle",
        source: "src-gps-end",
        paint: { "circle-radius": 6, "circle-color": "#ef4444", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsTrack, mapReady]);

  // Sync custom layers (AI/user-generated + cave/municipality) in MapLibre
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || mapReady === 0) return;

    const syncCustomLayers = (layers) => {
      if (!map || !map.isStyleLoaded()) return;

      for (const layer of layers) {
        const id = layer.id;
        const visible = customLayerVisible[id] !== false;
        const opacity = customLayerOpacities[id] ?? layer.opacity ?? 0.8;
        const mlId = `ml-${id}`;
        const srcId = `src-${id}`;

        // Skip search category layers - handled separately (but NOT cave_db or municipality)
        if (layer._searchCat && !layer._caveDbLayer && !layer._municipalityLayer) continue;

        if (!visible) {
          if (map.getLayer(`${mlId}-points`)) try { map.removeLayer(`${mlId}-points`); } catch {}
          if (map.getLayer(`${mlId}-lines`)) try { map.removeLayer(`${mlId}-lines`); } catch {}
          if (map.getLayer(`${mlId}-polygons`)) try { map.removeLayer(`${mlId}-polygons`); } catch {}
          if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}
          if (map.getSource(srcId)) try { map.removeSource(srcId); } catch {}
          continue;
        }

        // GeoJSON custom layer (has features array) - includes cave_db, municipality, AI layers
        if (layer.features && Array.isArray(layer.features)) {
          console.log(`[Map3D] Syncing custom GeoJSON layer: ${id}, features: ${layer.features.length}, visible: ${visible}`);
          
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
          console.log(`[Map3D] GeoJSON for ${id}: ${geojsonFeatures.length} valid features`);

          if (!map.getSource(srcId)) {
            map.addSource(srcId, { type: "geojson", data: geojson });
            console.log(`[Map3D] Added custom source: ${srcId}`);
          } else {
            map.getSource(srcId).setData(geojson);
            console.log(`[Map3D] Updated custom source: ${srcId}`);
          }

          if (map.getLayer(mlId)) try { map.removeLayer(mlId); } catch {}

          const hasPoints = geojsonFeatures.some(f => f.geometry.type === "Point");
          const hasLines = geojsonFeatures.some(f => f.geometry.type === "LineString");
          const hasPolygons = geojsonFeatures.some(f => f.geometry.type === "Polygon");

          if (hasPoints) {
            const pointLayerId = `${mlId}-points`;
            if (!map.getLayer(pointLayerId)) {
              map.addLayer({ id: pointLayerId, type: "circle", source: srcId, filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": layer.color || "#1d9bf0", "circle-opacity": opacity, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
              console.log(`[Map3D] Added custom points layer: ${pointLayerId}`);
            } else {
              try { map.setPaintProperty(pointLayerId, "circle-opacity", opacity); map.setPaintProperty(pointLayerId, "circle-color", layer.color || "#1d9bf0"); } catch {}
            }
            try { map.moveLayer(pointLayerId); } catch {}
          }

          if (hasLines) {
            const lineLayerId = `${mlId}-lines`;
            if (!map.getLayer(lineLayerId)) {
              map.addLayer({ id: lineLayerId, type: "line", source: srcId, filter: ["==", "$type", "LineString"], paint: { "line-width": 3, "line-color": layer.color || "#1d9bf0", "line-opacity": opacity } });
              console.log(`[Map3D] Added custom lines layer: ${lineLayerId}`);
            } else {
              try { map.setPaintProperty(lineLayerId, "line-opacity", opacity); map.setPaintProperty(lineLayerId, "line-color", layer.color || "#1d9bf0"); } catch {}
            }
            try { map.moveLayer(lineLayerId); } catch {}
          }

          if (hasPolygons) {
            const polygonLayerId = `${mlId}-polygons`;
            if (!map.getLayer(polygonLayerId)) {
              map.addLayer({ id: polygonLayerId, type: "fill", source: srcId, filter: ["==", "$type", "Polygon"], paint: { "fill-color": layer.color || "#1d9bf0", "fill-opacity": opacity * 0.6 } });
              console.log(`[Map3D] Added custom polygons layer: ${polygonLayerId}`);
            } else {
              try { map.setPaintProperty(polygonLayerId, "fill-opacity", opacity * 0.6); map.setPaintProperty(polygonLayerId, "fill-color", layer.color || "#1d9bf0"); } catch {}
            }
            try { map.moveLayer(polygonLayerId); } catch {}
          }
          continue;
        }

        // Tile-based custom layer (WMS, ArcGIS, standard tiles)
        if (layer.features && layer.features.length === 0 && !layer.type && !layer.url && !layer.tileUrl) {
          console.log(`[Map3D] Skipping empty GeoJSON layer ${id} with no tile source`);
          continue;
        }
        
        let tileUrl = null;
        if (layer.type === "wms") {
          const parts = [
            `service=WMS`, `request=GetMap`, `version=${layer.version || "1.1.1"}`,
            `layers=${encodeURIComponent(layer.layers)}`, `styles=`, `format=${encodeURIComponent(layer.format || "image/png")}`,
            `transparent=${layer.transparent !== false ? "true" : "false"}`, `width=256`, `height=256`,
            `${layer.version?.startsWith("1.3") ? "crs" : "srs"}=EPSG:3857`, `bbox={bbox-epsg-3857}`
          ];
          tileUrl = `${layer.url}?${parts.join("&")}`;
        } else if (layer.tileUrl) {
          tileUrl = layer.tileUrl;
        } else if (layer.url) {
          tileUrl = layer.url.replace("{s}", "a").replace("{r}", "");
        }
        if (!tileUrl) continue;

        if (!map.getLayer(mlId)) {
          if (!map.getSource(srcId)) {
            map.addSource(srcId, { type: "raster", tiles: [tileUrl], tileSize: 256, minzoom: 0, maxzoom: 19 });
          }
          map.addLayer({ id: mlId, type: "raster", source: srcId, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
          console.log(`[Map3D] Added custom raster layer: ${mlId}`);
          try { map.moveLayer(mlId); } catch {}
        } else {
          try { map.setPaintProperty(mlId, "raster-opacity", opacity); } catch {}
        }
      }
    };

    syncCustomLayers(customLayers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLayers, customLayerVisible, customLayerOpacities, mapReady]);

  const setupTerrain = useCallback((map, key) => {
    if (!map.getSource("terrain-dem")) {
      map.addSource("terrain-dem", {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 256,
      });
    }
    map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
  }, []);

  useEffect(() => {
    let map = null;
    let cancelled = false;

    const init = async () => {
      try {
        if (!window.maplibregl) {
          await new Promise((resolve, reject) => {
            if (!document.querySelector('link[href*="maplibre-gl"]')) {
              const link = document.createElement("link");
              link.rel = "stylesheet";
              link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
              document.head.appendChild(link);
            }
            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
            script.crossOrigin = "anonymous";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        if (cancelled) return;

        const res = await base44.functions.invoke("getMaptilerKey", {});
        const apiKey = res.data?.key;
        if (!apiKey) throw new Error("No API key");
        apiKeyRef.current = apiKey;

        if (cancelled || !containerRef.current) return;

        const maplibre = window.maplibregl;
        const safeLng = (center && !isNaN(center[1])) ? center[1] : 14.9955;
        const safeLat = (center && !isNaN(center[0])) ? center[0] : 46.1512;
        map = new maplibre.Map({
          container: containerRef.current,
          style: ML_BASE_STYLES[0].style(apiKey),
          center: [safeLng, safeLat],
          zoom: zoom ?? 11,
          pitch: is3D ? 60 : 0,
          bearing: 0,
          antialias: true,
          maxPitch: 85,
        });

        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          if (is3D) setupTerrain(map, apiKey);
          mapReadyRef.current = true;
          setMapReady(c => c + 1);
          setLoading(false);
          // Sync any search category layers that were set before map was ready
          setTimeout(() => syncSearchCategoryLayers(map, searchCategoryLayersRef.current), 100);
        });

        // Swallow tile/source errors (404s, CORS, ArcGIS errors) — these must not crash the map
        map.on("error", (e) => {
          const msg = e?.error?.message || "";
          if (msg.includes("Source") || msg.includes("tile") || msg.includes("404") || msg.includes("Failed to fetch")) return;
          console.warn("MapLibre error:", msg);
        });
        map.on("pitchend", () => setPitch(Math.round(map.getPitch())));
        map.on("rotateend", () => setBearing(Math.round(map.getBearing())));

      } catch (e) {
        if (!cancelled) setError(e.message || "Napaka pri nalaganju karte");
      }
    };

    init();
    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      if (autoRotate.current) { clearInterval(autoRotate.current); autoRotate.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  const switchBase = useCallback((styleId) => {
    const map = mapRef.current;
    const apiKey = apiKeyRef.current;
    if (!map || !apiKey || !mapReadyRef.current) return;
    const styleDef = ML_BASE_STYLES.find(s => s.id === styleId);
    if (!styleDef) return;
    setActiveBase(styleId);
    if (onMLBaseChange) onMLBaseChange(styleId);
    // Stop ALL in-flight camera animations + tile requests before style switch
    try { map.stop(); } catch {}
    // Abort any pending tile loads by cancelling requests
    mapReadyRef.current = false;
    // Small delay so in-flight renders finish before we swap style
    setTimeout(() => {
      try { map.setStyle(styleDef.style(apiKey)); } catch (e) { console.warn("setStyle error:", e.message); return; }
      map.once("style.load", () => {
        if (is3D) setupTerrain(map, apiKey);
        mapReadyRef.current = true;
        // Reset tracked IDs since all layers were wiped by the style switch
        activeCatLayerIds.current = new Set();
        setMapReady(c => c + 1);
        // Re-sync ALL layer types after style change
        setTimeout(() => {
          syncSearchCategoryLayers(map, searchCategoryLayersRef.current);
          // Move all custom/search/GPS layers to top of z-order
          try {
            const allLayers = map.getStyle()?.layers || [];
            allLayers.forEach(l => {
              if (l.id.startsWith("ml-custom_") || l.id.startsWith("ml-search_") || 
                  l.id.startsWith("search_cat_") || l.id.startsWith("ml-gps")) {
                try { map.moveLayer(l.id); } catch {}
              }
            });
          } catch {}
        }, 150);
      });
    }, 50);
  }, [setupTerrain, is3D, syncSearchCategoryLayers]);

  const rotateTo = useCallback((delta) => {
    if (!mapRef.current) return;
    const next = mapRef.current.getBearing() + delta;
    mapRef.current.rotateTo(next, { duration: 400 });
    setBearing(Math.round(next % 360));
  }, []);

  const changePitch = useCallback((delta) => {
    if (!mapRef.current) return;
    const current = mapRef.current.getPitch();
    const next = Math.max(0, Math.min(85, current + delta));
    mapRef.current.setPitch(next);
    setPitch(Math.round(next));
  }, []);

  const resetView = useCallback(() => {
    if (!mapRef.current) return;
    const targetPitch = is3D ? 60 : 0;
    mapRef.current.easeTo({ pitch: targetPitch, bearing: 0, duration: 600 });
    setPitch(targetPitch);
    setBearing(0);
  }, [is3D]);

  const toggleAutoRotate = useCallback(() => {
    if (autoRotate.current) {
      clearInterval(autoRotate.current);
      autoRotate.current = null;
      setIsAutoRotating(false);
    } else {
      setIsAutoRotating(true);
      autoRotate.current = setInterval(() => {
        if (mapRef.current) {
          mapRef.current.setBearing(mapRef.current.getBearing() + 0.5);
          setBearing(Math.round(mapRef.current.getBearing() % 360));
        }
      }, 50);
    }
  }, []);

  useEffect(() => {
    return () => { if (autoRotate.current) clearInterval(autoRotate.current); };
  }, []);

  // Expose switchBase + jumpTo to parent via ref
  useImperativeHandle(ref, () => ({
    switchBase,
    jumpTo: (lat, lng, z) => {
      const map = mapRef.current;
      if (!map || !mapReadyRef.current) return;
      try { map.jumpTo({ center: [lng, lat], zoom: z ?? map.getZoom() }); } catch {}
    },
  }), [switchBase]);

  // Trigger resize + sync location when map becomes visible
  useEffect(() => {
    if (!isVisible) return;
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    setTimeout(() => {
      try { map.resize(); } catch {}
      if (center && !isNaN(center[0]) && !isNaN(center[1])) {
        try { map.jumpTo({ center: [center[1], center[0]], zoom: zoom ?? map.getZoom() }); } catch {}
      }
    }, 150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);



  // React to is3D prop changes without full re-init
  useEffect(() => {
    const map = mapRef.current;
    const apiKey = apiKeyRef.current;
    if (!map || !mapReadyRef.current) return;
    try { map.stop(); } catch {}
    const targetPitch = is3D ? 60 : 0;
    map.easeTo({ pitch: targetPitch, duration: 600 });
    setPitch(targetPitch);
    if (is3D && apiKey) {
      setupTerrain(map, apiKey);
    } else {
      try { map.setTerrain(null); } catch {}
    }
  }, [is3D, setupTerrain]);

  // Pin picking: attach/detach click handler on map when onPinPicked is set
  const isPinPickingRef = useRef(false);
  isPinPickingRef.current = !!onPinPicked;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const handler = (e) => {
      if (!isPinPickingRef.current) return;
      onPinPicked && onPinPicked({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    map.on("click", handler);
    return () => { try { map.off("click", handler); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  return (
    <div className="absolute inset-0" style={{ zIndex: 1, cursor: onPinPicked ? "crosshair" : undefined }}>
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-sm">Nalagam {is3D ? "3D terrain" : "karto"}…</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button onClick={onClose} className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm">Zapri</button>
        </div>
      )}

      {/* Controls — bottom right, only reset button */}
      {!loading && !error && (
        <div className="absolute bottom-8 right-4 z-[500]">
          <button onClick={resetView} className="bg-black/60 hover:bg-black/80 text-white rounded-lg px-3 py-2 text-xs backdrop-blur transition font-medium">
            Reset
          </button>
        </div>
      )}

      {/* Search category layers (3D emoji symbols) - rendered via useEffect above for proper z-index */}
    </div>
  );
});

export default Map3DView;