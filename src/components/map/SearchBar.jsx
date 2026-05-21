import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, Loader2, ChevronDown, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Category definitions ──────────────────────────────────────────────────────
// Categories with overpassFull = fetch entire Slovenia as custom layer on click
const CATEGORIES = [
  { id: null,             label: "Vse",           emoji: "🔍" },
  { id: "castle",         label: "Gradovi",        emoji: "🏰" },
  { id: "lake",           label: "Jezera",         emoji: "🌊" },
  { id: "chapel",         label: "Kapelice",       emoji: "⛪" },
  { id: "park",           label: "Parki",          emoji: "🌳" },
  { id: "peak",           label: "Vrhovi",         emoji: "⛰️" },
  { id: "waterfall",      label: "Slapovi",        emoji: "💧" },
  { id: "viewpoint",      label: "Razglediš.",     emoji: "👁️" },
  { id: "museum",         label: "Muzeji",         emoji: "🏛️" },
  { id: "cave",           label: "Jame",           emoji: "🕳️" },
  { id: "ruins",          label: "Ruševine",       emoji: "🗿" },
  { id: "spring",         label: "Izviri",         emoji: "💦" },
  // ── NEW ──
  { id: "pipe",           label: "Pipe",           emoji: "🚰", overpassFull: true },
  { id: "parking",        label: "Parkirišča",     emoji: "🅿️", overpassFull: true },
  { id: "church",         label: "Cerkve",         emoji: "⛩️", overpassFull: true },
  { id: "camp",           label: "Kampi",          emoji: "🏕️", overpassFull: true },
  { id: "fuel",           label: "Bencinske",      emoji: "⛽", overpassFull: true },
  { id: "fire_station",   label: "Gasilski dom",   emoji: "🚒", overpassFull: true },
  { id: "police",         label: "Policija",       emoji: "🚔", overpassFull: true },
  { id: "hospital",       label: "Bolnice",        emoji: "🏥", overpassFull: true },
  { id: "clinic",         label: "Ambulante",      emoji: "🩺", overpassFull: true },
  { id: "dentist",        label: "Zobozdravstvo",  emoji: "🦷", overpassFull: true },
  { id: "supermarket",    label: "Živila",         emoji: "🛒", overpassFull: true },
  { id: "motorway_jct",   label: "AV uvozi",       emoji: "🛣️", overpassFull: true },
  { id: "bus_station",    label: "Avt. postaje",   emoji: "🚌", overpassFull: true },
  { id: "train_station",  label: "Vlak postaje",   emoji: "🚂", overpassFull: true },
  { id: "municipality",   label: "Občine/Kraji",   emoji: "🏘️", overpassFull: true },
  { id: "aerodrome",      label: "Letališča",      emoji: "✈️", overpassFull: true },
  { id: "cemetery",       label: "Pokopališča",    emoji: "⚰️", overpassFull: true },
  { id: "atm",            label: "Bankomati",      emoji: "💳", overpassFull: true },
];

