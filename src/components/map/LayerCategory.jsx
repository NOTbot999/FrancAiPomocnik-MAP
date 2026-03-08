import React, { useState } from "react";
import { ChevronDown, Eye, EyeOff, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export default function LayerCategory({ category, activeLayers, onToggleLayer, onOpacityChange, iconComponent: Icon }) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = category.layers.filter(l => activeLayers[l.id]).length;

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        {Icon && <Icon className="w-4 h-4 text-emerald-400 shrink-0" />}
        <span className="text-sm font-medium text-slate-200 flex-1 text-left">{category.name}</span>
        {activeCount > 0 && (
          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
            {activeCount}
          </span>
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
            <div className="px-3 pb-3 space-y-1">
              {category.layers.map((layer) => {
                const isActive = activeLayers[layer.id];
                return (
                  <div key={layer.id} className="group">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors">
                      <button
                        onClick={() => onToggleLayer(layer.id)}
                        className={`shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}
                      >
                        {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`text-xs flex-1 transition-colors ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>
                        {layer.name}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-48">
                            <p className="text-xs">{layer.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="px-8 pb-2"
                      >
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
                            className="flex-1"
                          />
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