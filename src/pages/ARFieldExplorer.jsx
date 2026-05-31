import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, Camera, MapPin, Navigation, AlertTriangle, Info, Layers, Loader2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { CATEGORIES, fetchFullSloveniaLayer } from "@/components/map/SearchBar";
import { loadCaves, cavesToLayerFeatures } from "@/components/map/CaveLayer";

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

const CAT_COLORS = [
  "#10b981","#6366f1","#f59e0b","#ef4444","#3b82f6",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#a3e635",
];
function categoryColor(idx) { return CAT_COLORS[idx % CAT_COLORS.length]; }

// AR localStorage key for active categories
const AR_ACTIVE_CATS_KEY = "ar_active_categories";

function loadActiveCats() {
  try {
    const s = localStorage.getItem(AR_ACTIVE_CATS_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveActiveCats(cats) {
  try { localStorage.setItem(AR_ACTIVE_CATS_KEY, JSON.stringify(cats)); } catch {}
}

export default function ARFieldExplorer() {
  const videoRef = useRef(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(null);
  const [radius, setRadius] = useState(5000);
  const [showInfo, setShowInfo] = useState(false);
  const [showLayers, setShowLayers] = useState(false);

  // Active category IDs and their loaded feature data
  const [activeCatIds, setActiveCatIds] = useState(loadActiveCats);
  const [catFeatures, setCatFeatures] = useState({}); // catId → [{lat,lng,label}]
  const [loadingCats, setLoadingCats] = useState(new Set());

  // Collab pins + caves (built-in)
  const [nearbyPins, setNearbyPins] = useState([]);
  const [nearbyCaves, setNearbyCaves] = useState([]);
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

  // Compass — absolutna smer (deviceorientationabsolute) ima prednost, fallback na deviceorientation
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);
  const absoluteReceivedRef = useRef(false);

  useEffect(() => {
    const handleAbsolute = (e) => {
      absoluteReceivedRef.current = true;
      // webkitCompassHeading = iOS, alpha na absolute eventu = Android
      if (e.webkitCompassHeading != null) {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha != null) {
        setHeading((360 - e.alpha + 360) % 360);
      }
    };

    const handleRelative = (e) => {
      // Only use relative if absolute event never fired
      if (absoluteReceivedRef.current) return;
      if (e.webkitCompassHeading != null) {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha != null) {
        setHeading((360 - e.alpha + 360) % 360);
      }
    };

    const attach = () => {
      window.addEventListener("deviceorientationabsolute", handleAbsolute, true);
      window.addEventListener("deviceorientation", handleRelative, true);
    };

    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      // iOS 13+ needs user gesture — show button
      setNeedsCompassPermission(true);
    } else {
      attach();
    }

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleAbsolute, true);
      window.removeEventListener("deviceorientation", handleRelative, true);
    };
  }, []);

  const requestCompassPermission = async () => {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === "granted") {
        setNeedsCompassPermission(false);
        const handleAbsolute = (e) => {
          absoluteReceivedRef.current = true;
          if (e.webkitCompassHeading != null) setHeading(e.webkitCompassHeading);
          else if (e.alpha != null) setHeading((360 - e.alpha + 360) % 360);
        };
        const handleRelative = (e) => {
          if (absoluteReceivedRef.current) return;
          if (e.webkitCompassHeading != null) setHeading(e.webkitCompassHeading);
          else if (e.alpha != null) setHeading((360 - e.alpha + 360) % 360);
        };
        window.addEventListener("deviceorientationabsolute", handleAbsolute, true);
        window.addEventListener("deviceorientation", handleRelative, true);
      }
    } catch {}
  };

  // Fetch collab pins + caves
  useEffect(() => {
    if (!userPos) return;
    const fetchData = async () => {
      try {
        const [pins, caves] = await Promise.all([
          base44.entities.CollabPin.list("-created_date", 50),
          base44.entities.Cave.list("-created_date", 200),
        ]);
        setNearbyPins(
          (pins || [])
            .filter(p => p.lat && p.lng)
            .map(p => ({ ...p, _dist: distanceTo(userPos.lat, userPos.lng, p.lat, p.lng) }))
            .filter(p => p._dist < radius)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 20)
        );
        setNearbyCaves(
          (caves || [])
            .filter(c => c.latitude && c.longitude)
            .map(c => ({ ...c, lat: c.latitude, lng: c.longitude, _dist: distanceTo(userPos.lat, userPos.lng, c.latitude, c.longitude) }))
            .filter(c => c._dist < radius)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 20)
        );
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [userPos, radius]);

  // Load a category's features
  const loadCategory = useCallback(async (catId) => {
    if (catFeatures[catId]) return; // already loaded
    setLoadingCats(prev => new Set([...prev, catId]));
    try {
      const cat = CATEGORIES.find(c => c.id === catId);
      if (!cat) return;
      let features = [];
      if (cat._caveDbLayer) {
        const caves = await loadCaves();
        features = cavesToLayerFeatures(caves).map(f => ({
          lat: f.coords[0], lng: f.coords[1], label: f.label || "Jama"
        }));
      } else if (!cat._municipalityLayer) {
        const layer = await fetchFullSloveniaLayer(cat);
        features = (layer?.features || []).map(f => {
          // SearchBar stores coords as [lat, lng]
          const [lat, lng] = f.coords;
          return { lat, lng, label: f.label || cat.label };
        }).filter(f => f.lat && f.lng);
      }
      setCatFeatures(prev => ({ ...prev, [catId]: features }));
    } catch {
      setCatFeatures(prev => ({ ...prev, [catId]: [] }));
    } finally {
      setLoadingCats(prev => { const n = new Set(prev); n.delete(catId); return n; });
    }
  }, [catFeatures]);

  // Toggle category on/off and load its data
  const toggleCategory = useCallback(async (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (cat?._municipalityLayer) return; // skip polygon layers

    setActiveCatIds(prev => {
      const isActive = prev.includes(catId);
      const next = isActive ? prev.filter(id => id !== catId) : [...prev, catId];
      saveActiveCats(next);
      return next;
    });
    // Load features if not yet loaded
    if (!catFeatures[catId] && !CATEGORIES.find(c => c.id === catId)?._municipalityLayer) {
      loadCategory(catId);
    }
  }, [catFeatures, loadCategory]);

  // On mount, load features for already-active categories
  useEffect(() => {
    activeCatIds.forEach(catId => {
      if (!catFeatures[catId]) loadCategory(catId);
    });
  }, []); // only on mount

  // All POIs merged
  const allPois = useMemo(() => {
    if (!userPos) return [];

    const pinPois = nearbyPins.map(p => ({
      id: `pin-${p.id}`,
      label: p.label || "Skupna označba",
      subLabel: p.username ? `@${p.username}` : "",
      lat: p.lat, lng: p.lng,
      dist: p._dist,
      color: p.color || "#10b981",
    }));

    const cavePois = nearbyCaves.map(c => ({
      id: `cave-${c.id}`,
      label: c.name,
      subLabel: c.length_m ? `${c.length_m} m` : "",
      lat: c.lat, lng: c.lng,
      dist: c._dist,
      color: "#6366f1",
    }));

    const catPois = activeCatIds.flatMap((catId, idx) => {
      const cat = CATEGORIES.find(c => c.id === catId);
      const features = catFeatures[catId] || [];
      return features
        .map(f => {
          const dist = distanceTo(userPos.lat, userPos.lng, f.lat, f.lng);
          if (dist > radius) return null;
          return {
            id: `cat-${catId}-${f.lat}-${f.lng}`,
            label: f.label || cat?.label || catId,
            subLabel: cat?.emoji || "",
            lat: f.lat, lng: f.lng,
            dist,
            color: cat?.color || categoryColor(idx),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 30); // max 30 per category
    });

    return [...pinPois, ...cavePois, ...catPois];
  }, [nearbyPins, nearbyCaves, activeCatIds, catFeatures, userPos, radius]);

  // Visible POIs based on heading
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

  const totalCatPois = activeCatIds.reduce((acc, catId) => acc + (catFeatures[catId]?.length || 0), 0);

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
            className="relative w-9 h-9 rounded-xl bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition"
          >
            <Layers className="w-4 h-4" />
            {activeCatIds.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeCatIds.length}
              </span>
            )}
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
      {!error && streamReady && userPos && needsCompassPermission && (
        <div className="absolute bottom-28 inset-x-4 flex justify-center" style={{ zIndex: 10 }}>
          <button
            onClick={requestCompassPermission}
            className="bg-sky-500/95 backdrop-blur-md rounded-xl px-5 py-3 text-white text-sm font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition"
          >
            <Navigation className="w-4 h-4" /> Dovoli dostop do kompasa
          </button>
        </div>
      )}
      {!error && streamReady && userPos && !needsCompassPermission && heading == null && (
        <div className="absolute bottom-28 inset-x-4 flex justify-center" style={{ zIndex: 10 }}>
          <div className="bg-sky-500/90 backdrop-blur-md rounded-xl px-4 py-2 text-white text-xs flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Premakni telefon v obliki osmice za kalibracijo kompasa...
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
          {activeCatIds.length > 0 && (
            <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-white text-xs">{totalCatPois} kategorij točk</span>
            </div>
          )}
        </div>
      )}

      {/* Layers panel */}
      {showLayers && (
        <div className="absolute inset-0 bg-black/70 flex items-end justify-center pb-6" style={{ zIndex: 20 }}>
          <div className="bg-slate-900 rounded-2xl p-4 w-full max-w-sm mx-4 shadow-2xl border border-slate-700" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">Sloji v AR pogledu</h3>
              <button onClick={() => setShowLayers(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            {/* Built-in layers */}
            <p className="text-slate-500 text-[10px] uppercase font-semibold mb-2">Vgrajeno (vedno vklopljeno)</p>
            <div className="space-y-1.5 mb-4">
              {[
                { id: "_pins", label: "Skupne označbe", color: "#10b981", emoji: "📍" },
                { id: "_caves", label: "Jame (baza)", color: "#6366f1", emoji: "🕳️" },
              ].map(item => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800">
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-white text-sm flex-1">{item.label}</span>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              ))}
            </div>

            {/* All categories */}
            <p className="text-slate-500 text-[10px] uppercase font-semibold mb-2">Kategorije ({activeCatIds.length} vklopljeno)</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.filter(cat => !cat._municipalityLayer).map(cat => {
                const isActive = activeCatIds.includes(cat.id);
                const isLoading = loadingCats.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    disabled={isLoading}
                    className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl transition-all relative"
                    style={{
                      backgroundColor: isActive ? cat.color + "33" : "rgba(30,41,59,0.8)",
                      borderWidth: 1,
                      borderColor: isActive ? cat.color : "transparent",
                    }}
                  >
                    {isLoading
                      ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      : <span className="text-xl leading-none">{cat.emoji}</span>
                    }
                    <span className="text-[9px] text-center leading-tight" style={{ color: isActive ? "#fff" : "#64748b" }}>
                      {cat.label}
                    </span>
                    {isActive && !isLoading && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-slate-600 text-[10px] text-center mt-3">
              Kategorije se naložijo iz predpomnilnika ali Overpass API
            </p>
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
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><p>Vklopi kategorije z gumbom <strong>Sloji</strong> (zgoraj desno). Vsaka kategorija se naloži enkrat in shrani v predpomnilnik.</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 shrink-0" /><p>Izberi radij (1, 5, 10, 30 km) za filtriranje bližnjih točk.</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" /><p>Skupne označbe in jame iz baze so vedno prikazane (brez nalaganja).</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" /><p>Točke se prikažejo glede na smer pogleda (kompas).</p></div>
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