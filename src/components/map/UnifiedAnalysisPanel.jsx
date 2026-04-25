import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, MapPin, Star, X, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { OVERLAY_CATEGORIES } from "./layerConfig";
import ReactMarkdown from "react-markdown";

const AREA_OPTIONS = [
  { label: "1×1 km", km: 1, latDelta: 0.0045, lngDelta: 0.0072 },
  { label: "3×3 km", km: 3, latDelta: 0.0135, lngDelta: 0.0215 },
  { label: "4×4 km", km: 4, latDelta: 0.019,  lngDelta: 0.030  },
  { label: "5×5 km", km: 5, latDelta: 0.0225, lngDelta: 0.036  },
];

const TERRAIN_SYSTEM = `Si strokovni GIS analitik za Slovenijo. VEDNO odgovarjaj v SLOVENŠČINI.
Analiziraj območje okoli podanih koordinat.

KRITIČNO — KOORDINATE: Vse lat/lng koordinate v JSON bloku MORAJO biti znotraj podanega bounding boxa (minLat, maxLat, minLng, maxLng). Koordinate izven tega območja so NAPAKA. Vsak objekt mora biti pozicioniran na svoji dejanski geografski lokaciji znotraj območja — ne izmišljaj si koordinat, uporabi resnično poznavanje terena.

Razdelki:
1) Umetne strukture — zgradbe, ceste, infrastruktura, mostovi, jezovi itd.
2) Terenske značilnosti — reliefne oblike, gozdovi, vode, vzpetine itd.
3) Točke interesa (POI) — razgledišča, koče, zanimivosti, kulturna dediščina itd.
4) Predlagane poti — konkretne ture s pribl. trasami (vsaka pot ima coords: niz koordinatnih parov, VSI znotraj bounding boxa)

Za vsako ugotovitev vključi klikajoč vnos v JSON blok:
- Navadni objekti/POI: {"lat":46.05,"lng":14.5,"label":"Ime","type":"structure|poi|landmark","description":"kratek opis"}
- Predlagane POTI: {"label":"Ime poti","type":"route","description":"opis","coords":[[lat,lng],[lat,lng],...]}

Na KONCU odgovora OBVEZNO:
<map_markers>[...seznam vseh objektov in poti...]</map_markers>

Vsak razdelek mora imeti vsaj 2-3 vnose v JSON. Koordinate morajo biti NATANČNE in znotraj bounding boxa.`;

