import React, { useEffect, useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { X, Camera, MapPin, Navigation, AlertTriangle, Info } from "lucide-react";
import { Link } from "react-router-dom";

const EARTH_R = 6371000;

function toRad(d) { return d * Math.PI / 180; }

// Bearing in degrees from north, from (lat1,lng1) to (lat2,lng2)
function bearingTo(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// Haversine distance in meters
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

// Horizontal FOV of camera in degrees (approximate)
const H_FOV = 60;

export default function ARFieldExplorer() {
  const videoRef = useRef(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(null); // compass heading in degrees
  const [pois, setPois] = useState([]); // points of interest to overlay
  const [nearbyPins, setNearbyPins] = useState([]);
  const [nearbyCaves, setNearbyCaves] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const orientationRef = useRef(null);
  const watchIdRef = useRef(null);

  // Request camera
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
      } catch (e) {
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

  // Device orientation (compass heading)
  useEffect(() => {
    const handleOrientation = (e) => {
      // iOS uses webkitCompassHeading, Android uses alpha (needs correction)
      if (e.webkitCompassHeading != null) {
        setHeading(e.webkitCompassHeading);
      } else if (e.absolute && e.alpha != null) {
        setHeading((360 - e.alpha) % 360);
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

  // Fetch nearby data when position changes
  useEffect(() => {
    if (!userPos) return;
    const fetchData = async () => {
      try {
        const [pins, caves] = await Promise.all([
          base44.entities.CollabPin.list("-created_date", 50),
          base44.entities.Cave.list("-created_date", 100),
        ]);
        const RADIUS = 5000; // 5 km
        setNearbyPins(
          (pins || [])
            .filter(p => p.lat && p.lng)
            .map(p => ({ ...p, _dist: distanceTo(userPos.lat, userPos.lng, p.lat, p.lng) }))
            .filter(p => p._dist < RADIUS)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 15)
        );
        setNearbyCaves(
          (caves || [])
            .filter(c => c.latitude && c.longitude)
            .map(c => ({ ...c, lat: c.latitude, lng: c.longitude, _dist: distanceTo(userPos.lat, userPos.lng, c.latitude, c.longitude) }))
            .filter(c => c._dist < RADIUS)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 15)
        );
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [userPos]);

  // Compute visible POI overlays based on heading
  const visiblePois = useMemo(() => {
    if (!userPos || heading == null) return [];
    const all = [
      ...nearbyPins.map(p => ({
        id: `pin-${p.id}`,
        label: p.label || "Skupna označba",
        subLabel: p.username ? `@${p.username}` : "",
        lat: p.lat, lng: p.lng,
        dist: p._dist,
        color: p.color || "#10b981",
        type: "pin",
      })),
      ...nearbyCaves.map(c => ({
        id: `cave-${c.id}`,
        label: c.name,
        subLabel: c.length_m ? `${c.length_m} m` : "",
        lat: c.lat, lng: c.lng,
        dist: c._dist,
        color: "#6366f1",
        type: "cave",
      })),
    ];

    return all.map(poi => {
      const bearing = bearingTo(userPos.lat, userPos.lng, poi.lat, poi.lng);
      // Angle relative to current heading (-180 to +180)
      let relAngle = bearing - heading;
      if (relAngle > 180) relAngle -= 360;
      if (relAngle < -180) relAngle += 360;
      // Within FOV?
      const halfFov = H_FOV / 2;
      if (Math.abs(relAngle) > halfFov + 10) return null; // +10 for soft edge
      const screenX = 50 + (relAngle / halfFov) * 50; // 0–100%
      // Vertical position: farther = higher on screen
      const screenY = Math.max(15, 80 - (poi.dist / 5000) * 60);
      return { ...poi, screenX, screenY, relAngle };
    }).filter(Boolean).sort((a, b) => b.dist - a.dist); // render far first
  }, [userPos, heading, nearbyPins, nearbyCaves]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 9999 }}>
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(1)" }}
      />

      {/* Dark overlay for UI areas */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 pb-2" style={{ zIndex: 10 }}>
        <div className="flex items-center gap-2">
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

      {/* No GPS / heading warnings */}
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
            {/* Connector line */}
            <div className="flex flex-col items-center gap-0.5">
              {/* Label bubble */}
              <div
                className="rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-xl border max-w-[140px] text-center"
                style={{ backgroundColor: poi.color + "dd", borderColor: poi.color + "88" }}
              >
                <p className="text-white text-[11px] font-bold leading-tight truncate">{poi.label}</p>
                {poi.subLabel && <p className="text-white/70 text-[9px] truncate">{poi.subLabel}</p>}
                <p className="text-white text-[10px] font-mono mt-0.5">{formatDist(poi.dist)}</p>
              </div>
              {/* Dot pin */}
              <div className="w-1.5 h-4 rounded-full" style={{ background: `linear-gradient(to bottom, ${poi.color}, transparent)` }} />
              <div className="w-3 h-3 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: poi.color }} />
            </div>
          </div>
        );
      })}

      {/* Crosshair center */}
      {streamReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 7 }}>
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-white/60 rounded-full" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-white/60 rounded-full" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-2.5 bg-white/60 rounded-full" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-2.5 bg-white/60 rounded-full" />
            <div className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full border border-white/80" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", position: "absolute" }} />
          </div>
        </div>
      )}

      {/* Bottom stats bar */}
      {streamReady && (
        <div className="absolute bottom-6 inset-x-4 flex items-center justify-center gap-3" style={{ zIndex: 10 }}>
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-white text-xs">{nearbyPins.length} skupnih označb</span>
          </div>
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-white text-xs">{nearbyCaves.length} jam</span>
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
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><p>Točke skupnega dela in jame v radiju 5 km se prikažejo na kameri glede na smer pogleda.</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 shrink-0" /><p>Kompas se samodejno kalibrira — premakni telefon v obliki osmice za boljšo natančnost.</p></div>
              <div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" /><p>Potrebuješ dovoljenje za kamero in lokacijo. Na iOS morda ne deluje v brskalniku Chrome.</p></div>
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