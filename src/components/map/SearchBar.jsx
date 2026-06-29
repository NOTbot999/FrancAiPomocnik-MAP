import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefetchCategories } from "@/hooks/usePrefetchCategories";
import { base44 } from "@/api/base44Client";
import CategoryGrid from "./CategoryGrid";

// ── All categories — each toggles a full-Slovenia layer ───────────────────────
export const CATEGORIES = [
  { id: "castle",        label: "Gradovi",        emoji: "🏰", color: "#b45309", query: `[out:json][timeout:30];(node["historic"="castle"](45.4,13.4,46.9,16.6);way["historic"="castle"](45.4,13.4,46.9,16.6););out center;` },
  { id: "peak",          label: "Vrhovi",         emoji: "⛰️", color: "#6b7280", query: `[out:json][timeout:30];node["natural"="peak"](45.4,13.4,46.9,16.6);out;` },
  { id: "waterfall",     label: "Slapovi",        emoji: "💧", color: "#0ea5e9", query: `[out:json][timeout:30];node["waterway"="waterfall"](45.4,13.4,46.9,16.6);out;` },
  { id: "viewpoint",     label: "Razglediš.",     emoji: "👁️", color: "#8b5cf6", query: `[out:json][timeout:30];node["tourism"="viewpoint"](45.4,13.4,46.9,16.6);out;` },
  { id: "cave",          label: "Jame",           emoji: "🕳️", color: "#78716c", _caveDbLayer: true, query: `` },
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

  // ── Novi custom sloji (označi na karti) ──────────────────────────────────────
  { id: "beach",         label: "Plaže",          emoji: "🏖️", color: "#fbbf24", query: `[out:json][timeout:30];(node["natural"="beach"](45.4,13.4,46.9,16.6);way["natural"="beach"](45.4,13.4,46.9,16.6);relation["natural"="beach"](45.4,13.4,46.9,16.6););out center;` },
  { id: "geocache",      label: "Geocacher",      emoji: "🥾", color: "#84cc16", query: `[out:json][timeout:45];(node["geocache"](45.4,13.4,46.9,16.6);node["tourism"="information"]["information"="geocache"](45.4,13.4,46.9,16.6););out;` },
  { id: "racetrack",     label: "Dirkališča",      emoji: "🏁", color: "#ef4444", query: `[out:json][timeout:30];(way["highway"="raceway"](45.4,13.4,46.9,16.6);way["leisure"="track"]["sport"="motorsport"](45.4,13.4,46.9,16.6);way["leisure"="track"]["sport"="karting"](45.4,13.4,46.9,16.6);way["leisure"="track"]["sport"="motor_autocross"](45.4,13.4,46.9,16.6);way["sport"="motorsport"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pitch",         label: "Šport. igrišča", emoji: "⚽", color: "#22c55e", query: `[out:json][timeout:45];(way["leisure"="pitch"](45.4,13.4,46.9,16.6);relation["leisure"="pitch"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fitness",       label: "Outdoor fitnes",  emoji: "💪", color: "#f97316", query: `[out:json][timeout:30];(node["leisure"="fitness_station"](45.4,13.4,46.9,16.6);way["leisure"="fitness_station"](45.4,13.4,46.9,16.6););out center;` },
  { id: "toilets",       label: "Stranišča",      emoji: "🚻", color: "#64748b", query: `[out:json][timeout:30];(node["amenity"="toilets"](45.4,13.4,46.9,16.6);way["amenity"="toilets"](45.4,13.4,46.9,16.6););out center;` },
  { id: "transmitter",   label: "Oddajniki",      emoji: "📡", color: "#0ea5e9", query: `[out:json][timeout:30];(node["man_made"="communications_tower"](45.4,13.4,46.9,16.6);node["man_made"="tower"]["tower:type"="communication"](45.4,13.4,46.9,16.6);way["man_made"="tower"]["tower:type"="communication"](45.4,13.4,46.9,16.6);node["man_made"="mast"]["tower:type"="communication"](45.4,13.4,46.9,16.6););out center;` },
  { id: "speed_camera",   label: "Radarji",       emoji: "📷", color: "#dc2626", query: `[out:json][timeout:30];node["highway"="speed_camera"](45.4,13.4,46.9,16.6);out;` },
  { id: "post_office",   label: "Pošte",          emoji: "📮", color: "#8b5cf6", query: `[out:json][timeout:30];(node["amenity"="post_office"](45.4,13.4,46.9,16.6);way["amenity"="post_office"](45.4,13.4,46.9,16.6););out center;` },

];

// Invalidate old cache for improved queries
["fuel","atm","hospital","clinic","lake","racetrack","geocache","pitch","fitness","toilets","transmitter","speed_camera","post_office"].forEach(id => {
  try { localStorage.removeItem("slomapcat_" + id); } catch {}
});
// Invalidate old municipality cache (stitching fix)
["slomapcat_mun_v1","slomapcat_mun_v2","slomapcat_mun_v3","slomapcat_municipalities_v2","slomapcat_mun_v4","slomapcat_places_v2"].forEach(k => {
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

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const OP_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "sl,en;q=0.8",
  "User-Agent": "SloveniaGISExplorer/1.0 (https://francaimap.app)",
};

async function fetchOverpass(query) {
  const enc = encodeURIComponent(query);
  // Try GET first (lighter, fewer 406s), then POST as fallback per mirror
  for (const mirror of OVERPASS_MIRRORS) {
    for (const method of ["GET", "POST"]) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const url = method === "GET" ? `${mirror}?data=${enc}` : mirror;
        const init = { method, headers: OP_HEADERS, signal: controller.signal };
        if (method === "POST") {
          init.headers["Content-Type"] = "application/x-www-form-urlencoded";
          init.body = `data=${enc}`;
        }
        const res = await fetch(url, init);
        clearTimeout(timeout);
        if (!res.ok) continue;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("json")) continue; // HTML error page → try next
        return await res.json();
      } catch {
        // try next method/mirror
      }
    }
  }
  throw new Error("Vsi Overpass strežniki so nedosegljivi");
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
  // 3. Server-side prebuilt cache (fastest remote source)
  try {
    const serverData = await base44.entities.CachedLayer.filter({ category_id: cat.id });
    if (serverData && serverData.length > 0 && serverData[0].features?.length > 0) {
      const features = serverData[0].features;
      saveToStorage(cat.id, features);
      const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, emoji: cat.emoji, features, _categoryId: cat.id };
      layerCache[cat.id] = layer;
      return layer;
    }
  } catch { /* fallback to Overpass */ }
  // 4. Fallback: Fetch from Overpass (with mirror fallback)
  const data = await fetchOverpass(cat.query);
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
  // Only persist non-empty results so a temporary failure never pins an empty layer for 7 days
  if (features.length > 0) {
    saveToStorage(cat.id, features);
  } else {
    try { localStorage.removeItem(LS_PREFIX + cat.id); } catch {}
  }
  const layer = { name: `${cat.emoji} ${cat.label}`, color: cat.color, emoji: cat.emoji, features, _categoryId: cat.id };
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
export default function SearchBar({ onLocationSelect, autoFocus, onAddCustomLayer, onRemoveCustomLayer, activeSearchLayers, onSearchLayersChange, customMenuLayers, customMenuActive, onToggleCustomMenuLayer, onDeleteCustomMenuLayer }) {
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