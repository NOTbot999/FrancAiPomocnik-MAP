import React, { useState, useEffect, useCallback, useMemo } from "react";
import { WifiOff, Download, Trash2, X, CheckCircle2, Loader2, Database, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getManifest, DATA_BASE } from "@/lib/offlineData";

const MAX_TILES_PER_DOWNLOAD = 8000;

function useSW() {
  const [swReady, setSwReady] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setSwReady(true));
    }
  }, []);
  return swReady;
}

function postToSW(message, onMessage) {
  const ch = new MessageChannel();
  ch.port1.onmessage = (e) => onMessage?.(e.data);
  navigator.serviceWorker.controller.postMessage(message, [ch.port2]);
}

function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return [x, y];
}

/** Every Leaflet grid layer currently on the map that fetches imagery (tile, WMS, ArcGIS export). */
function activeGridLayers(map) {
  const out = [];
  map.eachLayer((l) => {
    if (l instanceof L.GridLayer && typeof l.getTileUrl === "function") out.push(l);
  });
  return out;
}

/** Build the list of image URLs needed to show `layers` inside `bounds` for zooms min..max. */
function buildTileUrls(map, layers, bounds, minZoom, maxZoom) {
  const urls = new Set();
  for (const layer of layers) {
    const native = layer.options?.maxNativeZoom ?? maxZoom;
    const zMax = Math.min(maxZoom, native);
    const prevTileZoom = layer._tileZoom;
    for (let z = minZoom; z <= zMax; z++) {
      layer._tileZoom = z; // L.TileLayer.getTileUrl reads the {z} placeholder from here
      const [x0, y0] = latLngToTile(bounds.north, bounds.west, z);
      const [x1, y1] = latLngToTile(bounds.south, bounds.east, z);
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          try {
            const coords = new L.Point(x, y);
            coords.z = z;
            const url = layer.getTileUrl(coords);
            if (url && url.startsWith("http")) urls.add(url);
          } catch { /* layer not ready */ }
        }
      }
    }
    layer._tileZoom = prevTileZoom;
  }
  return Array.from(urls);
}

