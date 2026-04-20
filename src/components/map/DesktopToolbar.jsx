import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Layers, Locate, LoaderCircle, Ruler, Pentagon, MapPin, Trash2,
  MousePointer2, Navigation, Route, Sparkles, TrendingUp, X,
  Map, Settings, GripVertical, Eye, EyeOff, Save, FolderOpen,
  Loader2, Check, Plus, Minus, ChevronRight, ChevronLeft
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

// Each button is a draggable "chip" with its own position
const BUTTON_DEFS = [
  { id: "layers",          icon: Layers,        label: "Toggle Layers",       color: "emerald" },
  { id: "locate",          icon: Locate,        label: "My Location",         color: "sky" },
  { id: "zoomin",          icon: Plus,          label: "Zoom In",             color: "slate" },
  { id: "zoomout",         icon: Minus,         label: "Zoom Out",            color: "slate" },
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

const DEFAULT_POSITIONS = {};
// Default stacked column at bottom-right, each button offset vertically
BUTTON_DEFS.forEach((btn, i) => {
  DEFAULT_POSITIONS[btn.id] = { x: window.innerWidth - 56, y: window.innerHeight - 56 - i * 46 };
});

function loadButtonPrefs() {
  try {
    const raw = localStorage.getItem("desktopBtnPrefs2");
    if (raw) {
      const saved = JSON.parse(raw);
      // merge any new buttons
      const merged = { positions: { ...DEFAULT_POSITIONS, ...saved.positions }, hidden: saved.hidden || [] };
      return merged;
    }
  } catch {}
  return { positions: { ...DEFAULT_POSITIONS }, hidden: [] };
}

function saveButtonPrefs(prefs) {
  localStorage.setItem("desktopBtnPrefs2", JSON.stringify(prefs));
}

// A single draggable button chip
function DraggableBtn({ id, icon: Icon, label, color, pos, onPosChange, onPosCommit, onClick, active, disabled, children, badge }) {
  const ref = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = ref.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    draggingRef.current = true;
    movedRef.current = false;

    const onMove = (ev) => {
      const nx = ev.clientX - dragOffset.current.x;
      const ny = ev.clientY - dragOffset.current.y;
      movedRef.current = true;
      onPosChange({ x: nx, y: ny });
    };
    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      draggingRef.current = false;
      if (!movedRef.current) {
        onClick();
      } else {
        const nx = ev.clientX - dragOffset.current.x;
        const ny = ev.clientY - dragOffset.current.y;
        onPosCommit({ x: nx, y: ny });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const activeColors = {
    emerald: "bg-emerald-500 text-white shadow-emerald-400/40",
    sky:     "bg-sky-500 text-white shadow-sky-400/40",
    blue:    "bg-blue-500 text-white shadow-blue-400/40",
    teal:    "bg-teal-500 text-white shadow-teal-400/40",
    violet:  "bg-violet-500 text-white shadow-violet-400/40",
    amber:   "bg-amber-500 text-white shadow-amber-400/40",
    slate:   "bg-slate-700 text-white shadow-slate-400/40",
  };

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            onMouseDown={onMouseDown}
            style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 950, cursor: "grab", userSelect: "none" }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border transition-all duration-200 relative
              ${active
                ? `${activeColors[color] || activeColors.emerald} border-transparent`
                : "bg-white/95 backdrop-blur-xl text-slate-700 border-slate-200/60 hover:bg-white hover:shadow-xl"
              }
              ${disabled ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {badge != null && badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center pointer-events-none">
                {badge}
              </span>
            )}
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="z-[9999]" sideOffset={6}>
          <p className="text-xs font-medium">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
  mapRef,
}) {
  const [prefs, setPrefs] = useState(loadButtonPrefs);
  const [showSettings, setShowSettings] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [loadingDraw, setLoadingDraw] = useState(false);
  const [rulerOpen, setRulerOpen] = useState(false);

  const updatePos = useCallback((id, pos) => {
    setPrefs(prev => ({ ...prev, positions: { ...prev.positions, [id]: pos } }));
  }, []);

  const commitPos = useCallback((id, pos) => {
    setPrefs(prev => {
      const next = { ...prev, positions: { ...prev.positions, [id]: pos } };
      saveButtonPrefs(next);
      return next;
    });
  }, []);

  const toggleHidden = (id) => {
    setPrefs(prev => {
      const hidden = prev.hidden.includes(id)
        ? prev.hidden.filter(x => x !== id)
        : [...prev.hidden, id];
      const next = { ...prev, hidden };
      saveButtonPrefs(next);
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
    const name = `Drawing ${new Date().toLocaleString()}`;
    await base44.entities.MapDrawing.create({
      name,
      markers: drawings.markers,
      lines: drawings.lines,
      polygons: drawings.polygons,
      gps_tracks: gpsTrack?.length > 0 ? [gpsTrack] : [],
    });
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
    if (id === "zoomin")        return document.querySelector(".leaflet-control-zoom-in")?.click();
    if (id === "zoomout")       return document.querySelector(".leaflet-control-zoom-out")?.click();
    if (id === "gps")           return onGpsToggle();
    if (id === "mytracks")      return onShowMyTracks();
    if (id === "nav")           return onNavToggle();
    if (id === "askmap")        return onAskMapToggle();
    if (id === "trackanalyzer") return onTrackAnalyzerToggle();
    if (id === "ruler")         return setRulerOpen(p => !p);
    if (id === "save")          return handleSave();
    if (id === "load")          return handleLoad();
  };

  const hasAnything = drawings && (drawings.markers?.length || drawings.lines?.length || drawings.polygons?.length || gpsTrack?.length);

  return (
    <>
      {/* Individual draggable buttons */}
      {BUTTON_DEFS.filter(b => !prefs.hidden.includes(b.id)).map(btn => {
        const pos = prefs.positions[btn.id] || { x: window.innerWidth - 56, y: 100 };
        let icon = btn.icon;
        let disabled = false;

        if (btn.id === "locate" && locating) icon = LoaderCircle;
        if (btn.id === "save" && saving)     icon = Loader2;
        if (btn.id === "save" && savedOk)    icon = Check;
        if (btn.id === "load" && loadingDraw) icon = Loader2;
        if (btn.id === "save") disabled = !hasAnything && !savedOk;

        return (
          <DraggableBtn
            key={btn.id}
            id={btn.id}
            icon={icon}
            label={btn.label}
            color={btn.color}
            pos={pos}
            onPosChange={(p) => updatePos(btn.id, p)}
            onPosCommit={(p) => commitPos(btn.id, p)}
            onClick={() => handleClick(btn.id)}
            active={isActive(btn.id)}
            disabled={disabled}
            badge={btn.id === "layers" ? (activeLayerCount > 0 ? activeLayerCount : null) : null}
          />
        );
      })}

      {/* Ruler sub-tools popup */}
      <AnimatePresence>
        {rulerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: "fixed",
              left: (prefs.positions["ruler"]?.x ?? window.innerWidth - 56) - 128,
              top: (prefs.positions["ruler"]?.y ?? 200) - 4,
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

      {/* Settings button — fixed bottom-right corner always */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowSettings(p => !p)}
              style={{ position: "fixed", right: 12, bottom: 12, zIndex: 970 }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg border transition-all ${
                showSettings
                  ? "bg-slate-800 text-white border-transparent"
                  : "bg-white/95 backdrop-blur-xl text-slate-400 border-slate-200/60 hover:text-slate-700 hover:bg-white"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="z-[9999]">
            <p className="text-xs font-medium">Customize Toolbar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            style={{ position: "fixed", right: 52, bottom: 12, zIndex: 970 }}
            className="bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-4 w-60 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-800">Toolbar Buttons</span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mb-3">Drag buttons anywhere on screen. Toggle visibility here.</p>
            <div className="space-y-1">
              {BUTTON_DEFS.map(btn => {
                const Icon = btn.icon;
                const hidden = prefs.hidden.includes(btn.id);
                return (
                  <button
                    key={btn.id}
                    onClick={() => toggleHidden(btn.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-sm ${
                      hidden ? "bg-slate-50 text-slate-400" : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left text-xs">{btn.label}</span>
                    {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                const fresh = { positions: { ...DEFAULT_POSITIONS }, hidden: [] };
                setPrefs(fresh);
                saveButtonPrefs(fresh);
              }}
              className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 py-1 border-t border-slate-100 pt-2"
            >
              Reset positions & visibility
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}