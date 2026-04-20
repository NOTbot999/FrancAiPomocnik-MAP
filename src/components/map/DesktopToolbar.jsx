import React, { useState, useRef, useCallback } from "react";
import {
  Layers, Locate, LoaderCircle, Ruler, Pentagon, MapPin, Trash2,
  MousePointer2, Navigation, Route, Sparkles, TrendingUp, X,
  Map, Settings, Eye, EyeOff, Save, FolderOpen,
  Loader2, Check, GripVertical
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

const BUTTON_DEFS = [
  { id: "layers",          icon: Layers,        label: "Toggle Layers",       color: "emerald" },
  { id: "locate",          icon: Locate,        label: "My Location",         color: "sky" },
  { id: "ruler",           icon: Ruler,         label: "Drawing Tools",       color: "violet" },
  { id: "save",            icon: Save,          label: "Save Drawings",       color: "emerald" },
  { id: "load",            icon: FolderOpen,    label: "Load Drawings",       color: "amber" },
  { id: "gps",             icon: Navigation,    label: "GPS Track",           color: "blue" },
  { id: "mytracks",        icon: Map,           label: "My GPS Tracks",       color: "teal" },
  { id: "nav",             icon: Route,         label: "Route Planner",       color: "emerald" },
  { id: "askmap",          icon: Sparkles,      label: "Ask the Map (AI)",    color: "emerald" },
  { id: "trackanalyzer",   icon: TrendingUp,    label: "Track Analyzer (AI)", color: "blue" },
];

const RULER_TOOLS = [
  { id: "pointer",  icon: MousePointer2, label: "Select" },
  { id: "distance", icon: Ruler,         label: "Measure Distance" },
  { id: "area",     icon: Pentagon,      label: "Measure Area" },
  { id: "marker",   icon: MapPin,        label: "Place Marker" },
  { id: "clear",    icon: Trash2,        label: "Clear All" },
];

const STORAGE_KEY = "desktopToolbarPos";

function loadPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: window.innerWidth - 72, y: window.innerHeight / 2 - 200 };
}

function savePos(pos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
}

