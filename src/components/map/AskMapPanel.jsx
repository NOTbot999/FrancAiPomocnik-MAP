import React, { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { OVERLAY_CATEGORIES, BASE_LAYERS } from "./layerConfig";

const LAYER_SUMMARY = [
  ...BASE_LAYERS.map(l => `Base: ${l.name}`),
  ...OVERLAY_CATEGORIES.flatMap(cat =>
    cat.layers.map(l => `${cat.name} > ${l.name}: ${l.description || ""}`)
  )
].join("\n");

const SYSTEM_PROMPT = `You are an AI assistant for Slovenia GIS Explorer — a professional GIS map application for Slovenia.

Available map layers:
${LAYER_SUMMARY}

You help users:
1. Find and activate the right layers for their task (respond with layer IDs to activate when helpful)
2. Answer questions about Slovenia's geography, environment, geology, history, land use
3. Explain what layers show and how to interpret them
4. Suggest combinations of layers for specific use cases

When recommending layers to activate, include a JSON block at the end of your response in this format:
<activate_layers>["layer_id_1","layer_id_2"]</activate_layers>

Keep responses concise and practical. You have real-time context about the map.`;

export default function AskMapPanel({ onClose, activeLayers, onToggleLayer, mapCenter, mapZoom }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your GIS assistant for Slovenia. Ask me anything about the map — I can activate layers, explain data, or answer questions about Slovenia's geography. Try: *\"Show me flood risk areas\"* or *\"What layers show caves?\"*" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeLayerNames = Object.keys(activeLayers).map(id => {
    for (const cat of OVERLAY_CATEGORIES) {
      const l = cat.layers.find(l => l.id === id);
      if (l) return l.name;
    }
    const base = BASE_LAYERS.find(l => l.id === id);
    return base?.name || id;
  });

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const contextNote = `Current map state: center=[${mapCenter?.[0]?.toFixed(4)}, ${mapCenter?.[1]?.toFixed(4)}], zoom=${mapZoom}, active layers: ${activeLayerNames.length > 0 ? activeLayerNames.join(", ") : "none"}.`;

    const history = messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `${SYSTEM_PROMPT}\n\n${contextNote}\n\nConversation so far:\n${history}\n\nUser: ${userMsg}\n\nAssistant:`,
        add_context_from_internet: true,
        model: "gemini_3_flash"
      });

      const text = typeof res === "string" ? res : res?.content || res?.text || JSON.stringify(res);

      // Extract layer activations
      const match = text.match(/<activate_layers>(.*?)<\/activate_layers>/s);
      let cleanText = text.replace(/<activate_layers>.*?<\/activate_layers>/s, "").trim();
      let activatedNames = [];

      if (match) {
        try {
          const ids = JSON.parse(match[1]);
          ids.forEach(id => {
            if (!activeLayers[id]) {
              onToggleLayer(id);
              const allLayers = OVERLAY_CATEGORIES.flatMap(c => c.layers).concat(BASE_LAYERS);
              const found = allLayers.find(l => l.id === id);
              if (found) activatedNames.push(found.name);
            }
          });
        } catch {}
      }

      const finalText = activatedNames.length > 0
        ? `${cleanText}\n\n✅ Activated: ${activatedNames.join(", ")}`
        : cleanText;

      setMessages(prev => [...prev, { role: "assistant", content: finalText }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had trouble connecting. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="flex flex-col bg-slate-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden"
      style={{ width: 340, height: 480 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/50 shrink-0 bg-gradient-to-r from-emerald-900/40 to-slate-900/40">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-white flex-1">Ask the Map</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-200"
            }`}>
              {msg.content.split(/\*([^*]+)\*/).map((part, j) =>
                j % 2 === 1 ? <em key={j} className="not-italic font-semibold text-emerald-400">{part}</em> : part
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
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="bg-slate-800 rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-700/50 shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about layers, places, data..."
          className="flex-1 bg-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none border border-slate-700 focus:border-emerald-500 placeholder-slate-500"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-emerald-500 text-white disabled:opacity-40 hover:bg-emerald-400 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}