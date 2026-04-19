import React, { useState } from "react";
import { Layers, Locate, LoaderCircle, Plus, Minus, Ruler, Search, Pentagon, MapPin, Trash2, MousePointer2, Navigation, Settings, Route } from "lucide-react";
import { useMap } from "react-leaflet";
import { createPortal } from "react-dom";
import SearchBar from "./SearchBar";
import MobileSettingsPanel, { useMobileButtonPrefs } from "./MobileSettingsPanel";
import { AnimatePresence, motion } from "framer-motion";
import NavigationPanel from "./NavigationPanel";

const TOOLS = [
  { id: "pointer", icon: MousePointer2, label: "Select" },
  { id: "distance", icon: Ruler, label: "Distance" },
  { id: "area", icon: Pentagon, label: "Area" },
  { id: "marker", icon: MapPin, label: "Marker" },
  { id: "clear", icon: Trash2, label: "Clear" },
];

function MobileTopBarInner({
  onTogglePanel, isPanelOpen, activeLayerCount,
  onLocate, activeTool, onToolChange, onClear,
  onLocationSelect, isGpsTracking, onGpsToggle,
  onShowTracks, gpsTrack, onLoadTrack,
  onRouteResult,
}) {
  const map = useMap();
  const container = map.getContainer();
  const [locating, setLocating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNav, setShowNav] = useState(false);
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

  const scale = prefs.buttonScale ?? 1.0;
  const btnPx = Math.round(10 * scale);
  const iconPx = Math.round(20 * scale);
  const btnStyle = { padding: `${btnPx}px`, gap: `${Math.round(4 * scale)}px` };
  const iconStyle = { width: `${iconPx}px`, height: `${iconPx}px`, flexShrink: 0 };

  const btnBase = "rounded-xl bg-white/95 backdrop-blur-xl text-slate-700 border border-slate-200/50 shadow-md transition-all duration-200 flex items-center justify-center";
  const btnActive = "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/30";

  const isVisible = (id) => !prefs.hidden.includes(id);

  const optionalButtons = prefs.order.map((id) => {
    if (!isVisible(id)) return null;
    // layers and zoom are rendered separately
    if (id === "layers" || id === "zoom") return null;
    // search is shown as persistent top bar when enabled
    if (id === "search") return null;
    if (id === "locate") return (
      <button key="locate" onClick={handleLocate} disabled={locating} style={btnStyle} className={`${btnBase} disabled:opacity-60`}>
        {locating ? <LoaderCircle style={iconStyle} className="animate-spin" /> : <Locate style={iconStyle} />}
      </button>
    );
    if (id === "gps") return (
      <button key="gps" onClick={onGpsToggle} style={btnStyle} className={`${btnBase} ${isGpsTracking ? btnActive : ''}`}>
        <Navigation style={iconStyle} />
      </button>
    );
    if (id === "ruler") return (
      <button key="ruler" onClick={() => setShowRuler(p => !p)} style={btnStyle} className={`${btnBase} ${showRuler ? btnActive : ''}`}>
        <Ruler style={iconStyle} />
      </button>
    );
    return null;
  }).filter(Boolean);

  const searchAlwaysVisible = isVisible("search");

  return createPortal(
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 950, pointerEvents: "none" }}>



      {/* Search bar — always visible if enabled, top center */}
      {searchAlwaysVisible && (
        <div style={{ pointerEvents: "auto" }} className="absolute top-3 left-3 right-14 z-[960]">
          <SearchBar
            onLocationSelect={(loc) => { onLocationSelect(loc); }}
            autoFocus={false}
          />
        </div>
      )}

      {/* Right column */}
      <div style={{ pointerEvents: "auto", gap: `${Math.round(8 * scale)}px`, paddingTop: "12px", paddingRight: "8px", paddingLeft: "8px" }} className="absolute top-0 right-0 bottom-0 flex flex-col items-center overflow-y-auto">
        {/* Settings button — always on top */}
        <button onClick={() => setShowSettings(p => !p)} style={btnStyle} className={`${btnBase} ${showSettings ? btnActive : ''}`}>
          <Settings style={iconStyle} />
        </button>

        {/* Layers button — togglable */}
        {isVisible("layers") && (
          <button onClick={onTogglePanel} style={btnStyle} className={`${btnBase} relative ${isPanelOpen ? btnActive : ''}`}>
            <Layers style={iconStyle} />
            {activeLayerCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeLayerCount}
              </span>
            )}
          </button>
        )}

        {/* Zoom controls — single combined button */}
        {isVisible("zoom") && (
          <div className="flex flex-col rounded-xl overflow-hidden border border-slate-200/50 shadow-md">
            <button onClick={() => map.zoomIn()} style={btnStyle} className="bg-white/95 backdrop-blur-xl text-slate-700 transition-all duration-200 flex items-center justify-center hover:bg-white border-b border-slate-200/50">
              <Plus style={iconStyle} />
            </button>
            <button onClick={() => map.zoomOut()} style={btnStyle} className="bg-white/95 backdrop-blur-xl text-slate-700 transition-all duration-200 flex items-center justify-center hover:bg-white">
              <Minus style={iconStyle} />
            </button>
          </div>
        )}

        {/* Togglable buttons in user-defined order (skip search since it's in top bar) */}
        {optionalButtons}

        {/* Route / Navigation button */}
        <button
          onClick={() => setShowNav(p => !p)}
          style={btnStyle}
          className={`${btnBase} ${showNav ? btnActive : ''}`}
          title="Route Planner"
        >
          <Route style={iconStyle} />
        </button>

        <div className="flex-1" />
      </div>

      {/* Search bar overlay (when search button toggled manually, not from prefs) */}
      <AnimatePresence>
        {!searchAlwaysVisible && showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ pointerEvents: "auto" }}
            className="absolute top-3 left-3 right-14 z-[960]"
          >
            <SearchBar
              onLocationSelect={(loc) => { onLocationSelect(loc); setShowSearch(false); }}
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      {showSettings && (
        <MobileSettingsPanel
          onClose={() => setShowSettings(false)}
          prefs={prefs}
          setPrefs={setPrefs}
          gpsTrack={gpsTrack}
          onLoadTrack={onLoadTrack}
        />
      )}

      {/* Navigation Panel for mobile */}
      <div style={{ pointerEvents: "auto" }} className="absolute bottom-4 right-14">
        <NavigationPanel
          onRouteResult={onRouteResult || (() => {})}
          isOpen={showNav}
          onToggle={() => setShowNav(p => !p)}
          onClose={() => setShowNav(false)}
        />
      </div>

      {/* Ruler tool strip */}
      <AnimatePresence>
        {showRuler && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ pointerEvents: "auto" }}
            className="absolute bottom-8 right-14 flex flex-col gap-2"
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
                  className={`${btnBase} ${
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
    </div>,
    container
  );
}

export default MobileTopBarInner;