function loadHidden() {
  try {
    const raw = localStorage.getItem("desktopToolbarHidden");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHidden(hidden) {
  localStorage.setItem("desktopToolbarHidden", JSON.stringify(hidden));
}

const activeColors = {
  emerald: "bg-emerald-500 text-white border-emerald-500 shadow-emerald-400/30",
  sky:     "bg-sky-500 text-white border-sky-500 shadow-sky-400/30",
  blue:    "bg-blue-500 text-white border-blue-500 shadow-blue-400/30",
  teal:    "bg-teal-500 text-white border-teal-500 shadow-teal-400/30",
  violet:  "bg-violet-500 text-white border-violet-500 shadow-violet-400/30",
  amber:   "bg-amber-500 text-white border-amber-500 shadow-amber-400/30",
  slate:   "bg-slate-700 text-white border-slate-700 shadow-slate-400/30",
};

export default function DesktopToolbar({
  isPanelOpen, onTogglePanel, activeLayerCount,
  activeTool, onToolChange, measurements, onClear,
  isGpsTracking, onGpsToggle,
  showMyTracks, onShowMyTracks,
  onLocate,
  isNavOpen, onNavToggle,
  isAskMapOpen, onAskMapToggle,
  isTrackAnalyzerOpen, onTrackAnalyzerToggle,
  drawings, gpsTrack, onLoadDrawings,
}) {
  const [pos, setPos] = useState(loadPos);
  const [hidden, setHidden] = useState(loadHidden);
  const [showSettings, setShowSettings] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [loadingDraw, setLoadingDraw] = useState(false);
  const [rulerOpen, setRulerOpen] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const toolbarRef = useRef(null);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = toolbarRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    movedRef.current = false;

    const onMove = (ev) => {
      const nx = ev.clientX - dragOffset.current.x;
      const ny = ev.clientY - dragOffset.current.y;
      movedRef.current = true;
      setPos({ x: nx, y: ny });
    };
    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (movedRef.current) {
        const nx = ev.clientX - dragOffset.current.x;
        const ny = ev.clientY - dragOffset.current.y;
        const finalPos = { x: nx, y: ny };
        setPos(finalPos);
        savePos(finalPos);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const toggleHidden = (id) => {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveHidden(next);
      return next;
    });
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); onLocate({ lat: p.coords.latitude, lng: p.coords.longitude, zoom: 15 }); },
      () => setLocating(false)
    );
  };

  const handleSave = async () => {
    const hasAnything = drawings && (drawings.markers?.length || drawings.lines?.length || drawings.polygons?.length || gpsTrack?.length);
    if (!hasAnything) return;
    setSaving(true);
    await base44.entities.MapDrawing.create({
      name: `Drawing ${new Date().toLocaleString()}`,
      markers: drawings.markers,
      lines: drawings.lines,
      polygons: drawings.polygons,
      gps_tracks: gpsTrack?.length > 0 ? [gpsTrack] : [],
    });
    base44.analytics.track({ eventName: "drawing_saved", properties: { markers: drawings.markers?.length || 0, lines: drawings.lines?.length || 0, polygons: drawings.polygons?.length || 0, gps_points: gpsTrack?.length || 0 } });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  const handleLoad = async () => {
    setLoadingDraw(true);
    const records = await base44.entities.MapDrawing.list("-created_date", 20);
    setLoadingDraw(false);
    if (records.length === 0) { alert("No saved drawings found."); return; }
    const merged = { markers: [], lines: [], polygons: [], gps_tracks: [] };
    records.forEach(r => {
      if (r.markers) merged.markers.push(...r.markers);
      if (r.lines) merged.lines.push(...r.lines);
      if (r.polygons) merged.polygons.push(...r.polygons);
      if (r.gps_tracks) merged.gps_tracks.push(...r.gps_tracks);
    });
    if (onLoadDrawings) onLoadDrawings(merged);
  };

  const isActive = (id) => {
    if (id === "layers")        return isPanelOpen;
    if (id === "gps")           return isGpsTracking;
    if (id === "mytracks")      return showMyTracks;
    if (id === "nav")           return isNavOpen;
    if (id === "askmap")        return isAskMapOpen;
    if (id === "trackanalyzer") return isTrackAnalyzerOpen;
    if (id === "ruler")         return rulerOpen || ["distance","area","marker"].includes(activeTool);
    if (id === "save")          return savedOk;
    return false;
  };

  const handleClick = (id) => {
    if (id === "layers")        return onTogglePanel();
    if (id === "locate")        return handleLocate();
    if (id === "gps")           { if (!isGpsTracking) base44.analytics.track({ eventName: "gps_tracking_started" }); return onGpsToggle(); }
    if (id === "mytracks")      return onShowMyTracks();
    if (id === "nav")           { if (!isNavOpen) base44.analytics.track({ eventName: "route_planner_opened" }); return onNavToggle(); }
    if (id === "askmap")        { if (!isAskMapOpen) base44.analytics.track({ eventName: "ask_map_opened" }); return onAskMapToggle(); }
    if (id === "trackanalyzer") { if (!isTrackAnalyzerOpen) base44.analytics.track({ eventName: "track_analyzer_opened" }); return onTrackAnalyzerToggle(); }
    if (id === "ruler")         return setRulerOpen(p => !p);
    if (id === "save")          return handleSave();
    if (id === "load")          return handleLoad();
  };

  const hasAnything = drawings && (drawings.markers?.length || drawings.lines?.length || drawings.polygons?.length || gpsTrack?.length);

  const visibleButtons = BUTTON_DEFS.filter(b => !hidden.includes(b.id));

  return (
    <>
      {/* Main draggable toolbar cluster */}
      <div
        ref={toolbarRef}
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 950, userSelect: "none" }}
        className="flex flex-col items-center gap-1"
      >
        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="w-8 h-5 flex items-center justify-center cursor-grab text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/80 transition-all"
          title="Drag to move"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Cluster pill */}
        <div className="flex flex-col items-center gap-1 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/60 p-1.5">
          <TooltipProvider delayDuration={400}>
            {visibleButtons.map((btn) => {
              let Icon = btn.id === "locate" && locating ? LoaderCircle
                       : btn.id === "save" && saving    ? Loader2
                       : btn.id === "save" && savedOk   ? Check
                       : btn.id === "load" && loadingDraw ? Loader2
                       : btn.icon;
              const active = isActive(btn.id);
              const disabled = btn.id === "save" && !hasAnything && !savedOk;

              return (
                <Tooltip key={btn.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => !disabled && handleClick(btn.id)}
                      disabled={disabled}
                      className={`relative w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-150
                        ${active
                          ? `${activeColors[btn.color] || activeColors.emerald} shadow-md`
                          : "bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50 hover:text-slate-800"
                        }
                        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${btn.id === "locate" && locating ? "animate-spin" : ""} ${(btn.id === "save" && saving) || (btn.id === "load" && loadingDraw) ? "animate-spin" : ""}`} />
                      {btn.id === "layers" && activeLayerCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center pointer-events-none">
                          {activeLayerCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="z-[9999]" sideOffset={6}>
                    <p className="text-xs font-medium">{btn.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>

          {/* Divider + Settings button */}
          <div className="w-6 h-px bg-slate-200 my-0.5" />
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowSettings(p => !p)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-150
                    ${showSettings
                      ? "bg-slate-800 text-white border-transparent"
                      : "bg-white text-slate-400 border-slate-200/60 hover:bg-slate-50 hover:text-slate-700"
                    }
                  `}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="z-[9999]" sideOffset={6}>
                <p className="text-xs font-medium">Customize Toolbar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Ruler sub-tools popup — anchored next to toolbar */}
      <AnimatePresence>
        {rulerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 6 }}
            style={{
              position: "fixed",
              left: pos.x - 148,
              top: pos.y + 24,
              zIndex: 960,
            }}
            className="flex flex-col gap-1 bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-2"
          >
            <p className="text-[10px] font-semibold text-slate-400 uppercase px-2 pt-1 pb-0.5">Drawing Tools</p>
            <TooltipProvider delayDuration={300}>
              {RULER_TOOLS.map(tool => {
                const Icon = tool.icon;
                const isToolActive = activeTool === tool.id;
                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (tool.id === "clear") { onClear(); setRulerOpen(false); }
                          else onToolChange(activeTool === tool.id ? "pointer" : tool.id);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                          isToolActive
                            ? "bg-violet-500 text-white"
                            : tool.id === "clear"
                            ? "text-red-400 hover:bg-red-50"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs font-medium">{tool.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="z-[9999]">
                      <p className="text-xs">{tool.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Measurement display */}
      <AnimatePresence>
        {measurements && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 960 }}
            className="bg-slate-900/90 backdrop-blur-xl text-white px-4 py-2 rounded-xl shadow-xl pointer-events-none"
          >
            <p className="text-xs font-medium">{measurements}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 6 }}
            style={{ position: "fixed", left: pos.x - 216, top: pos.y + 24, zIndex: 970 }}
            className="bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-4 w-52 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-800">Toolbar Buttons</span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mb-3">Drag the grip to move the toolbar. Toggle visibility below.</p>
            <div className="space-y-1">
              {BUTTON_DEFS.map(btn => {
                const Icon = btn.icon;
                const isHidden = hidden.includes(btn.id);
                return (
                  <button
                    key={btn.id}
                    onClick={() => toggleHidden(btn.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-sm ${
                      isHidden ? "bg-slate-50 text-slate-400" : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left text-xs">{btn.label}</span>
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                const fresh = { x: window.innerWidth - 72, y: window.innerHeight / 2 - 200 };
                setPos(fresh);
                savePos(fresh);
                setHidden([]);
                saveHidden([]);
              }}
              className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 py-1 border-t border-slate-100 pt-2"
            >
              Reset toolbar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}