import React, { useState, useCallback } from "react";
import MapContainerComponent from "@/components/map/MapContainer";
import LayerPanel from "@/components/map/LayerPanel";
import SearchBar from "@/components/map/SearchBar";
import DrawingTools from "@/components/map/DrawingTools";
import MiniToolbar from "@/components/map/MiniToolbar";
import MobileTopBar from "@/components/map/MobileTopBar";
import SaveLoadDrawings from "@/components/map/SaveLoadDrawings";
import { OVERLAY_CATEGORIES } from "@/components/map/layerConfig";
import { useIsMobile } from "@/hooks/use-mobile";


export default function MapViewer() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeBaseLayer, setActiveBaseLayer] = useState("osm");
  const [activeLayers, setActiveLayers] = useState({});
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [activeTool, setActiveTool] = useState("pointer");
  const [measurements, setMeasurements] = useState(null);
  const [drawings, setDrawings] = useState({ markers: [], lines: [], polygons: [] });
  const [gpsTrack, setGpsTrack] = useState([]);
  const [isGpsTracking, setIsGpsTracking] = useState(false);
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
    setGpsTrack([]);
    setIsGpsTracking(false);
    setMeasurements(null);
    setActiveTool("pointer");
  }, []);

  const handleGpsTrackUpdate = useCallback((pt) => {
    setGpsTrack(prev => [...prev, pt]);
  }, []);

  const handleGpsToggle = useCallback(() => {
    setIsGpsTracking(prev => !prev);
  }, []);

  const handleLoadDrawings = useCallback((merged) => {
    setDrawings({
      markers: merged.markers || [],
      lines: merged.lines || [],
      polygons: merged.polygons || [],
    });
    if (merged.gps_tracks && merged.gps_tracks.length > 0) {
      setGpsTrack(merged.gps_tracks[merged.gps_tracks.length - 1]);
    }
  }, []);

  const activeLayerCount = Object.keys(activeLayers).length;
  const isMobile = useIsMobile();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      <MapContainerComponent
        activeBaseLayer={activeBaseLayer}
        activeLayers={activeLayers}
        flyToLocation={flyToLocation}
        activeTool={activeTool}
        onMeasurement={setMeasurements}
        drawings={drawings}
        setDrawings={setDrawings}
        showZoomControls={!isMobile}
        mobileProps={isMobile ? {
          onTogglePanel: () => setIsPanelOpen(p => !p),
          isPanelOpen,
          activeLayerCount,
          onLocate: setFlyToLocation,
          activeTool,
          onToolChange: setActiveTool,
          onClear: handleClearDrawings,
          onLocationSelect: setFlyToLocation,
          isGpsTracking,
          onGpsToggle: handleGpsToggle,
        } : null}
        gpsTracking={{
          isTracking: isGpsTracking,
          track: gpsTrack,
          onTrackUpdate: handleGpsTrackUpdate,
        }}
      />

      {/* ── DESKTOP ONLY ── */}
      {!isMobile && (
        <>
          {/* Top-left: layers toggle */}
          <div className="absolute top-4 left-4 z-[950]">
            <MiniToolbar
              onTogglePanel={() => setIsPanelOpen(p => !p)}
              isPanelOpen={isPanelOpen}
              onLocate={setFlyToLocation}
            />
            {activeLayerCount > 0 && (
              <div className="mt-2 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg text-center">
                {activeLayerCount} layer{activeLayerCount > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Search bar — centered top */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[950] w-full max-w-md px-4">
            <SearchBar onLocationSelect={(loc) => setFlyToLocation(loc)} />
          </div>

          {/* Bottom-right: drawing tools + save/load */}
          <div className="absolute right-4 bottom-8 z-[950] flex flex-col items-end gap-2">
            <SaveLoadDrawings
              drawings={drawings}
              gpsTrack={gpsTrack}
              onLoad={handleLoadDrawings}
            />
            <DrawingTools
              activeTool={activeTool}
              onToolChange={setActiveTool}
              measurements={measurements}
              onClear={handleClearDrawings}
              onLocate={setFlyToLocation}
              isGpsTracking={isGpsTracking}
              onGpsToggle={handleGpsToggle}
            />
          </div>
        </>
      )}

      {/* Layer panel (both) */}
      <LayerPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        activeBaseLayer={activeBaseLayer}
        onBaseLayerChange={setActiveBaseLayer}
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        onOpacityChange={handleOpacityChange}
      />

      {/* App title watermark */}
      <div className="absolute bottom-3 right-3 z-[800]">
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
          <p className="text-[10px] font-semibold text-slate-600 tracking-wider uppercase">Slovenia GIS Explorer</p>
        </div>
      </div>
    </div>
  );
}