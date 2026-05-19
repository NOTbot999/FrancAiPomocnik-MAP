import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, Loader2, ChevronDown, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: null,             label: "Vse",       emoji: "🔍" },
  { id: "castle",         label: "Gradovi",   emoji: "🏰", amenity: null, historic: "castle", natural: null },
  { id: "lake",           label: "Jezera",    emoji: "🌊", natural: "water", water: "lake" },
  { id: "chapel",         label: "Kapelice",  emoji: "⛪", amenity: "place_of_worship", religion: null },
  { id: "park",           label: "Parki",     emoji: "🌳", leisure: "park" },
  { id: "peak",           label: "Vrhovi",    emoji: "⛰️", natural: "peak" },
  { id: "waterfall",      label: "Slapovi",   emoji: "💧", waterway: "waterfall" },
  { id: "viewpoint",      label: "Razglediš.", emoji: "👁️", tourism: "viewpoint" },
  { id: "museum",         label: "Muzeji",    emoji: "🏛️", tourism: "museum" },
  { id: "cave",           label: "Jame",      emoji: "🕳️", natural: "cave_entrance" },
  { id: "ruins",          label: "Ruševine",  emoji: "🗿", historic: "ruins" },
  { id: "spring",         label: "Izviri",    emoji: "💦", natural: "spring" },
];

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchBar({ onLocationSelect, mapCenter, autoFocus }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [activeCategory, setActiveCategory] = useState(null); // null = all
  const [showCategories, setShowCategories] = useState(false);

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

  const handleCategorySelect = (catId) => {
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
            <p className="text-[10px] font-semibold text-slate-400 uppercase px-1.5 pb-1.5">Kategorije</p>
            <div className="grid grid-cols-4 gap-1">
              {CATEGORIES.map(cat => (
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