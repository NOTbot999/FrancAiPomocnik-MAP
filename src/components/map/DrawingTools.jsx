import React, { useState } from "react";
import {
  Ruler, Pentagon, MapPin, Trash2, MousePointer2, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { LocateButton } from "@/components/map/MiniToolbar";

const TOOLS = [
  { id: "pointer", icon: MousePointer2, label: "Select" },
  { id: "distance", icon: Ruler, label: "Measure Distance" },
  { id: "area", icon: Pentagon, label: "Measure Area" },
  { id: "marker", icon: MapPin, label: "Place Marker" },
  { id: "clear", icon: Trash2, label: "Clear All" },
];

export default function DrawingTools({ activeTool, onToolChange, measurements, onClear, onLocate }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Tool buttons */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="flex flex-col gap-1.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl p-2 border border-slate-200/50"
          >
            <TooltipProvider>
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (tool.id === "clear") {
                            onClear();
                          } else {
                            onToolChange(tool.id === activeTool ? "pointer" : tool.id);
                          }
                        }}
                        className={`p-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : tool.id === 'clear'
                            ? 'text-red-400 hover:bg-red-50 hover:text-red-500'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">{tool.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom row: locate + ruler toggle */}
      <div className="flex items-center gap-1.5">
        <LocateButton onLocate={onLocate} />
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-3 rounded-xl shadow-lg transition-all duration-300 ${
            isExpanded
              ? 'bg-slate-800 text-white'
              : 'bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border border-slate-200/50'
          }`}
        >
          {isExpanded ? <X className="w-5 h-5" /> : <Ruler className="w-5 h-5" />}
        </button>
      </div>

      {/* Measurement display */}
      <AnimatePresence>
        {measurements && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-slate-900/90 backdrop-blur-xl text-white px-3.5 py-2 rounded-lg shadow-xl"
          >
            <p className="text-xs font-medium">{measurements}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}