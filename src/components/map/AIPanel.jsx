/**
 * AIPanel — unified AI hub with tabs: Ask Franc + unified Analysis
 * Premium-only (admins always have access).
 */
import React, { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, User, Lock, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { OVERLAY_CATEGORIES, BASE_LAYERS } from "./layerConfig";
import { loadTheme } from "@/components/map/ThemeCustomizer";
import ReactMarkdown from "react-markdown";
import UnifiedAnalysisPanel from "./UnifiedAnalysisPanel";
import SimpleAnalysisPanel from "./SimpleAnalysisPanel";

// ─── Layer summary for Ask Franc ───────────────────────────────────────────
const LAYER_SUMMARY = [
  ...BASE_LAYERS.map(l => `Osnovna karta: ${l.name}`),
  ...OVERLAY_CATEGORIES.flatMap(cat =>
    cat.layers.map(l => `${cat.name} > ${l.name} [id:${l.id}]: ${l.description || ""}`)
  )
].join("\n");

const ASK_SYSTEM = `Si AI asistent za GIS Explorer Slovenije. VEDNO odgovarjaj v SLOVENŠČINI.

═══ NAJPOMEMBNEJŠE PRAVILO ═══
Ko uporabnik reče "ustvari", "narisi", "naredi", "označi", "pokaži", "dodaj", "nariši", "prikaži" → VEDNO ustvari layer (overpass ali custom). NIKOLI samo opiši. Takoj ukrepaj z ustreznim XML tagom.
Ko uporabnik sprašuje informacije ("kje je", "koliko", "kaj je", "razloži") → odgovori z besedilom.
══════════════════════════════

AKCIJE (uporabi takoj ko ti narekuje besedna zveza):

1. AKTIVACIJA OBSTOJEČIH SLOJEV — ko prosi za sloj iz seznama:
   <activate_layers>["id1","id2"]</activate_layers>

2. OVERPASS QUERY — ko prosi za prikaz skupin objektov (reke, jezera, ceste, stavbe, parki, koče, ...):
   <overpass_query name="Ime sloja" color="#hex" bbox="south,west,north,east">
   [out:json][timeout:25];
   ( /* tvoja poizvedba */ );
   out geom;
   </overpass_query>
   KRITIČNO: bbox MORA biti znotraj meja Slovenije (lat: 45.4–46.9, lng: 13.4–16.6).
   Znana območja:
   - Savinjska dolina: bbox="46.0,15.0,46.4,15.6"
   - Ljubljanska kotlina: bbox="45.9,14.3,46.2,14.8"
   - Kranjska Gora: bbox="46.45,13.7,46.55,13.85"
   - Blejsko jezero: bbox="46.35,14.0,46.4,14.15"
   - Celotna Slovenija: bbox="45.4,13.4,46.9,16.6"
   Bbox za manjša območja: ~0.1–0.3 stopinje. Za doline/regije: ~0.3–0.6.

3. CUSTOM LAYER — za točno znane posamične točke (vrhovi, mesta, znamenitosti):
   <custom_layer>{"name":"Naziv","color":"#hex","features":[{"type":"Point","coords":[lat,lng],"label":"Ime"}]}</custom_layer>
   NIKOLI ne izmišljaj koordinat! Samo za točke ki jih zagotovo poznaš.
   VSE koordinate morajo biti znotraj (lat: 45.4–46.9, lng: 13.4–16.6).

4. VISION ANALIZA — ko prosi za analizo karte/vidnega:
   <vision_analyze prompt="Natančno opiši kaj je vidno na tej karti." />

RAZPOLOŽLJIVI SLOJI:
${LAYER_SUMMARY}

Bodi kratek. Vedno ukrepaj — ne samo opisuj.`;

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

// ─── Ask Franc tab ────────────────────────────────────────────────────────────
function AskTab({ activeLayers, onToggleLayer, mapCenter, mapZoom, theme, messages, setMessages, onResetChat, onAddCustomLayer, onRemoveCustomLayer }) {
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

  // Capture current map viewport as base64 image via html2canvas
  const captureMapImage = async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const mapEl = document.querySelector(".leaflet-container");
      if (!mapEl) return null;
      const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, logging: false, scale: 0.5 });
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch {
      return null;
    }
  };

  const executeOverpassQuery = async (queryStr, name, color, bbox) => {
    // Replace {{bbox}} with actual south,west,north,east
    const bboxParts = bbox.split(",").map(Number);
    const [south, west, north, east] = bboxParts;
    const bboxOverpass = `${south},${west},${north},${east}`;
    const finalQuery = queryStr.replace(/\{\{bbox\}\}/g, bboxOverpass);

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(finalQuery),
    });
    const data = await res.json();

    const features = [];
    for (const el of (data.elements || [])) {
      const label = el.tags?.name || el.tags?.["name:sl"] || "";
      if (el.type === "node" && el.lat != null) {
        features.push({ type: "Point", coords: [el.lat, el.lon], label });
      } else if (el.type === "way" && el.geometry) {
        const coords = el.geometry.map(p => [p.lat, p.lon]);
        if (coords.length > 0) {
          // Close polygon if natural=water / waterway area
          const isArea = el.tags?.natural === "water" || el.tags?.landuse === "reservoir";
          features.push({ type: isArea ? "Polygon" : "LineString", coords, label });
        }
      } else if (el.type === "relation" && el.members) {
        for (const m of el.members) {
          if (m.geometry && m.geometry.length > 0) {
            const coords = m.geometry.map(p => [p.lat, p.lon]);
            features.push({ type: "Polygon", coords, label: el.tags?.name || "" });
          }
        }
      }
    }
    return { name, color: color || "#1d9bf0", features };
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const context = `Karta: središče=[${mapCenter?.[0]?.toFixed(4)}, ${mapCenter?.[1]?.toFixed(4)}], zoom=${mapZoom}, aktivni sloji: ${activeLayerNames.join(", ") || "ni aktivnih"}.`;
    const history = messages.map(m => `${m.role === "user" ? "Uporabnik" : "Asistent"}: ${m.content}`).join("\n");

    // 1. Capture map screenshot in parallel with first LLM call
    const [res, imgData] = await Promise.all([
      base44.integrations.Core.InvokeLLM({
        prompt: `${ASK_SYSTEM}\n\n${context}\n\nZgodovina:\n${history}\n\nUporabnik: ${userMsg}\nAsistent:`,
        add_context_from_internet: true, model: "gemini_3_flash"
      }),
      captureMapImage()
    ]);

    const text = typeof res === "string" ? res : res?.content || JSON.stringify(res);

    // Parse all tags
    const layerMatch = text.match(/<activate_layers>(.*?)<\/activate_layers>/s);
    const customMatch = text.match(/<custom_layer>(.*?)<\/custom_layer>/s);
    const overpassMatch = text.match(/<overpass_query([^>]*)>([\s\S]*?)<\/overpass_query>/);
    const visionMatch = text.match(/<vision_analyze\s+prompt="([^"]+)"\s*\/>/);

    let cleanText = text
      .replace(/<activate_layers>.*?<\/activate_layers>/s, "")
      .replace(/<custom_layer>.*?<\/custom_layer>/s, "")
      .replace(/<overpass_query[\s\S]*?<\/overpass_query>/s, "")
      .replace(/<vision_analyze[^/]*\/>/g, "")
      .trim();

    // Vision analysis — capture map screenshot and analyze with LLM
    if (visionMatch) {
      const visionPrompt = visionMatch[1];
      cleanText += `\n\n📸 Analiziram karto...`;
      setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);
      const imgData = await captureMapImage();
      if (imgData) {
        // Upload image
        const blob = await (await fetch(imgData)).blob();
        const file = new File([blob], "map.jpg", { type: "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const visionRes = await base44.integrations.Core.InvokeLLM({
          prompt: `${visionPrompt}\nOdgovori v slovenščini. Bodi natančen in konkreten.`,
          file_urls: [file_url],
          model: "gemini_3_flash"
        });
        const visionText = typeof visionRes === "string" ? visionRes : JSON.stringify(visionRes);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: cleanText.replace("📸 Analiziram karto...", `📸 **Analiza karte:**\n\n${visionText}`) };
          return updated;
        });
        setLoading(false);
        return;
      }
    }

    // Activate existing layers
    let activated = [];
    if (layerMatch) {
      try {
        const ids = JSON.parse(layerMatch[1]);
        ids.forEach(id => {
          if (!activeLayers[id]) { onToggleLayer(id); }
          const all = OVERLAY_CATEGORIES.flatMap(c => c.layers).concat(BASE_LAYERS);
          const found = all.find(l => l.id === id);
          if (found) activated.push(found.name);
        });
      } catch {}
    }
    if (activated.length > 0) cleanText += `\n\n✅ Aktivirano: ${activated.join(", ")}`;

    // Add static custom layer
    if (customMatch) {
      try {
        const customLayer = JSON.parse(customMatch[1]);
        if (onAddCustomLayer) onAddCustomLayer(customLayer);
        cleanText += `\n\n🎨 Custom layer: ${customLayer.name}`;
      } catch {}
    }

    // Execute Overpass query for real OSM data
    if (overpassMatch) {
      const attrsStr = overpassMatch[1];
      const nameM = attrsStr.match(/name="([^"]+)"/);
      const colorM = attrsStr.match(/color="([^"]+)"/);
      const bboxM = attrsStr.match(/bbox="([^"]+)"/);
      const queryBody = overpassMatch[2].trim();
      const layerName = nameM?.[1] || "OSM sloj";
      const layerColor = colorM?.[1] || "#1d9bf0";
      const bbox = bboxM?.[1] || `${(mapCenter?.[0] || 46.1) - 0.2},${(mapCenter?.[1] || 15.0) - 0.3},${(mapCenter?.[0] || 46.1) + 0.2},${(mapCenter?.[1] || 15.0) + 0.3}`;
      try {
        cleanText += `\n\n🔍 Iščem podatke v OSM bazi...`;
        setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);
        const customLayer = await executeOverpassQuery(queryBody, layerName, layerColor, bbox);
        if (onAddCustomLayer) onAddCustomLayer(customLayer);
        // Update last message
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: updated[lastIdx].content.replace("🔍 Iščem podatke v OSM bazi...", `🗺️ Narisano ${customLayer.features.length} elementov: **${layerName}**`)
          };
          return updated;
        });
        setLoading(false);
        return;
      } catch (err) {
        cleanText += `\n\n❌ Napaka pri pridobivanju OSM podatkov.`;
      }
    }

    // --- Auto vision analysis of active layers if screenshot available and layers exist ---
    if (imgData && activeLayerNames.length > 0 && !visionMatch && !overpassMatch) {
      setMessages(prev => [...prev, { role: "assistant", content: cleanText + "\n\n🔍 Preverjam odgovor in analiziram karto..." }]);
      try {
        const blob = await (await fetch(imgData)).blob();
        const file = new File([blob], "map.jpg", { type: "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Run web backup check + vision analysis in parallel
        const [webCheck, visionResult] = await Promise.all([
          base44.integrations.Core.InvokeLLM({
            prompt: `Preveri in dopolni spodnji GIS odgovor z aktualnimi spletnimi viri. Aktivni sloji: ${activeLayerNames.join(", ")}. Dodaj le konkretne dopolnitve ali popravke — ne ponavljaj kar je že napisano. Odgovori v slovenščini, max 2 stavka.\n\nOdgovor ki ga preverjam:\n${cleanText}`,
            add_context_from_internet: true, model: "gemini_3_flash"
          }),
          base44.integrations.Core.InvokeLLM({
            prompt: `Analiziraj to karto GIS Explorerja Slovenije. Aktivni sloji so: ${activeLayerNames.join(", ")}. Opiši kar vidiš — površine, objekte, barve, vzorce. Bodi kratek (max 2 stavka). Odgovori v slovenščini.`,
            file_urls: [file_url], model: "gemini_3_flash"
          })
        ]);

        const webText = typeof webCheck === "string" ? webCheck : JSON.stringify(webCheck);
        const visionText = typeof visionResult === "string" ? visionResult : JSON.stringify(visionResult);

        const enriched = cleanText
          + (webText?.trim() ? `\n\n🌐 **Spletno preverjanje:** ${webText.trim()}` : "")
          + (visionText?.trim() ? `\n\n📸 **Vizualna analiza karte:** ${visionText.trim()}` : "");

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: enriched };
          return updated;
        });
        setLoading(false);
        return;
      } catch {
        // fallback — just show original answer
      }
    }

    setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);
    setLoading(false);
  };

  const quickQuestions = [
    "Kateri sloji so primerni za iskanje jam?",
    "Prikaži mi LIDAR senčenje",
    "Kako berem topografsko karto?",
    "Kje najdem stare ortofoto posnetke?",
  ];

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: `${theme.panelText}18` }}>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: theme.panelText }}>Pogovor s Francem</span>
        <button onClick={onResetChat}
          className="flex items-center gap-1 text-[10px] font-medium opacity-50 hover:opacity-100 transition-opacity px-2 py-1 rounded-lg hover:bg-white/10"
          style={{ color: theme.panelText }}>
          <RotateCcw className="w-3 h-3" /> Počisti
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <img src="https://media.base44.com/images/public/69ad3ce309822f8e71f66838/75ef0a326_EZU3mXIlM90xjxOrcrhU--0--SNgLs.jpg" alt="Franc" className="rounded-full object-cover shrink-0 mt-0.5 shadow-md ring-2 ring-emerald-500/30" style={{ width: "32px", height: "32px" }} />
            )}
            <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
              style={msg.role === "user"
                ? { backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText, borderRadius: "18px 18px 4px 18px" }
                : { backgroundColor: theme.menuBg + "44", color: theme.panelText, border: `1px solid ${theme.panelText}18`, borderRadius: "4px 18px 18px 18px" }
              }>
              <ReactMarkdown
                className="prose prose-xs max-w-none"
                components={{
                  p: ({ children }) => <p className="my-0.5 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-emerald-400">{children}</strong>,
                  ul: ({ children }) => <ul className="my-1 ml-3 list-disc space-y-0.5">{children}</ul>,
                  li: ({ children }) => <li>{children}</li>,
                  code: ({ children }) => <code className="bg-black/20 px-1 rounded text-[10px]">{children}</code>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-slate-600/50">
                <User className="w-3.5 h-3.5 text-slate-300" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 items-end">
            <img src="https://media.base44.com/images/public/69ad3ce309822f8e71f66838/75ef0a326_EZU3mXIlM90xjxOrcrhU--0--SNgLs.jpg" alt="Franc" className="rounded-full object-cover shrink-0 shadow-md" style={{ width: "32px", height: "32px" }} />
            <div className="rounded-2xl px-4 py-3 flex items-center gap-1" style={{ backgroundColor: theme.menuBg + "44", borderRadius: "4px 18px 18px 18px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        {/* Quick questions — only shown when no user messages yet */}
        {messages.length <= 1 && !loading && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] opacity-40 px-1" style={{ color: theme.panelText }}>Hitri predlogi:</p>
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => { setInput(q); }}
                className="w-full text-left text-[11px] px-3 py-2 rounded-xl transition-all hover:opacity-80"
                style={{ backgroundColor: theme.menuBg + "33", color: theme.panelText, border: `1px solid ${theme.panelText}15` }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-3 border-t shrink-0" style={{ borderColor: `${theme.panelText}22`, backgroundColor: theme.panelBg }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Vprašajte o slojih, krajih, podatkih..."
          className="flex-1 text-xs rounded-xl px-3 py-2 outline-none transition-all"
          style={{ backgroundColor: theme.menuBg + "44", color: theme.panelText, border: `1px solid ${theme.panelText}33` }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-emerald-500 text-white disabled:opacity-40 hover:bg-emerald-400 active:scale-95 transition-all">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

// ─── Main AIPanel ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "ask", label: "Franc", emoji: "💬" },
  { id: "simple", label: "Analiza v1", emoji: "⚡" },
  { id: "analysis", label: "Analiza", emoji: "🛰️" },
];

const AI_PANEL_STORAGE_KEY = "ai_panel_tab";
const FRANC_CHAT_STORAGE_KEY = "franc_chat_messages";

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
  onAddCustomLayer,
  onRemoveCustomLayer,
}) {
  const theme = loadTheme();
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem(AI_PANEL_STORAGE_KEY);
    return saved && TABS.some(t => t.id === saved) ? saved : "ask";
  });

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(FRANC_CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [{
        role: "assistant",
        content: "Živjo! Sem Franc, tvoj GIS asistent za Slovenijo. Vprašajte me o slojih, geografiji ali podatkih."
      }];
    } catch {
      return [{
        role: "assistant",
        content: "Živjo! Sem Franc, tvoj GIS asistent za Slovenijo. Vprašajte me o slojih, geografiji ali podatkih."
      }];
    }
  });

  const handleResetChat = () => {
    const defaultMessages = [{
      role: "assistant",
      content: "Živjo! Sem Franc, tvoj GIS asistent za Slovenijo. Vprašajte me o slojih, geografiji ali podatkih."
    }];
    setMessages(defaultMessages);
    localStorage.setItem(FRANC_CHAT_STORAGE_KEY, JSON.stringify(defaultMessages));
  };

  useEffect(() => {
    localStorage.setItem(FRANC_CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(AI_PANEL_STORAGE_KEY, tab);
  }, [tab]);

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
        <span className="text-sm font-semibold flex-1" style={{ color: theme.panelText }}>Asistent Franc</span>
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
                messages={messages}
                setMessages={setMessages}
                onResetChat={handleResetChat}
                onAddCustomLayer={onAddCustomLayer}
                onRemoveCustomLayer={onRemoveCustomLayer}
              />
            )}
            {tab === "simple" && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-4 py-3">
                  <SimpleAnalysisPanel
                    mapCenter={mapCenter}
                    pinnedLocation={pinnedLocation}
                    onRequestPin={onRequestPin}
                    onAddCustomLayer={onAddCustomLayer}
                    theme={theme}
                  />
                </div>
              </div>
            )}
            {tab === "analysis" && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-4 py-3">
                  <UnifiedAnalysisPanel
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
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}