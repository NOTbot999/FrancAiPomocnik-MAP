import React, { useState } from "react";
import { ChevronDown, Eye, EyeOff, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { base44 } from "@/api/base44Client";

export default function LayerCategory({ category, activeLayers, onToggleLayer, onOpacityChange, iconComponent, thumbnail, favorites = [], onToggleFavorite }) {
  const Icon = iconComponent;
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = category.layers.filter((l) => activeLayers[l.id]).length;

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700/30 transition-colors">
        
        {/* Category thumbnail */}
        {thumbnail &&
        <div className="w-8 h-6 rounded overflow-hidden shrink-0">
            <img src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        }
        {!thumbnail && Icon && <Icon className="w-4 h-4 text-emerald-400 shrink-0" />}
        <span className="text-sm font-medium text-slate-200 flex-1 text-left">{category.name}</span>
        {activeCount > 0 &&
        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
            {activeCount}
          </span>
        }
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden">
          
            <div className="px-3 pb-3 space-y-1.5">
              {category.layers.map((layer) => {
              const isActive = activeLayers[layer.id];
              return (
                <div key={layer.id} className="group">
                    <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${isActive ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}`}>
                      {/* Thumbnail */}
                      <div className={`w-10 h-7 rounded overflow-hidden shrink-0 border transition-colors ${
                    isActive ? 'border-emerald-500/60' : 'border-slate-600/40'}`
                    }>
                        {layer.thumbnail ?
                      <img src={layer.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" /> :

                      <div className={`w-full h-full flex items-center justify-center text-[9px] font-bold ${
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`
                      }>
                            {layer.name.charAt(0)}
                          </div>
                      }
                      </div>

                      {/* Name */}
                      <span className="text-slate-950 text-xs leading-tight flex-1 transition-colors">

                      
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

                      {/* Favorite button */}
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleFavorite(layer.id, layer.name, category.id, category.name); }}
                          className="shrink-0 text-base leading-none hover:scale-125 transition-transform"
                          title="Add to Favorites"
                        >
                          {favorites.includes(layer.id) ? "❤️" : "🤍"}
                        </button>
                      )}

                      {/* Toggle button */}
                      <button
                      onClick={() => {
                        onToggleLayer(layer.id);
                        base44.analytics.track({
                          eventName: "layer_toggled",
                          properties: {
                            layer_id: layer.id,
                            layer_name: layer.name,
                            category_id: category.id,
                            category_name: category.name,
                            action: isActive ? "off" : "on",
                          }
                        });
                      }}
                      className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      isActive ?
                      'bg-emerald-500 text-white' :
                      'bg-slate-700 text-slate-400 hover:bg-slate-600'}`
                      }>
                      
                        {isActive ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* Opacity slider */}
                    {isActive &&
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-3 pb-1 pt-0.5">
                    
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-8">
                            {Math.round((activeLayers[layer.id]?.opacity ?? layer.opacity) * 100)}%
                          </span>
                          <Slider
                        value={[Math.round((activeLayers[layer.id]?.opacity ?? layer.opacity) * 100)]}
                        onValueChange={([v]) => onOpacityChange(layer.id, v / 100)}
                        max={100}
                        min={0}
                        step={5}
                        className="flex-1" />
                      
                        </div>
                      </motion.div>
                  }
                  </div>);

            })}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}