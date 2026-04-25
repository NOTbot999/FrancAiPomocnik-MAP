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
Analiziraj podane koordinate. Za vsako pomembno ugotovitev (objekt, znamenitost, POI, pot):
Na KONCU odgovora vključi JSON blok s klikabilnimi markerji:
<map_markers>[{"lat":46.05,"lng":14.5,"label":"Oznaka","type":"structure|poi|route|landmark","layer":"layer_id_ali_null"}]</map_markers>
Razdelki: 1) Umetne strukture, 2) Terenske značilnosti, 3) Točke interesa (s koordinatami), 4) Predlagane poti (z začetnimi koordinatami).
Bodi natančen in uporabljaj resnična slovenska krajevna imena.`;

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
function TerrainTab({ mapCenter, mapZoom, activeLayers, onAddMarkers, theme, onRequestPin, pinnedLocation }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [markers, setMarkers] = useState([]);

  // The location to analyze: pinned point if set, otherwise map center
  const analysisLat = pinnedLocation ? pinnedLocation[0] : mapCenter?.[0];
  const analysisLng = pinnedLocation ? pinnedLocation[1] : mapCenter?.[1];

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    setMarkers([]);
    const activeNames = Object.keys(activeLayers).map(id => {
      for (const cat of OVERLAY_CATEGORIES) {
        const l = cat.layers.find(l => l.id === id);
        if (l) return l.name;
      }
      return id;
    });
    const prompt = `${TERRAIN_SYSTEM}

Koordinate: ${analysisLat.toFixed(5)}, ${analysisLng.toFixed(5)} | Zoom: ${mapZoom} | Aktivni sloji: ${activeNames.join(", ") || "ni aktivnih"}

Natančno analiziraj to slovensko lokacijo. Uporabi internetni kontekst za resnične podatke.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt, add_context_from_internet: true, model: "gemini_3_flash"
    });
    const text = typeof res === "string" ? res : res?.content || JSON.stringify(res);

    const markerMatch = text.match(/<map_markers>(.*?)<\/map_markers>/s);
    let cleanText = text.replace(/<map_markers>.*?<\/map_markers>/s, "").trim();
    let parsedMarkers = [];
    if (markerMatch) {
      try { parsedMarkers = JSON.parse(markerMatch[1]); } catch {}
    }
    setMarkers(parsedMarkers);
    setResult(cleanText);
    setLoading(false);
  };

  const handleMarkerClick = (marker) => {
    if (onAddMarkers) onAddMarkers([marker]);
  };

  const typeColor = { structure: "text-orange-400", poi: "text-emerald-400", route: "text-blue-400", landmark: "text-amber-400" };
  const typeIcon = { structure: "🏗️", poi: "📍", route: "🛤️", landmark: "🗺️" };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
      {!result && !loading && (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: theme.panelText }}>AI analiza terena</p>
          <p className="text-xs opacity-50 mb-4" style={{ color: theme.panelText }}>
            Zazna objekte, primerja sloje, predlaga poti in točke interesa.
          </p>

          {/* Pinpoint section */}
          <div className="mb-4 rounded-xl p-3 text-left" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}20` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2" style={{ color: theme.panelText }}>Lokacija analize</p>
            {pinnedLocation ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-400">Označena točka</p>
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
            {analysisLat?.toFixed(4)}, {analysisLng?.toFixed(4)}
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {/* Analyzed coords */}
          <div className="flex items-center gap-2 text-[10px] opacity-50" style={{ color: theme.panelText }}>
            <MapPin className="w-3 h-3" />
            <span className="font-mono">{analysisLat?.toFixed(5)}, {analysisLng?.toFixed(5)}</span>
            {pinnedLocation && <span className="text-emerald-400 opacity-100">• označena točka</span>}
          </div>

          {/* Clickable markers */}
          {markers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2" style={{ color: theme.panelText }}>
                Klikni za oznako na karti
              </p>
              <div className="space-y-1">
                {markers.map((m, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleMarkerClick(m)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all hover:bg-white/10"
                    style={{ border: `1px solid ${theme.panelText}18` }}
                  >
                    <span className="text-base leading-none">{typeIcon[m.type] || "📍"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: theme.panelText }}>{m.label}</p>
                      <p className={`text-[10px] ${typeColor[m.type] || "text-slate-400"}`}>
                        {m.lat?.toFixed(4)}, {m.lng?.toFixed(4)}
                        {m.layer ? ` · ${m.layer}` : ""}
                      </p>
                    </div>
                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-40" style={{ color: theme.panelText }} />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Analysis text */}
          <div className="text-[11px] flex items-center gap-1 opacity-50 mb-1" style={{ color: theme.panelText }}>
            <Star className="w-3 h-3 text-amber-400 opacity-100" /> Analiza zaključena
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

          <button onClick={() => { setResult(null); setMarkers([]); }}
            className="w-full py-2 text-xs font-medium rounded-xl transition mt-2 opacity-50 hover:opacity-80"
            style={{ border: `1px solid ${theme.panelText}33`, color: theme.panelText }}>
            Nova analiza
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
];

export default function AIPanel({
  onClose,
  activeLayers,
  onToggleLayer,
  mapCenter,
  mapZoom,
  isPremium,
  onAddMarkers,
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
      style={{ width: 360, height: 520, backgroundColor: theme.panelBg, color: theme.panelText, borderColor: `${theme.panelText}22` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${theme.panelText}18` }}>
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <span className="text-sm font-semibold flex-1" style={{ color: theme.panelText }}>AI Asistent</span>
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