export default function OfflineManager({ onClose }) {
  const map = useMap();
  const swReady = useSW();
  const [stats, setStats] = useState(null); // { count, shell, data }
  const [progress, setProgress] = useState(null); // { done, total, failed }
  const [downloading, setDownloading] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [maxZoom, setMaxZoom] = useState(14);
  const [manifest, setManifest] = useState(null);
  const [dataProgress, setDataProgress] = useState(null);
  const [warmingData, setWarmingData] = useState(false);

  const fetchStats = useCallback(() => {
    if (!swReady || !navigator.serviceWorker.controller) return;
    postToSW({ type: "CACHE_STATS" }, (d) => setStats(d));
  }, [swReady]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { getManifest().then(setManifest); }, []);

  const layers = useMemo(() => (map ? activeGridLayers(map) : []), [map]);
  const minZoom = Math.max((map?.getZoom?.() ?? 8) - 1, 7);

  const estimate = useMemo(() => {
    if (!map) return 0;
    const b = map.getBounds();
    const bounds = { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() };
    let n = 0;
    for (let z = minZoom; z <= maxZoom; z++) {
      const [x0, y0] = latLngToTile(bounds.north, bounds.west, z);
      const [x1, y1] = latLngToTile(bounds.south, bounds.east, z);
      n += (x1 - x0 + 1) * (y1 - y0 + 1);
    }
    return n * Math.max(activeGridLayers(map).length, 1);
  }, [map, maxZoom, minZoom, progress]);

  const downloadRegion = () => {
    if (!swReady || !navigator.serviceWorker.controller) return;
    const b = map.getBounds();
    const bounds = { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() };
    const active = activeGridLayers(map);
    let urls = buildTileUrls(map, active, bounds, minZoom, maxZoom);
    if (urls.length === 0) return;
    if (urls.length > MAX_TILES_PER_DOWNLOAD) urls = urls.slice(0, MAX_TILES_PER_DOWNLOAD);

    setDownloading(true);
    setProgress({ done: 0, total: urls.length, failed: 0 });
    postToSW({ type: "CACHE_REGION", urls }, (d) => {
      setProgress({ done: d.done, total: d.total, failed: d.failed || 0 });
      if (d.finished) { setDownloading(false); fetchStats(); }
    });
  };

  const warmData = () => {
    if (!swReady || !navigator.serviceWorker.controller || !manifest) return;
    const urls = [`${DATA_BASE}/manifest.json`, ...Object.keys(manifest.files || {}).map((id) => `${DATA_BASE}/${id}.json`)];
    setWarmingData(true);
    setDataProgress({ done: 0, total: urls.length });
    postToSW({ type: "WARM_DATA", urls }, (d) => {
      setDataProgress({ done: d.done, total: d.total });
      if (d.finished) { setWarmingData(false); fetchStats(); }
    });
  };

  const clearCache = () => {
    if (!swReady || !navigator.serviceWorker.controller) return;
    postToSW({ type: "CLEAR_TILE_CACHE" }, () => {
      setStats((s) => ({ ...(s || {}), count: 0 }));
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    });
  };

  const tileCount = () => {
    if (!stats) return "...";
    if (!stats.count) return "Ni shranjenih ploščic";
    return `${stats.count.toLocaleString("sl-SI")} ploščic shranjenih`;
  };

  const percent = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;
  const dataFiles = manifest ? Object.keys(manifest.files || {}).length : 0;
  const dataCached = stats?.data || 0;
  const builtAt = manifest?.built_at ? new Date(manifest.built_at).toLocaleDateString("sl-SI") : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      className="w-72 bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-slate-500" /> Brez povezave
        </span>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {!swReady && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Service worker ni na voljo. Aplikacijo odpri prek HTTPS (ali localhost).
          </p>
        )}

        {/* Bundled data */}
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-600" /> Podatki (jame, POI, občine)
            </span>
            {manifest && dataCached >= dataFiles && dataFiles > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          {manifest ? (
            <p className="text-[10px] text-slate-500">
              {dataFiles} paketov · zgrajeno {builtAt} · {dataCached}/{dataFiles} shranjenih za offline
            </p>
          ) : (
            <p className="text-[10px] text-amber-600">Paketi podatkov niso vključeni (zaženi <code>npm run fetch-data</code>).</p>
          )}
          {warmingData && dataProgress && (
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((dataProgress.done / Math.max(dataProgress.total, 1)) * 100)}%` }} />
            </div>
          )}
          <button
            onClick={warmData}
            disabled={!swReady || !manifest || warmingData}
            className="w-full py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {warmingData ? <><Loader2 className="w-3 h-3 animate-spin" /> Shranjujem…</> : <><Download className="w-3 h-3" /> Shrani vse podatke za offline</>}
          </button>
        </div>

        {/* Tiles */}
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-slate-600 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-slate-400" /> {tileCount()}</span>
          {stats?.count > 0 && (
            <button onClick={clearCache} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 font-medium">
              {cleared ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Trash2 className="w-3.5 h-3.5" />}
              {cleared ? "Počiščeno" : "Počisti"}
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1.5">
            Največji zoom za shranjevanje: <span className="text-emerald-600 font-bold">{maxZoom}</span>
          </label>
          <input
            type="range" min={10} max={17} step={1} value={maxZoom}
            onChange={e => setMaxZoom(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>10 (pregled)</span><span>17 (ulice)</span>
          </div>
        </div>

        {downloading && progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Prenašam ploščice…</span>
              <span>{percent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[10px] text-slate-400">{progress.done} / {progress.total} ploščic{progress.failed ? ` · ${progress.failed} neuspešnih` : ""}</p>
          </div>
        )}

        <button
          onClick={downloadRegion}
          disabled={!swReady || downloading || layers.length === 0}
          className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {downloading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Prenašam…</>
            : <><Download className="w-3.5 h-3.5" /> Shrani trenutni pogled za offline</>
          }
        </button>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Shrani ploščice vseh {layers.length} aktivnih slojev (podlaga + prekrivni) za trenutni izrez od zooma {minZoom} do {maxZoom}
          — približno {Math.min(estimate, MAX_TILES_PER_DOWNLOAD).toLocaleString("sl-SI")} slik
          {estimate > MAX_TILES_PER_DOWNLOAD ? ` (omejeno na ${MAX_TILES_PER_DOWNLOAD.toLocaleString("sl-SI")}; zmanjšaj zoom ali izrez)` : ""}.
          Premakni in približaj karto na želeno območje, preden shraniš.
        </p>
      </div>
    </motion.div>
  );
}
