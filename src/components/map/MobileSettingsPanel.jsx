import React, { useState, useCallback, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Search, Locate, Navigation, Route, Ruler, X, Link2, ChevronDown, ChevronUp, Layers, Plus, WifiOff, Palette, Brain, AlertTriangle, TrendingUp, Box } from "lucide-react";
import LagReportModal from "@/components/map/LagReportModal";
import { Slider } from "@/components/ui/slider";
import MyTracks from "./MyTracks";
import DeviceLink from "./DeviceLink";
import ThemeCustomizer, { loadTheme } from "@/components/map/ThemeCustomizer";



const DEFAULT_BUTTONS = [
  { id: "layers",  label: "Sloji",          icon: Layers },
  { id: "zoom",    label: "Zoom",           icon: Plus },
  { id: "search",  label: "Iskanje",        icon: Search },
  { id: "locate",  label: "Moja lokacija",  icon: Locate },
  { id: "gps",     label: "GPS sled",       icon: Navigation },
  { id: "ruler",   label: "Merilo",         icon: Ruler },
  { id: "nav",     label: "Navigacija",     icon: Route },
  { id: "offline", label: "Offline karte",  icon: WifiOff },
  { id: "ai",      label: "AI Asistent",    icon: Brain },
  { id: "trackanalyzer", label: "Analiza sledi",    icon: TrendingUp },
  { id: "view3d",        label: "3D Pogled",         icon: Box },
];

function loadPrefs() {
  try {
    const saved = localStorage.getItem("mobileButtonPrefs");
    if (saved) {
      const p = JSON.parse(saved);
      // Merge any new buttons not yet in saved prefs
      const allIds = DEFAULT_BUTTONS.map(b => b.id);
      const missingIds = allIds.filter(id => !p.order.includes(id));
      if (missingIds.length) {
        p.order = [...missingIds, ...p.order];
        p.hidden = [...p.hidden, ...missingIds];
      }
      return p;
    }
  } catch {}
  return { order: DEFAULT_BUTTONS.map(b => b.id), hidden: ["layers", "zoom"], buttonScale: 1.0, scaleBarVisible: true, scaleBarScale: 1.0 };
}

function savePrefs(prefs) {
  localStorage.setItem("mobileButtonPrefs", JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("mobilePrefsChanged", { detail: prefs }));
}

export function useMobileButtonPrefs() {
  const [prefs, setPrefsState] = useState(loadPrefs);

  const setPrefs = useCallback((next) => {
    setPrefsState(next);
    savePrefs(next);
  }, []);

  return [prefs, setPrefs];
}

function getDeviceId() {
  let id = localStorage.getItem("gis_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gis_device_id", id);
  }
  return id;
}

