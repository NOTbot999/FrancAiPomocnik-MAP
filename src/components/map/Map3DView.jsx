import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, RotateCcw, RotateCw, ChevronUp, ChevronDown, Compass, Mountain } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Map3DView({ center, zoom, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pitch, setPitch] = useState(60);
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    let map = null;
    let cancelled = false;

    const init = async () => {
      try {
        // Load MapLibre GL JS dynamically
        if (!window.maplibregl) {
          await new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
            document.head.appendChild(link);

            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        if (cancelled) return;

        const res = await base44.functions.invoke("getMaptilerKey", {});
        const apiKey = res.data?.key;
        if (!apiKey) throw new Error("No API key");

        if (cancelled || !containerRef.current) return;

        const maplibre = window.maplibregl;

        map = new maplibre.Map({
          container: containerRef.current,
          style: `https://api.maptiler.com/maps/satellite/style.json?key=${apiKey}`,
          center: [center[1], center[0]], // [lng, lat]
          zoom: zoom ?? 11,
          pitch: 60,
          bearing: 0,
          antialias: true,
        });

        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;

          // Add terrain source (Maptiler)
          map.addSource("terrain-dem", {
            type: "raster-dem",
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
            tileSize: 256,
          });

          map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });

          // Sky layer for atmosphere effect
          map.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 90.0],
              "sky-atmosphere-sun-intensity": 15,
            },
          });

          setLoading(false);
        });

        map.on("error", (e) => {
          console.error("MapLibre error:", e);
        });

        map.on("pitchend", () => setPitch(Math.round(map.getPitch())));
        map.on("rotateend", () => setBearing(Math.round(map.getBearing())));

      } catch (e) {
        if (!cancelled) setError(e.message || "Napaka pri nalaganju 3D karte");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
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

  const autoRotate = useRef(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);

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

      {/* Controls — right side */}
      {!loading && !error && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
          {/* Rotation */}
          <button
            onClick={() => rotateTo(-15)}
            className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition"
            title="Zavrti levo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => rotateTo(15)}
            className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition"
            title="Zavrti desno"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Compass / auto-rotate */}
          <button
            onClick={toggleAutoRotate}
            className={`rounded-full p-2.5 backdrop-blur transition ${isAutoRotating ? "bg-emerald-500 text-white" : "bg-black/60 hover:bg-black/80 text-white"}`}
            title="Samodejno vrtenje 360°"
          >
            <Compass className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-auto" />

          {/* Pitch */}
          <button
            onClick={() => changePitch(10)}
            className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition"
            title="Pogled bolj navzdol"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => changePitch(-10)}
            className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur transition"
            title="Pogled bolj ravno"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {/* Reset */}
          <div className="w-px h-4 bg-white/20 mx-auto" />
          <button
            onClick={resetView}
            className="bg-black/60 hover:bg-black/80 text-white rounded-xl px-2 py-1.5 text-[10px] backdrop-blur transition font-medium"
            title="Ponastavi pogled"
          >
            Reset
          </button>
        </div>
      )}

      {/* Bottom hint */}
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/50 text-[11px] text-center pointer-events-none">
          Drag to pan · Scroll to zoom · Right-drag to tilt
        </div>
      )}
    </div>
  );
}