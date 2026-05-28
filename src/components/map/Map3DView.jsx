import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMapLibreLayers } from "./useMapLibreLayers";
import SearchCategory3DLayer from "./SearchCategory3DLayer";

// MapLibre base map styles
export const ML_BASE_STYLES = [
  { id: "satellite", label: "Satelit",     style: (key) => `https://api.maptiler.com/maps/satellite/style.json?key=${key}` },
  { id: "topo",      label: "Topografija", style: (key) => `https://api.maptiler.com/maps/topo-v2/style.json?key=${key}` },
  { id: "outdoor",   label: "Outdoor",     style: (key) => `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}` },
  { id: "osm",       label: "OSM",         style: (key) => `https://api.maptiler.com/maps/openstreetmap/style.json?key=${key}` },
  { id: "hybrid",    label: "Hibrid",      style: (key) => `https://api.maptiler.com/maps/hybrid/style.json?key=${key}` },
  { id: "cesium",    label: "Cesium",      style: null, isCesium: true },
];

// Fetch Cesium Ion asset endpoint and build a MapLibre raster style
async function buildCesiumStyle(cesiumToken) {
  // Asset 1 = Cesium World Imagery (high-res satellite)
  const endpointRes = await fetch(
    `https://api.cesium.com/v1/assets/1/endpoint?access_token=${cesiumToken}`
  );
  if (!endpointRes.ok) throw new Error("Cesium endpoint fetch failed: " + endpointRes.status);
  const endpoint = await endpointRes.json();
  // endpoint.url is like "https://assets.cesium.com/1/{z}/{x}/{y}.jpg"
  // endpoint.accessToken may be a short-lived token
  const tileUrl = endpoint.url + "?access_token=" + (endpoint.accessToken || cesiumToken);

  return {
    version: 8,
    sources: {
      "cesium-imagery": {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: endpoint.attributions?.[0]?.html || "© Cesium Ion / Maxar",
        maxzoom: 20,
      }
    },
    layers: [
      {
        id: "cesium-imagery-layer",
        type: "raster",
        source: "cesium-imagery",
        paint: { "raster-opacity": 1 }
      }
    ]
  };
}

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

  // Sync LayerPanel layers into MapLibre (base layers, overlays, custom layers, GPS tracks)
  useMapLibreLayers(mapRef, mapReadyRef, {
    activeBaseLayers,
    activeLayers,
    layerOpacities,
    baseLayerOpacities,
    mapReady,
    customLayers,
    customLayerVisible,
    customLayerOpacities,
    gpsTrack,
  });

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

        const geojsonFeatures = (catLayer.features || [])
          .filter(f => f?.type === "Point" && f?.coords && Array.isArray(f.coords) && f.coords.length >= 2)
          .map(f => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [f.coords[1], f.coords[0]] },
            properties: { label: f.label || "", emoji }
          }));

        if (geojsonFeatures.length === 0) return;

        const geojson = { type: "FeatureCollection", features: geojsonFeatures };

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: "geojson", data: geojson, cluster: false });
        } else {
          map.getSource(sourceId).setData(geojson);
        }

        if (!map.getLayer(layerId)) {
          const allLayers = map.getStyle()?.layers || [];
          const topLayerId = allLayers.length > 0 ? allLayers[allLayers.length - 1].id : undefined;
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
              "symbol-z-elevate": true,
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
        } else {
          try { map.setPaintProperty(layerId, "text-opacity", catLayer.opacity ?? 1); } catch {}
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
    const t = setTimeout(() => syncSearchCategoryLayers(map, searchCategoryLayersRef.current), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCategoryLayers, mapReady]);

  const [skyColor, setSkyColor] = useState({ top: "#1a3a5c", bottom: "#87ceeb" });

  // Fetch current weather sky color based on map center
  useEffect(() => {
    const fetchWeatherSky = async () => {
      const lat = (center && !isNaN(center[0])) ? center[0] : 46.1512;
      const lng = (center && !isNaN(center[1])) ? center[1] : 14.9955;
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=9de243494c0b295cca9337e1e96b00e2`
        );
        const data = await res.json();
        const id = data?.weather?.[0]?.id ?? 800;
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 20;
        if (isNight) {
          setSkyColor({ top: "#0a0a1a", bottom: "#1a1a3a" });
        } else if (id >= 200 && id < 600) {
          // Rain / storm / snow
          setSkyColor({ top: "#2d3436", bottom: "#636e72" });
        } else if (id >= 600 && id < 700) {
          // Snow
          setSkyColor({ top: "#b2bec3", bottom: "#dfe6e9" });
        } else if (id >= 700 && id < 800) {
          // Fog / mist
          setSkyColor({ top: "#636e72", bottom: "#b2bec3" });
        } else if (id === 800) {
          // Clear sky
          setSkyColor({ top: "#0e4d92", bottom: "#87ceeb" });
        } else if (id > 800) {
          // Cloudy
          setSkyColor({ top: "#555f6b", bottom: "#a4b0be" });
        }
      } catch {
        // fallback — clear blue
        setSkyColor({ top: "#0e4d92", bottom: "#87ceeb" });
      }
    };
    fetchWeatherSky();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skyColorRef = useRef(skyColor);
  useEffect(() => { skyColorRef.current = skyColor; }, [skyColor]);

  const setupTerrain = useCallback((map, key) => {
    if (!map.getSource("terrain-dem")) {
      map.addSource("terrain-dem", {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 256,
      });
    }
    map.setTerrain({ source: "terrain-dem", exaggeration: 1.0 });
    // Sky layer
    if (!map.getLayer("sky")) {
      const sc = skyColorRef.current;
      map.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "gradient",
          "sky-gradient": ["interpolate", ["linear"], ["sky-radial-progress"],
            0.0, sc.bottom,
            1.0, sc.top
          ],
          "sky-gradient-center": [0, 0],
          "sky-gradient-radius": 90,
          "sky-opacity": 1.0,
        },
      });
    }
    // 3D Buildings
    if (!map.getLayer("3d-buildings")) {
      try {
        const layers = map.getStyle()?.layers || [];
        // Find the first symbol layer to insert buildings below labels
        const labelLayerId = layers.find(l => l.type === "symbol" && l.layout?.["text-field"])?.id;
        map.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": [
              "interpolate", ["linear"], ["get", "height"],
              0, "#c8d6e5",
              50, "#8395a7",
              200, "#576574"
            ],
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, ["get", "height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, ["get", "min_height"]],
            "fill-extrusion-opacity": 0.85,
          }
        }, labelLayerId);
      } catch (e) {
        // source may not exist on all base styles — silently ignore
        console.warn("[Map3D] 3d-buildings layer skipped:", e.message);
      }
    }
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
        window.__maptilerKey = apiKey; // share with useMapLibreLayers and MapContainer

        // Fetch Cesium token (non-blocking — silently fail if unavailable)
        base44.functions.invoke("getCesiumToken", {}).then(r => {
          if (r.data?.token) {
            window.__cesiumToken = r.data.token; // eslint-disable-line
          }
        }).catch(() => {});

        if (cancelled || !containerRef.current) return;

        // Determine initial style — respect activeMLBase prop
        const initialStyleId = activeMLBase || "satellite";
        const initialStyleDef = ML_BASE_STYLES.find(s => s.id === initialStyleId) || ML_BASE_STYLES[0];
        let initialStyle;
        if (initialStyleDef.isCesium) {
          let cesToken = window.__cesiumToken || null;
          if (!cesToken) {
            try {
              const cesRes = await base44.functions.invoke("getCesiumToken", {});
              cesToken = cesRes.data?.token;
              window.__cesiumToken = cesToken;
            } catch {}
          }
          try {
            initialStyle = cesToken ? await buildCesiumStyle(cesToken) : ML_BASE_STYLES[0].style(apiKey);
          } catch {
            initialStyle = ML_BASE_STYLES[0].style(apiKey);
          }
        } else {
          initialStyle = initialStyleDef.style(apiKey);
        }

        const maplibre = window.maplibregl;
        const safeLng = (center && !isNaN(center[1])) ? center[1] : 14.9955;
        const safeLat = (center && !isNaN(center[0])) ? center[0] : 46.1512;
        map = new maplibre.Map({
          container: containerRef.current,
          style: initialStyle,
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
          // Force resize so map fills the container after first render
          try { map.resize(); } catch {}
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
    if (!map || !mapReadyRef.current) return;
    const styleDef = ML_BASE_STYLES.find(s => s.id === styleId);
    if (!styleDef) return;
    setActiveBase(styleId);
    if (onMLBaseChange) onMLBaseChange(styleId);
    try { map.stop(); } catch {}
    mapReadyRef.current = false;

    const applyStyle = (styleObj) => {
      try { map.setStyle(styleObj); } catch (e) { console.warn("setStyle error:", e.message); return; }
      map.once("style.load", () => {
        if (is3D) setupTerrain(map, apiKey);
        mapReadyRef.current = true;
        activeCatLayerIds.current = new Set();
        setMapReady(c => c + 1);
        setTimeout(() => syncSearchCategoryLayers(map, searchCategoryLayersRef.current), 150);
      });
    };

    setTimeout(async () => {
      if (styleDef.isCesium) {
        let token = window.__cesiumToken || null;
        if (!token) {
          try {
            const cesRes = await base44.functions.invoke("getCesiumToken", {});
            token = cesRes.data?.token;
            window.__cesiumToken = token;
          } catch {}
        }
        if (!token) { console.warn("No Cesium token"); mapReadyRef.current = true; return; }
        try {
          const cesiumStyle = await buildCesiumStyle(token);
          applyStyle(cesiumStyle);
        } catch (e) {
          console.warn("Cesium style build failed:", e.message);
          mapReadyRef.current = true;
        }
      } else {
        applyStyle(styleDef.style(apiKey));
      }
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
      // Re-sync layers when 3D view becomes visible (custom layers may have been added while hidden)
      setMapReady(c => c + 1);
    }, 200);
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

    // Re-sync all layers after terrain toggle so custom layers remain visible
    setTimeout(() => { setMapReady(c => c + 1); }, 200);
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
    <div className="absolute inset-0" style={{ zIndex: 1, cursor: onPinPicked ? "crosshair" : undefined, width: "100%", height: "100%" }}>
      {/* Map container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

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