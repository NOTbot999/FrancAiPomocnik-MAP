import React, { useState } from "react";
import { BookOpen, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LEGEND_ITEMS = [
  {
    category: "OpenStreetMap (OSM)",
    color: "#7ebc6f",
    items: [
      { label: "Avtocesta / hitra cesta", color: "#e892a2", style: "line" },
      { label: "Glavna cesta (primary)", color: "#fcd6a4", style: "line" },
      { label: "Regionalna cesta (secondary)", color: "#fff7b1", style: "line" },
      { label: "Lokalna / naselbina (residential)", color: "#ffffff", style: "line" },
      { label: "Kolesarska pot (cycleway)", color: "#0066ff", style: "dash" },
      { label: "Pešpot / planinska pot", color: "#d72d2d", style: "dash" },
      { label: "Železnica", color: "#707070", style: "line" },
      { label: "Poseljeno območje / stavbe", color: "#d9d0c9", style: "square" },
      { label: "Gozd / vegetacija", color: "#aedfa3", style: "polygon" },
      { label: "Vode (reke, jezera)", color: "#aad2f0", style: "polygon" },
      { label: "Parki / zelenje", color: "#c7f0a3", style: "polygon" },
      { label: "POI (znamenitost, trgovina…)", color: "#ff6b6b", style: "dot" },
    ]
  },
  {
    category: "Kataster / GURS",
    color: "#6366f1",
    items: [
      { label: "Orthophoto DOF050/025", color: "#f59e0b", style: "square" },
      { label: "LIDAR Hillshade", color: "#94a3b8", style: "gradient" },
      { label: "Topographic DTK50", color: "#10b981", style: "square" },
      { label: "TTN5/TTN10", color: "#06b6d4", style: "square" },
    ]
  },
  {
    category: "Jame (KatasterJam)",
    color: "#a855f7",
    items: [
      { label: "Jama (točka)", color: "#a855f7", style: "dot" },
      { label: "Kraška območja", color: "#7c3aed", style: "polygon" },
      { label: "Naravne vrednote", color: "#ec4899", style: "polygon" },
    ]
  },
  {
    category: "Raba tal / Kmetijstvo",
    color: "#84cc16",
    items: [
      { label: "Njive in vrtovi", color: "#fbbf24", style: "square" },
      { label: "Travniki", color: "#4ade80", style: "square" },
      { label: "Gozdovi", color: "#16a34a", style: "square" },
    ]
  },
  {
    category: "Vreme (OWM)",
    color: "#38bdf8",
    items: [
      { label: "Oblačnost", color: "#cbd5e1", style: "square" },
      { label: "Veter", color: "#7dd3fc", style: "square" },
      { label: "Temperatura", color: "#f97316", style: "square" },
    ]
  },
  {
    category: "Poti",
    color: "#f59e0b",
    items: [
      { label: "Kolesarske poti", color: "#22d3ee", style: "line" },
      { label: "Pohodniške poti", color: "#f97316", style: "line" },
      { label: "Železnica", color: "#94a3b8", style: "line" },
    ]
  }
];

function LegendSymbol({ style, color }) {
  if (style === "dot") return (
    <div className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0" style={{ backgroundColor: color }} />
  );
  if (style === "line") return (
    <div className="w-5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
  );
  if (style === "dash") return (
    <div className="w-5 shrink-0" style={{ height: "2px", backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 9px)` }} />
  );
  if (style === "polygon") return (
    <div className="w-4 h-3 rounded shrink-0 border border-white/20" style={{ backgroundColor: color + "55", borderColor: color }} />
  );
  if (style === "gradient") return (
    <div className="w-4 h-3 rounded shrink-0" style={{ background: `linear-gradient(135deg, #1e293b, ${color}, #f8fafc)` }} />
  );
  return (
    <div className="w-4 h-3 rounded shrink-0" style={{ backgroundColor: color }} />
  );
}

function LegendSection({ category, color, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors rounded-lg"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-slate-300 flex-1 text-left">{category}</span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2 space-y-1.5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <LegendSymbol style={item.style} color={item.color} />
                  <span className="text-[11px] text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LayerLegend({ isOpen, onClose, theme }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
          style={{
            backgroundColor: (theme?.panelBg || "#0f172a") + "f8",
            backdropFilter: "blur(20px)",
            width: 240,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200 tracking-wide">Legenda</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drawing tools legend */}
          <div className="px-3 pt-2 pb-1 border-b border-white/5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Risalna orodja</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full border-2 border-white/30 shrink-0" style={{ backgroundColor: "#10b981" }} />
                <span className="text-[11px] text-slate-400">Marker / Točka</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-0.5 rounded shrink-0" style={{ backgroundColor: "#10b981" }} />
                <span className="text-[11px] text-slate-400">Razdalja / Linija</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-3 rounded shrink-0 border" style={{ backgroundColor: "#10b98133", borderColor: "#10b981" }} />
                <span className="text-[11px] text-slate-400">Površina / Poligon</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-0.5 rounded shrink-0" style={{ backgroundColor: "#3b82f6" }} />
                <span className="text-[11px] text-slate-400">GPS Track</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-0.5 rounded shrink-0" style={{ backgroundColor: "#2563eb" }} />
                <span className="text-[11px] text-slate-400">Navigacijska pot</span>
              </div>
            </div>
          </div>

          {/* Layer legends */}
          <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1 px-3">Sloji</p>
            {LEGEND_ITEMS.map((section) => (
              <LegendSection key={section.category} {...section} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}