import React, { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, RotateCw, Compass, ChevronUp, ChevronDown, Mountain, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMapLibreLayers } from "./useMapLibreLayers";

// MapLibre base map styles
export const ML_BASE_STYLES = [
  { id: "satellite", label: "Satelit",     style: (key) => `https://api.maptiler.com/maps/satellite/style.json?key=${key}` },
  { id: "topo",      label: "Topografija", style: (key) => `https://api.maptiler.com/maps/topo-v2/style.json?key=${key}` },
  { id: "outdoor",   label: "Outdoor",     style: (key) => `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}` },
  { id: "osm",       label: "OSM",         style: (key) => `https://api.maptiler.com/maps/openstreetmap/style.json?key=${key}` },
  { id: "hybrid",    label: "Hibrid",      style: (key) => `https://api.maptiler.com/maps/hybrid/style.json?key=${key}` },
];

export default function Map3DView({
  center, zoom, onClose, is3D = true,
  activeBaseLayers = {}, activeLayers = {},
  layerOpacities = {}, baseLayerOpacities = {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const apiKeyRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pitch, setPitch] = useState(is3D ? 60 : 0);
  const [bearing, setBearing] = useState(0);
  const [activeBase, setActiveBase] = useState("satellite");
  const autoRotate = useRef(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // Sync LayerPanel layers into MapLibre
  useMapLibreLayers(mapRef, mapReadyRef, {
    activeBaseLayers,
    activeLayers,
    layerOpacities,
    baseLayerOpacities,
    mapReady,
  });

  const setupTerrain = useCallback((map, key) => {
    if (!map.getSource("terrain-dem")) {
      map.addSource("terrain-dem", {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 256,
      });
    }
    map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
    if (!map.getLayer("sky")) {
      map.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0.0, 90.0],
          "sky-atmosphere-sun-intensity": 15,
        },
      });
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

        if (cancelled || !containerRef.current) return;

        const maplibre = window.maplibregl;
        map = new maplibre.Map({
          container: containerRef.current,
          style: ML_BASE_STYLES[0].style(apiKey),
          center: [center[1], center[0]],
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
          setMapReady(true);
          setLoading(false);
        });

        map.on("error", (e) => console.error("MapLibre error:", e));
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
    mapReadyRef.current = false;
    map.setStyle(styleDef.style(apiKey));
    map.once("style.load", () => {
      if (is3D) setupTerrain(map, apiKey);
      mapReadyRef.current = true;
      // Force re-sync of layers by toggling mapReady
      setMapReady(false);
      setTimeout(() => setMapReady(true), 50);
    });
  }, [setupTerrain, is3D]);

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

  return (
    <div className="absolute inset-0" style={{ zIndex: 1 }}>
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

      {/* Controls — bottom right, above z-index 1 but below UI panels */}
      {!loading && !error && (
        <div className="absolute bottom-8 right-4 z-[500] flex flex-col gap-1.5">
          {/* Status pill */}
          <div className="bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded-lg text-center font-mono mb-1">
            {is3D ? <Mountain className="w-3 h-3 inline mr-1" /> : <Square className="w-3 h-3 inline mr-1" />}
            P:{pitch}° B:{bearing}°
          </div>

          <button onClick={() => rotateTo(-15)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur transition" title="Zavrti levo">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => rotateTo(15)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur transition" title="Zavrti desno">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleAutoRotate}
            className={`rounded-full p-2 backdrop-blur transition ${isAutoRotating ? "bg-emerald-500 text-white" : "bg-black/60 hover:bg-black/80 text-white"}`}
            title="Samodejno vrtenje"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {is3D && (
            <>
              <div className="w-px h-3 bg-white/20 mx-auto" />
              <button onClick={() => changePitch(10)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur transition" title="Pogled bolj navzdol">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => changePitch(-10)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur transition" title="Pogled bolj ravno">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <div className="w-px h-3 bg-white/20 mx-auto" />
          <button onClick={resetView} className="bg-black/60 hover:bg-black/80 text-white rounded-lg px-1.5 py-1 text-[9px] backdrop-blur transition font-medium">
            Reset
          </button>
        </div>
      )}

      {/* Base map selector — bottom left */}
      {!loading && !error && (
        <div className="absolute bottom-8 left-4 z-[500] flex flex-col gap-1">
          {ML_BASE_STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => switchBase(style.id)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium backdrop-blur transition ${
                activeBase === style.id
                  ? "bg-emerald-500 text-white"
                  : "bg-black/60 hover:bg-black/80 text-white/80"
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}