import React, { useState } from "react";
import { ChevronDown, GripVertical } from "lucide-react";

const TOOL_ICONS = {
  "3d_view": "🧊",
  "track_analyzer": "📊",
  "layers": "🗺️",
  "zoom": "🔍",
  "search": "🔎",
  "locate": "📍",
  "gps_track": "🛰️",
  "scale": "📏",
  "navigation": "🧭",
  "offline": "📡",
  "ai": "🤖",
};

export default function Mobile3DMenu({
  isOpen,
  onClose,
  isPanelOpen,
  onTogglePanel,
  activeTool,
  onToolChange,
  isGpsTracking,
  onGpsToggle,
  isNavOpen,
  onNavToggle,
  isOfflineOpen,
  onOfflineToggle,
  isTrackAnalyzerOpen,
  onTrackAnalyzerToggle,
  isAIOpen,
  onAIToggle,
  onLocate,
  measurements,
  gpsTrack,
  showMyTracks,
  onShowMyTracks,
}) {
  const [buttonScale, setButtonScale] = useState(100);
  const [showScale, setShowScale] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    myTracks: false,
    colors: false,
    devices: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[970] pointer-events-none flex items-end">
      <div
        className="w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 pointer-events-auto flex flex-col max-h-[85vh] overflow-y-auto"
        style={{ borderRadius: "24px 24px 0 0" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 px-4 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Nastavitve karte</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tools Section */}
        <div className="px-4 py-4 space-y-2">
          <p className="text-xs text-slate-400 font-semibold mb-3">GUMBI NA ZASLONU</p>

          {/* 3D View */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">3D Pogled</span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded cursor-pointer"
              readOnly
            />
          </div>

          {/* Track Analyzer */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Analiza sledi</span>
            </div>
            <input
              type="checkbox"
              checked={isTrackAnalyzerOpen}
              onChange={onTrackAnalyzerToggle}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* Layers */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Sloji</span>
            </div>
            <input
              type="checkbox"
              checked={isPanelOpen}
              onChange={onTogglePanel}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* Zoom */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Zoom</span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded cursor-pointer"
              readOnly
            />
          </div>

          {/* Search */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Iskanje</span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded cursor-pointer"
              readOnly
            />
          </div>

          {/* My Location */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Moja lokacija</span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded cursor-pointer"
              readOnly
            />
          </div>

          {/* GPS Track */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">GPS sled</span>
            </div>
            <input
              type="checkbox"
              checked={isGpsTracking}
              onChange={onGpsToggle}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* Scale */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Merilo</span>
            </div>
            <input
              type="checkbox"
              checked={showScale}
              onChange={(e) => setShowScale(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Navigacija</span>
            </div>
            <input
              type="checkbox"
              checked={isNavOpen}
              onChange={onNavToggle}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* Offline Maps */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">Offline karte</span>
            </div>
            <input
              type="checkbox"
              checked={isOfflineOpen}
              onChange={onOfflineToggle}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* AI Assistant */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300 text-sm">AI Asistent</span>
            </div>
            <input
              type="checkbox"
              checked={isAIOpen}
              onChange={onAIToggle}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Button Size */}
        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-semibold">VELIČOST GUMBOV</span>
            <span className="text-xs text-emerald-400 font-semibold">{buttonScale}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="300"
            value={buttonScale}
            onChange={(e) => setButtonScale(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${buttonScale / 3}%, #475569 ${buttonScale / 3}%, #475569 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50%</span>
            <span>300%</span>
          </div>
        </div>

        {/* Scale Settings */}
        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">MERILO</span>
            <input
              type="checkbox"
              checked={showScale}
              onChange={(e) => setShowScale(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
          </div>
          {showScale && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Vidljivost merila</span>
                <span className="text-xs text-emerald-400">100%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="100"
                className="w-full h-2 bg-slate-700 rounded-lg"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>50%</span>
                <span>200%</span>
              </div>
            </div>
          )}
        </div>

        {/* My GPS Tracks */}
        <div className="px-4 py-3 border-t border-slate-700/50">
          <button
            onClick={() => toggleSection("myTracks")}
            className="w-full flex items-center justify-between text-slate-300 hover:text-white transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">🧭</span>
              <span className="text-sm font-medium">Moje GPS sledi</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.myTracks ? "rotate-180" : ""
              }`}
            />
          </button>
          {expandedSections.myTracks && (
            <div className="mt-3 space-y-2 text-xs text-slate-400">
              <p>Ni shranjenih poti</p>
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="px-4 py-3 border-t border-slate-700/50">
          <button
            onClick={() => toggleSection("colors")}
            className="w-full flex items-center justify-between text-slate-300 hover:text-white transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">🎨</span>
              <span className="text-sm font-medium">Barve vmesnika</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.colors ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Devices */}
        <div className="px-4 py-3 border-t border-slate-700/50 pb-8">
          <button
            onClick={() => toggleSection("devices")}
            className="w-full flex items-center justify-between text-slate-300 hover:text-white transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">📱</span>
              <span className="text-sm font-medium">Povezane naprave</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.devices ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}