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
Razpoložljivi sloji:\n${LAYER_SUMMARY}
Pomagaj uporabnikom aktivirati sloje, odgovori na vprašanja o geografiji Slovenije, razloži podatke.
Ko priporočaš sloje, vključi: <activate_layers>["id1","id2"]</activate_layers>
Ko želiš narisati custom layer (npr. izbrane poti, arheološka gradišča, ali druge feature-je), vključi:
<custom_layer>{"name":"Naziv","color":"#hexcolor","features":[{"type":"LineString","coords":[[lat,lng],[lat,lng],...]}]}</custom_layer>
Odgovori naj bodo kratki in praktični.`;

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
    const layerMatch = text.match(/<activate_layers>(.*?)<\/activate_layers>/s);
    const customMatch = text.match(/<custom_layer>(.*?)<\/custom_layer>/s);
    let cleanText = text.replace(/<activate_layers>.*?<\/activate_layers>/s, "").replace(/<custom_layer>.*?<\/custom_layer>/s, "").trim();
    
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
    
    if (customMatch) {
      try {
        const customLayer = JSON.parse(customMatch[1]);
        if (onAddCustomLayer) onAddCustomLayer(customLayer);
        cleanText += `\n\n🎨 Custom layer: ${customLayer.name}`;
      } catch {}
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