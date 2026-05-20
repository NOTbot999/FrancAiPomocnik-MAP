import React, { useState } from "react";
import { ChevronDown, GripVertical } from "lucide-react";

import { Slider } from "@/components/ui/slider";

export default function LayerCategory({ category, activeLayers, onToggleLayer, onOpacityChange, favorites = [], onToggleFavorite, activeLayerCount = 0, maxLayers = 6, dragHandleProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = category.layers.filter((l) => activeLayers[l.id]).length;

  return (
    <div className="border-b border-white/6 last:border-0">
      {/* Category header */}
      <div className="flex items-center gap-1 pr-2">
        {dragHandleProps && (
          <div {...dragHandleProps} className="shrink-0 pl-2 py-3 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" />
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center gap-2.5 px-3 py-3 transition-all hover:bg-white/5 active:bg-white/8"
        >
          {/* Category thumbnail */}
          {category.thumbnail && (
            <div className="w-9 h-6 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/10">
              <img src={category.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <span className="text-sm font-medium text-slate-200 flex-1 text-left leading-tight">{category.name}</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Layer list */}
      {isOpen && (
        <div className="px-3 pb-3 space-y-0.5">
          {category.layers.map((layer) => {
            const isActive = !!activeLayers[layer.id];
            const atLimit = !isActive && activeLayerCount >= maxLayers;
            const opacity = activeLayers[layer.id]?.opacity ?? layer.opacity ?? 0.7;

            return (
              <div key={layer.id}>
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'bg-emerald-500/10 ring-1 ring-emerald-500/25' : atLimit ? 'opacity-40' : 'hover:bg-white/5'
                }`}>
                  {/* Layer thumbnail */}
                  <div className={`w-9 h-6 rounded-lg overflow-hidden shrink-0 border transition-colors ${
                    isActive ? 'border-emerald-500/50' : 'border-white/10'
                  }`}>
                    {layer.thumbnail
                      ? <img src={layer.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className={`w-full h-full flex items-center justify-center text-[9px] font-bold ${
                          isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-500'
                        }`}>{layer.name.charAt(0)}</div>
                    }
                  </div>

                  {/* Name */}
                  <span className={`text-xs leading-tight flex-1 ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>
                    {layer.name}
                  </span>

                  {/* Favorite */}
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(layer.id, layer.name, category.id, category.name); }}
                      className="shrink-0 text-sm leading-none hover:scale-125 transition-transform"
                    >
                      {favorites.includes(layer.id) ? "❤️" : "🤍"}
                    </button>
                  )}

                  {/* Toggle button */}
                  <button
                    onClick={() => { if (atLimit) return; onToggleLayer(layer.id); }}
                    disabled={atLimit}
                    className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                      isActive
                        ? 'bg-emerald-500 text-white'
                        : atLimit ? 'bg-white/4 text-slate-600 cursor-not-allowed' : 'bg-white/8 text-slate-400 hover:bg-white/15'
                    }`}
                  >
                    {isActive ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Opacity slider — no animation, just conditional render */}
                {isActive && (
                  <div className="flex items-center gap-2 px-3 pt-0.5 pb-1.5">
                    <span className="text-[10px] text-emerald-400/70 w-7 font-mono">{Math.round(opacity * 100)}%</span>
                    <Slider
                      value={[Math.round(opacity * 100)]}
                      onValueChange={([v]) => onOpacityChange(layer.id, v / 100)}
                      max={100} min={0} step={5}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}