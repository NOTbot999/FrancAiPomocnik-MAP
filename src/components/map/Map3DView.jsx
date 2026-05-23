import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, RotateCcw, RotateCw, ChevronUp, ChevronDown, Compass, Mountain, Layers, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Base map styles
const BASE_STYLES = [
  { id: "satellite", label: "Satelit", style: (key) => `https://api.maptiler.com/maps/satellite/style.json?key=${key}` },
  { id: "topo",      label: "Topografija", style: (key) => `https://api.maptiler.com/maps/topo-v2/style.json?key=${key}` },
  { id: "outdoor",   label: "Outdoor", style: (key) => `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}` },
  { id: "osm",       label: "OSM", style: (key) => `https://api.maptiler.com/maps/openstreetmap/style.json?key=${key}` },
  { id: "hybrid",    label: "Hibrid", style: (key) => `https://api.maptiler.com/maps/hybrid/style.json?key=${key}` },
];

// Overlay layers (added on top of base style after load)
const OVERLAY_LAYERS = [
  {
    id: "hillshade",
    label: "Senčenje reliefa",
    addToMap: (map, key) => {
      if (!map.getSource("hillshade-src")) {
        map.addSource("hillshade-src", {
          type: "raster-dem",
          url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
          tileSize: 256,
        });
      }
      if (!map.getLayer("hillshade-layer")) {
        map.addLayer({
          id: "hillshade-layer",
          type: "hillshade",
          source: "hillshade-src",
          paint: { "hillshade-shadow-color": "#000", "hillshade-illumination-anchor": "map", "hillshade-intensity": 0.5 },
        });
      }
    },
    removeFromMap: (map) => {
      if (map.getLayer("hillshade-layer")) map.removeLayer("hillshade-layer");
    },
  },
  {
    id: "contours",
    label: "Plastnice",
    addToMap: (map, key) => {
      if (!map.getSource("contours-src")) {
        map.addSource("contours-src", {
          type: "vector",
          url: `https://api.maptiler.com/tiles/contours-v2/tiles.json?key=${key}`,
        });
      }
      if (!map.getLayer("contours-layer")) {
        map.addLayer({
          id: "contours-layer",
          type: "line",
          source: "contours-src",
          "source-layer": "contour",
          paint: { "line-color": "#8b6914", "line-width": 0.6, "line-opacity": 0.6 },
        });
      }
    },
    removeFromMap: (map) => {
      if (map.getLayer("contours-layer")) map.removeLayer("contours-layer");
    },
  },
  {
    id: "roads",
    label: "Ceste",
    addToMap: (map, key) => {
      if (!map.getSource("roads-src")) {
        map.addSource("roads-src", {
          type: "vector",
          url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,
        });
      }
      if (!map.getLayer("roads-layer")) {
        map.addLayer({
          id: "roads-layer",
          type: "line",
          source: "roads-src",
          "source-layer": "transportation",
          paint: { "line-color": "#ff6b35", "line-width": 1.2, "line-opacity": 0.8 },
        });
      }
    },
    removeFromMap: (map) => {
      if (map.getLayer("roads-layer")) map.removeLayer("roads-layer");
    },
  },
  {
    id: "labels",
    label: "Napisi krajev",
    addToMap: (map, key) => {
      if (!map.getSource("labels-src")) {
        map.addSource("labels-src", {
          type: "vector",
          url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,
        });
      }
      if (!map.getLayer("labels-layer")) {
        map.addLayer({
          id: "labels-layer",
          type: "symbol",
          source: "labels-src",
          "source-layer": "place",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-font": ["Noto Sans Regular"],
            "text-anchor": "center",
          },
          paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 },
        });
      }
    },
    removeFromMap: (map) => {
      if (map.getLayer("labels-layer")) map.removeLayer("labels-layer");
    },
  },
];

