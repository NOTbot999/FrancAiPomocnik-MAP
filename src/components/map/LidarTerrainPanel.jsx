import React, { useState } from "react";
import { X, ChevronRight, Mountain, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { loadTheme } from "@/components/map/ThemeCustomizer";

// Slovenia's LIDAR DEM available via ARSO ArcGIS MapServer (full coverage, public)
const LIDAR_LAYERS = [
  {
    id: "lidar_dm5",
    label: "DMR 5m (visokoločljivostni)",
    description: "Digitalni model reliefa 5m — ARSO LIDAR",
    url: "https://gis.arso.gov.si/arcgis/rest/services/DMR/DMR5/MapServer/export",
    bboxSR: 3857,
    resolution: 5,
    color: "emerald",
  },
  {
    id: "lidar_dm1",
    label: "DMR 1m (ultra HD)",
    description: "Digitalni model reliefa 1m — najdetajlnejši",
    url: "https://gis.arso.gov.si/arcgis/rest/services/DMR/DMR1/MapServer/export",
    bboxSR: 3857,
    resolution: 1,
    color: "violet",
  },
];

const EXAGGERATION_OPTIONS = [
  { value: 1.0, label: "1× (realno)" },
  { value: 1.5, label: "1.5× (privzeto)" },
  { value: 2.5, label: "2.5× (dramatično)" },
  { value: 4.0, label: "4× (ekstremno)" },
];

export default function LidarTerrainPanel({
  onClose,
  onActivateLidar,    // ({ layerId, url, bboxSR, exaggeration }) => void — activates in 3D view
  onDeactivateLidar,  // () => void
  isLidarActive,
  activeLidarId,
  on3DOpen,           // opens MapLibre
}) {
  const theme = loadTheme();
  const [selectedLayer, setSelectedLayer] = useState(LIDAR_LAYERS[0].id);
  const [exaggeration, setExaggeration] = useState(1.5);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleActivate = () => {
    const layer = LIDAR_LAYERS.find(l => l.id === selectedLayer);
    if (!layer) return;
    onActivateLidar({ layerId: layer.id, url: layer.url, bboxSR: layer.bboxSR, exaggeration });
    on3DOpen?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: 10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: 10 }}
      style={{ backgroundColor: theme.menuBg, color: theme.menuText }}
      className="rounded-2xl shadow-2xl border border-slate-200/40 backdrop-blur-xl p-4 w-72"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Mountain className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: theme.menuText }}>LIDAR Terrain View</h3>
            <p className="text-[10px] opacity-50">3D DMR vizualizacija</p>
          </div>
        </div>
        <button onClick={onClose} className="opacity-40 hover:opacity-80 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info toggle */}
      <button
        onClick={() => setInfoOpen(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-xs transition"
        style={{ backgroundColor: theme.accentColor + "18", color: theme.menuText }}
      >
        <Info className="w-3.5 h-3.5 shrink-0 text-sky-400" />
        <span className="opacity-70 text-left leading-snug">Kako deluje LIDAR Terrain View?</span>
        <ChevronRight className={`w-3 h-3 ml-auto shrink-0 opacity-40 transition-transform ${infoOpen ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {infoOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[10px] opacity-60 leading-relaxed px-1 pb-2">
              Naloži ARSO LIDAR digitalni model reliefa (DMR) kot prekrivni sloj v 3D pogledu. 
              Skupaj z MapTiler DMR podlago dobite ultra-detajlno 3D vizualizacijo terena Slovenije.
              Odpre se 3D pogled — priporočamo satelitski ali hibridni prikaz.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layer selector */}
      <p className="text-[10px] font-semibold uppercase opacity-40 mt-2 mb-1.5 px-1">Izberi DMR sloj</p>
      <div className="space-y-1.5 mb-3">
        {LIDAR_LAYERS.map(layer => {
          const isSelected = selectedLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => setSelectedLayer(layer.id)}
              style={isSelected
                ? { backgroundColor: "#8b5cf6", color: "#fff", borderColor: "#8b5cf6" }
                : { backgroundColor: theme.toolbarBg, color: theme.menuText, borderColor: theme.menuText + "20" }
              }
              className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition text-left"
            >
              <div className={`mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? "border-white" : "border-slate-400"}`}>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <div className="text-xs font-semibold">{layer.label}</div>
                <div className={`text-[10px] ${isSelected ? "text-white/70" : "opacity-50"}`}>{layer.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Exaggeration */}
      <p className="text-[10px] font-semibold uppercase opacity-40 mb-1.5 px-1">Vertikalna ekstruzija</p>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {EXAGGERATION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setExaggeration(opt.value)}
            style={exaggeration === opt.value
              ? { backgroundColor: "#10b981", color: "#fff" }
              : { backgroundColor: theme.toolbarBg, color: theme.menuText, border: `1px solid ${theme.menuText}20` }
            }
            className="rounded-xl px-2 py-1.5 text-[11px] font-medium transition"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Activate / Deactivate button */}
      {isLidarActive ? (
        <button
          onClick={onDeactivateLidar}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition bg-red-500/10 text-red-400 border border-red-400/30 hover:bg-red-500/20"
        >
          Deaktiviraj LIDAR sloj
        </button>
      ) : (
        <button
          onClick={handleActivate}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #06b6d4)", color: "#fff" }}
        >
          <Mountain className="w-4 h-4" />
          Prikaži v 3D pogledu
        </button>
      )}

      {isLidarActive && (
        <p className="text-center text-[10px] text-emerald-500 mt-2 opacity-80">
          ✓ LIDAR sloj je aktiven v 3D pogledu
        </p>
      )}
    </motion.div>
  );
}