import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, MapPin, Star, X, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { OVERLAY_CATEGORIES } from "./layerConfig";
import ReactMarkdown from "react-markdown";

const AREA_OPTIONS = [
  { label: "100×100 m", km: 0.1, latDelta: 0.00045, lngDelta: 0.00072 },
  { label: "250×250 m", km: 0.25, latDelta: 0.001125, lngDelta: 0.0018 },
  { label: "500×500 m", km: 0.5, latDelta: 0.00225, lngDelta: 0.0036 },
  { label: "1×1 km", km: 1, latDelta: 0.0045, lngDelta: 0.0072 },
  { label: "3×3 km", km: 3, latDelta: 0.0135, lngDelta: 0.0215 },
  { label: "5×5 km", km: 5, latDelta: 0.0225, lngDelta: 0.036 },
  { label: "10×10 km", km: 10, latDelta: 0.045, lngDelta: 0.072 },
  { label: "50×50 km", km: 50, latDelta: 0.225, lngDelta: 0.36 },
];

// Overpass API query — fetch real OSM objects in bbox
async function fetchOverpassData(minLat, minLng, maxLat, maxLng) {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:25];
(
  node["historic"](${bbox});
  node["tourism"](${bbox});
  node["amenity"~"place_of_worship|shelter|restaurant|parking"](${bbox});
  node["natural"~"peak|spring|waterfall|cave_entrance|water"](${bbox});
  node["man_made"~"bunker|tower|chimney|water_tower|bridge"](${bbox});
  node["military"](${bbox});
  node["abandoned"](${bbox});
  node["ruins"](${bbox});
  way["historic"](${bbox});
  way["tourism"](${bbox});
  way["natural"~"peak|spring|waterfall|cave_entrance|water"](${bbox});
  way["military"](${bbox});
  way["ruins"](${bbox});
  way["abandoned"](${bbox});
  relation["hiking"](${bbox});
  relation["route"~"hiking|bicycle|foot"](${bbox});
);
out center tags 200;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();
  return data.elements || [];
}

function overpassToText(elements) {
  if (!elements.length) return "Ni podatkov v OpenStreetMap za to območje.";
  return elements.map(el => {
    const t = el.tags || {};
    const lat = el.lat || el.center?.lat;
    const lng = el.lon || el.center?.lon;
    const name = t.name || t["name:sl"] || t["name:en"] || "";
    const type = t.historic || t.tourism || t.amenity || t.natural || t.man_made || t.military || t.ruins || t.abandoned || el.type || "";
    return `- ${name || "(brez imena)"} [${type}] lat=${lat?.toFixed(5)} lng=${lng?.toFixed(5)}${t.description ? " — " + t.description : ""}${t.note ? " (" + t.note + ")" : ""}`;
  }).join("\n");
}

function overpassToMarkers(elements, minLat, maxLat, minLng, maxLng) {
  return elements
    .map(el => {
      const t = el.tags || {};
      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      if (!lat || !lng) return null;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
      const name = t.name || t["name:sl"] || t["name:en"] || t.historic || t.tourism || t.amenity || t.natural || t.man_made || t.military || "(objekt)";
      const typeTag = t.historic || t.tourism || t.amenity || t.natural || t.man_made || t.military || "";
      let markerType = "poi";
      if (["peak","spring","waterfall","cave_entrance","water","wood"].includes(typeTag)) markerType = "landmark";
      if (["ruins","archaeological_site","castle","bunker","fort","memorial","monument","battlefield"].includes(typeTag)) markerType = "structure";
      if (["military","bunker"].includes(typeTag) || t.military || t.ruins || t.abandoned) markerType = "structure";
      const desc = t.description || t["description:sl"] || t.note || typeTag;
      return { lat, lng, label: name, type: markerType, description: desc };
    })
    .filter(Boolean);
}

const TERRAIN_AI_PROMPT = (osmText, placeName, lat, lng, km) =>
`Si GIS asistent za Slovenijo. VEDNO odgovarjaj v SLOVENŠČINI.
Spodaj so DEJANSKI podatki iz OpenStreetMap za območje ${km}×${km} km okoli "${placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}".
Opiši jih v lepem slovenskem besedilu — kaj je zanimivega, zakaj je vredno obiska, kratki opisi.
NE dodajaj objektov ki niso na spodnjem seznamu. NE izmišljaj imen ali lokacij.

OSM podatki:
${osmText}`;

