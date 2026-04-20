import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, FolderOpen, Trash2, X, Loader2, Check, Route, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DeviceLink from "./DeviceLink";
import { loadTheme } from "@/components/map/ThemeCustomizer";

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

function getDeviceId() {
  let id = localStorage.getItem("gis_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gis_device_id", id);
  }
  return id;
}

export default function MyTracks({ gpsTrack, onLoadTrack, onClose, inline }) {
  const theme = loadTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeviceLink, setShowDeviceLink] = useState(false);
  const deviceId = getDeviceId();

  const loadSessions = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("guestTracks", { action: "load", device_id: deviceId });
    setSessions(res.data.tracks || []);
    setLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  const handleSave = async () => {
    if (gpsTrack.length < 2) return;
    setSaving(true);
    const dist = calcDistance(gpsTrack);
    const name = `Track ${new Date().toLocaleString()}`;
    const newTrack = { name, track_data: gpsTrack, distance_meters: Math.round(dist), saved_at: new Date().toISOString() };
    const updated = [...sessions, newTrack];
    await base44.functions.invoke("guestTracks", { action: "save", device_id: deviceId, tracks: updated });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadSessions();
  };

  const handleDelete = async (idx) => {
    setDeletingId(idx);
    const updated = sessions.filter((_, i) => i !== idx);
    await base44.functions.invoke("guestTracks", { action: "save", device_id: deviceId, tracks: updated });
    setSessions(updated);
    setDeletingId(null);
  };

  return (
    <div className={inline ? "w-full" : "absolute bottom-8 right-16 z-[950] w-72 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50"}
      style={!inline ? { backgroundColor: theme.menuBg, color: theme.menuText } : {}}>
      {/* Header — hidden in inline mode */}
      {!inline && (
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.menuText + "22" }}>
          <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: theme.menuText }}>
            <Route className="w-4 h-4" style={{ color: theme.accentColor }} />
            My GPS Tracks
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeviceLink(p => !p)}
              title="Link devices"
              className={`p-1.5 rounded-lg transition ${showDeviceLink ? "text-emerald-500 bg-emerald-50" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 opacity-50 hover:opacity-100" style={{ color: theme.menuText }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Device Link panel — hidden in inline mode (handled by settings panel) */}
      {!inline && showDeviceLink && (
        <div className="px-4 py-3 border-b" style={{ borderColor: theme.menuText + "22" }}>
          <DeviceLink deviceId={deviceId} onClose={() => setShowDeviceLink(false)} />
        </div>
      )}

      {/* Save current track */}
      <div className="px-4 py-3 border-b" style={{ borderColor: theme.menuText + "22" }}>
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
            {[...sessions].reverse().map((s, ri) => {
              const idx = sessions.length - 1 - ri;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-4 py-2.5 border-b last:border-0"
                  style={{ borderColor: theme.menuText + "11" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: theme.menuText }}>{s.name}</p>
                    {s.distance_meters && (
                      <p className="text-[10px] opacity-50" style={{ color: theme.menuText }}>{fmtDist(s.distance_meters)} · {s.track_data?.length} pts</p>
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
                    onClick={() => handleDelete(idx)}
                    disabled={deletingId === idx}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === idx ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}