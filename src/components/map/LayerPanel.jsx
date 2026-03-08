import React from "react";
import { Layers, X, Building2, Droplets, Trees, CloudSun, MapPin, Wheat, Mountain, History, Landmark, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OVERLAY_CATEGORIES, BASE_LAYERS } from "./layerConfig";
import LayerCategory from "./LayerCategory";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICON_MAP = {
  Building2, Droplets, Trees, CloudSun, MapPin, Wheat, Mountain, History, Landmark
};

export default function LayerPanel({
  isOpen,
  onClose,
  activeBaseLayer,
  onBaseLayerChange,
  activeLayers,
  onToggleLayer,
  onOpacityChange,
}) {
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
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white tracking-tight">Layers</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            {/* Base Layers */}
            <div className="px-4 pt-4 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Base Map</p>
              <div className="grid grid-cols-3 gap-2">
                {BASE_LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => onBaseLayerChange(layer.id)}
                    className={`relative rounded-lg overflow-hidden transition-all duration-200 ${
                      activeBaseLayer === layer.id
                        ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900 scale-[1.02]'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-slate-800">
                      <img
                        src={layer.thumbnail}
                        alt={layer.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                      <p className="text-[9px] font-medium text-white truncate text-center">{layer.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-slate-700/50" />

            {/* Overlay categories */}
            <div className="pt-2 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 px-4">Data Layers</p>
              {OVERLAY_CATEGORIES.map((category) => (
                <LayerCategory
                  key={category.id}
                  category={category}
                  activeLayers={activeLayers}
                  onToggleLayer={onToggleLayer}
                  onOpacityChange={onOpacityChange}
                  iconComponent={ICON_MAP[category.icon]}
                />
              ))}
            </div>
          </ScrollArea>

          {/* KatasterJam quick links */}
          <div className="px-4 py-3 border-t border-slate-700/50 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">External Tools</p>
            {[
              { label: "KatasterJam – Caves", url: "https://www.katasterjam.si" },
              { label: "ARSO Atlas Okolja", url: "https://gis.arso.gov.si/atlasokolja/profile.aspx?id=Atlas_Okolja_AXL@Arso&culture=en-US" },
              { label: "Old Maps Online", url: "https://www.oldmapsonline.org/en/Slovenia" },
              { label: "e-Prostor Javni Vpogled", url: "https://ipi.eprostor.gov.si/jv/" },
            ].map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors py-0.5"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                {link.label}
              </a>
            ))}
          </div>
          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-600 text-center">
              Data: ARSO · GURS · e-Prostor · OSM
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}