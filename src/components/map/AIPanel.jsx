/**
 * AIPanel — unified AI hub with tabs: Ask the Map + Terrain AI
 * Premium-only (admins always have access).
 */
import React, { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Bot, User, MapPin, Star, Lock, Crosshair, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { OVERLAY_CATEGORIES, BASE_LAYERS } from "./layerConfig";
import { loadTheme } from "@/components/map/ThemeCustomizer";
import ReactMarkdown from "react-markdown";

// ─── Layer summary for Ask the Map ───────────────────────────────────────────
const LAYER_SUMMARY = [
  ...BASE_LAYERS.map(l => `Osnovna karta: ${l.name}`),
  ...OVERLAY_CATEGORIES.flatMap(cat =>
    cat.layers.map(l => `${cat.name} > ${l.name} [id:${l.id}]: ${l.description || ""}`)
  )
].join("\n");

const ASK_SYSTEM = `Si AI asistent za GIS Explorer Slovenije. VEDNO odgovarjaj v SLOVENŠČINI.
Razpoložljivi sloji:\n${LAYER_SUMMARY}
Pomagaj uporabnikom aktivirati sloje, odgovori na vprašanja o geografiji Slovenije, razloži podatke.
Ko priporočaš sloje, vključi: <activate_layers>["id1","id2"]</activate_layers>
Odgovori naj bodo kratki in praktični.`;

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
<map_markers>[...seznam vseh sumljivih objektov...]</map_markers>

Bodi sistematičen — išči po kategorijah in navedi vsaj 5-8 konkretnih lokacij.`;

// ─── Premium Lock screen ──────────────────────────────────────────────────────
function PremiumLock({ theme }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 py-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
        <Lock className="w-7 h-7 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-bold mb-1" style={{ color: theme.panelText }}>Premium funkcija</p>
        <p className="text-xs opacity-60" style={{ color: theme.panelText }}>
          AI orodja so na voljo samo za premium uporabnike. Nadgradite račun za dostop.
        </p>
      </div>
    </div>
  );
}

// ─── Ask the Map tab ──────────────────────────────────────────────────────────
function AskTab({ activeLayers, onToggleLayer, mapCenter, mapZoom, theme }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Pozdravljeni! Sem vaš GIS asistent za Slovenijo. Vprašajte me o slojih, geografiji ali podatkih. Primer: *\"Pokaži poplavna območja\"*"
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const activeLayerNames = Object.keys(activeLayers).map(id => {
    for (const cat of OVERLAY_CATEGORIES) {
      const l = cat.layers.find(l => l.id === id);
      if (l) return l.name;
    }
    return BASE_LAYERS.find(l => l.id === id)?.name || id;
  });

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    const context = `Karta: središče=[${mapCenter?.[0]?.toFixed(4)}, ${mapCenter?.[1]?.toFixed(4)}], zoom=${mapZoom}, aktivni sloji: ${activeLayerNames.join(", ") || "ni aktivnih"}.`;
    const history = messages.map(m => `${m.role === "user" ? "Uporabnik" : "Asistent"}: ${m.content}`).join("\n");
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `${ASK_SYSTEM}\n\n${context}\n\nZgodovina:\n${history}\n\nUporabnik: ${userMsg}\nAsistent:`,
      add_context_from_internet: true, model: "gemini_3_flash"
    });
    const text = typeof res === "string" ? res : res?.content || JSON.stringify(res);
    const match = text.match(/<activate_layers>(.*?)<\/activate_layers>/s);
    let cleanText = text.replace(/<activate_layers>.*?<\/activate_layers>/s, "").trim();
    let activated = [];
    if (match) {
      try {
        const ids = JSON.parse(match[1]);
        ids.forEach(id => {
          if (!activeLayers[id]) { onToggleLayer(id); }
          const all = OVERLAY_CATEGORIES.flatMap(c => c.layers).concat(BASE_LAYERS);
          const found = all.find(l => l.id === id);
          if (found) activated.push(found.name);
        });
      } catch {}
    }
    if (activated.length > 0) cleanText += `\n\n✅ Aktivirano: ${activated.join(", ")}`;
    setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);
    setLoading(false);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
            <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed"
              style={msg.role === "user"
                ? { backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText }
                : { backgroundColor: theme.menuBg + "33", color: theme.panelText, border: `1px solid ${theme.panelText}22` }
              }>
              {msg.content.split(/\*([^*]+)\*/).map((part, j) =>
                j % 2 === 1
                  ? <em key={j} className="not-italic font-semibold text-emerald-400">{part}</em>
                  : part
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: theme.menuBg + "33" }}>
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-3 border-t shrink-0" style={{ borderColor: `${theme.panelText}22`, backgroundColor: theme.panelBg }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Vprašajte o slojih, krajih, podatkih..."
          className="flex-1 text-xs rounded-xl px-3 py-2 outline-none"
          style={{ backgroundColor: theme.menuBg + "44", color: theme.panelText, border: `1px solid ${theme.panelText}33` }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-emerald-500 text-white disabled:opacity-40 hover:bg-emerald-400 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

// ─── Terrain AI tab ───────────────────────────────────────────────────────────
const AREA_OPTIONS = [
  { label: "1×1 km", km: 1, latDelta: 0.0045, lngDelta: 0.0072 },
  { label: "3×3 km", km: 3, latDelta: 0.0135, lngDelta: 0.0215 },
  { label: "4×4 km", km: 4, latDelta: 0.019,  lngDelta: 0.030  },
  { label: "5×5 km", km: 5, latDelta: 0.0225, lngDelta: 0.036  },
];

function TerrainTab({ mapCenter, mapZoom, activeLayers, onAddMarkers, onRemoveAiMarkers, onFlyTo, onShowRoute, theme, onRequestPin, pinnedLocation }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [activeRouteIdx, setActiveRouteIdx] = useState(null);
  const [selectedArea, setSelectedArea] = useState(AREA_OPTIONS[2]); // default 4×4
  const [frozenCoords, setFrozenCoords] = useState(null);
  const [pinnedPlaceName, setPinnedPlaceName] = useState(null);

  // Reverse geocode when pinnedLocation changes
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
    setLoading(true);
    setResult(null);
    setMarkers([]);
    setActiveRouteIdx(null);
    if (onRemoveAiMarkers) onRemoveAiMarkers();
    if (onShowRoute) onShowRoute(null);

    // Reverse geocode first to get real place name
    let placeName = "";
    try {
      const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${analysisLat}&lon=${analysisLng}&format=json&accept-language=sl`);
      const geoData = await geo.json();
      const a = geoData.address || {};
      const village = a.village || a.town || a.city || a.hamlet || "";
      const municipality = a.municipality || a.county || "";
      placeName = [village, municipality].filter(Boolean).join(", ") || geoData.display_name?.split(",").slice(0,2).join(",") || "";
    } catch {}

    const activeNames = Object.keys(activeLayers).map(id => {
      for (const cat of OVERLAY_CATEGORIES) {
        const l = cat.layers.find(l => l.id === id);
        if (l) return l.name;
      }
      return id;
    });
    const { latDelta, lngDelta, km } = selectedArea;
    const minLat = (analysisLat - latDelta).toFixed(5);
    const maxLat = (analysisLat + latDelta).toFixed(5);
    const minLng = (analysisLng - lngDelta).toFixed(5);
    const maxLng = (analysisLng + lngDelta).toFixed(5);

    const prompt = `${TERRAIN_SYSTEM}

LOKACIJA: ${placeName ? `"${placeName}"` : "neznana"} | Koordinate: ${analysisLat.toFixed(5)}°N, ${analysisLng.toFixed(5)}°E
BOUNDING BOX — VSE koordinate v JSON MORAJO biti ZNOTRAJ tega območja (ne zunaj!):
  minLat=${minLat}, maxLat=${maxLat}, minLng=${minLng}, maxLng=${maxLng}
Območje analize: ${km}×${km} km | Aktivni sloji: ${activeNames.join(", ") || "ni aktivnih"}

ANALIZIRAJ TOČNO TO LOKACIJO: ${placeName || `${analysisLat.toFixed(4)}°N ${analysisLng.toFixed(4)}°E`}. Ne analiziraj drugega kraja. Vse koordinate v JSON MORAJO biti med zgornjimi mejami.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt, add_context_from_internet: true, model: "gemini_3_flash"
    });
    const text = typeof res === "string" ? res : res?.content || JSON.stringify(res);

    const markerMatch = text.match(/<map_markers>(.*?)<\/map_markers>/s);
    let cleanText = text.replace(/<map_markers>.*?<\/map_markers>/s, "").trim();
    let parsedMarkers = [];
    if (markerMatch) {
      try {
        const raw = JSON.parse(markerMatch[1]);
        // Filter out markers outside bounding box
        parsedMarkers = raw.filter(m => {
          if (m.type === "route") return true; // keep routes
          if (!m.lat || !m.lng) return false;
          return m.lat >= parseFloat(minLat) && m.lat <= parseFloat(maxLat) &&
                 m.lng >= parseFloat(minLng) && m.lng <= parseFloat(maxLng);
        });
      } catch {}
    }
    setMarkers(parsedMarkers);
    setResult(cleanText);
    setLoading(false);
  };

  const handleItemClick = (marker, idx) => {
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
      if (onAddMarkers) onAddMarkers([{ lat: marker.lat, lng: marker.lng, label: marker.label }], true /* isAi */);
      if (onFlyTo) onFlyTo({ lat: marker.lat, lng: marker.lng, zoom: 16 });
    }
  };

  const handleReset = () => {
    setResult(null);
    setMarkers([]);
    setActiveRouteIdx(null);
    setFrozenCoords(null);
    if (onShowRoute) onShowRoute(null);
    if (onRemoveAiMarkers) onRemoveAiMarkers();
  };

  const typeColor = { structure: "text-orange-400", poi: "text-emerald-400", route: "text-blue-400", landmark: "text-amber-400" };
  const typeIcon = { structure: "🏗️", poi: "📍", route: "🛤️", landmark: "🗺️" };
  const typeBg = { structure: "rgba(251,146,60,0.12)", poi: "rgba(16,185,129,0.12)", route: "rgba(59,130,246,0.12)", landmark: "rgba(245,158,11,0.12)" };

  // Group markers by type for display
  const groups = [
    { key: "structure", label: "Umetne strukture" },
    { key: "landmark", label: "Terenske značilnosti" },
    { key: "poi", label: "Točke interesa" },
    { key: "route", label: "Predlagane poti" },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
      {!result && !loading && (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: theme.panelText }}>AI analiza terena</p>
          <p className="text-xs opacity-50 mb-4" style={{ color: theme.panelText }}>
            Zazna objekte, primerja sloje, predlaga poti in točke interesa v območju 4,2 × 4,2 km.
          </p>

          {/* Pinpoint section */}
          <div className="mb-4 rounded-xl p-3 text-left" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}20` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2" style={{ color: theme.panelText }}>Lokacija analize</p>
            {pinnedLocation ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
          <div className="mb-3">
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

          <button onClick={analyze}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow">
            Analiziraj lokacijo
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
          <p className="text-sm opacity-60" style={{ color: theme.panelText }}>AI analizira teren...</p>
          <p className="text-xs opacity-40 font-mono" style={{ color: theme.panelText }}>
            {displayLat?.toFixed(4)}, {displayLng?.toFixed(4)} · {selectedArea.label}
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {/* Analyzed coords */}
          <div className="rounded-xl px-3 py-2 mb-1" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}18` }}>
            {pinnedLocation && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-emerald-400">📍 Označena točka</span>
                <button
                  onClick={() => onRequestPin && onRequestPin(null)}
                  className="text-[10px] opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
                  style={{ color: theme.panelText }}
                >
                  <X className="w-3 h-3" /> Odstrani
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] opacity-60" style={{ color: theme.panelText }}>
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="font-mono">{displayLat?.toFixed(5)}, {displayLng?.toFixed(5)}</span>
              <span className="opacity-60">· 4,2km²</span>
            </div>
          </div>

          {/* Grouped clickable markers */}
          {markers.length > 0 && groups.map(group => {
            const items = markers.map((m, i) => ({ ...m, _idx: i })).filter(m => m.type === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1.5 flex items-center gap-1.5" style={{ color: theme.panelText }}>
                  <span>{typeIcon[group.key]}</span> {group.label}
                </p>
                <div className="space-y-1">
                  {items.map((m) => {
                    const isActiveRoute = m.type === "route" && activeRouteIdx === m._idx;
                    return (
                      <motion.button
                        key={m._idx}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleItemClick(m, m._idx)}
                        className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                        style={{
                          border: `1px solid ${isActiveRoute ? "rgba(59,130,246,0.5)" : theme.panelText + "18"}`,
                          backgroundColor: isActiveRoute ? "rgba(59,130,246,0.15)" : typeBg[m.type] || "transparent",
                        }}
                      >
                        <span className="text-sm leading-none mt-0.5 shrink-0">{typeIcon[m.type] || "📍"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: theme.panelText }}>{m.label}</p>
                          {m.description && (
                            <p className="text-[10px] opacity-60 leading-snug mt-0.5" style={{ color: theme.panelText }}>{m.description}</p>
                          )}
                          {m.type === "route" && m.coords?.length > 0 ? (
                            <p className={`text-[10px] mt-0.5 font-medium ${isActiveRoute ? "text-blue-400" : typeColor[m.type]}`}>
                              {isActiveRoute ? "✓ Prikazano na karti" : `🛤️ ${m.coords.length} točk — klikni za prikaz`}
                            </p>
                          ) : m.lat && m.lng ? (
                            <p className={`text-[10px] mt-0.5 ${typeColor[m.type] || "text-slate-400"}`}>
                              {m.lat.toFixed(4)}, {m.lng.toFixed(4)} · klikni za oznako
                            </p>
                          ) : null}
                        </div>
                        {m.type === "route"
                          ? <span className="text-blue-400 text-[10px] shrink-0 mt-0.5">{isActiveRoute ? "✓" : "→"}</span>
                          : <MapPin className="w-3 h-3 shrink-0 opacity-30 mt-0.5" style={{ color: theme.panelText }} />
                        }
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Analysis text */}
          <div className="text-[11px] flex items-center gap-1 opacity-50 mt-2 mb-1" style={{ color: theme.panelText }}>
            <Star className="w-3 h-3 text-amber-400 opacity-100" /> Celotna analiza
          </div>
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
              {result}
            </ReactMarkdown>
          </div>

          <button onClick={handleReset}
            className="w-full py-2 text-xs font-medium rounded-xl transition mt-2 opacity-50 hover:opacity-80"
            style={{ border: `1px solid ${theme.panelText}33`, color: theme.panelText }}>
            Nova analiza (počisti točke)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Urbex / Object Finder tab ────────────────────────────────────────────────
function UrbexTab({ mapCenter, mapZoom, activeLayers, onToggleLayer, onAddMarkers, onRemoveAiMarkers, onFlyTo, onShowRoute, theme, onRequestPin, pinnedLocation }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [frozenCoords, setFrozenCoords] = useState(null);
  const [selectedArea, setSelectedArea] = useState(AREA_OPTIONS[2]);
  const [pinnedPlaceName, setPinnedPlaceName] = useState(null);

  // Layer quick-picks for urbex
  const URBEX_LAYER_COMBOS = [
    { label: "Satelit + LIDAR", ids: ["satellite", "lidar_overlay"], desc: "Osnova za iskanje" },
    { label: "Satelit + OSM", ids: ["satellite", "osm_buildings"], desc: "Neoznačene zgradbe" },
    { label: "HOT + LIDAR", ids: ["humanitarian", "lidar_overlay"], desc: "Vse umetne strukture" },
    { label: "Toner B/W", ids: ["stamen_toner"], desc: "Visok kontrast" },
  ];

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
    setLoading(true);
    setResult(null);
    setMarkers([]);
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

    const prompt = `${URBEX_SYSTEM}

