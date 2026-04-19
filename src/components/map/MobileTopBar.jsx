import React, { useState } from "react";
import { Layers, Locate, LoaderCircle, Plus, Minus, Ruler, Search, X, Pentagon, MapPin, Trash2, MousePointer2, Navigation, EyeOff, Eye, Route, Settings } from "lucide-react";
import { useMap } from "react-leaflet";
import { createPortal } from "react-dom";
import SearchBar from "./SearchBar";
import MobileSettingsPanel, { useMobileButtonPrefs } from "./MobileSettingsPanel";
import { AnimatePresence, motion } from "framer-motion";

const TOOLS = [
  { id: "pointer", icon: MousePointer2, label: "Select" },
  { id: "distance", icon: Ruler, label: "Distance" },
  { id: "area", icon: Pentagon, label: "Area" },
  { id: "marker", icon: MapPin, label: "Marker" },
  { id: "clear", icon: Trash2, label: "Clear" },
];

function MobileTopBarInner({ onTogglePanel, isPanelOpen, activeLayerCount, onLocate, activeTool, onToolChange, onClear, onLocationSelect, isGpsTracking, onGpsToggle, onShowTracks }) {
  const map = useMap();
  const container = map.getContainer();
  const [locating, setLocating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useMobileButtonPrefs();

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

  const isVisible = (id) => !prefs.hidden.includes(id);

  // Ordered optional buttons
  const optionalButtons = prefs.order.map((id) => {
    if (!isVisible(id)) return null;
    if (id === "search") return (
      <button key="search" onClick={() => setShowSearch(true)} className={btnBase}>
        <Search className="w-5 h-5" />
      </button>
    );
    if (id === "locate") return (
      <button key="locate" onClick={handleLocate} disabled={locating} className={`${btnBase} disabled:opacity-60`}>
        {locating ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Locate className="w-5 h-5" />}
      </button>
    );
    if (id === "gps") return (
      <button key="gps" onClick={onGpsToggle} className={`${btnBase} ${isGpsTracking ? btnActive : ''}`}>
        <Navigation className="w-5 h-5" />
      </button>
    );
    if (id === "tracks") return (
      <button key="tracks" onClick={onShowTracks} className={btnBase}>
        <Route className="w-5 h-5" />
      </button>
    );
    if (id === "ruler") return (
      <button key="ruler" onClick={() => setShowRuler(p => !p)} className={`${btnBase} ${showRuler ? btnActive : ''}`}>
        <Ruler className="w-5 h-5" />
      </button>
    );
    return null;
  }).filter(Boolean);

  return createPortal(
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 950, pointerEvents: "none" }}>

      {/* Hide/Show toggle — always visible */}
      <button
        onClick={() => { setUiHidden(p => !p); setShowSearch(false); setShowRuler(false); setShowSettings(false); }}
        style={{ pointerEvents: "auto" }}
        className="absolute top-3 left-3 p-2.5 rounded-xl bg-white/95 backdrop-blur-xl text-slate-700 border border-slate-200/50 shadow-md"
      >
        {uiHidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
      </button>

      {/* Right column — hidden when uiHidden */}
      {!uiHidden && (
        <div style={{ pointerEvents: "auto" }} className="absolute top-0 right-0 bottom-0 flex flex-col items-center gap-2 px-2 pt-3">
          {showSearch ? (
            <button onClick={() => setShowSearch(false)} className={btnBase}>
              <X className="w-5 h-5" />
            </button>
          ) : (
            <>
              {/* Always-visible: Layers */}
              <button onClick={onTogglePanel} className={`${btnBase} relative ${isPanelOpen ? btnActive : ''}`}>
                <Layers className="w-5 h-5" />
                {activeLayerCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {activeLayerCount}
                  </span>
                )}
              </button>

              {/* Settings button */}
              <button onClick={() => setShowSettings(p => !p)} className={`${btnBase} ${showSettings ? btnActive : ''}`}>
                <Settings className="w-5 h-5" />
              </button>

              {/* Optional buttons (user-controlled order & visibility) */}
              {optionalButtons}

              {/* Always-visible: Zoom */}
              <button onClick={() => map.zoomIn()} className={btnBase}>
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={() => map.zoomOut()} className={btnBase}>
                <Minus className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Settings panel */}
      {!uiHidden && showSettings && (
        <MobileSettingsPanel
          onClose={() => setShowSettings(false)}
          prefs={prefs}
          setPrefs={setPrefs}
        />
      )}

      {/* Search bar overlay */}
      {!uiHidden && (
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ pointerEvents: "auto", position: "absolute", top: 12, left: 56, right: 56, zIndex: 960 }}
            >
              <SearchBar
                onLocationSelect={(loc) => { onLocationSelect(loc); setShowSearch(false); }}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Ruler tool strip */}
      {!uiHidden && (
        <AnimatePresence>
          {showRuler && !showSearch && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ pointerEvents: "auto" }}
              className="absolute bottom-8 right-14 flex flex-col gap-2 mr-12"
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
                    className={`${btnBase} gap-1.5 text-[11px] font-medium ${
                      isActive ? btnActive : tool.id === "clear" ? "text-red-400 border-red-200" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>,
    container
  );
}

export default MobileTopBarInner;