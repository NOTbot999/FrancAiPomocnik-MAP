import React, { useState } from "react";
import { Layers, Locate, LoaderCircle, Plus, Minus, Ruler, Search, X, Pentagon, MapPin, Trash2, MousePointer2, Navigation } from "lucide-react";
import { useMap } from "react-leaflet";
import { createPortal } from "react-dom";
import SearchBar from "./SearchBar";
import { AnimatePresence, motion } from "framer-motion";

const TOOLS = [
  { id: "pointer", icon: MousePointer2, label: "Select" },
  { id: "distance", icon: Ruler, label: "Distance" },
  { id: "area", icon: Pentagon, label: "Area" },
  { id: "marker", icon: MapPin, label: "Marker" },
  { id: "clear", icon: Trash2, label: "Clear" },
];

function MobileTopBarInner({ onTogglePanel, isPanelOpen, activeLayerCount, onLocate, activeTool, onToolChange, onClear, onLocationSelect, isGpsTracking, onGpsToggle }) {
  const map = useMap();
  const container = map.getContainer();
  const [locating, setLocating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRuler, setShowRuler] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 15 });
      },
      () => setLocating(false)
    );
  };

  const btnBase = "p-2.5 rounded-xl bg-white/95 backdrop-blur-xl text-slate-700 border border-slate-200/50 shadow-md transition-all duration-200 flex items-center justify-center";
  const btnActive = "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/30";

  return createPortal(
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 950 }} className="pointer-events-none">
      {/* Top bar */}
      <div className="pointer-events-auto flex items-center gap-2 px-3 pt-3 pb-2 justify-end">
        {/* Search — expands when open */}
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1">
              <SearchBar
                onLocationSelect={(loc) => { onLocationSelect(loc); setShowSearch(false); }}
                autoFocus
              />
            </div>
            <button onClick={() => setShowSearch(false)} className={btnBase}>
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {/* Layers */}
            <button
              onClick={onTogglePanel}
              className={`${btnBase} relative ${isPanelOpen ? btnActive : ''}`}
            >
              <Layers className="w-5 h-5" />
              {activeLayerCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeLayerCount}
                </span>
              )}
            </button>

            {/* Search */}
            <button onClick={() => setShowSearch(true)} className={btnBase}>
              <Search className="w-5 h-5" />
            </button>

            {/* GPS locate */}
            <button onClick={handleLocate} disabled={locating} className={`${btnBase} disabled:opacity-60`}>
              {locating ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Locate className="w-5 h-5" />}
            </button>

            {/* GPS Track */}
            <button
              onClick={onGpsToggle}
              className={`${btnBase} ${isGpsTracking ? btnActive : ''}`}
            >
              <Navigation className="w-5 h-5" />
            </button>

            {/* Zoom in */}
            <button onClick={() => map.zoomIn()} className={btnBase}>
              <Plus className="w-5 h-5" />
            </button>

            {/* Zoom out */}
            <button onClick={() => map.zoomOut()} className={btnBase}>
              <Minus className="w-5 h-5" />
            </button>

            {/* Ruler toggle */}
            <button
              onClick={() => setShowRuler(p => !p)}
              className={`${btnBase} ${showRuler ? btnActive : ''}`}
            >
              <Ruler className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Ruler tool strip */}
      <AnimatePresence>
        {showRuler && !showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto flex items-center gap-2 px-3 pb-2 justify-end"
          >
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.id === "clear") { onClear(); setShowRuler(false); }
                    else onToolChange(tool.id === activeTool ? "pointer" : tool.id);
                  }}
                  className={`${btnBase} flex-1 gap-1.5 text-[11px] font-medium ${
                    isActive ? btnActive : tool.id === "clear" ? "text-red-400 border-red-200" : ""
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{tool.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    container
  );
}

export default MobileTopBarInner;