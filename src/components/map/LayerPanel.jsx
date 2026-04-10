import React, { useState } from "react";
import { Layers, X, Building2, Droplets, Trees, CloudSun, MapPin, Wheat, Mountain, History, Landmark, ExternalLink, ChevronDown, Map } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { OVERLAY_CATEGORIES, BASE_LAYERS } from "./layerConfig";
import LayerCategory from "./LayerCategory";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

const ICON_MAP = {
  Building2, Droplets, Trees, CloudSun, MapPin, Wheat, Mountain, History, Landmark
};

const CATEGORY_THUMBNAILS = {
  gurs: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop",
  katasterjam: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=80&h=60&fit=crop",
  arso_water: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=80&h=60&fit=crop",
  arso_nature: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=60&fit=crop",
  arso_env: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
  landuse: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=80&h=60&fit=crop",
  historical: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=80&h=60&fit=crop",
  admin: "https://images.unsplash.com/photo-1527489377706-5bf97e608852?w=80&h=60&fit=crop",
};

// Base Map as a collapsible category inside Data Layers
function BaseMapCategory({ activeBaseLayers, onToggleBaseLayer, onBaseOpacityChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeIds = activeBaseLayers ? Object.keys(activeBaseLayers) : [];
  const firstActive = BASE_LAYERS.find(l => activeIds.includes(l.id));
  return (
    <div className="border-b border-slate-700/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        {firstActive?.thumbnail ? (
          <div className="w-8 h-6 rounded overflow-hidden shrink-0">
            <img src={firstActive.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : <Map className="w-4 h-4 text-emerald-400 shrink-0" />}
        <span className="text-sm font-medium text-slate-200 flex-1 text-left">Base Map</span>
        {activeIds.length > 0 && (
          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full mr-1">{activeIds.length}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {BASE_LAYERS.map((layer) => {
                const isActive = activeIds.includes(layer.id);
                return (
                  <div key={layer.id}>
                    <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'
                    }`}>
                      <div className={`w-10 h-7 rounded overflow-hidden shrink-0 border ${
                        isActive ? 'border-emerald-500/60' : 'border-slate-600/40'
                      }`}>
                        <img src={layer.thumbnail} alt={layer.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <span className={`text-xs flex-1 text-left leading-tight ${
                        isActive ? 'text-slate-200' : 'text-slate-500'
                      }`}>{layer.name}</span>
                      <button
                        onClick={() => onToggleBaseLayer(layer.id, layer.opacity ?? 1)}
                        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          isActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {isActive ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {isActive && (
                      <div className="px-3 pb-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-8">
                            {Math.round((activeBaseLayers[layer.id]?.opacity ?? 1) * 100)}%
                          </span>
                          <Slider
                            value={[Math.round((activeBaseLayers[layer.id]?.opacity ?? 1) * 100)]}
                            onValueChange={([v]) => onBaseOpacityChange(layer.id, v / 100)}
                            max={100} min={0} step={5}
                            className="flex-1"
                          />
                        </div>
                      </div>
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

function PanelContent({ activeBaseLayers, onToggleBaseLayer, onBaseOpacityChange, activeLayers, onToggleLayer, onOpacityChange }) {
  return (
    <div className="pt-2 pb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 px-4">Layers</p>
      {/* Base map first */}
      <BaseMapCategory
        activeBaseLayers={activeBaseLayers}
        onToggleBaseLayer={onToggleBaseLayer}
        onBaseOpacityChange={onBaseOpacityChange}
      />
      {/* Data overlay categories */}
      {OVERLAY_CATEGORIES.map((category) => (
        <LayerCategory
          key={category.id}
          category={category}
          activeLayers={activeLayers}
          onToggleLayer={onToggleLayer}
          onOpacityChange={onOpacityChange}
          iconComponent={ICON_MAP[category.icon]}
          thumbnail={CATEGORY_THUMBNAILS[category.id]}
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
  onOpacityChange,
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 z-[899] bg-black/30"
            />
            {/* Bottom sheet — ~37.5vh (50% shorter than before) */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 z-[900] flex flex-col bg-slate-900/97 backdrop-blur-xl rounded-t-2xl border-t border-slate-700/50"
              style={{ height: "37.5vh" }}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-600" />
              </div>
              <div className="flex items-center justify-between px-5 py-2 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-white tracking-tight">Layers</h2>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <PanelContent
                  activeBaseLayers={activeBaseLayers}
                  onToggleBaseLayer={onToggleBaseLayer}
                  onBaseOpacityChange={onBaseOpacityChange}
                  activeLayers={activeLayers}
                  onToggleLayer={onToggleLayer}
                  onOpacityChange={onOpacityChange}
                />
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: left slide-in
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="absolute top-0 left-0 bottom-0 w-80 z-[900] flex flex-col bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white tracking-tight">Layers</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <PanelContent
              activeBaseLayers={activeBaseLayers}
              onToggleBaseLayer={onToggleBaseLayer}
              onBaseOpacityChange={onBaseOpacityChange}
              activeLayers={activeLayers}
              onToggleLayer={onToggleLayer}
              onOpacityChange={onOpacityChange}
            />
          </ScrollArea>
          <div className="px-4 py-3 border-t border-slate-700/50 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">External Tools</p>
            {[
              { label: "KatasterJam – Caves", url: "https://www.katasterjam.si" },
              { label: "ARSO Atlas Okolja", url: "https://gis.arso.gov.si/atlasokolja/profile.aspx?id=Atlas_Okolja_AXL@Arso&culture=en-US" },
              { label: "Old Maps Online", url: "https://www.oldmapsonline.org/en/Slovenia" },
              { label: "e-Prostor Javni Vpogled", url: "https://ipi.eprostor.gov.si/jv/" },
            ].map(link => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors py-0.5">
                <ExternalLink className="w-3 h-3 shrink-0" />
                {link.label}
              </a>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-600 text-center">Data: ARSO · GURS · e-Prostor · OSM</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}