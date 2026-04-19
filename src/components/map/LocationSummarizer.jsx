import React, { useState, useEffect } from "react";
import { X, Loader2, MapPin, Info } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { OVERLAY_CATEGORIES } from "./layerConfig";

export default function LocationSummarizer({ latlng, activeLayers, onClose }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const activeLayerNames = Object.keys(activeLayers).map(id => {
    for (const cat of OVERLAY_CATEGORIES) {
      const l = cat.layers.find(l => l.id === id);
      if (l) return l.name;
    }
    return null;
  }).filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setInfo(null);

    async function fetchInfo() {
      try {
        // First get a human-readable address via Nominatim
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latlng[0]}&lon=${latlng[1]}&format=json&addressdetails=1`,
          { headers: { "User-Agent": "SloveniaGISExplorer/1.0" } }
        );
        const nomData = await nomRes.json();
        const placeName = nomData.display_name || `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;

        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a geography and GIS expert for Slovenia. Provide a concise but rich summary for this location.

Location: ${placeName}
Coordinates: ${latlng[0].toFixed(5)}°N, ${latlng[1].toFixed(5)}°E
Active map layers showing: ${activeLayerNames.length > 0 ? activeLayerNames.join(", ") : "none"}

Provide a JSON response:
{
  "place_name": "Short place name (city/town/area)",
  "region": "Statistical or geographic region",
  "elevation_approx": "Approximate elevation in meters (e.g. ~350m a.s.l.)",
  "landscape": "Brief landscape type description",
  "historical_note": "1 interesting historical or cultural fact about this area",
  "nature_note": "1 notable nature/ecology fact",
  "layer_context": "Brief note about what the active layers show at this location (or 'No layers active' if none)",
  "quick_facts": ["fact 1", "fact 2", "fact 3"]
}`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              place_name: { type: "string" },
              region: { type: "string" },
              elevation_approx: { type: "string" },
              landscape: { type: "string" },
              historical_note: { type: "string" },
              nature_note: { type: "string" },
              layer_context: { type: "string" },
              quick_facts: { type: "array", items: { type: "string" } }
            }
          }
        });

        if (!cancelled) setInfo(res);
      } catch {
        if (!cancelled) setInfo({ error: true });
      }
      if (!cancelled) setLoading(false);
    }

    fetchInfo();
    return () => { cancelled = true; };
  }, [latlng[0], latlng[1]]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      className="bg-slate-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden"
      style={{ width: 300 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-violet-900/40 to-slate-900/40">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Location Info</p>
          <p className="text-[10px] text-slate-500 truncate">{latlng[0].toFixed(4)}°N, {latlng[1].toFixed(4)}°E</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-xs text-slate-400">Gathering location intel...</p>
          </div>
        )}

        {!loading && info && !info.error && (
          <div className="space-y-3">
            {/* Place */}
            <div>
              <p className="text-base font-bold text-white">{info.place_name}</p>
              <p className="text-xs text-violet-400">{info.region}</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-slate-800 rounded-xl p-2">
                <p className="text-[9px] text-slate-500 uppercase">Elevation</p>
                <p className="text-[11px] font-semibold text-white mt-0.5">{info.elevation_approx}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-2">
                <p className="text-[9px] text-slate-500 uppercase">Landscape</p>
                <p className="text-[11px] font-semibold text-slate-300 mt-0.5 truncate">{info.landscape}</p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <div className="bg-slate-800/60 rounded-xl px-3 py-2">
                <p className="text-[9px] text-amber-500 uppercase tracking-wider mb-0.5">History</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">{info.historical_note}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl px-3 py-2">
                <p className="text-[9px] text-emerald-500 uppercase tracking-wider mb-0.5">Nature</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">{info.nature_note}</p>
              </div>
              {activeLayerNames.length > 0 && (
                <div className="bg-slate-800/60 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-violet-400 uppercase tracking-wider mb-0.5">Active Layers</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{info.layer_context}</p>
                </div>
              )}
            </div>

            {/* Quick facts */}
            {info.quick_facts?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {info.quick_facts.map((f, i) => (
                  <span key={i} className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && info?.error && (
          <p className="text-xs text-slate-500 text-center py-4">Could not load location info. Try again.</p>
        )}
      </div>
    </motion.div>
  );
}