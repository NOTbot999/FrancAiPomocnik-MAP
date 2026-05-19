import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, TrendingUp, Ruler, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Unit conversion helpers
function convertDistance(meters, unit) {
  if (unit === "ft") return { value: (meters * 3.28084).toFixed(1), label: "ft" };
  if (unit === "mi") return { value: (meters / 1609.34).toFixed(3), label: "mi" };
  if (meters < 1000) return { value: meters.toFixed(0), label: "m" };
  return { value: (meters / 1000).toFixed(3), label: "km" };
}

function convertArea(sqm, unit) {
  if (unit === "ft2") return { value: (sqm * 10.7639).toFixed(1), label: "ft²" };
  if (unit === "acres") return { value: (sqm / 4046.86).toFixed(4), label: "ac" };
  if (sqm < 10000) return { value: sqm.toFixed(0), label: "m²" };
  if (sqm < 1000000) return { value: (sqm / 10000).toFixed(2), label: "ha" };
  return { value: (sqm / 1000000).toFixed(4), label: "km²" };
}

async function fetchElevationProfile(points) {
  if (!points || points.length < 2) return null;
  // Sample max 100 points for the profile
  let sampled = points;
  if (points.length > 100) {
    const step = points.length / 100;
    sampled = Array.from({ length: 100 }, (_, i) => points[Math.round(i * step)]);
    sampled[sampled.length - 1] = points[points.length - 1];
  }
  const locations = sampled.map(p => `${p[0]},${p[1]}`).join("|");
  const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locations}`);
  if (!res.ok) throw new Error("Elevation API error");
  const data = await res.json();
  return data.results.map((r, i) => ({
    dist: i,
    elevation: r.elevation,
    lat: r.latitude,
    lng: r.longitude,
  }));
}

// Mini sparkline for elevation
function ElevationSparkline({ profile }) {
  if (!profile || profile.length < 2) return null;
  const elevations = profile.map(p => p.elevation);
  const minE = Math.min(...elevations);
  const maxE = Math.max(...elevations);
  const range = maxE - minE || 1;
  const W = 200, H = 40;
  const pts = profile.map((p, i) => {
    const x = (i / (profile.length - 1)) * W;
    const y = H - ((p.elevation - minE) / range) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
        <span>{minE}m</span>
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> profil višin</span>
        <span>{maxE}m</span>
      </div>
      <svg width={W} height={H} className="rounded overflow-hidden bg-slate-800/50">
        <polyline
          points={pts}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={`0,${H} ${pts} ${W},${H}`}
          fill="#10b981"
          fillOpacity="0.15"
          stroke="none"
        />
      </svg>
      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
        <span>↑ {Math.max(...elevations.map((e, i) => i > 0 ? e - elevations[i - 1] : 0)).toFixed(0)}m</span>
        <span>Δ {(maxE - minE).toFixed(0)}m</span>
      </div>
    </div>
  );
}

// MeasurementDisplay accepts:
// type: "distance" | "area" | "both"
// valueMeters: distance in meters
// areaSqm: area in m² (for type "both")
// points: array of [lat, lng]
export default function MeasurementDisplay({ type, valueMeters, areaSqm, points, style = "desktop" }) {
  const [distUnit, setDistUnit] = useState("auto");
  const [areaUnit, setAreaUnit] = useState("auto");
  const [elevProfile, setElevProfile] = useState(null);
  const [loadingElev, setLoadingElev] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if ((type !== "distance" && type !== "both") || !points || points.length < 2) {
      setElevProfile(null);
      return;
    }
    setLoadingElev(true);
    setElevProfile(null);
    fetchElevationProfile(points)
      .then(p => setElevProfile(p))
      .catch(() => setElevProfile(null))
      .finally(() => setLoadingElev(false));
  }, [type, JSON.stringify(points)]);

  if (!valueMeters) return null;

  const DIST_UNITS = [
    { id: "auto", label: "auto" },
    { id: "m", label: "m" },
    { id: "km", label: "km" },
    { id: "ft", label: "ft" },
    { id: "mi", label: "mi" },
  ];
  const AREA_UNITS = [
    { id: "auto", label: "auto" },
    { id: "ha", label: "ha" },
    { id: "km2", label: "km²" },
    { id: "ft2", label: "ft²" },
    { id: "acres", label: "ac" },
  ];

  const distU = distUnit === "auto" ? null : distUnit;
  const areaU = areaUnit === "auto" ? null : areaUnit;
  const distDisplay = convertDistance(valueMeters, distU);
  const areaDisplay = areaSqm ? convertArea(areaSqm, areaU) : null;

  const isDesktop = style === "desktop";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className={`bg-slate-900/92 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-white/10 ${isDesktop ? "px-4 py-3 min-w-[220px]" : "px-3 py-2 min-w-[180px]"}`}
      >
        {/* Distance row */}
        <div className="flex items-center gap-2">
          <Ruler className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-lg font-bold text-emerald-400 leading-none">{distDisplay.value} {distDisplay.label}</span>
          <div className="flex flex-wrap gap-0.5 ml-auto">
            {DIST_UNITS.map(u => (
              <button
                key={u.id}
                onClick={() => setDistUnit(u.id)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                  distUnit === u.id ? "bg-emerald-500 text-white font-bold" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >{u.label}</button>
            ))}
          </div>
        </div>

        {/* Area row — only for "area" or "both" */}
        {(type === "area" || type === "both") && areaDisplay && (
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/10">
            <Square className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-sm font-bold text-violet-400 leading-none">{areaDisplay.value} {areaDisplay.label}</span>
            <div className="flex flex-wrap gap-0.5 ml-auto">
              {AREA_UNITS.map(u => (
                <button
                  key={u.id}
                  onClick={() => setAreaUnit(u.id)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                    areaUnit === u.id ? "bg-violet-500 text-white font-bold" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >{u.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Elevation toggle */}
        {(type === "distance" || type === "both") && (
          <div className="mt-2">
            <button
              onClick={() => setShowProfile(p => !p)}
              className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <TrendingUp className="w-3 h-3" />
              {loadingElev ? "Nalagam višinski profil…" : elevProfile ? (showProfile ? "Skrij profil višin" : "Pokaži profil višin") : "Višinski profil ni na voljo"}
              {elevProfile && (showProfile ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            {showProfile && elevProfile && <ElevationSparkline profile={elevProfile} />}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}