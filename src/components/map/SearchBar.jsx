import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefetchCategories } from "@/hooks/usePrefetchCategories";
import { base44, OFFLINE_MODE } from "@/api/base44Client";
import { fetchOverpass } from "@/lib/overpass";
import { loadBundled } from "@/lib/offlineData";
import { CATEGORIES } from "@/data/categories";
import { parseOverpassPoints } from "@/data/parsers";
import { loadCaves } from "./CaveLayer";
import CategoryGrid from "./CategoryGrid";
import { loadOpenChargeMap, loadWikidataCastles, loadWikidataMonuments, loadWikidataMuseums, loadWikipediaArticles } from "./ExternalLayers";

// Category definitions live in src/data/categories.js (shared with scripts/fetch-offline-data.mjs)
export { CATEGORIES };

// Invalidate old cache for improved queries
["fuel","atm","hospital","clinic","lake","racetrack","geocache","pitch","fitness","toilets","transmitter","speed_camera","post_office","sex_shop","tunnel","viaduct","motorway_tunnel","motorway_bridge","cross","helipad","mosque","synagogue","beach","bus_station","train_station","camp","aerodrome","cemetery","motorway_jct"].forEach(id => {
  try { localStorage.removeItem("slomapcat_" + id); } catch {}
});
// Invalidate OLD municipality cache formats only (stitching fix).
// Current keys (slomapcat_mun_v4, slomapcat_places_v2) are kept so the layer
// loads instantly from cache instead of re-fetching from Overpass every time.
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

export async function fetchFullSloveniaLayer(cat) {
  // 1. In-memory cache (only non-empty results)
  if (layerCache[cat.id] && layerCache[cat.id].features.length > 0) return layerCache[cat.id];
  // 2. localStorage cache (ignore stale empty results so a transient Overpass failure doesn't stick)
  const cached = loadFromStorage(cat.id);
  if (cached && cached.length > 0) {
    const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, emoji: cat.emoji, features: cached, _categoryId: cat.id };
    layerCache[cat.id] = layer;
    return layer;
  }
  // 3. Bundled /data/<id>.json (built by `npm run fetch-data`) — instant and works offline
  const bundled = await loadBundled(cat.id);
  if (bundled) {
    const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, emoji: cat.emoji, features: bundled, _categoryId: cat.id, _bundled: true };
    layerCache[cat.id] = layer;
    return layer;
  }

  // 4+5. Race server cache vs Overpass in parallel — whichever returns valid data first wins
  const parseOverpass = parseOverpassPoints;

  const serverPromise = OFFLINE_MODE
    ? Promise.resolve(null)
    : base44.entities.CachedLayer.filter({ category_id: cat.id })
        .then(d => (d?.length > 0 && d[0].features?.length > 0) ? d[0].features : null)
        .catch(() => null);

  let sourcePromise;
  if (cat._source === "openchargemap") {
    sourcePromise = loadOpenChargeMap().catch(() => null);
  } else if (cat._source === "wikidata_castles") {
    sourcePromise = loadWikidataCastles().catch(() => null);
  } else if (cat._source === "wikidata_monuments") {
    sourcePromise = loadWikidataMonuments().catch(() => null);
  } else if (cat._source === "wikidata_museums") {
    sourcePromise = loadWikidataMuseums().catch(() => null);
  } else if (cat._source === "wikipedia") {
    sourcePromise = loadWikipediaArticles().catch(() => null);
  } else {
    sourcePromise = cat.query
      ? fetchOverpass(cat.query).then(parseOverpass).catch(() => null)
      : Promise.resolve(null);
  }

  let features = null;
  let fromServer = false;
  // Wait for server first (usually faster), then Overpass as fallback
  const serverResult = await serverPromise;
  if (serverResult && serverResult.length > 0) {
    features = serverResult;
    fromServer = true;
  } else {
    features = await sourcePromise;
  }
  // Only persist non-empty results so a temporary failure never pins an empty layer for 7 days
  if (features && features.length > 0) {
    saveToStorage(cat.id, features);
    // Save to server cache too (admin-only write; silently fails for regular users)
    if (!fromServer && !OFFLINE_MODE) {
      try {
        const existing = await base44.entities.CachedLayer.filter({ category_id: cat.id });
        if (existing && existing.length > 0) {
          await base44.entities.CachedLayer.update(existing[0].id, {
            features, feature_count: features.length, built_at: new Date().toISOString(),
          });
        } else {
          await base44.entities.CachedLayer.create({
            category_id: cat.id, features, feature_count: features.length, built_at: new Date().toISOString(),
          });
        }
      } catch { /* non-admin user — skip server cache write */ }
    }
  } else {
    try { localStorage.removeItem(LS_PREFIX + cat.id); } catch {}
  }
  const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, emoji: cat.emoji, features: features || [], _categoryId: cat.id };
  layerCache[cat.id] = layer;
  return layer;
}

