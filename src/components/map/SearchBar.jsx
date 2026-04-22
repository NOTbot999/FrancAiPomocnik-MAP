import React, { useState, useRef, useEffect } from "react";
import { Search, X, MapPin, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


const TYPE_ICONS = {
  city: "🏙️", town: "🏘️", village: "🏡", hamlet: "🏠",
  suburb: "📍", neighbourhood: "📍", quarter: "📍",
  road: "🛣️", street: "🛣️", path: "🛤️",
  peak: "⛰️", mountain: "⛰️", hill: "⛰️",
  lake: "🌊", river: "🌊", water: "🌊",
  forest: "🌲", park: "🌳", nature_reserve: "🌿",
  county: "🗺️", state: "🗺️", country: "🌍",
  restaurant: "🍽️", hotel: "🏨", museum: "🏛️",
  church: "⛪", castle: "🏰", monument: "🗿",
};

function getTypeIcon(item) {
  const t = item.type || item.class || "";
  return TYPE_ICONS[t] || "📌";
}

function getSubtitle(item) {
  // Build a detailed subtitle using addressdetails
  const a = item.address || {};
  const parts = [];
  // Add house number + road for precise locations
  if (a.house_number && a.road) parts.push(`${a.road} ${a.house_number}`);
  else if (a.road) parts.push(a.road);
  if (a.suburb || a.neighbourhood) parts.push(a.suburb || a.neighbourhood);
  if (a.village || a.town || a.city) parts.push(a.village || a.town || a.city);
  if (a.postcode) parts.push(a.postcode);
  if (parts.length > 0) return parts.join(", ");
  // Fallback
  return item.display_name.split(",").slice(1, 4).filter(Boolean).join(", ");
}

function getMainName(item) {
  const a = item.address || {};
  // For house number results, show road + number as main title
  if (a.house_number && a.road) return `${a.road} ${a.house_number}`;
  return item.display_name.split(",")[0];
}

function getTypeLabel(item) {
  const t = item.type || item.class || "";
  return t.replace(/_/g, " ");
}

export default function SearchBar({ onLocationSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchLocation = async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Use addressdetails=1 and add Slovenia country bias for better results
      // Also request house numbers and street-level detail
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1&countrycodes=si&dedupe=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "sl,en" } });
      let data = await res.json();
      // If no results with country bias, search globally
      if (data.length === 0) {
        const urlGlobal = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&dedupe=1`;
        const resGlobal = await fetch(urlGlobal, { headers: { "Accept-Language": "sl,en" } });
        data = await resGlobal.json();
      }
      setResults(data);
      setIsOpen(true);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInput = (value) => {
    setQuery(value);
    setHighlighted(-1);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value || value.length < 2) { setResults([]); setIsOpen(false); return; }
    timeoutRef.current = setTimeout(() => searchLocation(value), 300);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && highlighted >= 0) { e.preventDefault(); handleSelect(results[highlighted]); }
    else if (e.key === "Escape") { setIsOpen(false); }
  };

  const handleSelect = (item) => {
    onLocationSelect({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon ?? item.lng),
      name: item.display_name,
      zoom: 15,
    });
    setQuery(item.display_name.split(",")[0]);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative z-[1000]">
      <div className="flex items-center bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden transition-all duration-300 hover:shadow-xl">
        <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search Slovenia..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2.5 text-sm bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
        />
        {isSearching && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin mr-3" />}
        {query && !isSearching && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="mr-3 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-80 overflow-y-auto"
          >
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left border-b border-slate-100 last:border-0 ${
                  highlighted === i ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-base shrink-0">{getTypeIcon(item)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {getMainName(item)}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {getSubtitle(item)}
                  </p>
                </div>
                {getTypeLabel(item) && (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 hidden sm:block">
                    {getTypeLabel(item)}
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}