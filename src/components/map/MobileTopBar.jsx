import React, { useState } from "react";
import { Layers, Locate, LoaderCircle, Plus, Minus, Ruler, MapPin, Trash2, MousePointer2, Navigation, Settings, Route, WifiOff, Brain, TrendingUp, Box, X, RotateCcw, RotateCw, Mountain, Users, Camera } from "lucide-react";
import { useMap } from "react-leaflet";
import { createPortal } from "react-dom";
import SearchBar from "./SearchBar";
import MobileSettingsPanel, { useMobileButtonPrefs } from "./MobileSettingsPanel";
import { AnimatePresence, motion } from "framer-motion";
import NavigationPanel from "./NavigationPanel";
import OfflineManager from "./OfflineManager";
import { loadTheme } from "@/components/map/ThemeCustomizer";
import MeasurementDisplay from "@/components/map/MeasurementDisplay";

const TOOLS = [
  { id: "pointer", icon: MousePointer2, label: "Izberi" },
  { id: "distance", icon: Ruler, label: "Meri razdaljo" },
  { id: "marker", icon: MapPin, label: "Postavi oznako" },
  { id: "clear", icon: Trash2, label: "Počisti vse" },
];

function MobileTopBarInner({
  onTogglePanel, isPanelOpen, activeLayerCount,
  onLocate, activeTool, onToolChange, onClear,
  onLocationSelect, isGpsTracking, onGpsToggle,
  onShowTracks, gpsTrack, onLoadTrack,
  onRouteResult, isAIOpen, onAIToggle,
  isTrackAnalyzerOpen, onTrackAnalyzerToggle,
  measurements, mapCenter,
  onAddCustomLayer, onRemoveCustomLayer,
  activeSearchLayers, onSearchLayersChange,
  is3DOpen, on3DToggle,
  isLidarOpen, onLidarToggle,
  isCollabOpen, onCollabToggle,
  onAROpen,
}) {
  const map = useMap();
  const container = map.getContainer();
  const [locating, setLocating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
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

  const theme = loadTheme();
  const scale = prefs.buttonScale ?? 1.0;
  // Enforce minimum 44px touch target (iOS HIG)
  const btnPx = Math.max(Math.round(10 * scale), Math.round((44 - Math.round(20 * scale)) / 2));
  const iconPx = Math.round(20 * scale);
  const btnStyle = { padding: `${btnPx}px`, gap: `${Math.round(4 * scale)}px`, backgroundColor: theme.toolbarBg, color: theme.toolbarText, borderColor: "#e2e8f0" };
  const btnActiveStyle = { padding: `${btnPx}px`, gap: `${Math.round(4 * scale)}px`, backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText, borderColor: theme.buttonActiveBg };
  const iconStyle = { width: `${iconPx}px`, height: `${iconPx}px`, flexShrink: 0 };

  const btnBase = "rounded-xl backdrop-blur-xl border shadow-md transition-all duration-200 flex items-center justify-center";

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
      <button key="gps" onClick={onGpsToggle} style={isGpsTracking ? btnActiveStyle : btnStyle} className={btnBase}>
        <Navigation style={iconStyle} />
      </button>
    );
    if (id === "ruler") return (
      <button key="ruler" onClick={() => setShowRuler(p => !p)} style={showRuler ? btnActiveStyle : btnStyle} className={btnBase}>
        <Ruler style={iconStyle} />
      </button>
    );
    if (id === "offline") return (
      <button key="offline" onClick={() => setShowOffline(p => !p)} style={showOffline ? btnActiveStyle : btnStyle} className={btnBase}>
        <WifiOff style={iconStyle} />
      </button>
    );
    if (id === "nav") return (
      <button key="nav" onClick={() => setShowNav(p => !p)} style={showNav ? btnActiveStyle : btnStyle} className={btnBase}>
        <Route style={iconStyle} />
      </button>
    );
    if (id === "ai") return (
      <button key="ai" onClick={onAIToggle} style={isAIOpen ? btnActiveStyle : btnStyle} className={btnBase}>
        <Brain style={iconStyle} />
      </button>
    );
    if (id === "trackanalyzer") return (
      <button key="trackanalyzer" onClick={onTrackAnalyzerToggle} style={isTrackAnalyzerOpen ? btnActiveStyle : btnStyle} className={btnBase}>
        <TrendingUp style={iconStyle} />
      </button>
    );
    if (id === "view3d") return (
      <button key="view3d" onClick={on3DToggle} style={is3DOpen ? btnActiveStyle : btnStyle} className={btnBase}>
        <Box style={iconStyle} />
      </button>
    );
    if (id === "lidar") return (
      <button key="lidar" onClick={onLidarToggle} style={isLidarOpen ? btnActiveStyle : btnStyle} className={btnBase}>
        <Mountain style={iconStyle} />
      </button>
    );
    if (id === "collab") return (
      <button key="collab" onClick={onCollabToggle} style={isCollabOpen ? btnActiveStyle : btnStyle} className={btnBase}>
        <Users style={iconStyle} />
      </button>
    );
    if (id === "ar") return (
      <button key="ar" onClick={onAROpen} style={btnStyle} className={btnBase}>
        <Camera style={iconStyle} />
      </button>
    );
    return null;
  }).filter(Boolean);

  const searchAlwaysVisible = isVisible("search");

  const anyMenuOpen = showSettings || showOffline || showSearch;

  return createPortal(
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 950, pointerEvents: "none" }}>



      {/* Map interaction blocker — when any menu is open */}
      {anyMenuOpen && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 951, pointerEvents: "auto" }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setShowSettings(false);
            setShowNav(false);
            setShowOffline(false);
            setShowRuler(false);
            setShowSearch(false);
          }}
        />
      )}



      {/* Search bar — always visible if enabled, top center */}
      {searchAlwaysVisible && (
        <div style={{ pointerEvents: "auto" }} className="absolute top-3 left-3 right-14 z-[960]">
          <SearchBar
            onLocationSelect={(loc) => { onLocationSelect(loc); }}
            mapCenter={mapCenter}
            autoFocus={false}
            onAddCustomLayer={onAddCustomLayer}
            onRemoveCustomLayer={onRemoveCustomLayer}
            activeSearchLayers={activeSearchLayers}
            onSearchLayersChange={onSearchLayersChange}
          />
        </div>
      )}

      {/* Right column */}
      <div style={{ pointerEvents: "auto", gap: `${Math.round(8 * scale)}px`, paddingTop: `calc(env(safe-area-inset-top) + 12px)`, paddingRight: `calc(env(safe-area-inset-right) + 8px)`, paddingLeft: "8px", paddingBottom: `calc(env(safe-area-inset-bottom) + 8px)` }} className="absolute top-0 right-0 bottom-0 flex flex-col items-center overflow-y-auto">
        {/* Settings button — always on top */}
        <button onClick={() => setShowSettings(p => !p)} style={showSettings ? btnActiveStyle : btnStyle} className={btnBase}>
          <Settings style={iconStyle} />
        </button>

        {/* Layers button — togglable */}
        {isVisible("layers") && (
          <button onClick={onTogglePanel} style={isPanelOpen ? btnActiveStyle : btnStyle} className={`${btnBase} relative`}>
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
            <button onClick={() => map.zoomIn()} style={btnStyle} className="transition-all duration-200 flex items-center justify-center border-b border-slate-200/30">
              <Plus style={iconStyle} />
            </button>
            <button onClick={() => map.zoomOut()} style={btnStyle} className="transition-all duration-200 flex items-center justify-center">
              <Minus style={iconStyle} />
            </button>
          </div>
        )}

        {/* Togglable buttons in user-defined order (skip search since it's in top bar) */}
        {optionalButtons}

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
              mapCenter={mapCenter}
              autoFocus
              onAddCustomLayer={onAddCustomLayer}
              onRemoveCustomLayer={onRemoveCustomLayer}
              activeSearchLayers={activeSearchLayers}
              onSearchLayersChange={onSearchLayersChange}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 970, pointerEvents: "none" }}>
          <MobileSettingsPanel
            onClose={() => setShowSettings(false)}
            prefs={prefs}
            setPrefs={setPrefs}
            gpsTrack={gpsTrack}
            onLoadTrack={onLoadTrack}
          />
        </div>
      )}

      {/* Navigation Panel for mobile — positioned like settings panel */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: "auto" }}
            className="absolute top-3 right-14 z-[970] w-72"
          >
            <NavigationPanel
              onRouteResult={onRouteResult || (() => {})}
              isOpen={true}
              onToggle={() => setShowNav(p => !p)}
              onClose={() => setShowNav(false)}
              inline
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Manager for mobile — same position style as settings panel */}
      <AnimatePresence>
        {showOffline && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ pointerEvents: "auto" }}
            className="absolute top-3 right-14 z-[970] w-72"
          >
            <OfflineManager onClose={() => setShowOffline(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Measurement + tools swipe-up panel — bottom sheet, shown when ruler is active */}
      <AnimatePresence>
        {showRuler && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ pointerEvents: "auto", backgroundColor: "rgba(15,23,42,0.96)", backdropFilter: "blur(20px)" }}
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-white/10 shadow-2xl z-[910]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-white/20" />
            </div>

            {/* Tool buttons row */}
            <div className="flex items-center justify-center gap-3 px-5 py-3 border-b border-white/10">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      if (tool.id === "clear") { onClear(); }
                      else onToolChange(tool.id === activeTool ? "pointer" : tool.id);
                    }}
                    style={isActive ? btnActiveStyle : tool.id === "clear" ? { ...btnStyle, color: "#f87171", borderColor: "#fecaca40" } : btnStyle}
                    className={`${btnBase} flex-col gap-1 px-4 py-2`}
                  >
                    <Icon style={iconStyle} className="shrink-0" />
                    <span className="text-[9px] opacity-70">{tool.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Measurement display */}
            {measurements && (
              <div className="px-5 py-4">
                <MeasurementDisplay
                  type={measurements.type}
                  valueMeters={measurements.meters}
                  areaSqm={measurements.areaSqm}
                  points={measurements.points}
                  style="mobile"
                />
              </div>
            )}
            {!measurements && (
              <div className="px-5 py-4 text-center text-slate-500 text-xs">
                Tapni na karto za začetek merjenja
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    container
  );
}

export default MobileTopBarInner;