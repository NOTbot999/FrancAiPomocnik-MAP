import React, { useState } from "react";
import React, { useState } from "react";
import { Navigation, Plus, Trash2, X, Loader2, Route } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function PointInput({ label, value, onChange, onClear }) {
  const [query, setQuery] = useState(value?.label || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  let debounce = null;

  const search = async (q) => {
    setQuery(q);
    if (!q || q.length < 2) { setSuggestions([]); return; }
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      setLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      setSuggestions(data);
      setLoading(false);
    }, 350);
  };

  const select = (s) => {
    setQuery(s.display_name);
    setSuggestions([]);
    onChange({ label: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
  };

  const clear = () => {
    setQuery("");
    setSuggestions([]);
    onClear();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-slate-500 w-6 shrink-0">{label}</span>
        <div className="relative flex-1">
          <input
            value={query}
            onChange={e => search(e.target.value)}
            placeholder={`Search ${label === "A" ? "origin" : label === "B" ? "destination" : "waypoint"}...`}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 pr-6"
          />
          {loading && <Loader2 className="absolute right-2 top-1.5 w-3 h-3 animate-spin text-slate-400" />}
          {!loading && query && (
            <button onClick={clear} className="absolute right-1.5 top-1.5 text-slate-300 hover:text-slate-500">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="absolute left-7 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg z-[1000] max-h-40 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => select(s)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border-b border-slate-100 last:border-0 truncate"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavigationPanel({ onRouteResult, onClose, isOpen, onToggle }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const addWaypoint = () => {
    if (waypoints.length < 5) setWaypoints([...waypoints, null]);
  };

  const updateWaypoint = (i, val) => {
    const updated = [...waypoints];
    updated[i] = val;
    setWaypoints(updated);
  };

  const removeWaypoint = (i) => {
    const updated = waypoints.filter((_, idx) => idx !== i);
    setWaypoints(updated);
  };

  const calculate = async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const validWaypoints = waypoints.filter(Boolean);

    // Build OSRM coordinates string: lng,lat;lng,lat;...
    const coords = [origin, ...validWaypoints, destination]
      .map(p => `${p.lng},${p.lat}`)
      .join(";");

    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    const data = await res.json();
    setLoading(false);

    if (data.code !== "Ok" || !data.routes?.length) {
      setError("Could not find a route between these points.");
      onRouteResult(null);
      return;
    }

    const route = data.routes[0];
    const polyline = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    // Build per-leg info
    const legs = route.legs.map(leg => ({
      distance: leg.distance >= 1000
        ? `${(leg.distance / 1000).toFixed(1)} km`
        : `${Math.round(leg.distance)} m`,
      duration: leg.duration >= 3600
        ? `${Math.floor(leg.duration / 3600)}h ${Math.round((leg.duration % 3600) / 60)}min`
        : `${Math.round(leg.duration / 60)} min`,
    }));

    const totalDist = route.distance >= 1000
      ? `${(route.distance / 1000).toFixed(1)} km`
      : `${Math.round(route.distance)} m`;
    const totalDur = route.duration >= 3600
      ? `${Math.floor(route.duration / 3600)}h ${Math.round((route.duration % 3600) / 60)}min`
      : `${Math.round(route.duration / 60)} min`;

    const result = { polyline, legs, totalDistance: totalDist, totalDuration: totalDur };
    setResult(result);
    onRouteResult(result);
  };

  const clear = () => {
    setOrigin(null);
    setDestination(null);
    setWaypoints([]);
    setResult(null);
    setError(null);
    onRouteResult(null);
  };

  return (
    <div className="absolute bottom-16 right-36 z-[960]" style={{ pointerEvents: "auto" }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="mt-1.5 w-72 bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-500" /> Route Planner
              </span>
              <button onClick={onClose} className="text-slate-300 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              <PointInput label="A" value={origin} onChange={setOrigin} onClear={() => setOrigin(null)} />

              {waypoints.map((wp, i) => (
                <div key={i} className="flex items-start gap-1">
                  <div className="flex-1">
                    <PointInput
                      label={String.fromCharCode(66 + i)}
                      value={wp}
                      onChange={v => updateWaypoint(i, v)}
                      onClear={() => updateWaypoint(i, null)}
                    />
                  </div>
                  <button onClick={() => removeWaypoint(i)} className="mt-1 text-red-300 hover:text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <PointInput
                label={String.fromCharCode(66 + waypoints.length)}
                value={destination}
                onChange={setDestination}
                onClear={() => setDestination(null)}
              />

              {waypoints.length < 5 && (
                <button
                  onClick={addWaypoint}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add stop
                </button>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={calculate}
                  disabled={!origin || !destination || loading}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
                  {loading ? "Calculating..." : "Get Route"}
                </button>
                <button onClick={clear} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition">
                  Clear
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              {result && (
                <div className="bg-emerald-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-emerald-800">
                    <span>🛣 {result.totalDistance}</span>
                    <span>⏱ {result.totalDuration}</span>
                  </div>
                  {result.legs.map((leg, i) => (
                    <div key={i} className="text-[10px] text-slate-600 border-t border-emerald-100 pt-1.5">
                      <span className="font-medium">{String.fromCharCode(65 + i)} → {String.fromCharCode(66 + i)}:</span>{" "}
                      {leg.distance} · {leg.duration}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}