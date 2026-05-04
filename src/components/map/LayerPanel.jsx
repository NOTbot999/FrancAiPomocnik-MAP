import React, { useState, useCallback } from "react";
import { Layers, X, ExternalLink, ChevronDown, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { OVERLAY_CATEGORIES, BASE_LAYERS } from "./layerConfig";
import LayerCategory from "./LayerCategory";
import { loadTheme } from "@/components/map/ThemeCustomizer";
import LayerLegend from "./LayerLegend";
import { scopedGet, scopedSet } from "@/lib/userPrefs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

// Base Map grid — always 1 active (radio style), no slider, 2×4 grid at the top
function BaseMapGrid({ activeBaseLayers, onSelectBaseLayer }) {
  const activeId = activeBaseLayers ? Object.keys(activeBaseLayers)[0] : "osm";

  return (
    <div className="px-3 pb-3 pt-2 border-b border-slate-700/50">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Osnovna karta</p>
      <div className="grid grid-cols-4 gap-1.5">
        {BASE_LAYERS.map((layer) => {
          const isActive = layer.id === activeId;
          return (
            <button
              key={layer.id}
              onClick={() => onSelectBaseLayer(layer.id)}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all ${isActive ? 'ring-2 ring-emerald-400 bg-slate-700/60' : 'hover:bg-slate-700/30'}`}
            >
              <div className={`w-full aspect-video rounded-lg overflow-hidden border ${isActive ? 'border-emerald-400/60' : 'border-slate-600/30'}`}>
                <img src={layer.thumbnail} alt={layer.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <span className={`text-[9px] leading-tight text-center w-full truncate ${isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                {layer.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MAX_OVERLAY_LAYERS = 6;

function ActiveLayersCategory({ activeLayers, allCategories, onToggleLayer, onOpacityChange }) {
  const [isOpen, setIsOpen] = useState(true);

  // Only overlay layers (base is always-on radio, not shown here)
  const activeLayersList = [];
  for (const cat of allCategories) {
    for (const layer of cat.layers) {
      if (activeLayers[layer.id]) {
        activeLayersList.push({ ...layer, _categoryName: cat.name, _opacity: activeLayers[layer.id]?.opacity ?? layer.opacity });
      }
    }
  }
  if (activeLayersList.length === 0) return null;

  return (
    <div className="border-b border-slate-700/50">
      <button onClick={() => setIsOpen(p => !p)} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700/30 transition-colors">
        <span className="text-base leading-none shrink-0">👁️</span>
        <span className="text-sm font-medium text-slate-200 flex-1 text-left">Aktivne karte</span>
        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
          {activeLayersList.length}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-1.5">
              {activeLayersList.map((layer) => (
                <div key={layer.id} className="group">
                  <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-slate-700/50">
                    <div className="w-10 h-7 rounded overflow-hidden shrink-0 border border-emerald-500/60">
                      {layer.thumbnail
                        ? <img src={layer.thumbnail} alt={layer.name} className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold bg-emerald-500/20 text-emerald-400">{layer.name.charAt(0)}</div>
                      }
                    </div>
                    <span className="text-slate-200 text-xs leading-tight flex-1">{layer.name}</span>
                    <span className="text-[9px] text-slate-500">{layer._categoryName}</span>
                    <button
                      onClick={() => onToggleLayer(layer.id)}
                      className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-600 text-slate-300 hover:bg-slate-500 transition-all"
                    >
                      OFF
                    </button>
                  </div>
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-3 pb-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-8">{Math.round(layer._opacity * 100)}%</span>
                      <Slider value={[Math.round(layer._opacity * 100)]} onValueChange={([v]) => onOpacityChange(layer.id, v / 100)} max={100} min={0} step={5} className="flex-1" />
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FavoritesCategory({ favoriteLayerIds, allCategories, activeLayers, onToggleLayer, onOpacityChange, onToggleFavorite, activeLayerCount }) {
  const [isOpen, setIsOpen] = useState(true);
  if (favoriteLayerIds.length === 0) return null;

  // Only overlay favorites
  const favLayers = [];
  for (const cat of allCategories) {
    for (const layer of cat.layers) {
      if (favoriteLayerIds.includes(layer.id)) {
        favLayers.push({ ...layer, _categoryName: cat.name });
      }
    }
  }
  if (favLayers.length === 0) return null;

  return (
    <div className="border-b border-slate-700/50">
      <button onClick={() => setIsOpen(p => !p)} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700/30 transition-colors">
        <span className="text-base leading-none shrink-0">❤️</span>
        <span className="text-sm font-medium text-slate-200 flex-1 text-left">Favorite ❤️</span>
        {favLayers.filter(l => activeLayers[l.id]).length > 0 && (
          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
            {favLayers.filter(l => activeLayers[l.id]).length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-1.5">
              {favLayers.map((layer) => {
                const isActive = !!(activeLayers[layer.id]);
                const currentOpacity = activeLayers[layer.id]?.opacity ?? layer.opacity;
                const atLimit = !isActive && activeLayerCount >= MAX_OVERLAY_LAYERS;
                return (
                  <div key={layer.id} className="group">
                    <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${isActive ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}`}>
                      <div className={`w-10 h-7 rounded overflow-hidden shrink-0 border ${isActive ? 'border-emerald-500/60' : 'border-slate-600/40'}`}>
                        {layer.thumbnail
                          ? <img src={layer.thumbnail} alt={layer.name} className="w-full h-full object-cover" loading="lazy" />
                          : <div className={`w-full h-full flex items-center justify-center text-[9px] font-bold ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>{layer.name.charAt(0)}</div>
                        }
                      </div>
                      <span className="text-slate-200 text-xs leading-tight flex-1">{layer.name}</span>
                      <span className="text-[9px] text-slate-500">{layer._categoryName}</span>
                      <button onClick={() => onToggleFavorite(layer.id)} className="shrink-0 text-base leading-none hover:scale-125 transition-transform">❤️</button>
                      <button
                        onClick={() => !atLimit && onToggleLayer(layer.id)}
                        disabled={atLimit}
                        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${isActive ? 'bg-emerald-500 text-white' : atLimit ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                      >
                        {isActive ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {isActive && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-3 pb-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-8">{Math.round(currentOpacity * 100)}%</span>
                          <Slider value={[Math.round(currentOpacity * 100)]} onValueChange={([v]) => onOpacityChange(layer.id, v / 100)} max={100} min={0} step={5} className="flex-1" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PanelContent({ activeBaseLayers, onSelectBaseLayer, activeLayers, onToggleLayer, onOpacityChange, favorites, onToggleFavorite }) {
  const activeLayerCount = Object.keys(activeLayers).length;

  return (
    <div className="pt-2 pb-4">
      {/* Base Map grid — always at top, radio select */}
      <BaseMapGrid
        activeBaseLayers={activeBaseLayers}
        onSelectBaseLayer={onSelectBaseLayer}
      />

      {/* Active overlay layers */}
      <ActiveLayersCategory
        activeLayers={activeLayers}
        allCategories={OVERLAY_CATEGORIES}
        onToggleLayer={onToggleLayer}
        onOpacityChange={onOpacityChange}
      />

      {/* Overlay limit indicator — always visible */}
      <div className="px-4 py-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">Prekrivni sloji</span>
          <span className={`text-[9px] font-bold ${activeLayerCount >= MAX_OVERLAY_LAYERS ? 'text-amber-400' : 'text-emerald-400'}`}>
            {activeLayerCount}/{MAX_OVERLAY_LAYERS}
          </span>
        </div>
        <div className="h-0.5 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((activeLayerCount / MAX_OVERLAY_LAYERS) * 100, 100)}%`, backgroundColor: activeLayerCount >= MAX_OVERLAY_LAYERS ? '#f59e0b' : '#10b981' }} />
        </div>
      </div>

      {/* Favorites */}
      <FavoritesCategory
        favoriteLayerIds={favorites}
        allCategories={OVERLAY_CATEGORIES}
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
        onOpacityChange={onOpacityChange}
        onToggleFavorite={(id) => onToggleFavorite(id)}
        activeLayerCount={activeLayerCount}
      />

      {/* Overlay categories — plain list, no drag */}
      {OVERLAY_CATEGORIES.map((category) => (
        <LayerCategory
          key={category.id}
          category={category}
          activeLayers={activeLayers}
          onToggleLayer={onToggleLayer}
          onOpacityChange={onOpacityChange}
          favorites={favorites}
          onToggleFavorite={(layerId, layerName, catId, catName) => onToggleFavorite(layerId, layerName, catId, catName)}
          activeLayerCount={activeLayerCount}
          maxLayers={MAX_OVERLAY_LAYERS}
        />
      ))}
    </div>
  );
}

export default function LayerPanel({
  isOpen,
  onClose,
  activeBaseLayers,
  onToggleBaseLayer,
  onBaseOpacityChange,
  activeLayers,
  onToggleLayer,
  onOpacityChange
}) {
  const isMobile = useIsMobile();
  const [favorites, setFavorites] = useState(() => scopedGet("layerFavorites") || []);

  // Radio-style: select exactly 1 base layer
  const handleSelectBaseLayer = useCallback((layerId) => {
    // Always keep exactly this one active at opacity 1
    const next = { [layerId]: { opacity: 1 } };
    // Use the existing onToggleBaseLayer mechanism: turn off all others, turn on selected
    // We'll call the parent's setter directly via a synthetic approach
    // Since we only have onToggleBaseLayer, we build the new state here and call onBaseOpacityChange trick
    // Instead, call parent-passed handlers to sync state
    const currentIds = activeBaseLayers ? Object.keys(activeBaseLayers) : [];
    currentIds.filter(id => id !== layerId).forEach(id => onToggleBaseLayer(id)); // turn off others
    if (!currentIds.includes(layerId)) onToggleBaseLayer(layerId, 1); // turn on selected
    else if (currentIds.length === 1) return; // already the only one active, do nothing
  }, [activeBaseLayers, onToggleBaseLayer]);

  const handleToggleFavorite = useCallback((layerId) => {
    setFavorites(prev => {
      const next = prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId];
      scopedSet("layerFavorites", next);
      return next;
    });
  }, []);

  const trackedToggleLayer = useCallback((layerId) => {
    const activeCount = Object.keys(activeLayers).length;
    const willBeActive = !activeLayers[layerId];
    if (willBeActive && activeCount >= MAX_OVERLAY_LAYERS) return; // enforce limit
    if (willBeActive) base44.analytics.track({ eventName: "layer_toggled", properties: { layer_id: layerId } });
    onToggleLayer(layerId);
  }, [activeLayers, onToggleLayer]);

  const theme = loadTheme();
  const [showLegend, setShowLegend] = useState(false);
  const panelProps = { activeBaseLayers, onSelectBaseLayer: handleSelectBaseLayer, activeLayers, onToggleLayer: trackedToggleLayer, onOpacityChange, favorites, onToggleFavorite: handleToggleFavorite };

  const panelBg = theme.panelBg || "#0f172a";
  const panelText = theme.panelText || "#e2e8f0";
  const accentColor = theme.accentColor || "#10b981";

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="absolute inset-0 z-[899]"
              style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="absolute bottom-0 left-0 right-0 z-[900] flex flex-col rounded-t-3xl border-t border-white/10 shadow-2xl"
              style={{ height: "43.1vh", backgroundColor: panelBg + "fa", backdropFilter: "blur(24px)", color: panelText }}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: accentColor + "60" }} />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/8 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + "20" }}>
                    <Layers className="w-4 h-4" style={{ color: accentColor }} />
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight" style={{ color: panelText }}>Sloji</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowLegend(p => !p)}
                    className="p-1.5 rounded-xl transition-all"
                    style={showLegend ? { backgroundColor: accentColor, color: "#fff" } : { color: panelText, opacity: 0.6 }}
                    title="Legenda"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onClose} className="p-1.5 rounded-xl transition-colors hover:bg-white/10" style={{ color: panelText, opacity: 0.6 }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <PanelContent {...panelProps} />
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: left slide-in
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute top-0 left-0 bottom-0 w-80 z-[900] flex flex-col border-r border-white/8 shadow-2xl"
            style={{ backgroundColor: panelBg + "f8", backdropFilter: "blur(24px)", color: panelText }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + "22" }}>
                  <Layers className="w-4.5 h-4.5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight leading-none" style={{ color: panelText }}>Sloji karte</h2>
                  <p className="text-[10px] mt-0.5" style={{ color: panelText, opacity: 0.4 }}>Slovenia Map Viewer</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowLegend(p => !p)}
                  className="p-1.5 rounded-xl transition-all text-xs font-medium flex items-center gap-1"
                  style={showLegend
                    ? { backgroundColor: accentColor, color: "#fff" }
                    : { backgroundColor: "rgba(255,255,255,0.06)", color: panelText, opacity: 0.7 }
                  }
                  title="Legenda"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
                  style={{ color: panelText, opacity: 0.6 }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <PanelContent {...panelProps} />
            </ScrollArea>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/8 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: panelText, opacity: 0.35 }}>Zunanje povezave</p>
              {[
                { label: "KatasterJam – Jame", url: "https://www.katasterjam.si" },
                { label: "ARSO Atlas Okolja", url: "https://gis.arso.gov.si/atlasokolja/profile.aspx?id=Atlas_Okolja_AXL@Arso&culture=en-US" },
                { label: "Old Maps Online", url: "https://www.oldmapsonline.org/en/Slovenia" },
                { label: "e-Prostor Javni Vpogled", url: "https://ipi.eprostor.gov.si/jv/" }
              ].map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[11px] py-0.5 transition-colors hover:opacity-100"
                  style={{ color: panelText, opacity: 0.45 }}
                  onMouseEnter={e => e.currentTarget.style.color = accentColor}
                  onMouseLeave={e => { e.currentTarget.style.color = panelText; e.currentTarget.style.opacity = 0.45; }}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {link.label}
                </a>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-white/5">
              <p className="text-[9px] text-center" style={{ color: panelText, opacity: 0.25 }}>Podatki: ARSO · GURS · e-Prostor · OSM</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend panel — floats next to the layer panel */}
      <AnimatePresence>
        {isOpen && showLegend && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="absolute top-16 z-[901]"
            style={{ left: 332 }}
          >
            <LayerLegend isOpen={showLegend} onClose={() => setShowLegend(false)} theme={theme} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}