LOKACIJA: ${placeName ? `"${placeName}"` : "neznana"} | Koordinate: ${analysisLat.toFixed(5)}°N, ${analysisLng.toFixed(5)}°E
BOUNDING BOX — VSE koordinate v JSON MORAJO biti ZNOTRAJ:
  minLat=${minLat}, maxLat=${maxLat}, minLng=${minLng}, maxLng=${maxLng}
Območje analize: ${km}×${km} km`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt, add_context_from_internet: true, model: "gemini_3_flash"
    });
    const text = typeof res === "string" ? res : res?.content || JSON.stringify(res);

    const markerMatch = text.match(/<map_markers>(.*?)<\/map_markers>/s);
    let cleanText = text.replace(/<map_markers>.*?<\/map_markers>/s, "").trim();
    let parsedMarkers = [];
    if (markerMatch) {
      try {
        const raw = JSON.parse(markerMatch[1]);
        parsedMarkers = raw.filter(m => {
          if (!m.lat || !m.lng) return false;
          return m.lat >= parseFloat(minLat) && m.lat <= parseFloat(maxLat) &&
                 m.lng >= parseFloat(minLng) && m.lng <= parseFloat(maxLng);
        });
      } catch {}
    }
    setMarkers(parsedMarkers);
    setResult(cleanText);
    setLoading(false);
  };

  const handleReset = () => {
    setResult(null);
    setMarkers([]);
    setFrozenCoords(null);
    if (onRemoveAiMarkers) onRemoveAiMarkers();
    if (onShowRoute) onShowRoute(null);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
      {!result && !loading && (
        <div className="py-2">
          <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-sm font-semibold mb-1 text-center" style={{ color: theme.panelText }}>Iskanje neznanih objektov</p>
          <p className="text-xs opacity-50 mb-4 text-center" style={{ color: theme.panelText }}>
            AI poišče opuščene zgradbe, bunkerje, gradišča, neoznačene posege v naravo in skrite strukture.
          </p>

          {/* Quick layer combos */}
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2" style={{ color: theme.panelText }}>Priporočeni sloji za iskanje</p>
            <div className="grid grid-cols-2 gap-1.5">
              {URBEX_LAYER_COMBOS.map(combo => (
                <button
                  key={combo.label}
                  onClick={() => combo.ids.forEach(id => { if (!activeLayers[id]) onToggleLayer && onToggleLayer(id); })}
                  className="px-2 py-2 rounded-xl text-left transition-all"
                  style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}20` }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: theme.panelText }}>{combo.label}</p>
                  <p className="text-[10px] opacity-50" style={{ color: theme.panelText }}>{combo.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pin location */}
          <div className="mb-3 rounded-xl p-3" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}20` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2" style={{ color: theme.panelText }}>Lokacija iskanja</p>
            {pinnedLocation ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  {pinnedPlaceName && <p className="text-[11px] font-medium" style={{ color: theme.panelText }}>{pinnedPlaceName}</p>}
                  <p className="text-[10px] font-mono opacity-60" style={{ color: theme.panelText }}>{pinnedLocation[0].toFixed(5)}, {pinnedLocation[1].toFixed(5)}</p>
                </div>
                <button onClick={() => onRequestPin(null)} className="text-[10px] opacity-50 hover:opacity-80" style={{ color: theme.panelText }}>Počisti</button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] opacity-60" style={{ color: theme.panelText }}>Središče: {mapCenter?.[0]?.toFixed(5)}, {mapCenter?.[1]?.toFixed(5)}</p>
                <button
                  onClick={() => onRequestPin && onRequestPin("pick")}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ backgroundColor: `#ef444420`, color: "#ef4444", border: `1px solid #ef444440` }}
                >
                  <Crosshair className="w-3.5 h-3.5" /> Označi točko iskanja
                </button>
              </div>
            )}
          </div>

          {/* Area selector */}
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2" style={{ color: theme.panelText }}>Območje iskanja</p>
            <div className="grid grid-cols-4 gap-1">
              {AREA_OPTIONS.map(opt => (
                <button key={opt.label} onClick={() => setSelectedArea(opt)}
                  className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={selectedArea.label === opt.label
                    ? { backgroundColor: "#ef4444", color: "#ffffff" }
                    : { backgroundColor: `${theme.panelText}12`, color: theme.panelText, opacity: 0.6 }
                  }
                >{opt.label}</button>
              ))}
            </div>
          </div>

          <button onClick={analyze}
            className="w-full py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow">
            🔍 Iskanje neznanih objektov
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-7 h-7 text-red-400 animate-spin" />
          <p className="text-sm opacity-60" style={{ color: theme.panelText }}>AI išče neznane objekte...</p>
          <p className="text-xs opacity-40 font-mono" style={{ color: theme.panelText }}>{displayLat?.toFixed(4)}, {displayLng?.toFixed(4)} · {selectedArea.label}</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}18` }}>
            <div className="flex items-center gap-2 text-[10px] opacity-60" style={{ color: theme.panelText }}>
              <span>🔍</span>
              <span className="font-mono">{displayLat?.toFixed(5)}, {displayLng?.toFixed(5)}</span>
              <span>· {selectedArea.label}</span>
            </div>
          </div>

          {/* Markers */}
          {markers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1.5" style={{ color: theme.panelText }}>
                🏚️ Najdeni objekti ({markers.length})
              </p>
              <div className="space-y-1">
                {markers.map((m, i) => (
                  <motion.button key={i} whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (onAddMarkers) onAddMarkers([{ lat: m.lat, lng: m.lng, label: m.label }], true);
                      if (onFlyTo) onFlyTo({ lat: m.lat, lng: m.lng, zoom: 16 });
                    }}
                    className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                    style={{ border: `1px solid rgba(239,68,68,0.25)`, backgroundColor: "rgba(239,68,68,0.08)" }}
                  >
                    <span className="text-sm mt-0.5 shrink-0">🏚️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: theme.panelText }}>{m.label}</p>
                      {m.description && <p className="text-[10px] opacity-60 leading-snug mt-0.5" style={{ color: theme.panelText }}>{m.description}</p>}
                      <p className="text-[10px] mt-0.5 text-red-400">{m.lat.toFixed(4)}, {m.lng.toFixed(4)} · klikni za prikaz</p>
                    </div>
                    <MapPin className="w-3 h-3 shrink-0 opacity-40 mt-0.5 text-red-400" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Analysis text */}
          <div className="text-[11px] flex items-center gap-1 opacity-50 mt-2 mb-1" style={{ color: theme.panelText }}>
            <span>📋</span> Analiza
          </div>
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
              {result}
            </ReactMarkdown>
          </div>

          <button onClick={handleReset}
            className="w-full py-2 text-xs font-medium rounded-xl transition mt-2 opacity-50 hover:opacity-80"
            style={{ border: `1px solid ${theme.panelText}33`, color: theme.panelText }}>
            Novo iskanje
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main AIPanel ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "ask", label: "Vprašaj karto", emoji: "💬" },
  { id: "terrain", label: "Teren AI", emoji: "🛰️" },
  { id: "urbex", label: "Iskanje", emoji: "🔍" },
];

export default function AIPanel({
  onClose,
  activeLayers,
  onToggleLayer,
  mapCenter,
  mapZoom,
  isPremium,
  onAddMarkers,
  onRemoveAiMarkers,
  onFlyTo,
  onShowRoute,
  onRequestPin,
  pinnedLocation,
}) {
  const theme = loadTheme();
  const [tab, setTab] = useState("ask");
  

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
      style={{ width: 380, height: 540, backgroundColor: theme.panelBg, color: theme.panelText, borderColor: `${theme.panelText}22` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${theme.panelText}18` }}>
        <img src="https://media.base44.com/images/public/69ad3ce309822f8e71f66838/7aa56bc1c_EZU3mXIlM90xjxOrcrhU--0--SNgLs.jpg" alt="Franc" className="w-7 h-7 rounded-lg object-cover" />
        <span className="text-sm font-semibold flex-1" style={{ color: theme.panelText }}>Franc</span>
        {isPremium && (
          <span className="text-[9px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded-full">PREMIUM</span>
        )}
        <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: theme.panelText }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 px-3 pt-2.5 pb-0 gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={tab === t.id
              ? { backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText }
              : { backgroundColor: `${theme.panelText}10`, color: theme.panelText, opacity: 0.6 }
            }
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {!isPremium ? (
        <PremiumLock theme={theme} />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "ask" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1 min-h-0 pt-2"
          >
            {tab === "ask" && (
              <AskTab
                activeLayers={activeLayers}
                onToggleLayer={onToggleLayer}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                theme={theme}
              />
            )}
            {tab === "terrain" && (
              <TerrainTab
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                activeLayers={activeLayers}
                onAddMarkers={onAddMarkers}
                onRemoveAiMarkers={onRemoveAiMarkers}
                onFlyTo={onFlyTo}
                onShowRoute={onShowRoute}
                theme={theme}
                onRequestPin={onRequestPin}
                pinnedLocation={pinnedLocation}
              />
            )}
            {tab === "urbex" && (
              <UrbexTab
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                activeLayers={activeLayers}
                onToggleLayer={onToggleLayer}
                onAddMarkers={onAddMarkers}
                onRemoveAiMarkers={onRemoveAiMarkers}
                onFlyTo={onFlyTo}
                onShowRoute={onShowRoute}
                theme={theme}
                onRequestPin={onRequestPin}
                pinnedLocation={pinnedLocation}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}