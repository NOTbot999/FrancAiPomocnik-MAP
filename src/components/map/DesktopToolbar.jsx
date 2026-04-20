import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Layers, Locate, LoaderCircle, Ruler, Pentagon, MapPin, Trash2,
  MousePointer2, Navigation, Route, Sparkles, TrendingUp, X,
  Map, Settings, GripVertical, Eye, EyeOff, ChevronDown
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

const BUTTON_DEFS = [
  { id: "layers",          icon: Layers,        label: "Toggle Layers",       group: "map" },
  { id: "locate",          icon: Locate,        label: "My Location",         group: "map" },
  { id: "pointer",         icon: MousePointer2, label: "Select",              group: "draw" },
  { id: "distance",        icon: Ruler,         label: "Measure Distance",    group: "draw" },
  { id: "area",            icon: Pentagon,      label: "Measure Area",        group: "draw" },
  { id: "marker",          icon: MapPin,        label: "Place Marker",        group: "draw" },
  { id: "clear",           icon: Trash2,        label: "Clear All",           group: "draw" },
  { id: "gps",             icon: Navigation,    label: "GPS Track",           group: "track" },
  { id: "mytracks",        icon: Map,           label: "My GPS Tracks",       group: "track" },
  { id: "nav",             icon: Route,         label: "Route Planner",       group: "nav" },
  { id: "askmap",          icon: Sparkles,      label: "Ask the Map (AI)",    group: "ai" },
  { id: "trackanalyzer",   icon: TrendingUp,    label: "Track Analyzer (AI)", group: "ai" },
];

