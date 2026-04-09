import React, { useState } from "react";
import { Layers, Locate, LoaderCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export default function MiniToolbar({ onTogglePanel, isPanelOpen, onLocate }) {
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 15 });
      },
      () => { setLocating(false); }
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1.5">
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
          <TooltipContent side="right"><p className="text-xs">Toggle Layers</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export function LocateButton({ onLocate }) {
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 15 });
      },
      () => { setLocating(false); }
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleLocate}
            disabled={locating}
            className="p-3 rounded-xl shadow-lg bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border border-slate-200/50 transition-all duration-300 disabled:opacity-60"
          >
            {locating
              ? <LoaderCircle className="w-5 h-5 animate-spin" />
              : <Locate className="w-5 h-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left"><p className="text-xs">My Location</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}