export default function MobileSettingsPanel({ onClose, prefs, setPrefs, gpsTrack, onLoadTrack }) {
  const [showTracks, setShowTracks] = useState(false);
  const [showDeviceLink, setShowDeviceLink] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showLagReport, setShowLagReport] = useState(false);
  const [theme, setTheme] = useState(loadTheme);
  const username = localStorage.getItem("userUsername") || null;
  const deviceId = getDeviceId();

  const orderedButtons = prefs.order
    .map(id => DEFAULT_BUTTONS.find(b => b.id === id))
    .filter(Boolean);

  const scrollRef = React.useRef(null);

  const handleDragEnd = (result) => {
    if (scrollRef.current) scrollRef.current.style.overflowY = "auto";
    if (!result.destination) return;
    const newOrder = [...prefs.order];
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    setPrefs({ ...prefs, order: newOrder });
  };

  const handleDragStart = () => {
    if (scrollRef.current) scrollRef.current.style.overflowY = "hidden";
  };

  const toggleHidden = (id) => {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter(h => h !== id)
      : [...prefs.hidden, id];
    setPrefs({ ...prefs, hidden });
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute top-3 right-14 z-[970] w-72 bg-slate-100 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60"
      style={{ pointerEvents: "auto" }}
    >
    <div
      ref={scrollRef}
      style={{ maxHeight: "calc(100vh - 24px)", overflowY: "auto", overscrollBehavior: "contain", touchAction: "pan-y" }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => { e.stopPropagation(); }}
      onTouchEnd={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Nastavitve karte</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar buttons section */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Gumbi na zaslonu</p>
        <p className="text-[10px] text-slate-400 mb-2">Povleci za vrstni red · preklopi za prikaz na zaslonu</p>
      </div>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Droppable droppableId="buttons">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="pb-2 px-2">
              {orderedButtons.map((btn, index) => {
                const Icon = btn.icon;
                const isVisible = !prefs.hidden.includes(btn.id);
                return (
                  <Draggable key={btn.id} draggableId={btn.id} index={index}>
                    {(prov, snapshot) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`flex items-center rounded-xl transition-all mb-0.5 select-none ${
                          snapshot.isDragging ? "bg-white shadow-lg" : "bg-slate-50 hover:bg-white"
                        }`}
                      >
                        {/* LEFT 1/3 — drag handle only */}
                        <div
                          {...prov.dragHandleProps}
                          className="flex items-center gap-2 px-3 py-3 cursor-grab active:cursor-grabbing touch-none"
                          style={{ width: "33%" }}
                        >
                          <GripVertical className="w-5 h-5 text-slate-300 shrink-0" />
                          <Icon className={`w-4 h-4 shrink-0 ${isVisible ? "text-slate-600" : "text-slate-300"}`} />
                        </div>
                        {/* RIGHT 2/3 — scrollable / tap area */}
                        <div className="flex items-center gap-2 px-2 py-3 flex-1" style={{ touchAction: "pan-y" }}>
                          <span className={`flex-1 text-xs font-medium ${isVisible ? "text-slate-600" : "text-slate-300"}`}>
                            {btn.label}
                          </span>
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); toggleHidden(btn.id); }}
                            className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                              isVisible ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              isVisible ? "left-[18px]" : "left-0.5"
                            }`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-200 my-2" />

      {/* Button size slider */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Velikost gumbov</p>
          <span className="text-[10px] font-bold text-emerald-600">{Math.round((prefs.buttonScale ?? 1.0) * 100)}%</span>
        </div>
        <Slider
          value={[Math.round(((prefs.buttonScale ?? 1.0) - 0.5) / 2.5 * 100)]}
          onValueChange={([v]) => {
            const scale = 0.5 + (v / 100) * 2.5;
            setPrefs({ ...prefs, buttonScale: Math.round(scale * 100) / 100 });
          }}
          min={0} max={100} step={1}
          className="w-full"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-400">50%</span>
          <span className="text-[9px] text-slate-400">300%</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-200 my-2" />

      {/* Scale Bar section */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Merilo</p>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setPrefs({ ...prefs, scaleBarVisible: !prefs.scaleBarVisible }); }}
            className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs.scaleBarVisible !== false ? "bg-emerald-500" : "bg-slate-300"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${prefs.scaleBarVisible !== false ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </div>
        {prefs.scaleBarVisible !== false && (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-slate-400">Velikost merila</p>
              <span className="text-[10px] font-bold text-emerald-600">{Math.round((prefs.scaleBarScale ?? 1.0) * 100)}%</span>
            </div>
            <Slider
              value={[Math.round(((prefs.scaleBarScale ?? 1.0) - 0.5) / 1.5 * 100)]}
              onValueChange={([v]) => {
                const scale = 0.5 + (v / 100) * 1.5;
                setPrefs({ ...prefs, scaleBarScale: Math.round(scale * 100) / 100 });
              }}
              min={0} max={100} step={1}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-400">50%</span>
              <span className="text-[9px] text-slate-400">200%</span>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-200 my-2" />

      {/* My GPS Tracks section */}
      <div className="px-2 pb-1">
        <button
          onClick={() => { setShowTracks(p => !p); setShowDeviceLink(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-white transition-all text-slate-700"
        >
          <Route className="w-4 h-4 text-emerald-500" />
          <span className="flex-1 text-xs font-medium text-left">Moje GPS sledi</span>
          {showTracks ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showTracks && (
          <div className="mt-1 bg-white rounded-xl overflow-hidden border border-slate-200">
            <MyTracks
              gpsTrack={gpsTrack || []}
              onLoadTrack={onLoadTrack}
              onClose={() => setShowTracks(false)}
              inline
            />
          </div>
        )}
      </div>

      {/* Theme Customizer section */}
      <div className="px-2 pb-1">
        <button
          onClick={() => { setShowTheme(p => !p); setShowTracks(false); setShowDeviceLink(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-white transition-all text-slate-700"
        >
          <Palette className="w-4 h-4 text-emerald-500" />
          <span className="flex-1 text-xs font-medium text-left">Barve vmesnika</span>
          {showTheme ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showTheme && (
          <div className="mt-1 bg-white rounded-xl overflow-hidden border border-slate-200 p-1">
            <ThemeCustomizer
              isOpen={true}
              onClose={() => setShowTheme(false)}
              theme={theme}
              onThemeChange={(t) => { setTheme(t); }}
            />
          </div>
        )}
      </div>

      {/* Link Devices section */}
      <div className="px-2 pb-1">
        <button
          onClick={() => { setShowDeviceLink(p => !p); setShowTracks(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-white transition-all text-slate-700"
        >
          <Link2 className="w-4 h-4 text-emerald-500" />
          <span className="flex-1 text-xs font-medium text-left">Poveži naprave</span>
          {showDeviceLink ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showDeviceLink && (
          <div className="mt-1 bg-white rounded-xl overflow-hidden border border-slate-200 p-3">
            <DeviceLink deviceId={deviceId} onClose={() => setShowDeviceLink(false)} />
          </div>
        )}
      </div>

      {/* Lag Report button */}
      <div className="mx-4 border-t border-slate-200 my-2" />
      <div className="px-2 pb-3">
        <button
          onClick={() => setShowLagReport(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 transition-all text-amber-700 border border-amber-200"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="flex-1 text-xs font-medium text-left">Poročaj o zaostanku</span>
        </button>
      </div>

      {showLagReport && (
        <LagReportModal username={username} onClose={() => setShowLagReport(false)} />
      )}
    </div>
    </div>
  );
}