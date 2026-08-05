import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { base44 } from '@/api/base44Client';
import { BASE_LAYERS, OVERLAY_CATEGORIES } from '@/components/map/layerConfig';
import { Button } from '@/components/ui/button';
import { Activity, Play, Square, CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import 'leaflet/dist/leaflet.css';

const SLO_CENTER = [46.1512, 14.9955];
const TEST_ZOOM = 12;

const SPEED_PRESETS = {
  hitro: { loadTimeoutMs: 8000, lagSampleMs: 2000, label: 'Hitro (10s/sloj)' },
  normalno: { loadTimeoutMs: 15000, lagSampleMs: 3000, label: 'Normalno (18s/sloj)' },
  temeljito: { loadTimeoutMs: 60000, lagSampleMs: 8000, label: 'Temeljito (68s/sloj)' },
};

function buildLayerList() {
  return [
    ...BASE_LAYERS.map((l) => ({ ...l, _category: 'Osnovne karte' })),
    ...OVERLAY_CATEGORIES.flatMap((cat) => cat.layers.map((l) => ({ ...l, _category: cat.name }))),
  ];
}

function createLeafletLayer(layer, map, maptilerKey) {
  const common = { maxZoom: 22, maxNativeZoom: layer.maxNativeZoom || 19, keepBuffer: 0, updateWhenIdle: false };
  if (layer.type === 'tile') return L.tileLayer(layer.url, common);
  if (layer.type === 'wms') {
    return L.tileLayer.wms(layer.url, {
      layers: layer.layers,
      format: layer.format || 'image/png',
      transparent: layer.transparent !== false,
      version: layer.version || '1.1.1',
      crs: L.CRS.EPSG3857,
      tileSize: layer.tileSize || 256,
      ...common,
    });
  }
  if (layer.type === 'arcgis_export') {
    const url = layer.url || layer.arcgisUrl;
    const useBboxSR = layer.bboxSR || 3857;
    const useImageSR = layer.imageSR || useBboxSR;
    const useFormat = layer.format || (layer.transparent !== false ? 'png32' : 'jpg');
    const useTransparent = layer.transparent !== false;
    const arcLayer = L.tileLayer('about:blank', {
      tileSize: 256, maxZoom: 22, maxNativeZoom: layer.maxNativeZoom || 19,
      bounds: [[45.3, 13.3], [46.9, 16.8]], keepBuffer: 0,
    });
    arcLayer.getTileUrl = function (coords) {
      const tileBounds = this._tileCoordsToBounds(coords);
      const size = this.getTileSize();
      let bbox;
      if (useBboxSR === 4326) {
        const sw = tileBounds.getSouthWest();
        const ne = tileBounds.getNorthEast();
        bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
      } else {
        const sw = map.options.crs.project(tileBounds.getSouthWest());
        const ne = map.options.crs.project(tileBounds.getNorthEast());
        bbox = `${sw.x},${sw.y},${ne.x},${ne.y}`;
      }
      return (
        url +
        `?bbox=${bbox}&bboxSR=${useBboxSR}&imageSR=${useImageSR}&size=${size.x},${size.y}&f=image&format=${useFormat}&transparent=${useTransparent}`
      );
    };
    return arcLayer;
  }
  if (layer.type === 'maptiler_tile') {
    if (!maptilerKey) throw new Error('Manjka MapTiler ključ');
    const url = layer.urlTemplate.replace('{key}', maptilerKey);
    return L.tileLayer(url, { maxZoom: 22, maxNativeZoom: layer.maxNativeZoom || 12, keepBuffer: 0 });
  }
  return null;
}

function measureLag(ms) {
  return new Promise((resolve) => {
    let frames = 0;
    let maxFrame = 0;
    let lagSpikes = 0;
    let last = performance.now();
    const stop = performance.now() + ms;
    const loop = (t) => {
      const dt = t - last;
      last = t;
      if (dt > 100) lagSpikes++;
      if (dt > maxFrame) maxFrame = dt;
      frames++;
      if (performance.now() < stop) requestAnimationFrame(loop);
      else resolve({ fps: Math.round(frames / (ms / 1000)), max_frame_ms: Math.round(maxFrame), lag_spikes: lagSpikes });
    };
    requestAnimationFrame(loop);
  });
}

function testLayer(layer, map, maptilerKey, { loadTimeoutMs, lagSampleMs }) {
  return new Promise((resolve) => {
    const start = performance.now();
    let firstTileMs = null;
    let tilesLoaded = 0;
    let tilesErrored = 0;
    let settled = false;
    let leafletLayer;
    try {
      leafletLayer = createLeafletLayer(layer, map, maptilerKey);
    } catch (e) {
      return resolve({ status: 'skipped', error: e.message });
    }
    if (!leafletLayer) return resolve({ status: 'skipped', error: 'Nepodprti tip sloja' });

    leafletLayer.on('tileload', () => {
      tilesLoaded++;
      if (firstTileMs === null) firstTileMs = performance.now() - start;
    });
    leafletLayer.on('tileerror', () => {
      tilesErrored++;
      if (firstTileMs === null) firstTileMs = performance.now() - start;
    });
    leafletLayer.addTo(map);

    const finish = async (status, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const fullLoadMs = performance.now() - start;
      const lag = await measureLag(lagSampleMs);
      leafletLayer.off();
      leafletLayer.remove();
      resolve({
        status,
        error: error || null,
        first_tile_ms: firstTileMs != null ? Math.round(firstTileMs) : null,
        full_load_ms: Math.round(fullLoadMs + lagSampleMs),
        tiles_loaded: tilesLoaded,
        tiles_errored: tilesErrored,
        fps: lag.fps,
        max_frame_ms: lag.max_frame_ms,
        lag_spikes: lag.lag_spikes,
      });
    };
    const timer = setTimeout(() => {
      if (tilesLoaded > 0 && tilesErrored === 0) finish('ok');
      else if (tilesLoaded > 0 && tilesErrored > 0) finish('degraded', `${tilesErrored} napak ploščic`);
      else if (tilesErrored > 0) finish('failed', 'Vse ploščice napake');
      else finish('failed', 'Brez odgovora v časovni omejitvi');
    }, loadTimeoutMs);
    leafletLayer.on('load', () => {
      if (!settled) finish(tilesErrored > 0 ? 'degraded' : 'ok');
    });
  });
}

async function getMaptilerKey() {
  if (window.__maptilerKey) return window.__maptilerKey;
  try {
    const res = await base44.functions.invoke('getMaptilerKey', {});
    const k = res.data?.key || null;
    if (k) window.__maptilerKey = k;
    return k;
  } catch {
    return null;
  }
}

function StatusBadge({ status }) {
  const map = {
    ok: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Deluje' },
    degraded: { icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Delno' },
    failed: { icon: XCircle, cls: 'bg-red-100 text-red-700 border-red-200', label: 'Ne deluje' },
    skipped: { icon: MinusCircle, cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Presk. ' },
  };
  const { icon: Icon, cls, label } = map[status] || map.skipped;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function LayerHealthTester() {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState('normalno');
  const [results, setResults] = useState([]);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [runSummary, setRunSummary] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const reports = await base44.entities.LayerHealthReport.list('-run_at', 10);
      setHistory(reports || []);
    } catch (e) {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    mapRef.current = L.map(mapElRef.current, {
      center: SLO_CENTER,
      zoom: TEST_ZOOM,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
    });
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
    loadHistory();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loadHistory]);

  const run = async () => {
    if (!mapRef.current) return;
    setRunning(true);
    runningRef.current = true;
    setResults([]);
    setRunSummary(null);
    const layers = buildLayerList();
    const total = layers.length;
    const maptilerKey = await getMaptilerKey();
    const preset = SPEED_PRESETS[speed];
    const acc = [];
    const runStart = performance.now();
    for (let i = 0; i < total; i++) {
      if (!runningRef.current) break;
      const layer = layers[i];
      setCurrent({ index: i, total, layer });
      const r = await testLayer(layer, mapRef.current, maptilerKey, preset);
      const result = {
        layer_id: layer.id,
        name: layer.name,
        category: layer._category,
        type: layer.type,
        ...r,
      };
      acc.push(result);
      setResults([...acc]);
    }
    runningRef.current = false;
    setRunning(false);
    setCurrent(null);
    const duration_ms = Math.round(performance.now() - runStart);
    const summary = {
      total: acc.length,
      healthy: acc.filter((r) => r.status === 'ok').length,
      degraded: acc.filter((r) => r.status === 'degraded').length,
      failed: acc.filter((r) => r.status === 'failed').length,
      skipped: acc.filter((r) => r.status === 'skipped').length,
      duration_ms,
    };
    setRunSummary(summary);
    // Save report
    try {
      await base44.entities.LayerHealthReport.create({
        run_at: new Date().toISOString(),
        total_layers: summary.total,
        healthy: summary.healthy,
        degraded: summary.degraded,
        failed: summary.failed,
        skipped: summary.skipped,
        duration_ms: summary.duration_ms,
        speed_preset: speed,
        results: acc,
      });
      loadHistory();
    } catch (e) {
      // Persist failure is non-fatal — results still shown in UI
    }
  };

  const stop = () => {
    runningRef.current = false;
    setRunning(false);
  };

  const pct = current ? Math.round((current.index / current.total) * 100) : results.length ? 100 : 0;
  const okCount = results.filter((r) => r.status === 'ok').length;
  const degradedCount = results.filter((r) => r.status === 'degraded').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const sorted = [...results].sort((a, b) => {
    const order = { failed: 0, degraded: 1, skipped: 2, ok: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <div className="px-6 pb-10 space-y-5">
      {/* Hidden test map */}
      <div
        ref={mapElRef}
        style={{ position: 'fixed', left: '-99999px', top: 0, width: 512, height: 512, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-300">
          <Activity className="w-5 h-5" />
          <span className="font-semibold text-sm">Samotest slojev</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          {Object.entries(SPEED_PRESETS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setSpeed(k)}
              disabled={running}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                speed === k
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {running ? (
          <Button size="sm" variant="destructive" onClick={stop} className="gap-1.5">
            <Square className="w-3.5 h-3.5" /> Ustavi
          </Button>
        ) : (
          <Button size="sm" onClick={run} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
            <Play className="w-3.5 h-3.5" /> Zaženi test
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={loadHistory} className="text-slate-400 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Progress */}
      {(running || results.length > 0) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">
              {running && current ? `Testiram: ${current.layer.name}` : 'Test zaključen'}
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {results.length}{current ? `/${current.total}` : ''} · {pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs">
            <span className="text-emerald-400">✓ Deluje: {okCount}</span>
            <span className="text-amber-400">⚠ Delno: {degradedCount}</span>
            <span className="text-red-400">✗ Ne deluje: {failedCount}</span>
            <span className="text-slate-400">– Presk.: {skippedCount}</span>
          </div>
        </div>
      )}

      {/* Results table */}
      {sorted.length > 0 && (
        <div className="rounded-xl border border-slate-800 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">Sloj</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">Kategorija</th>
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">1. ploščica</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Nalaganje</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Ploščice</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">FPS</th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Lag</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.layer_id} className={`border-b border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                  <td className="px-3 py-2 text-white">{r.name}</td>
                  <td className="px-3 py-2 text-slate-400">{r.category}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">
                    {r.first_tile_ms != null ? `${r.first_tile_ms} ms` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">
                    {r.full_load_ms != null ? `${(r.full_load_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">
                    {r.tiles_loaded != null ? (
                      <span>
                        <span className="text-emerald-400">{r.tiles_loaded}</span>
                        {r.tiles_errored > 0 && <span className="text-red-400"> / {r.tiles_errored}✗</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.fps != null ? (
                      <span className={r.fps >= 50 ? 'text-emerald-400' : r.fps >= 30 ? 'text-amber-400' : 'text-red-400'}>
                        {r.fps}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">
                    {r.lag_spikes != null ? (
                      <span className={r.lag_spikes === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {r.lag_spikes}× {r.max_frame_ms ? `(${r.max_frame_ms}ms)` : ''}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">Zgodovina testov</span>
          <span className="text-xs text-slate-500">{history.length} shranjenih</span>
        </div>
        {loadingHistory ? (
          <div className="text-xs text-slate-500">Nalagam…</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-slate-500">Še ni shranjenih poročil.</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const total = (h.healthy || 0) + (h.degraded || 0) + (h.failed || 0) + (h.skipped || 0);
              const healthPct = total > 0 ? Math.round(((h.healthy || 0) / total) * 100) : 0;
              return (
                <div key={h.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/40 text-xs">
                  <div className="text-slate-300 whitespace-nowrap font-mono">
                    {(() => { try { return format(new Date(h.run_at), 'dd.MM.yy HH:mm'); } catch { return h.run_at; } })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${healthPct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2 font-mono whitespace-nowrap">
                    <span className="text-emerald-400">✓{h.healthy || 0}</span>
                    <span className="text-amber-400">⚠{h.degraded || 0}</span>
                    <span className="text-red-400">✗{h.failed || 0}</span>
                    <span className="text-slate-500">–{h.skipped || 0}</span>
                  </div>
                  <div className="text-slate-500 whitespace-nowrap font-mono">
                    {((h.duration_ms || 0) / 1000).toFixed(0)}s
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}