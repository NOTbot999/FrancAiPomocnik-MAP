import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save, FolderOpen, Loader2, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export default function SaveLoadDrawings({ drawings, gpsTrack, onLoad }) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasAnything =
    drawings.markers.length > 0 ||
    drawings.lines.length > 0 ||
    drawings.polygons.length > 0 ||
    gpsTrack.length > 0;

  const handleSave = async () => {
    if (!hasAnything) return;
    setSaving(true);
    const name = `Drawing ${new Date().toLocaleString()}`;
    await base44.entities.MapDrawing.create({
      name,
      markers: drawings.markers,
      lines: drawings.lines,
      polygons: drawings.polygons,
      gps_tracks: gpsTrack.length > 0 ? [gpsTrack] : [],
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoad = async () => {
    setLoading(true);
    const records = await base44.entities.MapDrawing.list("-created_date", 20);
    setLoading(false);
    if (records.length === 0) {
      alert("No saved drawings found.");
      return;
    }
    // Merge all saved drawings into one
    const merged = { markers: [], lines: [], polygons: [], gps_tracks: [] };
    records.forEach((r) => {
      if (r.markers) merged.markers.push(...r.markers);
      if (r.lines) merged.lines.push(...r.lines);
      if (r.polygons) merged.polygons.push(...r.polygons);
      if (r.gps_tracks) merged.gps_tracks.push(...r.gps_tracks);
    });
    onLoad(merged);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleSave}
              disabled={saving || !hasAnything}
              className={`p-3 rounded-xl shadow-lg transition-all duration-300 border ${
                saved
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border-slate-200/50"
              } disabled:opacity-40`}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : saved ? (
                <Check className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left"><p className="text-xs">Save Drawings</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLoad}
              disabled={loading}
              className="p-3 rounded-xl shadow-lg bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border border-slate-200/50 transition-all duration-300 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FolderOpen className="w-5 h-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left"><p className="text-xs">Load Saved Drawings</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}