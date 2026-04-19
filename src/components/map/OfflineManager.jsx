import React, { useState, useEffect, useCallback } from "react";
import { WifiOff, Download, Trash2, X, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMap } from "react-leaflet";

function useSW() {
  const [swReady, setSwReady] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setSwReady(true));
    }
  }, []);
  return swReady;
}

export default function OfflineManager({ onClose }) {
  const map = useMap();
  const swReady = useSW();
  const [cacheCount, setCacheCount] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total }
  const [downloading, setDownloading] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [maxZoom, setMaxZoom] = useState(14);

  const fetchStats = useCallback(() => {
    if (!swReady || !navigator.serviceWorker.controller) return;
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => setCacheCount(e.data.count);
    navigator.serviceWorker.controller.postMessage({ type: "CACHE_STATS" }, [ch.port2]);
  }, [swReady]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const downloadRegion = () => {
    if (!swReady || !navigator.serviceWorker.controller) return;
    const b = map.getBounds();
    const bounds = {
      north: b.getNorth(), south: b.getSouth(),
      west: b.getWest(), east: b.getEast(),
    };
    const minZoom = Math.max(map.getZoom() - 1, 7);
    setDownloading(true);
    setProgress({ done: 0, total: 1 });

    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      setProgress({ done: e.data.done, total: e.data.total });
      if (e.data.finished) {
        setDownloading(false);
        fetchStats();
      }
    };
    navigator.serviceWorker.controller.postMessage(
      { type: "CACHE_REGION", bounds, minZoom, maxZoom },
      [ch.port2]
    );
  };

  const clearCache = () => {
    if (!swReady || !navigator.serviceWorker.controller) return;
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { setCacheCount(0); setCleared(true); setTimeout(() => setCleared(false), 2000); };
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_TILE_CACHE" }, [ch.port2]);
  };

  const tileCount = () => {
    if (cacheCount === null) return "...";
    if (cacheCount === 0) return "No tiles cached";
    return `${cacheCount.toLocaleString()} tiles cached`;
  };

  const percent = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      className="w-72 bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-slate-500" /> Offline Maps
        </span>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {!swReady && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Service worker not available. Make sure you are using the app over HTTPS.
          </p>
        )}

        <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-slate-600">{tileCount()}</span>
          {cacheCount > 0 && (
            <button
              onClick={clearCache}
              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 font-medium"
            >
              {cleared ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Trash2 className="w-3.5 h-3.5" />}
              {cleared ? "Cleared!" : "Clear"}
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1.5">
            Max zoom to cache: <span className="text-emerald-600 font-bold">{maxZoom}</span>
          </label>
          <input
            type="range" min={10} max={17} step={1} value={maxZoom}
            onChange={e => setMaxZoom(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>10 (overview)</span><span>17 (street detail)</span>
          </div>
        </div>

        {downloading && progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Downloading tiles…</span>
              <span>{percent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">{progress.done} / {progress.total} tiles</p>
          </div>
        )}

        <button
          onClick={downloadRegion}
          disabled={!swReady || downloading}
          className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {downloading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading…</>
            : <><Download className="w-3.5 h-3.5" /> Save current view for offline</>
          }
        </button>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Zooms into the current map view and caches all tiles from zoom {Math.max(map?.getZoom?.() - 1, 7) || 7} to {maxZoom}. Pan &amp; zoom to the area you want before saving.
        </p>
      </div>
    </motion.div>
  );
}