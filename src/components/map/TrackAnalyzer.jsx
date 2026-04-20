import React, { useState } from "react";
import { X, Sparkles, Loader2, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { loadTheme } from "@/components/map/ThemeCustomizer";

function calcDistance(track) {
  if (!track || track.length < 2) return 0;
  let d = 0;
  for (let i = 1; i < track.length; i++) {
    const [lat1, lon1] = track[i - 1];
    const [lat2, lon2] = track[i];
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const dφ = (lat2 - lat1) * Math.PI / 180;
    const dλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    d += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return d;
}

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export default function TrackAnalyzer({ gpsTrack, onClose }) {
  const theme = loadTheme();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const hasTrack = gpsTrack && gpsTrack.length > 1;
  const distance = hasTrack ? calcDistance(gpsTrack) : 0;
  const points = gpsTrack?.length || 0;

  // Sample track for prompt (every Nth point to keep it concise)
  const sampleTrack = (track, n = 20) => {
    if (!track || track.length === 0) return [];
    const step = Math.max(1, Math.floor(track.length / n));
    return track.filter((_, i) => i % step === 0).slice(0, n);
  };

  const analyze = async () => {
    if (!hasTrack) return;
    setLoading(true);
    setAnalysis(null);

    const sampled = sampleTrack(gpsTrack);
    const start = gpsTrack[0];
    const end = gpsTrack[gpsTrack.length - 1];

    // Bounding box
    const lats = gpsTrack.map(p => p[0]);
    const lngs = gpsTrack.map(p => p[1]);
    const bbox = {
      minLat: Math.min(...lats).toFixed(4), maxLat: Math.max(...lats).toFixed(4),
      minLng: Math.min(...lngs).toFixed(4), maxLng: Math.max(...lngs).toFixed(4)
    };

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a GIS and outdoor activity expert for Slovenia. Analyze this GPS track and provide a detailed breakdown.

Track statistics:
- Total points: ${points}
- Estimated distance: ${formatDist(distance)}
- Start point: [${start[0].toFixed(5)}, ${start[1].toFixed(5)}]
- End point: [${end[0].toFixed(5)}, ${end[1].toFixed(5)}]
- Bounding box: lat ${bbox.minLat}–${bbox.maxLat}, lng ${bbox.minLng}–${bbox.maxLng}
- Sample waypoints (lat/lng): ${JSON.stringify(sampled)}

Provide a JSON response with this exact structure:
{
  "region": "Name of the region/area in Slovenia this track is in",
  "activity_type": "Likely activity (hiking, cycling, driving, etc.)",
  "difficulty": "Easy / Moderate / Challenging / Extreme",
  "terrain": "Brief description of terrain type",
  "notable_features": ["feature 1", "feature 2", "feature 3"],
  "points_of_interest": ["POI 1 near this area", "POI 2", "POI 3"],
  "summary": "2-3 sentence narrative description of the route",
  "tips": ["Tip 1", "Tip 2"],
  "estimated_duration_minutes": 90
}`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            region: { type: "string" },
            activity_type: { type: "string" },
            difficulty: { type: "string" },
            terrain: { type: "string" },
            notable_features: { type: "array", items: { type: "string" } },
            points_of_interest: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            tips: { type: "array", items: { type: "string" } },
            estimated_duration_minutes: { type: "number" }
          }
        }
      });

      setAnalysis(res);
    } catch (e) {
      setAnalysis({ error: "Analysis failed. Please try again." });
    }
    setLoading(false);
  };

  const difficultyColor = {
    "Easy": "text-emerald-400",
    "Moderate": "text-yellow-400",
    "Challenging": "text-orange-400",
    "Extreme": "text-red-400"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden"
      style={{ width: 320, backgroundColor: theme.panelBg, color: theme.panelText }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/50" style={{ backgroundColor: theme.panelBg }}>
        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-blue-400" />
        </div>
        <span className="text-sm font-semibold flex-1" style={{ color: theme.panelText }}>Track Analyzer</span>
        <button onClick={() => setExpanded(p => !p)} className="opacity-60 hover:opacity-100 mr-1" style={{ color: theme.panelText }}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={onClose} className="opacity-60 hover:opacity-100" style={{ color: theme.panelText }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Track stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: theme.menuBg + "33" }}>
              <p className="text-[10px] uppercase tracking-wider opacity-50" style={{ color: theme.panelText }}>Distance</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: theme.panelText }}>{hasTrack ? formatDist(distance) : "—"}</p>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: theme.menuBg + "33" }}>
              <p className="text-[10px] uppercase tracking-wider opacity-50" style={{ color: theme.panelText }}>Points</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: theme.panelText }}>{points}</p>
            </div>
          </div>

          {!hasTrack && (
            <p className="text-xs opacity-50 text-center py-2" style={{ color: theme.panelText }}>Start a GPS track to analyze it.</p>
          )}

          {hasTrack && !analysis && !loading && (
            <button
              onClick={analyze}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Analyze with AI
            </button>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400">Analyzing your route...</p>
            </div>
          )}

          {analysis && !analysis.error && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Route Summary</p>
                <p className="text-xs text-slate-300 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-slate-800 rounded-xl p-2 text-center">
                  <p className="text-[9px] text-slate-500 uppercase">Region</p>
                  <p className="text-[10px] font-semibold text-white mt-0.5 truncate">{analysis.region}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-2 text-center">
                  <p className="text-[9px] text-slate-500 uppercase">Activity</p>
                  <p className="text-[10px] font-semibold text-blue-400 mt-0.5 truncate">{analysis.activity_type}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-2 text-center">
                  <p className="text-[9px] text-slate-500 uppercase">Difficulty</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${difficultyColor[analysis.difficulty] || "text-slate-300"}`}>{analysis.difficulty}</p>
                </div>
              </div>

              {analysis.estimated_duration_minutes && (
                <div className="bg-slate-800/60 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Est. Duration</span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {analysis.estimated_duration_minutes >= 60
                      ? `${Math.floor(analysis.estimated_duration_minutes / 60)}h ${analysis.estimated_duration_minutes % 60}min`
                      : `${analysis.estimated_duration_minutes} min`}
                  </span>
                </div>
              )}

              {analysis.notable_features?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Notable Features</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.notable_features.map((f, i) => (
                      <span key={i} className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.points_of_interest?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Points of Interest</p>
                  {analysis.points_of_interest.map((p, i) => (
                    <p key={i} className="text-[11px] text-slate-300 py-0.5">📍 {p}</p>
                  ))}
                </div>
              )}

              {analysis.tips?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Tips</p>
                  {analysis.tips.map((t, i) => (
                    <p key={i} className="text-[11px] text-slate-300 py-0.5">💡 {t}</p>
                  ))}
                </div>
              )}

              <button
                onClick={analyze}
                className="w-full py-2 rounded-xl bg-slate-800 text-slate-400 text-[11px] hover:bg-slate-700 transition-colors"
              >
                Re-analyze
              </button>
            </div>
          )}

          {analysis?.error && (
            <p className="text-xs text-red-400 text-center">{analysis.error}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}