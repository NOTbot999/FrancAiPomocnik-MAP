import React from "react";
import { useMap } from "react-leaflet";
import { Plus, Minus } from "lucide-react";
import { createPortal } from "react-dom";

export default function ZoomControls() {
  const map = useMap();
  const container = map.getContainer();

  return createPortal(
    <div
      style={{ position: "absolute", bottom: 32, left: 16, zIndex: 950 }}
      className="flex flex-col rounded-xl overflow-hidden shadow-lg border border-slate-200/50"
    >
      <button
        onClick={() => map.zoomIn()}
        className="p-3 bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white hover:text-emerald-600 transition-all duration-150 border-b border-slate-200/50"
        aria-label="Zoom in"
      >
        <Plus className="w-5 h-5" />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="p-3 bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white hover:text-emerald-600 transition-all duration-150"
        aria-label="Zoom out"
      >
        <Minus className="w-5 h-5" />
      </button>
    </div>,
    container
  );
}