const URBEX_AI_PROMPT = (osmText, placeName, lat, lng, km) =>
`Si GIS analitik za iskanje neznanih objektov v Sloveniji. VEDNO odgovarjaj v SLOVENŠČINI.
Spodaj so DEJANSKI podatki iz OpenStreetMap za območje ${km}×${km} km okoli "${placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}".
Fokusiraj se na: ruševine, opuščene objekte, vojaške/zgodovinske, archaeological_site, bunkerje, castle, tower, memorial.
Za vsak tak objekt kratko razloži zakaj je zanimiv za urbex/iskanje.
NE dodajaj objektov ki niso na spodnjem seznamu. Če ni nobenih takih objektov, kratko sporoči.

OSM podatki:
${osmText}`;

export default function UnifiedAnalysisPanel({
  mapCenter,
  mapZoom,
  activeLayers,
  onToggleLayer,
  onAddMarkers,
  onRemoveAiMarkers,
  onFlyTo,
  onShowRoute,
  theme,
  onRequestPin,
  pinnedLocation,
}) {
  const [selectedArea, setSelectedArea] = useState(AREA_OPTIONS[2]);
  const [pinnedPlaceName, setPinnedPlaceName] = useState(null);
  const [frozenCoords, setFrozenCoords] = useState(null);

  // Combined analysis state
  const [analysisResult, setAnalysisResult] = useState(() => {
    const terrain = localStorage.getItem("ai_terrain_result");
    const urbex = localStorage.getItem("ai_urbex_result");
    return terrain || urbex ? { terrain, urbex } : null;
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMarkers, setAnalysisMarkers] = useState(() => {
    try {
      const terrain = JSON.parse(localStorage.getItem("ai_terrain_markers") || "[]");
      const urbex = JSON.parse(localStorage.getItem("ai_urbex_markers") || "[]");
      return { terrain, urbex };
    } catch {
      return { terrain: [], urbex: [] };
    }
  });
  const [visibleMarkers, setVisibleMarkers] = useState({});
  const [activeRouteIdx, setActiveRouteIdx] = useState(null);
  const [savedLocation, setSavedLocation] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ai_analysis_location"));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!pinnedLocation) { setPinnedPlaceName(null); return; }
    const [lat, lng] = pinnedLocation;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=sl`)
      .then(r => r.json())
      .then(data => {
        const a = data.address || {};
        const place = a.village || a.town || a.city || a.hamlet || a.suburb || "";
        const municipality = a.municipality || a.county || "";
        setPinnedPlaceName([place, municipality].filter(Boolean).join(", ") || data.display_name?.split(",")[0] || "");
      })
      .catch(() => setPinnedPlaceName(null));
  }, [pinnedLocation]);

  const displayLat = frozenCoords ? frozenCoords[0] : (pinnedLocation ? pinnedLocation[0] : mapCenter?.[0]);
  const displayLng = frozenCoords ? frozenCoords[1] : (pinnedLocation ? pinnedLocation[1] : mapCenter?.[1]);

  const analyze = async () => {
    const analysisLat = pinnedLocation ? pinnedLocation[0] : mapCenter?.[0];
    const analysisLng = pinnedLocation ? pinnedLocation[1] : mapCenter?.[1];
    
    setSavedLocation({ lat: analysisLat, lng: analysisLng, area: selectedArea.label });
    localStorage.setItem("ai_analysis_location", JSON.stringify({ lat: analysisLat, lng: analysisLng, area: selectedArea.label }));
    setFrozenCoords([analysisLat, analysisLng]);
    setAnalysisLoading(true);
    setAnalysisResult(null);
    setAnalysisMarkers({ terrain: [], urbex: [] });
    setActiveRouteIdx(null);
    setVisibleMarkers({});
    if (onRemoveAiMarkers) onRemoveAiMarkers();
    if (onShowRoute) onShowRoute(null);

    const { latDelta, lngDelta, km } = selectedArea;
    const minLat = analysisLat - latDelta;
    const maxLat = analysisLat + latDelta;
    const minLng = analysisLng - lngDelta;
    const maxLng = analysisLng + lngDelta;

    // Step 1: reverse geocode + Overpass in parallel
    let placeName = "";
    let osmElements = [];
    try {
      const [geoRes, osmData] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${analysisLat}&lon=${analysisLng}&format=json&accept-language=sl`).then(r => r.json()),
        fetchOverpassData(minLat, minLng, maxLat, maxLng)
      ]);
      const a = geoRes.address || {};
      placeName = [a.village || a.town || a.city || a.hamlet || "", a.municipality || a.county || ""].filter(Boolean).join(", ") || geoRes.display_name?.split(",")[0] || "";
      osmElements = osmData;
    } catch {}

    // Step 2: build real markers directly from OSM
    const allMarkers = overpassToMarkers(osmElements, minLat, maxLat, minLng, maxLng);
    const urbexMarkers = allMarkers.filter(m => m.type === "structure");
    const terrainMarkers = allMarkers;

    // Step 3: AI describes only what OSM actually found
    const osmText = overpassToText(osmElements);
    const [terrainRes, urbexRes] = await Promise.all([
      base44.integrations.Core.InvokeLLM({ prompt: TERRAIN_AI_PROMPT(osmText, placeName, analysisLat, analysisLng, km) }),
      base44.integrations.Core.InvokeLLM({ prompt: URBEX_AI_PROMPT(osmText, placeName, analysisLat, analysisLng, km) }),
    ]);
    const terrainText = typeof terrainRes === "string" ? terrainRes : terrainRes?.content || "";
    const urbexText = typeof urbexRes === "string" ? urbexRes : urbexRes?.content || "";

    setAnalysisMarkers({ terrain: terrainMarkers, urbex: urbexMarkers });
    setAnalysisResult({ terrain: terrainText, urbex: urbexText });
    localStorage.setItem("ai_terrain_markers", JSON.stringify(terrainMarkers));
    localStorage.setItem("ai_terrain_result", terrainText);
    localStorage.setItem("ai_urbex_markers", JSON.stringify(urbexMarkers));
    localStorage.setItem("ai_urbex_result", urbexText);
    setAnalysisLoading(false);
  };

  const handleMarkerClick = (marker, idx, analysisType) => {
    if (marker.type === "route" && marker.coords?.length > 0) {
      if (activeRouteIdx === idx) {
        setActiveRouteIdx(null);
        if (onShowRoute) onShowRoute(null);
      } else {
        setActiveRouteIdx(idx);
        if (onShowRoute) onShowRoute(marker.coords);
        if (onFlyTo && marker.coords[0]) {
          onFlyTo({ lat: marker.coords[0][0], lng: marker.coords[0][1], zoom: 14 });
        }
      }
    } else if (marker.lat && marker.lng) {
      const key = `${analysisType}-${marker.lat}-${marker.lng}`;
      setVisibleMarkers(prev => {
        const next = { ...prev, [key]: !prev[key] };
        if (next[key]) {
          if (onAddMarkers) onAddMarkers([{ lat: marker.lat, lng: marker.lng, label: marker.label }], true);
          if (onFlyTo) onFlyTo({ lat: marker.lat, lng: marker.lng, zoom: 16 });
        } else {
          if (onRemoveAiMarkers) onRemoveAiMarkers();
        }
        return next;
      });
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setAnalysisMarkers({ terrain: [], urbex: [] });
    setVisibleMarkers({});
    setActiveRouteIdx(null);
    localStorage.removeItem("ai_terrain_result");
    localStorage.removeItem("ai_terrain_markers");
    localStorage.removeItem("ai_urbex_result");
    localStorage.removeItem("ai_urbex_markers");
    setFrozenCoords(null);
    if (onShowRoute) onShowRoute(null);
    if (onRemoveAiMarkers) onRemoveAiMarkers();
  };

  const restoreLocation = () => {
    if (savedLocation) {
      setFrozenCoords([savedLocation.lat, savedLocation.lng]);
      const areaOpt = AREA_OPTIONS.find(a => a.label === savedLocation.area);
      if (areaOpt) setSelectedArea(areaOpt);
    }
  };

  useEffect(() => {
    if (savedLocation && !hasResults && !isLoading) {
      restoreLocation();
    }
  }, []);

  const isLoading = analysisLoading;
  const hasResults = !!(analysisResult && (analysisResult.terrain || analysisResult.urbex));

  const typeColor = { structure: "text-orange-400", poi: "text-emerald-400", route: "text-blue-400", landmark: "text-amber-400" };
  const typeIcon = { structure: "🏗️", poi: "📍", route: "🛤️", landmark: "🗺️" };
  const typeBg = { structure: "rgba(251,146,60,0.12)", poi: "rgba(16,185,129,0.12)", route: "rgba(59,130,246,0.12)", landmark: "rgba(245,158,11,0.12)" };
  const groups = [
    { key: "structure", label: "Umetne strukture" },
    { key: "landmark", label: "Terenske značilnosti" },
    { key: "poi", label: "Točke interesa" },
    { key: "route", label: "Predlagane poti" },
  ];

  return (
    <div className="space-y-3">
      {/* Main content */}
      {!hasResults && !isLoading && (
        <div className="text-center py-2 space-y-3">
          <p className="text-sm font-semibold" style={{ color: theme.panelText }}>
            AI analiza in iskanje
          </p>

          {/* Location section */}
          <div className="rounded-xl p-3 text-left" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}20` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2" style={{ color: theme.panelText }}>Lokacija analize</p>
            {pinnedLocation ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-400">Označena točka</p>
                  {pinnedPlaceName && (
                    <p className="text-[11px] font-medium mb-0.5" style={{ color: theme.panelText }}>{pinnedPlaceName}</p>
                  )}
                  <p className="text-[10px] font-mono opacity-60" style={{ color: theme.panelText }}>
                    {pinnedLocation[0].toFixed(5)}, {pinnedLocation[1].toFixed(5)}
                  </p>
                </div>
                <button
                  onClick={() => onRequestPin(null)}
                  className="text-[10px] opacity-50 hover:opacity-80 transition-opacity"
                  style={{ color: theme.panelText }}
                >Počisti</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 opacity-50 shrink-0" style={{ color: theme.panelText }} />
                  <div className="flex-1">
                    <p className="text-xs opacity-70" style={{ color: theme.panelText }}>Središče karte</p>
                    <p className="text-[10px] font-mono opacity-50" style={{ color: theme.panelText }}>
                      {mapCenter?.[0]?.toFixed(5)}, {mapCenter?.[1]?.toFixed(5)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRequestPin && onRequestPin("pick")}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ backgroundColor: `${theme.accentColor || "#10b981"}20`, color: theme.accentColor || "#10b981", border: `1px solid ${theme.accentColor || "#10b981"}40` }}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Označi točko na karti
                </button>
              </div>
            )}
          </div>

          {/* Area size selector */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 text-left" style={{ color: theme.panelText }}>Območje analize</p>
            <div className="grid grid-cols-4 gap-1">
              {AREA_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setSelectedArea(opt)}
                  className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={selectedArea.label === opt.label
                    ? { backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText }
                    : { backgroundColor: `${theme.panelText}12`, color: theme.panelText, opacity: 0.6 }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] opacity-70" style={{ color: theme.panelText }}>AI bo analizirala teren in iskala neznane objekte hkrati.</p>

          <button onClick={analyze}
            className="w-full py-2.5 font-semibold rounded-xl text-white transition shadow"
            style={{ background: "linear-gradient(to right, #f59e0b, #10b981)" }}
          >
            🔍 Analiziraj območje
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
          <p className="text-sm opacity-60" style={{ color: theme.panelText }}>
            AI analizira teren in iskanje objektov...
          </p>
          <p className="text-xs opacity-40 font-mono" style={{ color: theme.panelText }}>
            {displayLat?.toFixed(4)}, {displayLng?.toFixed(4)} · {selectedArea.label}
          </p>
        </div>
      )}

      {hasResults && !isLoading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="rounded-xl px-3 py-2 flex-1" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}18` }}>
              <div className="flex items-center gap-2 text-[10px] opacity-60" style={{ color: theme.panelText }}>
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="font-mono">{displayLat?.toFixed(5)}, {displayLng?.toFixed(5)}</span>
                <span className="opacity-60">· {selectedArea.label}</span>
              </div>
            </div>
            <button onClick={handleReset}
              className="px-3 py-2 text-[10px] font-medium rounded-xl transition opacity-60 hover:opacity-100"
              style={{ border: `1px solid ${theme.panelText}33`, color: theme.panelText }}>
              Počisti
            </button>
          </div>

          {/* Terrain results */}
          {analysisResult?.terrain && (
            <div className="space-y-2 pb-3 border-b" style={{ borderColor: `${theme.panelText}18` }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">🛰️ Analiza terena</p>
              {analysisMarkers.terrain.length > 0 && groups.map(group => {
                const items = analysisMarkers.terrain.map((m, i) => ({ ...m, _idx: i })).filter(m => m.type === group.key);
                if (items.length === 0) return null;
                return (
                  <div key={group.key}>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1" style={{ color: theme.panelText }}>
                      {typeIcon[group.key]} {group.label}
                    </p>
                    <div className="space-y-1">
                      {items.map((m) => {
                        const key = `terrain-${m.lat}-${m.lng}`;
                        const isVisible = visibleMarkers[key];
                        return (
                          <motion.button
                            key={m._idx}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleMarkerClick(m, m._idx, "terrain")}
                            className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              border: `1px solid ${isVisible ? `${theme.buttonActiveBg}80` : theme.panelText + "18"}`,
                              backgroundColor: isVisible ? `${theme.buttonActiveBg}15` : typeBg[m.type] || "transparent",
                            }}
                          >
                            <span className="text-sm leading-none mt-0.5 shrink-0">{typeIcon[m.type] || "📍"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: theme.panelText }}>{m.label}</p>
                              {m.description && (
                                <p className="text-[10px] opacity-60 leading-snug mt-0.5" style={{ color: theme.panelText }}>{m.description}</p>
                              )}
                              {m.type === "route" && m.coords?.length > 0 ? (
                                <p className={`text-[10px] mt-0.5 font-medium ${isVisible ? "text-blue-400" : typeColor[m.type]}`}>
                                  {isVisible ? "✓ Prikazano" : `🛤️ ${m.coords.length} točk`}
                                </p>
                              ) : m.lat && m.lng ? (
                                <p className={`text-[10px] mt-0.5 ${typeColor[m.type] || "text-slate-400"}`}>
                                  {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                                </p>
                              ) : null}
                            </div>
                            <span className="text-sm shrink-0 mt-0.5" style={{ color: isVisible ? theme.buttonActiveBg : theme.panelText + "80" }}>
                              {isVisible ? "✓" : "○"}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="prose prose-xs max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-sm font-bold mt-3 mb-1" style={{ color: theme.panelText }}>{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xs font-bold mt-2.5 mb-1" style={{ color: theme.panelText }}>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-0.5" style={{ color: theme.panelText }}>{children}</h3>,
                    p: ({ children }) => <p className="text-xs mb-1.5 leading-relaxed opacity-80" style={{ color: theme.panelText }}>{children}</p>,
                    ul: ({ children }) => <ul className="text-xs ml-3 space-y-0.5 mb-1.5 opacity-80" style={{ color: theme.panelText }}>{children}</ul>,
                    li: ({ children }) => <li className="list-disc">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold opacity-100" style={{ color: theme.panelText }}>{children}</strong>,
                  }}
                >
                  {analysisResult.terrain}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Urbex results */}
          {analysisResult?.urbex && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-red-400">🔍 Iskanje objektov</p>
              {analysisMarkers.urbex.length > 0 && analysisMarkers.urbex.map((m, i) => {
                const key = `urbex-${m.lat}-${m.lng}`;
                const isVisible = visibleMarkers[key];
                return (
                  <motion.button
                    key={i}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleMarkerClick(m, i, "urbex")}
                    className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                    style={{
                      border: `1px solid ${isVisible ? "rgba(239,68,68,0.5)" : theme.panelText + "18"}`,
                      backgroundColor: isVisible ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)",
                    }}
                  >
                    <span className="text-sm leading-none mt-0.5 shrink-0">🏚️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: theme.panelText }}>{m.label}</p>
                      {m.description && (
                        <p className="text-[10px] opacity-60 leading-snug mt-0.5" style={{ color: theme.panelText }}>{m.description}</p>
                      )}
                      <p className="text-[10px] mt-0.5 text-red-400">{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</p>
                    </div>
                    <span className="text-sm shrink-0 mt-0.5" style={{ color: isVisible ? "#ef4444" : theme.panelText + "80" }}>
                      {isVisible ? "✓" : "○"}
                    </span>
                  </motion.button>
                );
              })}
              <div className="prose prose-xs max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-sm font-bold mt-3 mb-1" style={{ color: theme.panelText }}>{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xs font-bold mt-2.5 mb-1" style={{ color: theme.panelText }}>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-0.5" style={{ color: theme.panelText }}>{children}</h3>,
                    p: ({ children }) => <p className="text-xs mb-1.5 leading-relaxed opacity-80" style={{ color: theme.panelText }}>{children}</p>,
                    ul: ({ children }) => <ul className="text-xs ml-3 space-y-0.5 mb-1.5 opacity-80" style={{ color: theme.panelText }}>{children}</ul>,
                    li: ({ children }) => <li className="list-disc">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold opacity-100" style={{ color: theme.panelText }}>{children}</strong>,
                  }}
                >
                  {analysisResult.urbex}
                </ReactMarkdown>
              </div>
            </div>
          )}

          <button onClick={handleReset}
            className="w-full py-2 text-xs font-medium rounded-xl transition opacity-50 hover:opacity-80"
            style={{ border: `1px solid ${theme.panelText}33`, color: theme.panelText }}>
            Počisti
          </button>
        </div>
      )}
    </div>
  );
}