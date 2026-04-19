import React, { useState, useRef, useEffect } from "react";
import { Search, X, MapPin, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SearchBar({ onLocationSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const searchLocation = async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + " Slovenia")}&limit=6&addressdetails=1&countrycodes=si`
      );
      const data = await res.json();
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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchLocation(value), 400);
  };

  const handleSelect = (item) => {
    onLocationSelect({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: item.display_name,
      zoom: item.type === "city" || item.type === "town" ? 13 : 16
    });
    setQuery(item.display_name.split(",")[0]);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div className="relative z-[1000]">
      <div className="flex items-center bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden transition-all duration-300 hover:shadow-xl">
        <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search Slovenia..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
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
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-white/20 overflow-hidden max-h-72 overflow-y-auto"
          >
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item)}
                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-emerald-50 transition-colors text-left border-b border-slate-100 last:border-0"
              >
                <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.display_name.split(",")[0]}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.display_name.split(",").slice(1, 3).join(",")}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}