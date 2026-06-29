import React, { useState, useCallback } from "react";
import { Loader2, Eye, EyeOff, Trash2, Pencil, Check } from "lucide-react";
import { CATEGORIES, fetchFullSloveniaLayer } from "./SearchBar";
import { loadCaves, cavesToLayerFeatures } from "./CaveLayer";

const HIDDEN_BUILTIN_KEY = "hiddenCategoryIds";
const HIDDEN_CUSTOM_KEY = "hiddenCustomMenuIds";

function loadHidden(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function saveHidden(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

// Franc-created custom layers shown as menu buttons
function isFrancLayer(l) {
  return l && (l._francSavedId || (typeof l.id === "string" && l.id.startsWith("franc_")));
}

export default function CategoryGrid({
  onAddCustomLayer,
  onRemoveCustomLayer,
  activeSearchLayers,
  onSearchLayersChange,
  customMenuLayers = [],
  customMenuActive = {},
  onToggleCustomMenuLayer,
  onDeleteCustomMenuLayer,
}) {
  const [manageMode, setManageMode] = useState(false);
  const [hiddenBuiltin, setHiddenBuiltin] = useState(() => loadHidden(HIDDEN_BUILTIN_KEY));
  const [hiddenCustom, setHiddenCustom] = useState(() => loadHidden(HIDDEN_CUSTOM_KEY));
  const [loadingCat, setLoadingCat] = useState(null);

  const activeLayers = activeSearchLayers || {};
  const setActiveLayers = onSearchLayersChange || (() => {});

  const toggleHiddenBuiltin = (id) => {
    const next = hiddenBuiltin.includes(id)
      ? hiddenBuiltin.filter(h => h !== id)
      : [...hiddenBuiltin, id];
    setHiddenBuiltin(next);
    saveHidden(HIDDEN_BUILTIN_KEY, next);
  };

  const toggleHiddenCustom = (id) => {
    const next = hiddenCustom.includes(id)
      ? hiddenCustom.filter(h => h !== id)
      : [...hiddenCustom, id];
    setHiddenCustom(next);
    saveHidden(HIDDEN_CUSTOM_KEY, next);
    // If un-hiding, keep map state as-is; if hiding the button only (not the layer), do nothing to map
  };

  const handleDeleteCustom = (layer) => {
    if (onDeleteCustomMenuLayer) onDeleteCustomMenuLayer(layer);
    // also drop from hidden list
    const next = hiddenCustom.filter(h => h !== layer.id);
    setHiddenCustom(next);
    saveHidden(HIDDEN_CUSTOM_KEY, next);
  };

  // Built-in category click (fetch / municipality / cave / toggle)
  const handleCategoryClick = useCallback(async (cat) => {
    if (!onAddCustomLayer) return;

    if (activeLayers[cat.id]) {
      if (onRemoveCustomLayer) onRemoveCustomLayer(activeLayers[cat.id]);
      setActiveLayers(prev => { const n = { ...prev }; delete n[cat.id]; return n; });
      return;
    }

    if (cat._municipalityLayer) {
      const layerId = `search_municipality`;
      onAddCustomLayer({ id: layerId, name: "🏘️ Občine", color: "#b45309", features: [], _searchCat: cat.id, _municipalityLayer: true });
      setActiveLayers(prev => ({ ...prev, [cat.id]: layerId }));
      return;
    }

    if (cat._caveDbLayer) {
      setLoadingCat(cat.id);
      try {
        const caves = await loadCaves();
        const features = cavesToLayerFeatures(caves);
        const layerId = `search_${cat.id}`;
        onAddCustomLayer({ id: layerId, name: "🕳️ Jame", color: "#78716c", features, _searchCat: cat.id, _caveDbLayer: true });
        setActiveLayers(prev => ({ ...prev, [cat.id]: layerId }));
      } finally { setLoadingCat(null); }
      return;
    }

    setLoadingCat(cat.id);
    try {
      const layer = await fetchFullSloveniaLayer(cat);
      if (layer) {
        const layerId = `search_${cat.id}`;
        onAddCustomLayer({ ...layer, id: layerId, _searchCat: cat.id });
        setActiveLayers(prev => ({ ...prev, [cat.id]: layerId }));
      }
    } catch {
      const layerId = `search_${cat.id}`;
      onAddCustomLayer({ id: layerId, name: `${cat.emoji} ${cat.label}`, color: cat.color, features: [], _searchCat: cat.id });
      setActiveLayers(prev => ({ ...prev, [cat.id]: layerId }));
    } finally { setLoadingCat(null); }
  }, [activeLayers, onAddCustomLayer, onRemoveCustomLayer, setActiveLayers]);

  const francLayers = (customMenuLayers || []).filter(isFrancLayer);
  const visibleBuiltin = CATEGORIES.filter(c => !hiddenBuiltin.includes(c.id));
  const visibleCustom = francLayers.filter(l => !hiddenCustom.includes(l.id));

  const activeCount = Object.keys(activeLayers).length;

  const clearAll = () => {
    Object.values(activeLayers).forEach(lid => onRemoveCustomLayer && onRemoveCustomLayer(lid));
    setActiveLayers({});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {manageMode ? "Urejanje menija" : "Označi na karti — celotna Slovenija"}
        </p>
        <div className="flex items-center gap-2">
          {!manageMode && activeCount > 0 && (
            <button onClick={clearAll} className="text-[10px] text-red-400 hover:text-red-600 transition-colors font-medium">
              Počisti vse
            </button>
          )}
          <button
            onClick={() => setManageMode(m => !m)}
            className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-lg transition-colors ${
              manageMode ? "bg-emerald-100 text-emerald-700" : "text-slate-400 hover:text-emerald-600"
            }`}
            title={manageMode ? "Zaključi urejanje" : "Uredi meni (skrij/prikaži/izbriši)"}
          >
            {manageMode ? <><Check className="w-3 h-3" /> Done</> : <><Pencil className="w-3 h-3" /> Uredi</>}
          </button>
        </div>
      </div>

      {manageMode && (
        <p className="text-[10px] text-slate-400 mb-2 px-1">
          👁 Skrij/prikaži gumb · 🗑 izbriši Franc sloj. Skriti gumbi so prikazani sivo.
        </p>
      )}

      <div className="grid grid-cols-5 gap-1">
        {/* Built-in categories */}
        {(manageMode ? CATEGORIES : visibleBuiltin).map(cat => {
          const isActive = !!activeLayers[cat.id];
          const isLoading = loadingCat === cat.id;
          const isHidden = hiddenBuiltin.includes(cat.id);
          return (
            <div key={cat.id} className="relative">
              {manageMode && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); toggleHiddenBuiltin(cat.id); }}
                  className="absolute top-0.5 left-0.5 z-10 w-4 h-4 rounded-full bg-white/90 shadow flex items-center justify-center"
                  title={isHidden ? "Prikaži v meniju" : "Skrij v meniju"}
                >
                  {isHidden ? <EyeOff className="w-2.5 h-2.5 text-slate-400" /> : <Eye className="w-2.5 h-2.5 text-emerald-500" />}
                </button>
              )}
              <button
                onClick={() => handleCategoryClick(cat)}
                disabled={isLoading || (manageMode && isHidden)}
                className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-center transition-all ${
                  isHidden ? "opacity-30" :
                  isActive ? "ring-2 text-emerald-700" :
                  isLoading ? "bg-slate-100 text-slate-400 cursor-wait" :
                  "hover:bg-slate-50 text-slate-600"
                }`}
                style={isActive && !isHidden ? { backgroundColor: cat.color + "15", ringColor: cat.color } : {}}
              >
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <span className="text-lg leading-none">{cat.emoji}</span>
                }
                <span className="text-[9px] leading-tight text-center w-full truncate">{cat.label}</span>
                {isActive && !isHidden && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                )}
              </button>
            </div>
          );
        })}

        {/* Franc AI custom layers */}
        {(manageMode ? francLayers : visibleCustom).map(layer => {
          const isActive = customMenuActive[layer.id] === true;
          const isHidden = hiddenCustom.includes(layer.id);
          const emoji = layer.emoji || "✨";
          const label = (layer.name || "").replace(/^\S+\s/, "").slice(0, 12);
          return (
            <div key={layer.id} className="relative">
              {manageMode && (
                <>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); toggleHiddenCustom(layer.id); }}
                    className="absolute top-0.5 left-0.5 z-10 w-4 h-4 rounded-full bg-white/90 shadow flex items-center justify-center"
                    title={isHidden ? "Prikaži v meniju" : "Skrij v meniju"}
                  >
                    {isHidden ? <EyeOff className="w-2.5 h-2.5 text-slate-400" /> : <Eye className="w-2.5 h-2.5 text-emerald-500" />}
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(layer); }}
                    className="absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-red-50"
                    title="Izbriši sloj"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-red-500" />
                  </button>
                </>
              )}
              <button
                onClick={() => onToggleCustomMenuLayer && onToggleCustomMenuLayer(layer.id)}
                disabled={manageMode && isHidden}
                className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-center transition-all ${
                  isHidden ? "opacity-30" :
                  isActive ? "ring-2 text-emerald-700" :
                  "hover:bg-slate-50 text-slate-600"
                }`}
                style={isActive && !isHidden ? { backgroundColor: (layer.color || "#10b981") + "15", ringColor: layer.color || "#10b981" } : {}}
                title={layer.name}
              >
                <span className="text-lg leading-none">{emoji}</span>
                <span className="text-[9px] leading-tight text-center w-full truncate">{label || "Franc"}</span>
                {isActive && !isHidden && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: layer.color || "#10b981" }} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}