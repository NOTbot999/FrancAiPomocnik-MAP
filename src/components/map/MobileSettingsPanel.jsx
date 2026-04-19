import React, { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Search, Locate, Navigation, Route, Ruler, X } from "lucide-react";

const DEFAULT_BUTTONS = [
  { id: "search",  label: "Search",     icon: Search },
  { id: "locate",  label: "My Location",icon: Locate },
  { id: "gps",     label: "GPS Track",  icon: Navigation },
  { id: "tracks",  label: "My Tracks",  icon: Route },
  { id: "ruler",   label: "Ruler",      icon: Ruler },
];

function loadPrefs() {
  try {
    const saved = localStorage.getItem("mobileButtonPrefs");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { order: DEFAULT_BUTTONS.map(b => b.id), hidden: [] };
}

function savePrefs(prefs) {
  localStorage.setItem("mobileButtonPrefs", JSON.stringify(prefs));
}

export function useMobileButtonPrefs() {
  const [prefs, setPrefsState] = useState(loadPrefs);

  const setPrefs = useCallback((next) => {
    setPrefsState(next);
    savePrefs(next);
  }, []);

  return [prefs, setPrefs];
}

export default function MobileSettingsPanel({ onClose, prefs, setPrefs }) {
  const orderedButtons = prefs.order
    .map(id => DEFAULT_BUTTONS.find(b => b.id === id))
    .filter(Boolean);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newOrder = [...prefs.order];
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    setPrefs({ ...prefs, order: newOrder });
  };

  const toggleHidden = (id) => {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter(h => h !== id)
      : [...prefs.hidden, id];
    setPrefs({ ...prefs, hidden });
  };

  return (
    <div
      style={{ pointerEvents: "auto" }}
      className="absolute top-3 right-14 z-[970] w-56 bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">Toolbar Buttons</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 px-4 pt-2 pb-1">Drag to reorder · tap to show/hide</p>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="buttons">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="pb-2">
              {orderedButtons.map((btn, index) => {
                const Icon = btn.icon;
                const isHidden = prefs.hidden.includes(btn.id);
                return (
                  <Draggable key={btn.id} draggableId={btn.id} index={index}>
                    {(prov, snapshot) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-xl transition-all ${
                          snapshot.isDragging ? "bg-slate-100 shadow-lg" : "hover:bg-slate-50"
                        }`}
                      >
                        <div {...prov.dragHandleProps} className="text-slate-300 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <Icon className={`w-4 h-4 ${isHidden ? "text-slate-300" : "text-slate-600"}`} />
                        <span className={`flex-1 text-xs font-medium ${isHidden ? "text-slate-300" : "text-slate-600"}`}>
                          {btn.label}
                        </span>
                        <button
                          onClick={() => toggleHidden(btn.id)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            isHidden ? "bg-slate-200" : "bg-emerald-500"
                          }`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            isHidden ? "left-0.5" : "left-4.5"
                          }`} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}