// ── Nominatim text search ─────────────────────────────────────────────────────
async function searchNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1&namedetails=1&countrycodes=si&dedupe=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "sl,hr,en", "User-Agent": "SloveniaGISExplorer/1.0" } });
  let data = await res.json();
  if (data.length === 0) {
    const global = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&namedetails=1&dedupe=1`;
    const res2 = await fetch(global, { headers: { "Accept-Language": "sl,hr,en", "User-Agent": "SloveniaGISExplorer/1.0" } });
    data = await res2.json();
  }
  // Remove true duplicates: same display_name or same coordinates (within ~1m)
  const seen = new Set();
  const deduped = [];
  for (const item of data) {
    const key = (item.display_name || "").trim().toLowerCase();
    const coordKey = `${parseFloat(item.lat).toFixed(5)},${parseFloat(item.lon).toFixed(5)}`;
    if (seen.has(key) || seen.has(coordKey)) continue;
    seen.add(key);
    seen.add(coordKey);
    deduped.push(item);
  }
  return deduped;
}

function getMainName(item) {
  if (item._source) return item.display_name.split(",")[0];
  const a = item.address || {};
  if (a.house_number && a.road) return `${a.road} ${a.house_number}`;
  return item.display_name.split(",")[0];
}

function getSubtitle(item) {
  if (item._source) return item._layerName || "";
  const a = item.address || {};
  const parts = [];
  if (a.road) parts.push(a.road);
  if (a.village || a.town || a.city) parts.push(a.village || a.town || a.city);
  if (a.postcode) parts.push(a.postcode);
  return parts.length > 0 ? parts.join(", ") : item.display_name.split(",").slice(1, 3).join(", ");
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchBar({ onLocationSelect, autoFocus, onAddCustomLayer, onRemoveCustomLayer, activeSearchLayers, onSearchLayersChange, customMenuLayers, customMenuActive, onToggleCustomMenuLayer, onDeleteCustomMenuLayer, searchableLayers = [] }) {
  // Pre-warm Overpass cache for all categories in background on first render
  usePrefetchCategories(CATEGORIES);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [showCategories, setShowCategories] = useState(false);
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
      const qlc = q.toLowerCase().trim();

      // ── Layer feature search (gradovi, custom sloji, ...) ────────────────────
      const layerMatches = [];
      for (const layer of searchableLayers) {
        if (!layer || !Array.isArray(layer.features)) continue;
        const emoji = layer.emoji || (layer.name ? layer.name.split(" ")[0] : "📍");
        for (const f of layer.features) {
          if (!f || !Array.isArray(f.coords) || f.coords.length < 2) continue;
          const lat = f.coords[0], lng = f.coords[1];
          if (typeof lat !== "number" || typeof lng !== "number") continue;
          const label = f.label || "";
          if (label.toLowerCase().includes(qlc)) {
            layerMatches.push({
              lat, lon: lng,
              display_name: label,
              address: {},
              _emoji: emoji,
              _source: "layer",
              _layerName: (layer.name || "").replace(/^\S+\s/, ""),
            });
          }
          if (layerMatches.length >= 8) break;
        }
        if (layerMatches.length >= 8) break;
      }

      // ── Cave DB search (vedno, tudi brez aktivnega sloja) ───────────────────
      let caveMatches = [];
      try {
        const caves = await loadCaves();
        caveMatches = caves
          .filter(c => c.name && c.name.toLowerCase().includes(qlc))
          .slice(0, 8)
          .map(c => {
            const dim = [];
            if (c.depth_m) dim.push(`${c.depth_m}m glob.`);
            if (c.length_m) dim.push(`${c.length_m}m dol.`);
            const sub = [c.administrative_unit, c.entry_regime].filter(Boolean).join(" · ");
            return {
              lat: parseFloat(c.latitude), lon: parseFloat(c.longitude),
              display_name: c.name + (dim.length ? ` (${dim.join(", ")})` : ""),
              address: { county: sub || "Jama" },
              _emoji: "🕳️",
              _source: "cave",
              _layerName: "Jame",
            };
          });
      } catch {}

      // ── Nominatim (naslovi, hišne št., občine, kraji) ────────────────────────
      let nominatimData = [];
      try { nominatimData = await searchNominatim(q); } catch {}

      // Merge: layer/cave matches first, then Nominatim, dedup by coords
      const seen = new Set();
      const merged = [];
      for (const item of [...layerMatches, ...caveMatches, ...nominatimData]) {
        const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
        if (isNaN(lat) || isNaN(lon)) continue;
        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
        if (merged.length >= 12) break;
      }
      setResults(merged);
      setIsOpen(true);
    } finally {
      setIsSearching(false);
    }
  }, [searchableLayers]);

  const handleInput = (value) => {
    setQuery(value);
    setHighlighted(-1);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value || value.length < 2) { setResults([]); setIsOpen(false); return; }
    timeoutRef.current = setTimeout(() => doSearch(value), 320);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setIsOpen(false); setShowCategories(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && results[highlighted]) {
        handleSelect(results[highlighted]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      } else if (query.length >= 2) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        doSearch(query);
      }
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
  };

  const handleSelect = (item) => {
    onLocationSelect({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), name: item.display_name, zoom: 16 });
    setQuery(item.display_name.split(",")[0]);
    setIsOpen(false);
    setResults([]);
  };

  const resultEmoji = (item) => item._emoji || "📌";

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
            <CategoryGrid
              onAddCustomLayer={onAddCustomLayer}
              onRemoveCustomLayer={onRemoveCustomLayer}
              activeSearchLayers={activeLayers}
              onSearchLayersChange={setActiveLayers}
              customMenuLayers={customMenuLayers}
              customMenuActive={customMenuActive}
              onToggleCustomMenuLayer={onToggleCustomMenuLayer}
              onDeleteCustomMenuLayer={onDeleteCustomMenuLayer}
            />
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
                <span className="text-base shrink-0">{resultEmoji(item)}</span>
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