const DEFAULT_PREFS = {
  hidden: [],
  position: { x: null, y: null }, // null = default bottom-right
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem("desktopToolbarPrefs");
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

function savePrefs(prefs) {
  localStorage.setItem("desktopToolbarPrefs", JSON.stringify(prefs));
}

export default function DesktopToolbar({
  // layer panel
  isPanelOpen, onTogglePanel,
  activeLayerCount,
  // drawing
  activeTool, onToolChange, measurements, onClear,
  // gps
  isGpsTracking, onGpsToggle,
  // tracks
  showMyTracks, onShowMyTracks,
  // locate
  onLocate,
  // navigation
  isNavOpen, onNavToggle,
  // AI panels
  isAskMapOpen, onAskMapToggle,
  isTrackAnalyzerOpen, onTrackAnalyzerToggle,
}) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showSettings, setShowSettings] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState(() => {
    const saved = loadPrefs().position;
    if (saved?.x !== null && saved?.y !== null) return saved;
    return null; // null = CSS default (bottom-right)
  });

  const dragRef = useRef(null);
  const containerRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const updatePrefs = useCallback((updater) => {
    setPrefs(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      savePrefs(next);
      return next;
    });
  }, []);

  const toggleHidden = (id) => {
    updatePrefs(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id)
        ? prev.hidden.filter(x => x !== id)
        : [...prev.hidden, id],
    }));
  };

  const isHidden = (id) => prefs.hidden.includes(id);

  // Dragging
  const onMouseDown = (e) => {
    if (!containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      setPos({ x, y });
    };
    const onUp = () => {
      setIsDragging(false);
      setPos(prev => {
        if (prev) {
          updatePrefs(p => ({ ...p, position: prev }));
        }
        return prev;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, updatePrefs]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); onLocate({ lat: p.coords.latitude, lng: p.coords.longitude, zoom: 15 }); },
      () => setLocating(false)
    );
  };

  const handleButtonClick = (id) => {
    if (id === "layers")        return onTogglePanel();
    if (id === "locate")        return handleLocate();
    if (id === "clear")         return onClear();
    if (id === "gps")           return onGpsToggle();
    if (id === "mytracks")      return onShowMyTracks();
    if (id === "nav")           return onNavToggle();
    if (id === "askmap")        return onAskMapToggle();
    if (id === "trackanalyzer") return onTrackAnalyzerToggle();
    // draw tools
    onToolChange(activeTool === id ? "pointer" : id);
  };

  const isActive = (id) => {
    if (id === "layers")        return isPanelOpen;
    if (id === "gps")           return isGpsTracking;
    if (id === "mytracks")      return showMyTracks;
    if (id === "nav")           return isNavOpen;
    if (id === "askmap")        return isAskMapOpen;
    if (id === "trackanalyzer") return isTrackAnalyzerOpen;
    if (["pointer","distance","area","marker"].includes(id)) return activeTool === id;
    return false;
  };

  const getStyle = (id) => {
    if (id === "clear") return "text-red-400 hover:bg-red-50 hover:text-red-500";
    if (id === "askmap" && isActive(id)) return "bg-emerald-500 text-white shadow-emerald-500/30";
    if (id === "trackanalyzer" && isActive(id)) return "bg-blue-500 text-white shadow-blue-500/30";
    if (id === "gps" && isActive(id)) return "bg-blue-500 text-white shadow-blue-500/30";
    if (isActive(id)) return "bg-emerald-500 text-white shadow-emerald-500/30";
    return "text-slate-600 hover:bg-slate-100 hover:text-slate-800";
  };

  const positionStyle = pos
    ? { position: "fixed", left: pos.x, top: pos.y, bottom: "auto", right: "auto" }
    : { position: "fixed", right: 16, bottom: 32 };

  const visibleButtons = BUTTON_DEFS.filter(b => !isHidden(b.id));

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        style={{ ...positionStyle, zIndex: 950, userSelect: "none" }}
        className="flex flex-col items-end gap-2"
      >
        {/* Main toolbar card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 p-2 flex flex-col gap-1">
          {/* Drag handle */}
          <div
            ref={dragRef}
            onMouseDown={onMouseDown}
            className="flex items-center justify-center py-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition"
            title="Drag to move toolbar"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Buttons */}
          {visibleButtons.map((btn) => {
            const Icon = btn.icon;
            const active = isActive(btn.id);
            return (
              <Tooltip key={btn.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleButtonClick(btn.id)}
                    disabled={btn.id === "locate" && locating}
                    className={`p-2.5 rounded-xl transition-all duration-200 shadow-sm border ${
                      active
                        ? `${getStyle(btn.id)} border-transparent shadow-md`
                        : `bg-white/80 border-slate-100 ${getStyle(btn.id)}`
                    }`}
                  >
                    {btn.id === "locate" && locating
                      ? <LoaderCircle className="w-5 h-5 animate-spin" />
                      : <Icon className="w-5 h-5" />
                    }
                    {btn.id === "layers" && activeLayerCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {activeLayerCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="z-[9999]">
                  <p className="text-xs font-medium">{btn.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Divider + Settings button */}
          <div className="h-px bg-slate-100 mx-1 my-0.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowSettings(p => !p)}
                className={`p-2.5 rounded-xl transition-all duration-200 border ${
                  showSettings
                    ? "bg-slate-800 text-white border-transparent"
                    : "bg-white/80 border-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="z-[9999]">
              <p className="text-xs font-medium">Customize Toolbar</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Measurement display */}
        <AnimatePresence>
          {measurements && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="bg-slate-900/90 backdrop-blur-xl text-white px-3.5 py-2 rounded-lg shadow-xl"
            >
              <p className="text-xs font-medium">{measurements}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 10 }}
              className="bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-4 w-56"
              style={{ position: "absolute", right: "calc(100% + 8px)", bottom: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-800">Toolbar Buttons</span>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {BUTTON_DEFS.map(btn => {
                  const Icon = btn.icon;
                  const hidden = isHidden(btn.id);
                  return (
                    <button
                      key={btn.id}
                      onClick={() => toggleHidden(btn.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm ${
                        hidden
                          ? "bg-slate-50 text-slate-400"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{btn.label}</span>
                      {hidden
                        ? <EyeOff className="w-3.5 h-3.5" />
                        : <Eye className="w-3.5 h-3.5" />
                      }
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  const resetPrefs = { ...DEFAULT_PREFS };
                  setPrefs(resetPrefs);
                  setPos(null);
                  savePrefs(resetPrefs);
                }}
                className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 py-1"
              >
                Reset to defaults
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}