// Overpass queries for full-Slovenia custom layers
const OVERPASS_FULL_QUERIES = {
  pipe:          { query: `[out:json][timeout:30];node["amenity"="drinking_water"](45.4,13.4,46.9,16.6);out;`, color: "#0ea5e9" },
  parking:       { query: `[out:json][timeout:30];(node["amenity"="parking"](45.4,13.4,46.9,16.6);way["amenity"="parking"](45.4,13.4,46.9,16.6););out center;`, color: "#6366f1" },
  church:        { query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6);way["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6););out center;`, color: "#8b5cf6" },
  camp:          { query: `[out:json][timeout:30];(node["tourism"="camp_site"](45.4,13.4,46.9,16.6);way["tourism"="camp_site"](45.4,13.4,46.9,16.6););out center;`, color: "#22c55e" },
  fuel:          { query: `[out:json][timeout:30];node["amenity"="fuel"](45.4,13.4,46.9,16.6);out;`, color: "#f59e0b" },
  fire_station:  { query: `[out:json][timeout:30];(node["amenity"="fire_station"](45.4,13.4,46.9,16.6);way["amenity"="fire_station"](45.4,13.4,46.9,16.6););out center;`, color: "#ef4444" },
  police:        { query: `[out:json][timeout:30];(node["amenity"="police"](45.4,13.4,46.9,16.6);way["amenity"="police"](45.4,13.4,46.9,16.6););out center;`, color: "#3b82f6" },
  hospital:      { query: `[out:json][timeout:30];(node["amenity"="hospital"](45.4,13.4,46.9,16.6);way["amenity"="hospital"](45.4,13.4,46.9,16.6););out center;`, color: "#ec4899" },
  clinic:        { query: `[out:json][timeout:30];(node["amenity"~"clinic|doctors"](45.4,13.4,46.9,16.6);way["amenity"~"clinic|doctors"](45.4,13.4,46.9,16.6););out center;`, color: "#14b8a6" },
  dentist:       { query: `[out:json][timeout:30];(node["amenity"="dentist"](45.4,13.4,46.9,16.6);way["amenity"="dentist"](45.4,13.4,46.9,16.6););out center;`, color: "#a855f7" },
  supermarket:   { query: `[out:json][timeout:30];(node["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6);way["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6););out center;`, color: "#f97316" },
  motorway_jct:  { query: `[out:json][timeout:30];node["highway"="motorway_junction"](45.4,13.4,46.9,16.6);out;`, color: "#64748b" },
  bus_station:   { query: `[out:json][timeout:30];(node["amenity"="bus_station"](45.4,13.4,46.9,16.6);node["highway"="bus_stop"](45.4,13.4,46.9,16.6););out;`, color: "#f59e0b" },
  train_station: { query: `[out:json][timeout:30];(node["railway"="station"](45.4,13.4,46.9,16.6);node["railway"="halt"](45.4,13.4,46.9,16.6););out;`, color: "#78716c" },
  municipality:  { query: `[out:json][timeout:30];(node["place"~"town|village|hamlet|suburb"](45.4,13.4,46.9,16.6););out;`, color: "#10b981" },
  aerodrome:     { query: `[out:json][timeout:30];(node["aeroway"="aerodrome"](45.4,13.4,46.9,16.6);way["aeroway"="aerodrome"](45.4,13.4,46.9,16.6););out center;`, color: "#06b6d4" },
  cemetery:      { query: `[out:json][timeout:30];(node["landuse"="cemetery"](45.4,13.4,46.9,16.6);way["landuse"="cemetery"](45.4,13.4,46.9,16.6););out center;`, color: "#6b7280" },
  atm:           { query: `[out:json][timeout:30];node["amenity"="atm"](45.4,13.4,46.9,16.6);out;`, color: "#84cc16" },
};

const CATEGORY_QUERY_MAP = {
  castle:    "[historic=castle]",
  lake:      "[natural=water][water=lake]",
  chapel:    "[amenity=place_of_worship]",
  park:      "[leisure=park]",
  peak:      "[natural=peak]",
  waterfall: "[waterway=waterfall]",
  viewpoint: "[tourism=viewpoint]",
  museum:    "[tourism=museum]",
  cave:      "[natural=cave_entrance]",
  ruins:     "[historic=ruins]",
  spring:    "[natural=spring]",
  pipe:          "[amenity=drinking_water]",
  parking:       "[amenity=parking]",
  church:        "[amenity=place_of_worship][religion=christian]",
  camp:          "[tourism=camp_site]",
  fuel:          "[amenity=fuel]",
  fire_station:  "[amenity=fire_station]",
  police:        "[amenity=police]",
  hospital:      "[amenity=hospital]",
  clinic:        "[amenity~clinic|doctors]",
  dentist:       "[amenity=dentist]",
  supermarket:   "[shop~supermarket|grocery|convenience]",
  motorway_jct:  "[highway=motorway_junction]",
  bus_station:   "[amenity=bus_station]",
  train_station: "[railway=station]",
  municipality:  "[place~town|village|hamlet]",
  aerodrome:     "[aeroway=aerodrome]",
  cemetery:      "[landuse=cemetery]",
  atm:           "[amenity=atm]",
};

// ── Type icon helpers ─────────────────────────────────────────────────────────
const TYPE_ICONS = {
  city: "🏙️", town: "🏘️", village: "🏡", hamlet: "🏠",
  suburb: "📍", neighbourhood: "📍", quarter: "📍",
  road: "🛣️", street: "🛣️", residential: "🛣️", path: "🛤️",
  peak: "⛰️", mountain: "⛰️", hill: "⛰️",
  lake: "🌊", river: "🌊", water: "🌊", waterfall: "💧",
  forest: "🌲", park: "🌳", nature_reserve: "🌿",
  county: "🗺️", state: "🗺️", country: "🌍",
  restaurant: "🍽️", hotel: "🏨", museum: "🏛️",
  church: "⛪", chapel: "⛪", castle: "🏰", monument: "🗿",
  viewpoint: "👁️", cave_entrance: "🕳️", ruins: "🗿", spring: "💦",
};

function getTypeIcon(item) {
  return TYPE_ICONS[item.type] || TYPE_ICONS[item.class] || "📌";
}

function getMainName(item) {
  const a = item.address || {};
  if (a.house_number && a.road) return `${a.road} ${a.house_number}`;
  return item.display_name.split(",")[0];
}

function getSubtitle(item) {
  const a = item.address || {};
  const parts = [];
  if (a.house_number && a.road) parts.push(`${a.road} ${a.house_number}`);
  else if (a.road) parts.push(a.road);
  if (a.suburb || a.neighbourhood) parts.push(a.suburb || a.neighbourhood);
  if (a.village || a.town || a.city) parts.push(a.village || a.town || a.city);
  if (a.postcode) parts.push(a.postcode);
  if (parts.length > 0) return parts.join(", ");
  return item.display_name.split(",").slice(1, 4).filter(Boolean).join(", ");
}

function getTypeLabel(item) {
  return (item.type || item.class || "").replace(/_/g, " ");
}

// ── Overpass nearby search ─────────────────────────────────────────────────────
async function fetchNearby(category, center, radius = 8000) {
  const filter = CATEGORY_QUERY_MAP[category];
  if (!filter || !center) return [];
  const [lat, lng] = center;
  const query = `[out:json][timeout:8];
(
  node${filter}(around:${radius},${lat},${lng});
  way${filter}(around:${radius},${lat},${lng});
);
out center 8;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();
  return (data.elements || []).map((el) => ({
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
    display_name: el.tags?.name || el.tags?.["name:sl"] || "Neznana lokacija",
    type: Object.keys(CATEGORY_QUERY_MAP).find(k => CATEGORY_QUERY_MAP[k] === filter) || "point",
    address: {},
    _nearby: true,
  })).filter(el => el.lat && el.lon);
}

// ── Main Nominatim search ──────────────────────────────────────────────────────
async function searchNominatim(q, category) {
  // Build category-specific extra params
  let extra = "";
  if (category === "castle")    extra = "&featuretype=settlement&historic=castle";
  if (category === "peak")      extra = "&natural=peak";
  if (category === "park")      extra = "&leisure=park";
  if (category === "museum")    extra = "&tourism=museum";
  if (category === "viewpoint") extra = "&tourism=viewpoint";

  const si = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1&countrycodes=si&dedupe=1${extra}`;
  const res = await fetch(si, { headers: { "Accept-Language": "sl,en" } });
  let data = await res.json();
  if (data.length === 0) {
    const global = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&dedupe=1${extra}`;
    const res2 = await fetch(global, { headers: { "Accept-Language": "sl,en" } });
    data = await res2.json();
  }
  return data;
}

// ── Fetch full-Slovenia Overpass layer ────────────────────────────────────────
async function fetchFullSloveniaLayer(categoryId) {
  const cfg = OVERPASS_FULL_QUERIES[categoryId];
  if (!cfg) return null;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(cfg.query),
  });
  const data = await res.json();
  const cat = CATEGORIES.find(c => c.id === categoryId);
  const features = (data.elements || []).map(el => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) return null;
    return {
      type: "Point",
      coords: [lat, lon],
      label: el.tags?.name || el.tags?.["name:sl"] || el.tags?.ref || ""
    };
  }).filter(Boolean);
  return { name: `${cat?.emoji || ""} ${cat?.label || categoryId}`, color: cfg.color, features, _categoryId: categoryId };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchBar({ onLocationSelect, mapCenter, autoFocus, onAddCustomLayer, onRemoveCustomLayer }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [activeCategory, setActiveCategory] = useState(null); // null = all
  const [showCategories, setShowCategories] = useState(false);
  const [fullLayerLoading, setFullLayerLoading] = useState(null); // categoryId being loaded
  const [activeFullLayers, setActiveFullLayers] = useState({}); // categoryId -> layerId

  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  // Close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowCategories(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Load nearby when category selected and no query
  useEffect(() => {
    if (!activeCategory || query.length > 1) return;
    setIsLoadingNearby(true);
    setNearbyResults([]);
    setIsOpen(true);
    fetchNearby(activeCategory, mapCenter)
      .then(setNearbyResults)
      .catch(() => setNearbyResults([]))
      .finally(() => setIsLoadingNearby(false));
  }, [activeCategory, mapCenter]);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const data = await searchNominatim(q, activeCategory);
      setResults(data);
      setIsOpen(true);
    } finally {
      setIsSearching(false);
    }
  }, [activeCategory]);

  const handleInput = (value) => {
    setQuery(value);
    setHighlighted(-1);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value || value.length < 2) { setResults([]); if (!activeCategory) setIsOpen(false); return; }
    timeoutRef.current = setTimeout(() => doSearch(value), 320);
  };

  const handleKeyDown = (e) => {
    const all = [...(query.length > 1 ? results : nearbyResults)];
    if (!isOpen || all.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, all.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && highlighted >= 0) { e.preventDefault(); handleSelect(all[highlighted]); }
    else if (e.key === "Escape") { setIsOpen(false); }
  };

  const handleSelect = (item) => {
    onLocationSelect({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon ?? item.lng),
      name: item.display_name,
      zoom: item._nearby ? 15 : 16,
    });
    setQuery(item.display_name.split(",")[0]);
    setIsOpen(false);
    setResults([]);
  };

  const handleCategorySelect = async (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);

    // For full-Slovenia overpass categories — toggle layer on/off
    if (cat?.overpassFull && onAddCustomLayer) {
      setShowCategories(false);
      // If already active, remove it
      if (activeFullLayers[catId]) {
        if (onRemoveCustomLayer) onRemoveCustomLayer(activeFullLayers[catId]);
        setActiveFullLayers(prev => { const n = { ...prev }; delete n[catId]; return n; });
        return;
      }
      setFullLayerLoading(catId);
      try {
        const layer = await fetchFullSloveniaLayer(catId);
        if (layer) {
          const layerId = `search_${catId}_${Date.now()}`;
          onAddCustomLayer({ ...layer, id: layerId, _searchCat: catId });
          setActiveFullLayers(prev => ({ ...prev, [catId]: layerId }));
        }
      } finally {
        setFullLayerLoading(null);
      }
      return;
    }

    setActiveCategory(catId);
    setShowCategories(false);
    if (!catId) { setNearbyResults([]); if (query.length < 2) setIsOpen(false); }
  };

  const activeCat = CATEGORIES.find(c => c.id === activeCategory);
  const displayResults = query.length > 1 ? results : nearbyResults;
  const showDropdown = isOpen && (displayResults.length > 0 || isLoadingNearby || isSearching);

  return (
    <div ref={containerRef} className="relative z-[1000]">
      {/* Main input row */}
      <div className="flex items-center bg-white/96 backdrop-blur-xl rounded-xl shadow-lg border border-white/30 overflow-visible transition-all duration-200 hover:shadow-xl">

        {/* Category pill */}
        <button
          onClick={() => setShowCategories(p => !p)}
          className="flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 shrink-0 text-slate-500 hover:text-emerald-600 transition-colors"
          title="Kategorija iskanja"
        >
          <span className="text-base leading-none">{activeCat?.emoji || "🔍"}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        <div className="w-px h-4 bg-slate-200 shrink-0" />

        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          placeholder={activeCat?.id ? `Iščem ${activeCat.label.toLowerCase()}…` : "Naslov, kraj, objekt…"}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (displayResults.length > 0 || activeCategory) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-2.5 py-2.5 text-sm bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
        />

        {(isSearching || isLoadingNearby) && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin mr-2.5 shrink-0" />}
        {query && !(isSearching || isLoadingNearby) && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(!!activeCategory); }}
            className="mr-2.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {!query && !(isSearching || isLoadingNearby) && (
          <Search className="w-4 h-4 text-slate-300 mr-3 shrink-0" />
        )}
      </div>

      {/* Category picker dropdown */}
      <AnimatePresence>
        {showCategories && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 p-2 z-[1010]"
          >
            <p className="text-[10px] font-semibold text-slate-400 uppercase px-1.5 pb-1.5">Kategorije iskanja</p>
            <div className="grid grid-cols-4 gap-1 mb-2">
              {CATEGORIES.filter(c => !c.overpassFull).map(cat => (
                <button
                  key={String(cat.id)}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-center transition-all text-xs font-medium ${
                    activeCategory === cat.id
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300"
                      : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="text-lg leading-none">{cat.emoji}</span>
                  <span className="text-[10px] leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase px-1.5 pb-1.5">🇸🇮 Celotna Slovenija (AI Layer)</p>
              <div className="grid grid-cols-4 gap-1">
                {CATEGORIES.filter(c => c.overpassFull).map(cat => {
                  const isActive = !!activeFullLayers[cat.id];
                  const isLoading = fullLayerLoading === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      disabled={isLoading}
                      className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-center transition-all text-xs font-medium relative ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400"
                          : isLoading
                          ? "bg-slate-100 text-slate-400 cursor-wait"
                          : "hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {isLoading ? (
                        <span className="text-lg leading-none animate-spin">⏳</span>
                      ) : (
                        <span className="text-lg leading-none">{cat.emoji}</span>
                      )}
                      <span className="text-[10px] leading-tight">{cat.label}</span>
                      {isActive && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results dropdown */}
      <AnimatePresence>
        {showDropdown && !showCategories && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-80 overflow-y-auto z-[1010]"
          >
            {/* Nearby section header */}
            {query.length <= 1 && activeCategory && (
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                <Navigation className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                  V bližini
                </span>
              </div>
            )}

            {isLoadingNearby && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Iščem v bližini…</span>
              </div>
            )}

            {displayResults.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left border-b border-slate-100 last:border-0 ${
                  highlighted === i ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-base shrink-0">{getTypeIcon(item)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{getMainName(item)}</p>
                  <p className="text-xs text-slate-400 truncate">{getSubtitle(item)}</p>
                </div>
                {getTypeLabel(item) && (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 hidden sm:block">
                    {getTypeLabel(item)}
                  </span>
                )}
                {item._nearby && (
                  <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                    <Navigation className="w-2.5 h-2.5" /> blizu
                  </span>
                )}
              </button>
            ))}

            {displayResults.length === 0 && !isSearching && !isLoadingNearby && query.length > 1 && (
              <div className="px-4 py-3 text-sm text-slate-400">Ni rezultatov za „{query}"</div>
            )}

            {displayResults.length === 0 && !isSearching && !isLoadingNearby && activeCategory && query.length <= 1 && (
              <div className="px-4 py-3 text-sm text-slate-400">
                Ni {CATEGORIES.find(c => c.id === activeCategory)?.label.toLowerCase()} v bližini.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}