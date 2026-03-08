import React, { useState, useCallback, useRef } from "react";
import MapContainerComponent from "@/components/map/MapContainer";
import LayerPanel from "@/components/map/LayerPanel";
import SearchBar from "@/components/map/SearchBar";
import DrawingTools from "@/components/map/DrawingTools";
import MiniToolbar from "@/components/map/MiniToolbar";
import { OVERLAY_CATEGORIES } from "@/components/map/layerConfig";

export default function MapViewer() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeBaseLayer, setActiveBaseLayer] = useState("osm");
  const [activeLayers, setActiveLayers] = useState({});
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [activeTool, setActiveTool] = useState("pointer");
  const [measurements, setMeasurements] = useState(null);
  const [drawings, setDrawings] = useState({ markers: [], lines: [], polygons: [] });
  const mapRef = useRef(null);

  const handleToggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => {
      if (prev[layerId]) {
        const next = { ...prev };
        delete next[layerId];
        return next;
      }
      // Find the layer config to get default opacity
      let defaultOpacity = 0.7;
      for (const cat of OVERLAY_CATEGORIES) {
        const found = cat.layers.find(l => l.id === layerId);
        if (found) {
          defaultOpacity = found.opacity;
          break;
        }
      }
      return { ...prev, [layerId]: { opacity: defaultOpacity } };
    });
  }, []);

  const handleOpacityChange = useCallback((layerId, opacity) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], opacity }
    }));
  }, []);

  const handleClearDrawings = useCallback(() => {
    setDrawings({ markers: [], lines: [], polygons: [] });
    setMeasurements(null);
    setActiveTool("pointer");
  }, []);

  const activeLayerCount = Object.keys(activeLayers).length;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950" ref={mapRef}>
      {/* Map */}
      <MapContainerComponent
        activeBaseLayer={activeBaseLayer}
        activeLayers={activeLayers}
        flyToLocation={flyToLocation}
        activeTool={activeTool}
        onMeasurement={setMeasurements}
        drawings={drawings}
        setDrawings={setDrawings}
      />

      {/* Top bar overlay */}
      <div className="absolute top-4 left-4 right-4 z-[950] flex items-start gap-3">
        {/* Layer toggle */}
        <MiniToolbar
          onTogglePanel={() => setIsPanelOpen(p => !p)}
          isPanelOpen={isPanelOpen}
          mapRef={mapRef}
        />

        {/* Search */}
        <div className="flex-1 max-w-md">
          <SearchBar onLocationSelect={(loc) => setFlyToLocation(loc)} />
        </div>

        {/* Active layers badge */}
        {activeLayerCount > 0 && (
          <div className="bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg">
            {activeLayerCount} layer{activeLayerCount > 1 ? 's' : ''} active
          </div>
        )}
      </div>

      {/* Layer panel */}
      <LayerPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        activeBaseLayer={activeBaseLayer}
        onBaseLayerChange={setActiveBaseLayer}
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        onOpacityChange={handleOpacityChange}
      />

      {/* Drawing tools - right side */}
      <div className="absolute right-4 bottom-20 z-[950]">
        <DrawingTools
          activeTool={activeTool}
          onToolChange={setActiveTool}
          measurements={measurements}
          onClear={handleClearDrawings}
        />
      </div>

      {/* App title watermark */}
      <div className="absolute bottom-3 right-3 z-[800]">
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
          <p className="text-[10px] font-semibold text-slate-600 tracking-wider uppercase">Slovenia GIS Explorer</p>
        </div>
      </div>
    </div>
  );
}