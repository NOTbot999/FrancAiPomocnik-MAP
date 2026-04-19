import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, FolderOpen, Trash2, X, Loader2, Check, Route } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function calcDistance(track) {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    const [lat1, lng1] = track[i - 1];
    const [lat2, lng2] = track[i];
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

export default function MyTracks({ gpsTrack, onLoadTrack, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadSessions = async () => {
    setLoading(true);
    const records = await base44.entities.GpsTrackSession.list("-created_date", 30);
    setSessions(records);
    setLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  const handleSave = async () => {
    if (gpsTrack.length < 2) return;
    setSaving(true);
    const dist = calcDistance(gpsTrack);
    const name = `Track ${new Date().toLocaleString()}`;
    await base44.entities.GpsTrackSession.create({
      name,
      track_data: gpsTrack,
      distance_meters: Math.round(dist),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadSessions();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    await base44.entities.GpsTrackSession.delete(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="absolute bottom-8 right-16 z-[950] w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Route className="w-4 h-4 text-emerald-500" />
          My GPS Tracks
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Save current track */}
      <div className="px-4 py-3 border-b border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving || gpsTrack.length < 2}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved!" : gpsTrack.length < 2 ? "No track to save" : `Save current track (${fmtDist(calcDistance(gpsTrack))})`}
        </button>
      </div>

      {/* Saved sessions list */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-6">No saved tracks yet</p>
        ) : (
          <AnimatePresence>
            {sessions.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{s.name}</p>
                  {s.distance_meters && (
                    <p className="text-[10px] text-slate-400">{fmtDist(s.distance_meters)} · {s.track_data?.length} pts</p>
                  )}
                </div>
                <button
                  onClick={() => onLoadTrack(s.track_data)}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"
                  title="Load track"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 disabled:opacity-40"
                  title="Delete"
                >
                  {deletingId === s.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}