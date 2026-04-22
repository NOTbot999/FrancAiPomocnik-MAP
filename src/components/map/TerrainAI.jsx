/**
 * TerrainAI - Premium AI terrain analysis panel.
 * Uses InvokeLLM with internet context to analyze the current map area:
 * - Detects man-made structures (straight lines, rectangles, circles)
 * - Compares satellite vs hillshade (described via coordinates + zoom)
 * - Flags hidden/collapsed structures not visible on satellite
 * - Provides location summary, suggested routes, and points of interest
 */
import React, { useState, useRef } from "react";
import { X, Sparkles, Loader2, MapPin, TriangleAlert, Route, Star, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";

const SYSTEM_PROMPT = `You are an expert GIS analyst and terrain specialist for Slovenia. 
You will analyze a specific geographic location based on coordinates and zoom level provided.

Your task:
1. **Man-made structure detection**: Based on the area coordinates, identify any man-made structures (buildings, roads, fences, agricultural fields with straight edges, quarries, clearcuts) that may be detectable via geometric patterns (straight lines, rectangles, circles, regular grids). Flag any that might be hidden, collapsed, or overgrown.
2. **Hillshade vs Satellite comparison**: Using your knowledge of terrain in this area, note any discrepancies — e.g. terrain features visible in elevation data but not in satellite (underground structures, collapsed buildings, hidden clearings).
3. **Location summary**: Brief description of the place — what kind of area is this, notable landmarks, historical context.
4. **Suggested routes**: 2-3 short hiking/cycling route suggestions near this point.
5. **Points of interest**: Notable nearby places worth visiting.

Format your response in clear sections with markdown headers. Be specific and use real place names where possible. Focus on Slovenia.`;

export default function TerrainAI({ mapCenter, mapZoom, activeLayers, isPremium, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({ structures: true, summary: true, routes: true, poi: true });

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    const [lat, lng] = mapCenter;
    const prompt = `${SYSTEM_PROMPT}

Current map state:
- Center coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)} (latitude, longitude)
- Zoom level: ${mapZoom} (higher = more detailed view)
- Active overlay layers: ${Object.keys(activeLayers).join(", ") || "none"}

Analyze this location in Slovenia thoroughly. Use internet context to get real data about this area.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
    });

    setResult(res);
    setLoading(false);
  };

  if (!isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-5 w-72"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-800">Terrain AI</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-center py-4">
          <Lock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 mb-1">Premium funkcija</p>
          <p className="text-xs text-slate-500">Terrain AI je na voljo samo za premium uporabnike. Posodobite račun za dostop.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 w-80 max-h-[80vh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-emerald-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-800">Terrain AI</span>
          <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">PREMIUM</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Coords */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
        <p className="text-[10px] font-mono text-slate-500">
          📍 {mapCenter[0].toFixed(5)}, {mapCenter[1].toFixed(5)} | zoom {mapZoom}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!result && !loading && (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-sm text-slate-600 mb-1 font-medium">AI analiza terena</p>
            <p className="text-xs text-slate-400 mb-4">
              Zazna človeško narejene objekte, primerja satelit s hillshade, predlaga poti in točke interesa.
            </p>
            <button
              onClick={analyze}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:from-amber-600 hover:to-emerald-600 transition shadow-sm"
            >
              Analiziraj lokacijo
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
            <p className="text-sm text-slate-500">AI analizira terrain...</p>
            <p className="text-xs text-slate-400">Primerjam satelit, hillshade in terenske podatke</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400" /> Analiza zaključena
            </div>
            <div className="prose prose-xs prose-slate max-w-none text-xs leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-sm font-bold text-slate-800 mt-3 mb-1">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xs font-bold text-slate-700 mt-2.5 mb-1 flex items-center gap-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-600 mt-2 mb-0.5">{children}</h3>,
                  p: ({ children }) => <p className="text-xs text-slate-600 mb-1.5 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="text-xs text-slate-600 ml-3 space-y-0.5 mb-1.5">{children}</ul>,
                  li: ({ children }) => <li className="list-disc">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                }}
              >
                {result}
              </ReactMarkdown>
            </div>
            <button
              onClick={analyze}
              className="w-full py-2 border border-slate-200 text-slate-500 text-xs font-medium rounded-xl hover:bg-slate-50 transition mt-2"
            >
              Ponovi analizo
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}