import React, { useState, useRef, useEffect } from "react";
import { Navigation, Plus, Trash2, X, Loader2, Route, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { loadTheme } from "@/components/map/ThemeCustomizer";
import { planRoute } from "@/lib/routing";

// Route profile options — map to backend BRouter/OSRM profiles
const PROFILES = [
  { id: "highway", label: "Avtocesta",  emoji: "🚗", hint: "najhitrejša — avtoceste" },
  { id: "main",    label: "Hitra cesta", emoji: "🛣️", hint: "hitre/glavne ceste (brez avtocest)" },
  { id: "macadam", label: "Makadam",    emoji: "🛤️", hint: "makadamske/neasfaltirane ceste" },
  { id: "forest",  label: "Gozdna cesta", emoji: "🌲", hint: "pohodniške/gozdne poti" },
  { id: "foot",    label: "Peš pot",    emoji: "🚶", hint: "hoja, peš poti" },
];

// Barvne palete za označbo poti na karti
const ROUTE_COLORS = [
  "#2563eb", "#dc2626", "#7c3aed", "#ea580c",
  "#059669", "#db2777", "#0891b2", "#ca8a04",
];

// Prepozna vrsto POI-ja iz Nominatim class/type → { emoji, label }
function poiType(s) {
  const cls = s.class, typ = s.type;
  if (cls === "historic") {
    if (typ === "castle") return { emoji: "🏰", label: "Grad" };
    if (typ === "monument" || typ === "memorial" || typ === "statue") return { emoji: "🗿", label: "Spomenik" };
    if (typ === "ruins") return { emoji: "🏚️", label: "Ruševine" };
    if (typ === "archaeological_site") return { emoji: "🏺", label: "Arheološko" };
    if (typ === "wayside_shrine" || typ === "wayside_cross") return { emoji: "⛪", label: "Kapelica" };
    if (typ === "tomb" || typ === "tombstone") return { emoji: "⚰️", label: "Grob" };
    return { emoji: "🏛️", label: "Zgodovinski objekt" };
  }
  if (cls === "tourism") {
    if (typ === "artwork") return { emoji: "🗿", label: "Umetnina" };
    if (typ === "attraction") return { emoji: "🎡", label: "Atrakcija" };
    if (typ === "museum") return { emoji: "🏛️", label: "Muzej" };
    if (typ === "viewpoint") return { emoji: "👁️", label: "Razgledišče" };
    if (typ === "hotel" || typ === "hostel" || typ === "guest_house" || typ === "motel" || typ === "apartment" || typ === "chalet" || typ === "alpine_hut") return { emoji: "🏨", label: "Namestitev" };
    if (typ === "camp_site") return { emoji: "🏕️", label: "Kamp" };
    if (typ === "hotel") return { emoji: "🍴", label: "Gostilna" };
    return { emoji: "📍", label: "Turizem" };
  }
  if (cls === "amenity") {
    if (typ === "restaurant") return { emoji: "🍴", label: "Restavracija" };
    if (typ === "bar" || typ === "pub" || typ === "cafe" || typ === "fast_food" || typ === "biergarten" || typ === "ice_cream") return { emoji: "🍺", label: "Lokal" };
    if (typ === "fuel") return { emoji: "⛽", label: "Bencinska" };
    if (typ === "hospital") return { emoji: "🏥", label: "Bolnica" };
    if (typ === "clinic" || typ === "doctors" || typ === "dentist") return { emoji: "🩺", label: "Ambulanta" };
    if (typ === "pharmacy") return { emoji: "💊", label: "Lekarna" };
    if (typ === "police") return { emoji: "🚔", label: "Policija" };
    if (typ === "fire_station") return { emoji: "🚒", label: "Gasilci" };
    if (typ === "place_of_worship") return { emoji: "⛪", label: "Cerkev" };
    if (typ === "parking") return { emoji: "🅿️", label: "Parkirišče" };
    if (typ === "bus_station") return { emoji: "🚌", label: "Avtobusna" };
    if (typ === "school" || typ === "kindergarten" || typ === "university" || typ === "college") return { emoji: "🏫", label: "Šola" };
    if (typ === "post_office") return { emoji: "📮", label: "Pošta" };
    if (typ === "bank") return { emoji: "🏦", label: "Banka" };
    if (typ === "atm") return { emoji: "💳", label: "Bankomat" };
    if (typ === "toilets") return { emoji: "🚻", label: "Stranišče" };
    if (typ === "library") return { emoji: "📚", label: "Knjižnica" };
    if (typ === "theatre" || typ === "cinema" || typ === "arts_centre") return { emoji: "🎭", label: "Kultura" };
    if (typ === "townhall" || typ === "courthouse" || typ === "embassy") return { emoji: "🏢", label: "Ustanova" };
    if (typ === "marketplace") return { emoji: "🛒", label: "Tržnica" };
    if (typ === "childcare") return { emoji: "👶", label: "Vrtec" };
    return { emoji: "📍", label: "Storitev" };
  }
  if (cls === "shop") {
    if (typ === "supermarket" || typ === "convenience" || typ === "grocery") return { emoji: "🛒", label: "Trgovina" };
    if (typ === "bakery") return { emoji: "🥖", label: "Pekarna" };
    if (typ === "alcohol" || typ === "beverages") return { emoji: "🍷", label: "Pijača" };
    if (typ === "clothes" || typ === "fashion" || typ === "shoes") return { emoji: "👕", label: "Modna" };
    if (typ === "hardware" || typ === "doityourself") return { emoji: "🔧", label: "Železnina" };
    if (typ === "books") return { emoji: "📚", label: "Knjigarna" };
    if (typ === "electronics" || typ === "mobile_phone") return { emoji: "🔌", label: "Elektronika" };
    if (typ === "sports") return { emoji: "⚽", label: "Športna" };
    return { emoji: "🏪", label: "Trgovina" };
  }
  if (cls === "leisure") {
    if (typ === "park") return { emoji: "🌳", label: "Park" };
    if (typ === "pitch") return { emoji: "⚽", label: "Igr. igrišče" };
    if (typ === "playground") return { emoji: "🛝", label: "Otroško igrišče" };
    if (typ === "fitness_station") return { emoji: "💪", label: "Fitnes" };
    if (typ === "stadium") return { emoji: "🏟️", label: "Stadion" };
    if (typ === "swimming_pool") return { emoji: "🏊", label: "Bazen" };
    return { emoji: "🌿", label: "Rekreacija" };
  }
  if (cls === "natural") {
    if (typ === "peak") return { emoji: "⛰️", label: "Vrh" };
    if (typ === "waterfall") return { emoji: "💧", label: "Slap" };
    if (typ === "spring") return { emoji: "💦", label: "Izvir" };
    if (typ === "beach") return { emoji: "🏖️", label: "Plaža" };
    if (typ === "cave_entrance" || typ === "cave") return { emoji: "🕳️", label: "Jama" };
    if (typ === "tree") return { emoji: "🌲", label: "Drevo" };
    return { emoji: "🌿", label: "Narava" };
  }
  if (cls === "man_made") {
    if (typ === "tower" || typ === "communications_tower") return { emoji: "📡", label: "Oddajnik" };
    if (typ === "bridge") return { emoji: "🌉", label: "Most" };
    if (typ === "water_tower" || typ === "water_well") return { emoji: "🚰", label: "Voda" };
    return { emoji: "🏗️", label: "Objekt" };
  }
  if (cls === "aeroway") return { emoji: "✈️", label: "Letališče" };
  if (cls === "railway") return { emoji: "🚂", label: "Železnica" };
  if (cls === "highway") return { emoji: "🛣️", label: "Cesta" };
  if (cls === "building") return { emoji: "🏠", label: "Zgradba" };
  return { emoji: "📍", label: null };
}

// Zgradi glavni naslov in podpis za Nominatim rezultat
function describeResult(s) {
  const a = s.address || {};
  const street = a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.residential || a.square;
  const houseNo = a.house_number;
  const place = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county;
  const postcode = a.postcode;
  const poi = poiType(s);
  // Ime objekta (POI) ima prednost pred ulico — da uporabnik vidi kaj je našel
  const poiName = s.namedetails?.name || a.amenity || a.tourism || a.shop;
  const placeStr = place ? (postcode ? `${postcode} ${place}` : place) : "";

  let main, sub;
  if (poiName) {
    main = poiName;
    const addrParts = [];
    if (street && houseNo) addrParts.push(`${street} ${houseNo}`);
    else if (street) addrParts.push(street);
    if (placeStr) addrParts.push(placeStr);
    sub = [poi.label ? `${poi.emoji} ${poi.label}` : poi.emoji, ...addrParts].filter(Boolean).join(" · ");
  } else if (street) {
    main = houseNo ? `${street} ${houseNo}` : street;
    const addrParts = [];
    if (placeStr) addrParts.push(placeStr);
    sub = [poi.label ? `${poi.emoji} ${poi.label}` : null, ...addrParts].filter(Boolean).join(" · ");
  } else {
    main = place || s.display_name.split(",")[0];
    sub = [poi.label ? `${poi.emoji} ${poi.label}` : null, place && place !== main ? place : null, a.country && a.country !== "Slovenija" ? a.country : null].filter(Boolean).join(" · ");
  }
  return { main, sub };
}

function PointInput({ label, value, onChange, onClear, onPick, picking }) {
  const [query, setQuery] = useState(value?.label || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  const doSearch = async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); setLoading(false); return; }
    setLoading(true);
    try {
      const baseHeaders = { "User-Agent": "SloveniaGISExplorer/1.0", "Accept-Language": "sl,hr,en" };
      const common = "&addressdetails=1&namedetails=1&dedupe=1&countrycodes=si&accept-language=sl,hr,en";
      // Prosti iskalnik — najde POI (gradovi, trgovine, gostilne, kipi) in naslove
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=14${common}`;
      const res = await fetch(url, { headers: baseHeaders });
      let data = await res.json();

      // Structured search za natančne naslove (ulica + hišna + kraj) če prosti ne najde natančno
      const looksLikeAddress = /\d/.test(q) && /(,|\s)/.test(q);
      if (looksLikeAddress && data.length < 5) {
        // Razbijemo "Slovenska 12 Ljubljana" → street/housenumber/city
        const m = q.trim().match(/^(.+?)\s+(\d+[a-zA-ZčšžČŠŽ]?)\s*,?\s*(.*)$/);
        if (m) {
          const [, streetPart, hn, placePart] = m;
          const sUrl = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(streetPart + " " + hn)}&city=${encodeURIComponent(placePart)}&format=json&limit=8${common.replace(/&dedupe=1/, "")}`;
          const sRes = await fetch(sUrl, { headers: baseHeaders });
          const sData = await sRes.json();
          // Spoji, deduplikuj po koordinatah
          const seen = new Set(data.map(d => `${d.lat},${d.lon}`));
          sData.forEach(d => { if (!seen.has(`${d.lat},${d.lon}`)) data.push(d); });
        }
      }

      // fallback: if no results with countrycodes=si, try globally
      if (!data.length) {
        const fallback = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&namedetails=1&dedupe=1&accept-language=sl,hr,en`;
        const res2 = await fetch(fallback, { headers: baseHeaders });
        data = await res2.json();
      }
      setSuggestions(data.slice(0, 14));
    } catch { setSuggestions([]); }
    setLoading(false);
  };

  const handleChange = (q) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 350);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.length >= 2) {
      clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  const buildLabel = (s) => describeResult(s).main;

  const select = (s) => {
    const shortLabel = buildLabel(s);
    setQuery(shortLabel);
    setSuggestions([]);
    setFocused(false);
    onChange({ label: shortLabel, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
  };

  const clear = () => {
    setQuery("");
    setSuggestions([]);
    onClear();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = focused && suggestions.length > 0;
  const placeholders = { A: "Izhodišče (naslov, kraj...)", B: "Cilj (naslov, kraj...)" };
  const placeholder = placeholders[label] || "Vmesna točka...";

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-slate-500 w-6 shrink-0">{label}</span>
        <div className="relative flex-1">
          <input
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-400 pr-6"
            style={{ backgroundColor: "transparent", borderColor: "#e2e8f0", color: "inherit" }}
          />
          {loading && <Loader2 className="absolute right-2 top-1.5 w-3 h-3 animate-spin text-slate-400" />}
          {!loading && query && (
            <button onClick={clear} className="absolute right-1.5 top-1.5 text-slate-300 hover:text-slate-500">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {onPick && (
          <button
            onClick={onPick}
            title="Izberi na zemljevidu"
            className="shrink-0 transition px-1"
            style={{ color: picking ? "#10b981" : "#94a3b8" }}
          >
            <MapPin className="w-3.5 h-3.5" style={{ filter: picking ? "drop-shadow(0 0 3px #10b981)" : "none" }} />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute left-7 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl z-[1100] max-h-52 overflow-y-auto">
          {suggestions.map((s, i) => {
            const { main: mainLine, sub: subLine } = describeResult(s);
            return (
              <button
                key={i}
                onClick={() => select(s)}
                className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 last:border-0 transition-colors"
              >
                <div className="text-xs font-medium text-slate-800 truncate">{mainLine}</div>
                {subLine && <div className="text-[10px] text-slate-400 truncate mt-0.5">{subLine}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NavigationPanel({ onRouteResult, onClose, isOpen, onToggle, inline = false, onRequestPick, pendingPick, onPickApplied }) {
  const theme = loadTheme();
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState("highway");
  const [routeColor, setRouteColor] = useState(ROUTE_COLORS[0]);
  const [pickingTarget, setPickingTarget] = useState(null);

  // Apply a map-picked point to the right field, then clear pending
  useEffect(() => {
    if (!pendingPick || !pendingPick.target) return;
    const pt = { label: pendingPick.label || pendingPick.shortLabel, lat: pendingPick.lat, lng: pendingPick.lng };
    if (pendingPick.target === "origin") setOrigin(pt);
    else if (pendingPick.target === "destination") setDestination(pt);
    else if (pendingPick.target.startsWith("waypoint-")) {
      const i = parseInt(pendingPick.target.split("-")[1], 10);
      if (!Number.isNaN(i)) {
        setWaypoints(prev => {
          const updated = [...prev];
          updated[i] = pt;
          return updated;
        });
      }
    }
    setPickingTarget(null);
    if (onPickApplied) onPickApplied();
  }, [pendingPick, onPickApplied]);

  const requestPick = (target) => {
    setPickingTarget(target);
    if (onRequestPick) onRequestPick(target);
  };

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
    const points = [origin, ...validWaypoints, destination].map(p => ({ lat: p.lat, lng: p.lng }));

    try {
      const data = await planRoute(points, profile);

      const result = {
        polyline: data.polyline,
        alternatives: data.alternatives,
        legs: data.legs || [],
        totalDistance: data.totalDistance,
        totalDuration: data.totalDuration,
        usedFallback: data.usedFallback,
        color: routeColor,
      };
      setResult(result);
      onRouteResult(result);
    } catch (err) {
      setError(err.message || "Poti ni mogoče najti.");
      onRouteResult(null);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setOrigin(null);
    setDestination(null);
    setWaypoints([]);
    setResult(null);
    setError(null);
    onRouteResult(null);
  };

  const panelInner = (
    <div className="backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60" style={{ backgroundColor: theme.menuBg, color: theme.menuText, overflow: "visible" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.menuText + "22" }}>
        <span className="text-sm font-semibold flex items-center gap-2" style={{ color: theme.menuText }}>
          <Navigation className="w-4 h-4" style={{ color: theme.accentColor }} /> Route Planner
        </span>
        <button onClick={onClose} className="opacity-50 hover:opacity-100" style={{ color: theme.menuText }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <PointInput label="A" value={origin} onChange={setOrigin} onClear={() => setOrigin(null)} onPick={() => requestPick("origin")} picking={pickingTarget === "origin"} />

        {waypoints.map((wp, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1">
              <PointInput
                label={String.fromCharCode(66 + i)}
                value={wp}
                onChange={v => updateWaypoint(i, v)}
                onClear={() => updateWaypoint(i, null)}
                onPick={() => requestPick(`waypoint-${i}`)}
                picking={pickingTarget === `waypoint-${i}`}
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
          onPick={() => requestPick("destination")}
          picking={pickingTarget === "destination"}
        />

        {waypoints.length < 5 && (
          <button
            onClick={addWaypoint}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Vmesna točka
          </button>
        )}

        {/* Profile selector */}
        <div className="pt-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Tip poti</p>
          <div className="grid grid-cols-5 gap-1">
            {PROFILES.map(p => {
              const active = profile === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  title={p.hint}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                  style={{
                    backgroundColor: active ? "#10b98115" : "transparent",
                    border: `1px solid ${active ? "#10b981" : "#e2e8f0"}`,
                    color: active ? "#047857" : "#64748b",
                  }}
                >
                  <span className="text-sm leading-none">{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color picker */}
        <div className="pt-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Barva poti</p>
          <div className="flex flex-wrap gap-1.5">
            {ROUTE_COLORS.map(c => {
              const active = routeColor === c;
              return (
                <button
                  key={c}
                  onClick={() => setRouteColor(c)}
                  className="rounded-full transition-all"
                  style={{
                    width: 22, height: 22,
                    backgroundColor: c,
                    border: active ? "2px solid #0f172a" : "2px solid white",
                    boxShadow: active ? "0 0 0 2px " + c : "0 1px 2px rgba(0,0,0,0.2)",
                    transform: active ? "scale(1.15)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={calculate}
            disabled={!origin || !destination || loading}
            className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: routeColor }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
            {loading ? "Načrtujem..." : "Prikaži pot"}
          </button>
          <button onClick={clear} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition">
            Počisti
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
            {result.usedFallback && (
              <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                ℹ️ Za ta tip poti je bil uporabljen nadomestni strežnik (OSRM).
              </p>
            )}
            {result.legs.length > 1 && result.legs.map((leg, i) => (
              <div key={i} className="text-[10px] text-slate-600 border-t border-emerald-100 pt-1.5">
                <span className="font-medium">{String.fromCharCode(65 + i)} → {String.fromCharCode(66 + i)}:</span>{" "}
                {leg.distance} · {leg.duration}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // inline mode: caller controls positioning & animation
  if (inline) return panelInner;

  // desktop mode: self-positioned absolute panel
  return (
    <div className="absolute bottom-16 right-36 z-[960]" style={{ pointerEvents: "auto" }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="mt-1.5"
          >
            {panelInner}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}