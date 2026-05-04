import React, { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { base44 } from "@/api/base44Client";

export default function LayerCategory({ category, activeLayers, onToggleLayer, onOpacityChange, iconComponent, thumbnail, favorites = [], onToggleFavorite, activeLayerCount = 0, maxLayers = 5 }) {
  const Icon = iconComponent;
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = category.layers.filter((l) => activeLayers[l.id]).length;

  return (
    <div className="border-b border-white/6 last:border-0">
      {/* Category header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 transition-all hover:bg-white/5 active:bg-white/8"
      >
        {thumbnail && (
          <div className="w-8 h-6 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/10">
            <img src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        {!thumbnail && Icon && (
          <div className="w-7 h-6 rounded-lg flex items-center justify-center shrink-0 bg-white/6">
            <Icon className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        )}
        <span className="text-sm font-medium text-slate-200 flex-1 text-left leading-tight">{category.name}</span>
        <AnimatePresence>
          {activeCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full"
            >
              {activeCount}
            </motion.span>
          )}
        </AnimatePresence>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-250 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Layer list */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1">
              {category.layers.map((layer, idx) => {
                const isActive = !!activeLayers[layer.id];
                return (
                  <motion.div
                    key={layer.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.18 }}
                  >
                    {(()=>{ const atLimit = !isActive && activeLayerCount >= maxLayers; return (
                  <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-emerald-500/10 ring-1 ring-emerald-500/25'
                          : atLimit ? 'opacity-40' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Color indicator / thumbnail */}
                      <div className={`w-9 h-6 rounded-lg overflow-hidden shrink-0 border transition-all duration-200 ${
                        isActive ? 'border-emerald-500/50' : 'border-white/10'
                      }`}>
                        {layer.thumbnail
                          ? <img src={layer.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                          : <div className={`w-full h-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                              isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-500'
                            }`}>
                              {layer.name.charAt(0)}
                            </div>
                        }
                      </div>

                      {/* Name */}
                      <span className={`text-xs leading-tight flex-1 transition-colors duration-200 ${
                        isActive ? 'text-slate-100' : 'text-slate-400'
                      }`}>
                        {layer.name}
                      </span>

                      {/* Info tooltip */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-help shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-48">
                            <p className="text-xs">{layer.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Favorite */}
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleFavorite(layer.id, layer.name, category.id, category.name); }}
                          className="shrink-0 text-sm leading-none hover:scale-125 transition-transform"
                          title="Dodaj med priljubljene"
                        >
                          {favorites.includes(layer.id) ? "❤️" : "🤍"}
                        </button>
                      )}

                      {/* Toggle button */}
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          if (!isActive && activeLayerCount >= maxLayers) return;
                          onToggleLayer(layer.id);
                        }}
                        disabled={!isActive && activeLayerCount >= maxLayers}
                        className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                          isActive
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : activeLayerCount >= maxLayers ? 'bg-white/4 text-slate-600 cursor-not-allowed' : 'bg-white/8 text-slate-400 hover:bg-white/12'
                        }`}
                      >
                        {isActive ? 'ON' : 'OFF'}
                      </motion.button>
                    </div>); })()}

                    {/* Opacity slider */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-3 pt-1 pb-1.5">
                            <span className="text-[10px] text-emerald-400/70 w-7 font-mono">
                              {Math.round((activeLayers[layer.id]?.opacity ?? layer.opacity) * 100)}%
                            </span>
                            <Slider
                              value={[Math.round((activeLayers[layer.id]?.opacity ?? layer.opacity) * 100)]}
                              onValueChange={([v]) => onOpacityChange(layer.id, v / 100)}
                              max={100} min={0} step={5}
                              className="flex-1"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}