export default function Map3DView({ center, zoom, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const apiKeyRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pitch, setPitch] = useState(60);
  const [bearing, setBearing] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [activeBase, setActiveBase] = useState("satellite");
  const [activeOverlays, setActiveOverlays] = useState([]);
  const autoRotate = useRef(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const mapReadyRef = useRef(false);

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
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
            document.head.appendChild(link);
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
          style: BASE_STYLES[0].style(apiKey),
          center: [center[1], center[0]],
          zoom: zoom ?? 11,
          pitch: 60,
          bearing: 0,
          antialias: true,
          maxPitch: 85,
        });

        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          setupTerrain(map, apiKey);
          mapReadyRef.current = true;
          setLoading(false);
        });

        map.on("error", (e) => console.error("MapLibre error:", e));
        map.on("pitchend", () => setPitch(Math.round(map.getPitch())));
        map.on("rotateend", () => setBearing(Math.round(map.getBearing())));

      } catch (e) {
        if (!cancelled) setError(e.message || "Napaka pri nalaganju 3D karte");
      }
    };

    init();
    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Switch base style
  const switchBase = useCallback((styleId) => {
    const map = mapRef.current;
    const apiKey = apiKeyRef.current;
    if (!map || !apiKey || !mapReadyRef.current) return;

    const styleDef = BASE_STYLES.find(s => s.id === styleId);
    if (!styleDef) return;

    setActiveBase(styleId);
    setActiveOverlays([]); // clear overlays on style change (they'll be re-added after style load)
    map.setStyle(styleDef.style(apiKey));

    map.once("style.load", () => {
      setupTerrain(map, apiKey);
    });
  }, [setupTerrain]);

  // Toggle overlay layer
  const toggleOverlay = useCallback((overlayId) => {
    const map = mapRef.current;
    const apiKey = apiKeyRef.current;
    if (!map || !apiKey || !mapReadyRef.current) return;

    const overlay = OVERLAY_LAYERS.find(o => o.id === overlayId);
    if (!overlay) return;

    setActiveOverlays(prev => {
      const isActive = prev.includes(overlayId);
      if (isActive) {
        overlay.removeFromMap(map);
        return prev.filter(id => id !== overlayId);
      } else {
        overlay.addToMap(map, apiKey);
        return [...prev, overlayId];
      }
    });
  }, []);

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
    mapRef.current.easeTo({ pitch: 60, bearing: 0, duration: 600 });
    setPitch(60);
    setBearing(0);
  }, []);

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
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Mountain className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">3D Pogled</span>
          <span className="text-white/50 text-xs ml-2">Pitch: {pitch}° · Bearing: {bearing}°</span>
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Map container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-sm">Nalagam 3D terrain…</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button onClick={onClose} className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm">Zapri</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Layer panel toggle button — left side */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
            <button
              onClick={() => setShowLayers(p => !p)}
              className={`rounded-full p-2.5 backdrop-blur transition ${showLayers ? "bg-emerald-500 text-white" : "bg-black/60 hover:bg-black/80 text-white"}`}
              title="Sloji"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          {/* Layer panel */}
          {showLayers && (
            <div className="absolute left-14 top-1/2 -translate-y-1/2 z-10 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 p-3 w-48">
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Osnovna karta</p>
              <div className="space-y-1 mb-3">
                {BASE_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => switchBase(style.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition ${
                      activeBase === style.id
                        ? "bg-emerald-500 text-white"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {activeBase === style.id && <Check className="w-3 h-3 shrink-0" />}
                    {activeBase !== style.id && <span className="w-3 h-3 shrink-0" />}
                    {style.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 pt-2 mb-2">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Prekrivi</p>
                <div className="space-y-1">
                  {OVERLAY_LAYERS.map(overlay => {
                    const active = activeOverlays.includes(overlay.id);
                    return (
                      <button
                        key={overlay.id}
                        onClick={() => toggleOverlay(overlay.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition ${
                          active
                            ? "bg-emerald-500/80 text-white"
                            : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <div className={`w-3 h-3 rounded shrink-0 border transition ${active ? "bg-emerald-400 border-emerald-400" : "border-white/40"}`} />
                        {overlay.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Controls — right side */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
            <button onClick={() => rotateTo(-15)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition" title="Zavrti levo">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => rotateTo(15)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition" title="Zavrti desno">
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleAutoRotate}
              className={`rounded-full p-2.5 backdrop-blur transition ${isAutoRotating ? "bg-emerald-500 text-white" : "bg-black/60 hover:bg-black/80 text-white"}`}
              title="Samodejno vrtenje 360°"
            >
              <Compass className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-white/20 mx-auto" />

            <button onClick={() => changePitch(10)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition" title="Pogled bolj navzdol">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={() => changePitch(-10)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition" title="Pogled bolj ravno">
              <ChevronUp className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-white/20 mx-auto" />
            <button onClick={resetView} className="bg-black/60 hover:bg-black/80 text-white rounded-xl px-2 py-1.5 text-[10px] backdrop-blur transition font-medium" title="Ponastavi pogled">
              Reset
            </button>
          </div>

          {/* Bottom hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/50 text-[11px] text-center pointer-events-none">
            Drag to pan · Scroll to zoom · Right-drag to tilt
          </div>
        </>
      )}
    </div>
  );
}