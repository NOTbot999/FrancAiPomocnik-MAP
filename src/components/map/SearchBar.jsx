import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefetchCategories } from "@/hooks/usePrefetchCategories";

// ── All categories — each toggles a full-Slovenia layer ───────────────────────
const CATEGORIES = [
  { id: "castle",        label: "Gradovi",        emoji: "🏰", color: "#b45309", query: `[out:json][timeout:30];(node["historic"="castle"](45.4,13.4,46.9,16.6);way["historic"="castle"](45.4,13.4,46.9,16.6););out center;` },
  { id: "peak",          label: "Vrhovi",         emoji: "⛰️", color: "#6b7280", query: `[out:json][timeout:30];node["natural"="peak"](45.4,13.4,46.9,16.6);out;` },
  { id: "waterfall",     label: "Slapovi",        emoji: "💧", color: "#0ea5e9", query: `[out:json][timeout:30];node["waterway"="waterfall"](45.4,13.4,46.9,16.6);out;` },
  { id: "viewpoint",     label: "Razglediš.",     emoji: "👁️", color: "#8b5cf6", query: `[out:json][timeout:30];node["tourism"="viewpoint"](45.4,13.4,46.9,16.6);out;` },
  { id: "cave",          label: "Jame",           emoji: "🕳️", color: "#78716c", query: `[out:json][timeout:30];node["natural"="cave_entrance"](45.4,13.4,46.9,16.6);out;` },
  { id: "museum",        label: "Muzeji",         emoji: "🏛️", color: "#a855f7", query: `[out:json][timeout:30];(node["tourism"="museum"](45.4,13.4,46.9,16.6);way["tourism"="museum"](45.4,13.4,46.9,16.6););out center;` },
  { id: "ruins",         label: "Ruševine",       emoji: "🗿", color: "#92400e", query: `[out:json][timeout:30];(node["historic"="ruins"](45.4,13.4,46.9,16.6);way["historic"="ruins"](45.4,13.4,46.9,16.6););out center;` },
  { id: "spring",        label: "Izviri",         emoji: "💦", color: "#06b6d4", query: `[out:json][timeout:30];node["natural"="spring"](45.4,13.4,46.9,16.6);out;` },
  { id: "lake",          label: "Jezera",         emoji: "🌊", color: "#3b82f6", query: `[out:json][timeout:45];(way["natural"="water"]["water"~"lake|reservoir|pond"](45.4,13.4,46.9,16.6);way["natural"="water"][!"water"](45.4,13.4,46.9,16.6);way["landuse"="reservoir"](45.4,13.4,46.9,16.6);relation["natural"="water"](45.4,13.4,46.9,16.6););out center;` },
  { id: "park",          label: "Parki",          emoji: "🌳", color: "#22c55e", query: `[out:json][timeout:30];(way["leisure"="park"](45.4,13.4,46.9,16.6);relation["leisure"="park"](45.4,13.4,46.9,16.6););out center;` },
  { id: "chapel",        label: "Kapelice",       emoji: "⛪", color: "#e879f9", query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"]["building"~"chapel|wayside_shrine"](45.4,13.4,46.9,16.6);node["historic"="wayside_shrine"](45.4,13.4,46.9,16.6););out;` },
  { id: "church",        label: "Cerkve",         emoji: "🕌", color: "#d946ef", query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6);way["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fuel",          label: "Bencinske",      emoji: "⛽", color: "#f59e0b", query: `[out:json][timeout:45];(node["amenity"="fuel"](45.4,13.4,46.9,16.6);way["amenity"="fuel"](45.4,13.4,46.9,16.6);node["fuel"="yes"](45.4,13.4,46.9,16.6););out center;` },
  { id: "parking",       label: "Parkirišča",     emoji: "🅿️", color: "#6366f1", query: `[out:json][timeout:30];(node["amenity"="parking"](45.4,13.4,46.9,16.6);way["amenity"="parking"](45.4,13.4,46.9,16.6););out center;` },
  { id: "supermarket",   label: "Živila",         emoji: "🛒", color: "#f97316", query: `[out:json][timeout:30];(node["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6);way["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6););out center;` },
  { id: "atm",           label: "Bankomati",      emoji: "💳", color: "#84cc16", query: `[out:json][timeout:45];(node["amenity"="atm"](45.4,13.4,46.9,16.6);node["amenity"="bank"]["atm"!="no"](45.4,13.4,46.9,16.6);way["amenity"="bank"]["atm"!="no"](45.4,13.4,46.9,16.6););out center;` },
  { id: "hospital",      label: "Bolnice",        emoji: "🏥", color: "#ec4899", query: `[out:json][timeout:45];(node["amenity"="hospital"](45.4,13.4,46.9,16.6);way["amenity"="hospital"](45.4,13.4,46.9,16.6);node["amenity"="health_post"](45.4,13.4,46.9,16.6);relation["amenity"="hospital"](45.4,13.4,46.9,16.6););out center;` },
  { id: "clinic",        label: "Ambulante",      emoji: "🩺", color: "#14b8a6", query: `[out:json][timeout:45];(node["amenity"~"clinic|doctors|health_centre"](45.4,13.4,46.9,16.6);way["amenity"~"clinic|doctors|health_centre"](45.4,13.4,46.9,16.6);node["healthcare"~"centre|clinic|doctor|general_practitioner"](45.4,13.4,46.9,16.6);way["healthcare"~"centre|clinic"](45.4,13.4,46.9,16.6););out center;` },
  { id: "dentist",       label: "Zobozdrav.",     emoji: "🦷", color: "#a855f7", query: `[out:json][timeout:30];(node["amenity"="dentist"](45.4,13.4,46.9,16.6);way["amenity"="dentist"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pharmacy",      label: "Lekarne",        emoji: "💊", color: "#10b981", query: `[out:json][timeout:30];(node["amenity"="pharmacy"](45.4,13.4,46.9,16.6);way["amenity"="pharmacy"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fire_station",  label: "Gasilci",        emoji: "🚒", color: "#ef4444", query: `[out:json][timeout:30];(node["amenity"="fire_station"](45.4,13.4,46.9,16.6);way["amenity"="fire_station"](45.4,13.4,46.9,16.6););out center;` },
  { id: "police",        label: "Policija",       emoji: "🚔", color: "#3b82f6", query: `[out:json][timeout:30];(node["amenity"="police"](45.4,13.4,46.9,16.6);way["amenity"="police"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pipe",          label: "Pipe",           emoji: "🚰", color: "#0ea5e9", query: `[out:json][timeout:30];node["amenity"="drinking_water"](45.4,13.4,46.9,16.6);out;` },
  { id: "bus_station",   label: "Avt. postaje",   emoji: "🚌", color: "#f59e0b", query: `[out:json][timeout:30];(node["amenity"="bus_station"](45.4,13.4,46.9,16.6);node["highway"="bus_stop"](45.4,13.4,46.9,16.6););out;` },
  { id: "train_station", label: "Vlak postaje",   emoji: "🚂", color: "#78716c", query: `[out:json][timeout:30];(node["railway"="station"](45.4,13.4,46.9,16.6);node["railway"="halt"](45.4,13.4,46.9,16.6););out;` },
  { id: "camp",          label: "Kampi",          emoji: "🏕️", color: "#22c55e", query: `[out:json][timeout:30];(node["tourism"="camp_site"](45.4,13.4,46.9,16.6);way["tourism"="camp_site"](45.4,13.4,46.9,16.6););out center;` },
  { id: "aerodrome",     label: "Letališča",      emoji: "✈️", color: "#06b6d4", query: `[out:json][timeout:30];(node["aeroway"="aerodrome"](45.4,13.4,46.9,16.6);way["aeroway"="aerodrome"](45.4,13.4,46.9,16.6););out center;` },
  { id: "cemetery",      label: "Pokopališča",    emoji: "⚰️", color: "#6b7280", query: `[out:json][timeout:30];(node["landuse"="cemetery"](45.4,13.4,46.9,16.6);way["landuse"="cemetery"](45.4,13.4,46.9,16.6););out center;` },
  { id: "municipality",  label: "Občine",         emoji: "🏘️", color: "#b45309", _municipalityLayer: true, query: `` },
  { id: "motorway_jct",  label: "AC uvozi",       emoji: "🛣️", color: "#64748b", query: `[out:json][timeout:30];node["highway"="motorway_junction"](45.4,13.4,46.9,16.6);out;` },
];

// Invalidate old cache for improved queries
["fuel","atm","hospital","clinic","lake"].forEach(id => {
  try { localStorage.removeItem("slomapcat_" + id); } catch {}
});
// Invalidate old municipality cache (stitching fix)
["slomapcat_mun_v1","slomapcat_mun_v2","slomapcat_mun_v3","slomapcat_municipalities_v2"].forEach(k => {
  try { localStorage.removeItem(k); } catch {}
});

// Cache — v-memory + localStorage za hitrost
const layerCache = {};
const LS_PREFIX = "slomapcat_";

function saveToStorage(catId, features) {
  try {
    localStorage.setItem(LS_PREFIX + catId, JSON.stringify({ ts: Date.now(), features }));
  } catch(e) { /* quota */ }
}

function loadFromStorage(catId) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + catId);
    if (!raw) return null;
    const { ts, features } = JSON.parse(raw);
    // Cache valid for 7 days
    if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem(LS_PREFIX + catId); return null; }
    return features;
  } catch(e) { return null; }
}

async function fetchFullSloveniaLayer(cat) {
  // 1. In-memory cache
  if (layerCache[cat.id]) return layerCache[cat.id];
  // 2. localStorage cache
  const cached = loadFromStorage(cat.id);
  if (cached) {
    const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, features: cached, _categoryId: cat.id };
    layerCache[cat.id] = layer;
    return layer;
  }
  // 3. Fetch from Overpass
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(cat.query),
  });
  const data = await res.json();
  const features = (data.elements || []).map(el => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) return null;
    return {
      type: "Point",
      coords: [lat, lon],
      label: el.tags?.name || el.tags?.["name:sl"] || el.tags?.ref || "",
    };
  }).filter(Boolean);
  saveToStorage(cat.id, features);
  const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, features, _categoryId: cat.id };
  layerCache[cat.id] = layer;
  return layer;
}

// ── Nominatim text search ─────────────────────────────────────────────────────
async function searchNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1&countrycodes=si&dedupe=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "sl,en" } });
  let data = await res.json();
  if (data.length === 0) {
    const global = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&dedupe=1`;
    const res2 = await fetch(global, { headers: { "Accept-Language": "sl,en" } });
    data = await res2.json();
  }
  return data;
}

function getMainName(item) {
  const a = item.address || {};
  if (a.house_number && a.road) return `${a.road} ${a.house_number}`;
  return item.display_name.split(",")[0];
}

function getSubtitle(item) {
  const a = item.address || {};
  const parts = [];
  if (a.road) parts.push(a.road);
  if (a.village || a.town || a.city) parts.push(a.village || a.town || a.city);
  if (a.postcode) parts.push(a.postcode);
  return parts.length > 0 ? parts.join(", ") : item.display_name.split(",").slice(1, 3).join(", ");
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchBar({ onLocationSelect, autoFocus, onAddCustomLayer, onRemoveCustomLayer, activeSearchLayers, onSearchLayersChange }) {
  // Pre-warm Overpass cache for all categories in background on first render
  usePrefetchCategories(CATEGORIES);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [showCategories, setShowCategories] = useState(false);
  const [loadingCat, setLoadingCat] = useState(null);
  // Use controlled state from parent if provided, otherwise local fallback
  const [localActiveLayers, setLocalActiveLayers] = useState({});
  const activeLayers = activeSearchLayers ?? localActiveLayers;
  const setActiveLayers = (updater) => {
    const next = typeof updater === "function" ? updater(activeLayers) : updater;
    if (onSearchLayersChange) onSearchLayersChange(next);
    else setLocalActiveLayers(next);
  };

  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  useEffect(() => {
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowCategories(false);
      }
    };
    // Use capture=true so we get the event before Leaflet swallows it on mobile
    document.addEventListener("pointerdown", handle, true);
    return () => document.removeEventListener("pointerdown", handle, true);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const data = await searchNominatim(q);
      setResults(data);
      setIsOpen(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInput = (value) => {
    setQuery(value);
    setHighlighted(-1);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value || value.length < 2) { setResults([]); setIsOpen(false); return; }
    timeoutRef.current = setTimeout(() => doSearch(value), 320);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && highlighted >= 0) { e.preventDefault(); handleSelect(results[highlighted]); }
    else if (e.key === "Escape") { setIsOpen(false); setShowCategories(false); }
  };

  const handleSelect = (item) => {
    onLocationSelect({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), name: item.display_name, zoom: 16 });
    setQuery(item.display_name.split(",")[0]);
    setIsOpen(false);
    setResults([]);
  };

  const handleCategoryClick = async (cat) => {
    setShowCategories(false);
    if (!onAddCustomLayer) return;

    // Toggle off if already active
    if (activeLayers[cat.id]) {
      if (onRemoveCustomLayer) onRemoveCustomLayer(activeLayers[cat.id]);
      setActiveLayers(prev => { const n = { ...prev }; delete n[cat.id]; return n; });
      return;
    }

    // Municipality layer — special polygon layer, no Overpass fetch needed
    if (cat._municipalityLayer) {
      const layerId = `search_municipality`;
      onAddCustomLayer({ id: layerId, name: "🏘️ Občine", color: "#b45309", features: [], _searchCat: cat.id, _municipalityLayer: true });
      setActiveLayers(prev => ({ ...prev, [cat.id]: layerId }));
      return;
    }

    setLoadingCat(cat.id);
    try {
      const layer = await fetchFullSloveniaLayer(cat);
      if (layer) {
        const layerId = `search_${cat.id}`;
        onAddCustomLayer({ ...layer, id: layerId, _searchCat: cat.id });
        setActiveLayers(prev => ({ ...prev, [cat.id]: layerId }));
      }
    } finally {
      setLoadingCat(null);
    }
  };

  const activeCount = Object.keys(activeLayers).length;

  return (
    <div ref={containerRef} className="relative z-[1000]">
      {/* Input row */}
      <div className="flex items-center bg-white/96 backdrop-blur-xl rounded-xl shadow-lg border border-white/30 transition-all duration-200 hover:shadow-xl">

        {/* Categories toggle button */}
        <button
          onClick={() => { setShowCategories(p => !p); setIsOpen(false); }}
          className="flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 shrink-0 text-slate-500 hover:text-emerald-600 transition-colors relative"
          title="Kategorije (označi na karti)"
        >
          <span className="text-base leading-none">🗺️</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-0.5 bg-emerald-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        <div className="w-px h-4 bg-slate-200 shrink-0" />

        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          placeholder="Naslov, kraj, objekt…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-2.5 py-2.5 text-sm bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
        />

        {isSearching && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin mr-2.5 shrink-0" />}
        {query && !isSearching && (
          <button onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }} className="mr-2.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
        {!query && !isSearching && <Search className="w-4 h-4 text-slate-300 mr-3 shrink-0" />}
      </div>

      {/* Category grid dropdown */}
      <AnimatePresence>
        {showCategories && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onPointerDown={e => e.stopPropagation()}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 p-2.5 z-[1010]"
            style={{ minWidth: 280 }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Označi na karti — celotna Slovenija</p>
              {activeCount > 0 && (
                <button
                  onClick={() => {
                    Object.values(activeLayers).forEach(lid => onRemoveCustomLayer && onRemoveCustomLayer(lid));
                    setActiveLayers({});
                  }}
                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors font-medium"
                >
                  Počisti vse
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {CATEGORIES.map(cat => {
                const isActive = !!activeLayers[cat.id];
                const isLoading = loadingCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat)}
                    disabled={isLoading}
                    className={`relative flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-center transition-all ${
                      isActive
                        ? "ring-2 text-emerald-700"
                        : isLoading
                        ? "bg-slate-100 text-slate-400 cursor-wait"
                        : "hover:bg-slate-50 text-slate-600"
                    }`}
                    style={isActive ? { backgroundColor: cat.color + "15", ringColor: cat.color } : {}}
                  >
                    {isLoading
                      ? <span className="text-lg leading-none">⏳</span>
                      : <span className="text-lg leading-none">{cat.emoji}</span>
                    }
                    <span className="text-[9px] leading-tight text-center w-full truncate">{cat.label}</span>
                    {isActive && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text search results */}
      <AnimatePresence>
        {isOpen && results.length > 0 && !showCategories && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-80 overflow-y-auto z-[1010]"
          >
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left border-b border-slate-100 last:border-0 ${
                  highlighted === i ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-base shrink-0">📌</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{getMainName(item)}</p>
                  <p className="text-xs text-slate-400 truncate">{getSubtitle(item)}</p>
                </div>
              </button>
            ))}
            {results.length === 0 && !isSearching && query.length > 1 && (
              <div className="px-4 py-3 text-sm text-slate-400">Ni rezultatov za „{query}"</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}