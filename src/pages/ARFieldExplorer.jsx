import React, { useEffect, useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { X, Camera, MapPin, Navigation, AlertTriangle, Info, Layers } from "lucide-react";
import { Link } from "react-router-dom";

const EARTH_R = 6371000;

function toRad(d) { return d * Math.PI / 180; }

function bearingTo(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function distanceTo(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

const H_FOV = 60;

const RADIUS_OPTIONS = [
  { label: "1 km",  value: 1000 },
  { label: "5 km",  value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "30 km", value: 30000 },
];

// Stable color per category
const CAT_COLORS = [
  "#10b981","#6366f1","#f59e0b","#ef4444","#3b82f6",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#a3e635",
];
function categoryColor(idx) { return CAT_COLORS[idx % CAT_COLORS.length]; }

export default function ARFieldExplorer() {
  const videoRef = useRef(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(null);
  const [nearbyPins, setNearbyPins] = useState([]);
  const [nearbyCaves, setNearbyCaves] = useState([]);
  const [cachedLayers, setCachedLayers] = useState([]); // all CachedLayer records
  const [nearbyFromCache, setNearbyFromCache] = useState([]); // filtered by radius
  const [radius, setRadius] = useState(5000); // default 5 km
  const [showInfo, setShowInfo] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState(new Set());
  const watchIdRef = useRef(null);

  // Camera
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setStreamReady(true);
        }
      } catch {
        setError("Kamere ni mogoče odpreti. Prosimo, dovolite dostop do kamere.");
      }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) { setError("Geolokacija ni podprta."); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // Compass
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.webkitCompassHeading != null) {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha != null) {
        setHeading((360 - e.alpha) % 360);
      }
    };
    const requestPermission = async () => {
      if (typeof DeviceOrientationEvent?.requestPermission === "function") {
        try {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm === "granted") window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        } catch {}
      } else {
        window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        window.addEventListener("deviceorientation", handleOrientation, true);
      }
    };
    requestPermission();
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  // Fetch pins + caves when position changes
  useEffect(() => {
    if (!userPos) return;
    const fetchData = async () => {
      try {
        const [pins, caves] = await Promise.all([
          base44.entities.CollabPin.list("-created_date", 50),
          base44.entities.Cave.list("-created_date", 100),
        ]);
        setNearbyPins(
          (pins || [])
            .filter(p => p.lat && p.lng)
            .map(p => ({ ...p, _dist: distanceTo(userPos.lat, userPos.lng, p.lat, p.lng) }))
            .filter(p => p._dist < radius)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 15)
        );
        setNearbyCaves(
          (caves || [])
            .filter(c => c.latitude && c.longitude)
            .map(c => ({ ...c, lat: c.latitude, lng: c.longitude, _dist: distanceTo(userPos.lat, userPos.lng, c.latitude, c.longitude) }))
            .filter(c => c._dist < radius)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 15)
        );
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [userPos, radius]);

  // Load CachedLayer records + subscribe to changes (auto-sync)
  useEffect(() => {
    const loadLayers = async () => {
      try {
        const layers = await base44.entities.CachedLayer.list("-built_at", 100);
        setCachedLayers(layers || []);
      } catch {}
    };
    loadLayers();

    // Real-time subscription — auto-syncs when new categories are added
    const unsubscribe = base44.entities.CachedLayer.subscribe((event) => {
      if (event.type === "create") {
        setCachedLayers(prev => [...prev, event.data]);
      } else if (event.type === "update") {
        setCachedLayers(prev => prev.map(l => l.id === event.id ? event.data : l));
      } else if (event.type === "delete") {
        setCachedLayers(prev => prev.filter(l => l.id !== event.id));
      }
    });
    return unsubscribe;
  }, []);

  // Filter cached layer features by radius + user position
  useEffect(() => {
    if (!userPos || cachedLayers.length === 0) { setNearbyFromCache([]); return; }
    const nearby = [];
    cachedLayers.forEach((layer, layerIdx) => {
      if (hiddenCategories.has(layer.category_id)) return;
      const color = categoryColor(layerIdx);
      (layer.features || []).forEach((f) => {
        if (f.type !== "Point" || !f.coords || f.coords.length < 2) return;
        const [lng, lat] = f.coords; // GeoJSON: [lng, lat]
        const dist = distanceTo(userPos.lat, userPos.lng, lat, lng);
        if (dist < radius) {
          nearby.push({
            id: `cache-${layer.category_id}-${lat}-${lng}`,
            label: f.label || layer.category_id,
            subLabel: layer.category_id,
            lat, lng,
            dist,
            color,
            type: "category",
          });
        }
      });
    });
    nearby.sort((a, b) => a.dist - b.dist);
    setNearbyFromCache(nearby.slice(0, 50)); // max 50 category POIs
  }, [userPos, cachedLayers, radius, hiddenCategories]);

  // All POIs merged
  const allPois = useMemo(() => {
    const pinPois = nearbyPins.map(p => ({
      id: `pin-${p.id}`,
      label: p.label || "Skupna označba",
      subLabel: p.username ? `@${p.username}` : "",
      lat: p.lat, lng: p.lng,
      dist: p._dist,
      color: p.color || "#10b981",
      type: "pin",
    }));
    const cavePois = nearbyCaves.map(c => ({
      id: `cave-${c.id}`,
      label: c.name,
      subLabel: c.length_m ? `${c.length_m} m` : "",
      lat: c.lat, lng: c.lng,
      dist: c._dist,
      color: "#6366f1",
      type: "cave",
    }));
    return [...pinPois, ...cavePois, ...nearbyFromCache];
  }, [nearbyPins, nearbyCaves, nearbyFromCache]);

  // Compute visible POIs based on heading
  const visiblePois = useMemo(() => {
    if (!userPos || heading == null) return [];
    return allPois.map(poi => {
      const bearing = bearingTo(userPos.lat, userPos.lng, poi.lat, poi.lng);
      let relAngle = bearing - heading;
      if (relAngle > 180) relAngle -= 360;
      if (relAngle < -180) relAngle += 360;
      const halfFov = H_FOV / 2;
      if (Math.abs(relAngle) > halfFov + 10) return null;
      const screenX = 50 + (relAngle / halfFov) * 50;
      const screenY = Math.max(15, 80 - (poi.dist / radius) * 60);
      return { ...poi, screenX, screenY, relAngle };
    }).filter(Boolean).sort((a, b) => b.dist - a.dist);
  }, [userPos, heading, allPois, radius]);

  const toggleCategory = (catId) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 9999 }}>
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 pb-2" style={{ zIndex: 10 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span className="text-white text-xs font-semibold">AR Teren</span>
          </div>
          {heading != null && (
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5">
              <Navigation className="w-3.5 h-3.5 text-sky-400" style={{ transform: `rotate(${heading}deg)` }} />
              <span className="text-white text-xs font-mono">{Math.round(heading)}°</span>
            </div>
          )}
          {userPos && (
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-xl px-2.5 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white text-[10px] font-mono">{userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLayers(p => !p)}
            className="w-9 h-9 rounded-xl bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowInfo(p => !p)}
            className="w-9 h-9 rounded-xl bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition"
          >
            <Info className="w-4 h-4" />
          </button>
          <Link to="/">
            <button className="w-9 h-9 rounded-xl bg-red-500/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-600 transition">
              <X className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Radius selector */}
      <div className="absolute top-16 inset-x-0 flex justify-center gap-2 px-4" style={{ zIndex: 10 }}>
        {RADIUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRadius(opt.value)}
            className="px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border transition"
            style={{
              backgroundColor: radius === opt.value ? "#10b981" : "rgba(0,0,0,0.5)",
              color: "#fff",
              borderColor: radius === opt.value ? "#10b981" : "rgba(255,255,255,0.2)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
          <div className="bg-black/80 rounded-2xl p-6 max-w-xs text-center mx-4">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-white text-sm">{error}</p>
            <Link to="/" className="mt-4 inline-block bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl">
              Nazaj na karto
            </Link>
          </div>
        </div>
      )}

      {/* GPS / compass warnings */}
      {!error && streamReady && !userPos && (
        <div className="absolute bottom-28 inset-x-4 flex justify-center" style={{ zIndex: 10 }}>
          <div className="bg-amber-500/90 backdrop-blur-md rounded-xl px-4 py-2 text-white text-xs flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Čakam na GPS signal...
          </div>
        </div>
      )}
      {!error && streamReady && userPos && heading == null && (
        <div className="absolute bottom-28 inset-x-4 flex justify-center" style={{ zIndex: 10 }}>
          <div className="bg-sky-500/90 backdrop-blur-md rounded-xl px-4 py-2 text-white text-xs flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Premakni telefon za kalibracijo kompasa...
          </div>
        </div>
      )}

      {/* AR POI overlays */}
      {visiblePois.map(poi => {
        const opacity = Math.max(0.3, 1 - Math.abs(poi.relAngle) / (H_FOV / 2 + 10));
        return (
          <div
            key={poi.id}
            className="absolute pointer-events-none"
            style={{
              left: `${poi.screenX}%`,
              top: `${poi.screenY}%`,
              transform: "translate(-50%, -50%)",
              opacity,
              zIndex: 8,
              transition: "left 0.3s ease, top 0.3s ease",
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-xl border max-w-[140px] text-center"
                style={{ backgroundColor: poi.color + "dd", borderColor: poi.color + "88" }}
              >
                <p className="text-white text-[11px] font-bold leading-tight truncate">{poi.label}</p>
                {poi.subLabel && <p className="text-white/70 text-[9px] truncate">{poi.subLabel}</p>}
                <p className="text-white text-[10px] font-mono mt-0.5">{formatDist(poi.dist)}</p>
              </div>
              <div className="w-1.5 h-4 rounded-full" style={{ background: `linear-gradient(to bottom, ${poi.color}, transparent)` }} />
              <div className="w-3 h-3 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: poi.color }} />
            </div>
          </div>
        );
      })}

      {/* Crosshair */}
      {streamReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 7 }}>
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-white/60 rounded-full" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-white/60 rounded-full" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-2.5 bg-white/60 rounded-full" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-2.5 bg-white/60 rounded-full" />
          </div>
        </div>
      )}

      {/* Bottom stats bar */}
      {streamReady && (
        <div className="absolute bottom-6 inset-x-4 flex items-center justify-center gap-2 flex-wrap" style={{ zIndex: 10 }}>
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-white text-xs">{nearbyPins.length} označb</span>
          </div>
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-white text-xs">{nearbyCaves.length} jam</span>
          </div>
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-white text-xs">{nearbyFromCache.length} kategorij</span>
          </div>
        </div>
      )}

      {/* Layers panel */}
      {showLayers && (
        <div className="absolute inset-0 bg-black/70 flex items-end justify-center pb-6" style={{ zIndex: 20 }}>
          <div className="bg-slate-900 rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl border border-slate-700 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Sloji v AR pogledu</h3>
              <button onClick={() => setShowLayers(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            {/* Built-in */}
            <p className="text-slate-500 text-[10px] uppercase font-semibold mb-2">Vgrajeno</p>
            <div className="space-y-1.5 mb-4">
              {[{ id: "_pins", label: "Skupne označbe", color: "#10b981" }, { id: "_caves", label: "Jame", color: "#6366f1" }].map(item => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-white text-sm">{item.label}</span>
                </div>
              ))}
            </div>
            {/* CachedLayer categories */}
            <p className="text-slate-500 text-[10px] uppercase font-semibold mb-2">Kategorije s karte ({cachedLayers.length})</p>
            {cachedLayers.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-3">Ni kategorij. Dodaj jih z iskalnikom na karti.</p>
            )}
            <div className="space-y-1.5">
              {cachedLayers.map((layer, idx) => {
                const hidden = hiddenCategories.has(layer.category_id);
                const color = categoryColor(idx);
                return (
                  <button
                    key={layer.category_id}
                    onClick={() => toggleCategory(layer.category_id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition"
                    style={{ backgroundColor: hidden ? "rgba(30,41,59,0.5)" : "rgba(30,41,59,1)" }}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hidden ? "#475569" : color }} />
                    <span className="text-sm flex-1 text-left" style={{ color: hidden ? "#64748b" : "#fff" }}>
                      {layer.category_id}
                    </span>
                    <span className="text-[10px] text-slate-500">{(layer.features || []).length} točk</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: hidden ? "#374151" : "#10b981" + "30", color: hidden ? "#6b7280" : "#10b981" }}>
                      {hidden ? "skrito" : "vidno"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Info panel */}
      {showInfo && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 20 }}>
          <div className="bg-slate-900 rounded-2xl p-5 max-w-sm mx-4 shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">AR Teren — Navodila</h3>
              <button onClick={() => setShowInfo(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-slate-300 text-sm">
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><p>Točke skupnega dela, jame in kategorije iz karte se prikažejo glede na smer pogleda.</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 shrink-0" /><p>Izberi radij (1, 5, 10, 30 km) za filtriranje bližnjih točk.</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" /><p>Kategorije se samodejno sinhronizirajo z novimi sloji na karti (real-time).</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" /><p>Klikni <strong>Sloji</strong> (ikona zgoraj) za upravljanje vidnih kategorij.</p></div>
            </div>
            <button onClick={() => setShowInfo(false)} className="mt-4 w-full bg-emerald-500 text-white rounded-xl py-2 text-sm font-semibold hover:bg-emerald-600 transition">
              Razumem
            </button>
          </div>
        </div>
      )}
    </div>
  );
}