const URBEX_SYSTEM = `Si strokovni GIS analitik za iskanje NEZNANIH OBJEKTOV in človeških posegov v naravo v Sloveniji. VEDNO odgovarjaj v SLOVENŠČINI.

Tvoja naloga: poišči vse SUMLJIVE, NEOZNAČENE ali OPUŠČENE strukture v podanem območju, ki NISO vidne na standardnih kartah (OpenStreetMap, topografska karta).

IŠČEŠ:
- Opuščene zgradbe, bunkerje, zaklonišča, vojaške objekte
- Stare tovarne, mlini, žage, kovačnice, ki niso na karti
- Neoznačene poti, gozdne ceste, gramoznice, kamnolomi
- Arheološki najdbe: gradišča, gomile, valovi, rimski tabori
- Industrijske ruševine, odlagališča, stare elektrarne, žičnice
- Agrarne anomalije: stare terase, suhe zložbe, jarki
- Hidro objekti: zapuščene jeze, kanali, mlinski jarki
- Vse kar kaže na ČLOVEŠKI POSEG ki ni evidentiran

ZA VSAK OBJEKT navedi:
1. Natančno lokacijo (lat/lng ZNOTRAJ bounding boxa)
2. Tip objekta in verjetnost da je neoznačen (visoka/srednja/nizka)
3. Priporočene sloje za preverjanje (satelit, LIDAR, ortofoto)
4. Kratka razlaga zakaj je sumljiv

KRITIČNO — KOORDINATE: Vse lat/lng koordinate MORAJO biti znotraj bounding boxa. Ne izmišljaj koordinat — postavi objekte na verjetne lokacije glede na resnično geografijo terena.

Za vsak objekt:
{"lat":46.05,"lng":14.5,"label":"Ime objekta","type":"structure|poi|landmark","description":"opis + zakaj sumljiv + verjetnost"}

Na KONCU OBVEZNO:
<map_markers>[...seznam vseh sumljivih objektov...]</map_markers>`;

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
    
    setFrozenCoords([analysisLat, analysisLng]);
    setAnalysisLoading(true);
    setAnalysisResult(null);
    setAnalysisMarkers({ terrain: [], urbex: [] });
    setActiveRouteIdx(null);
    setVisibleMarkers({});
    
    if (onRemoveAiMarkers) onRemoveAiMarkers();
    if (onShowRoute) onShowRoute(null);

    let placeName = "";
    try {
      const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${analysisLat}&lon=${analysisLng}&format=json&accept-language=sl`);
      const geoData = await geo.json();
      const a = geoData.address || {};
      placeName = [a.village || a.town || a.city || a.hamlet || "", a.municipality || a.county || ""].filter(Boolean).join(", ") || geoData.display_name?.split(",").slice(0,2).join(",") || "";
    } catch {}

    const { latDelta, lngDelta, km } = selectedArea;
    const minLat = (analysisLat - latDelta).toFixed(5);
    const maxLat = (analysisLat + latDelta).toFixed(5);
    const minLng = (analysisLng - lngDelta).toFixed(5);
    const maxLng = (analysisLng + lngDelta).toFixed(5);

    const runAnalysis = async (systemPrompt, analysisType) => {
      const fullPrompt = `${systemPrompt}

LOKACIJA: ${placeName ? `"${placeName}"` : "neznana"} | Koordinate: ${analysisLat.toFixed(5)}°N, ${analysisLng.toFixed(5)}°E
BOUNDING BOX — VSE koordinate v JSON MORAJO biti ZNOTRAJ:
  minLat=${minLat}, maxLat=${maxLat}, minLng=${minLng}, maxLng=${maxLng}
Območje analize: ${km}×${km} km`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: fullPrompt, add_context_from_internet: true, model: "gemini_3_flash"
      });
      const text = typeof res === "string" ? res : res?.content || JSON.stringify(res);

      const markerMatch = text.match(/<map_markers>(.*?)<\/map_markers>/s);
      let cleanText = text.replace(/<map_markers>.*?<\/map_markers>/s, "").trim();
      let parsedMarkers = [];
      if (markerMatch) {
        try {
          const raw = JSON.parse(markerMatch[1]);
          parsedMarkers = raw.filter(m => {
            if (m.type === "route") return true;
            if (!m.lat || !m.lng) return false;
            return m.lat >= parseFloat(minLat) && m.lat <= parseFloat(maxLat) &&
                   m.lng >= parseFloat(minLng) && m.lng <= parseFloat(maxLng);
          });
        } catch {}
      }

      return { markers: parsedMarkers, text: cleanText };
    };

    // Run both analyses
    const [terrainData, urbexData] = await Promise.all([
      runAnalysis(TERRAIN_SYSTEM, "terrain"),
      runAnalysis(URBEX_SYSTEM, "urbex")
    ]);

    setAnalysisMarkers({ terrain: terrainData.markers, urbex: urbexData.markers });
    setAnalysisResult({ terrain: terrainData.text, urbex: urbexData.text });
    
    localStorage.setItem("ai_terrain_markers", JSON.stringify(terrainData.markers));
    localStorage.setItem("ai_terrain_result", terrainData.text);
    localStorage.setItem("ai_urbex_markers", JSON.stringify(urbexData.markers));
    localStorage.setItem("ai_urbex_result", urbexData.text);
    
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

  const isLoading = analysisLoading;
  const hasResults = analysisResult && (analysisResult.terrain || analysisResult.urbex);

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
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}18` }}>
            <div className="flex items-center gap-2 text-[10px] opacity-60" style={{ color: theme.panelText }}>
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="font-mono">{displayLat?.toFixed(5)}, {displayLng?.toFixed(5)}</span>
              <span className="opacity-60">· {selectedArea.label}</span>
            </div>
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