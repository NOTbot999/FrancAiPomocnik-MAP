import React from "react";
import { Layers, ZoomIn, ZoomOut, Locate, Maximize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SLOVENIA_CENTER, DEFAULT_ZOOM, SLOVENIA_BOUNDS } from "./layerConfig";

export default function MiniToolbar({ onTogglePanel, isPanelOpen, mapRef }) {
  const handleZoomIn = () => {
    if (mapRef?.current) {
      const container = mapRef.current;
      const map = container?.querySelector('.leaflet-container')?._leaflet_map;
      // We'll use a different approach - dispatch from window
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onTogglePanel}
              className={`p-3 rounded-xl shadow-lg transition-all duration-300 ${
                isPanelOpen
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border border-slate-200/50'
              }`}
            >
              <Layers className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">Toggle Layers</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}