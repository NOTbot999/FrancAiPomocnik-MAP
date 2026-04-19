import React, { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import MapContainerComponent from "@/components/map/MapContainer";
import LayerPanel from "@/components/map/LayerPanel";
import SearchBar from "@/components/map/SearchBar";
import DrawingTools from "@/components/map/DrawingTools";
import MiniToolbar from "@/components/map/MiniToolbar";
import MobileTopBar from "@/components/map/MobileTopBar";
import SaveLoadDrawings from "@/components/map/SaveLoadDrawings";
import MyTracks from "@/components/map/MyTracks";
import NavigationPanel from "@/components/map/NavigationPanel";
import OfflineManager from "@/components/map/OfflineManager";
import { OVERLAY_CATEGORIES } from "@/components/map/layerConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import AskMapPanel from "@/components/map/AskMapPanel";
import TrackAnalyzer from "@/components/map/TrackAnalyzer";
import LocationSummarizer from "@/components/map/LocationSummarizer";


export default function MapViewer() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeBaseLayers, setActiveBaseLayers] = useState({ osm: { opacity: 1 } });
  const [activeLayers, setActiveLayers] = useState({});
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [activeTool, setActiveTool] = useState("pointer");
  const [measurements, setMeasurements] = useState(null);
  const [drawings, setDrawings] = useState({ markers: [], lines: [], polygons: [] });
  const [gpsTrack, setGpsTrack] = useState([]);
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [showMyTracks, setShowMyTracks] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0);

  const handleLocate = useCallback((loc) => {
    setFlyToLocation(loc);
    setLocateTrigger(t => t + 1);
  }, []);
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

  const handleToggleBaseLayer = useCallback((layerId, defaultOpacity = 1) => {
    setActiveBaseLayers(prev => {
      if (prev[layerId]) {
        const next = { ...prev };
        delete next[layerId];
        return next;
      }
      return { ...prev, [layerId]: { opacity: defaultOpacity } };
    });
  }, []);

  const handleBaseOpacityChange = useCallback((layerId, opacity) => {
    setActiveBaseLayers(prev => ({ ...prev, [layerId]: { ...prev[layerId], opacity } }));
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

  const handleLoadTrack = useCallback((trackData) => {
    setGpsTrack(trackData);
    setShowMyTracks(false);
  }, []);

  const [routePolyline, setRoutePolyline] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isOfflineOpen, setIsOfflineOpen] = useState(false);
  const [isAskMapOpen, setIsAskMapOpen] = useState(false);
  const [isTrackAnalyzerOpen, setIsTrackAnalyzerOpen] = useState(false);
  const [locationSummary, setLocationSummary] = useState(null); // { latlng: [lat, lng] }
  const [mapCenter, setMapCenter] = useState([46.1512, 14.9955]);
  const [mapZoom, setMapZoom] = useState(9);

  const handleRouteResult = useCallback((data) => {
    setRoutePolyline(data ? data.polyline : null);
  }, []);

  const activeLayerCount = Object.keys(activeLayers).length;
  const isMobile = useIsMobile();

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: "#e8ede8", backgroundImage: "url('https://media.base44.com/images/public/69ad3ce309822f8e71f66838/b15473e19_5992128811794894233.jpg')", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      <MapContainerComponent
        activeBaseLayers={activeBaseLayers}
        activeLayers={activeLayers}
        flyToLocation={flyToLocation}
        activeTool={activeTool}
        onMeasurement={setMeasurements}
        drawings={drawings}
        setDrawings={setDrawings}
        routePolyline={routePolyline}
        offlineOpen={isOfflineOpen}
        onOfflineClose={() => setIsOfflineOpen(false)}
        showZoomControls={!isMobile}
        onLocationSummary={(latlng) => setLocationSummary({ latlng })}
        mobileProps={isMobile ? {
          onTogglePanel: () => setIsPanelOpen(p => !p),
          isPanelOpen,
          activeLayerCount,
          onLocate: handleLocate,
          activeTool,
          onToolChange: setActiveTool,
          onClear: handleClearDrawings,
          onLocationSelect: setFlyToLocation,
          isGpsTracking,
          onGpsToggle: handleGpsToggle,
          onShowTracks: () => setShowMyTracks(p => !p),
          gpsTrack,
          onLoadTrack: handleLoadTrack,
          onRouteResult: handleRouteResult,
        } : null}
        locateTrigger={locateTrigger}
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
              onLocate={handleLocate}
            />
            {activeLayerCount > 0 && (
              <div className="mt-2 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg text-center">
                {activeLayerCount} layer{activeLayerCount > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Search bar — centered top */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[950] w-full max-w-md px-4">
            <SearchBar onLocationSelect={(loc) => handleLocate(loc)} />
          </div>

          {/* My Tracks panel */}
          {showMyTracks && (
            <MyTracks
              gpsTrack={gpsTrack}
              onLoadTrack={handleLoadTrack}
              onClose={() => setShowMyTracks(false)}
            />
          )}

          {/* Offline button */}
          <div className="absolute right-4 bottom-56 z-[950] flex flex-col items-end gap-2">
            <button
              onClick={() => setIsOfflineOpen(p => !p)}
              className={`p-3 rounded-xl shadow-lg transition-all duration-300 border ${
                isOfflineOpen
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border-slate-200/50'
              }`}
              title="Offline Maps"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </button>
          </div>

          {/* AI Panels — desktop */}
          <AnimatePresence>
            {isAskMapOpen && (
              <div className="absolute right-4 bottom-72 z-[960]" key="ask-map">
                <AskMapPanel
                  onClose={() => setIsAskMapOpen(false)}
                  activeLayers={activeLayers}
                  onToggleLayer={handleToggleLayer}
                  mapCenter={mapCenter}
                  mapZoom={mapZoom}
                />
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isTrackAnalyzerOpen && (
              <div className="absolute right-4 bottom-72 z-[960]" key="track-analyzer">
                <TrackAnalyzer
                  gpsTrack={gpsTrack}
                  onClose={() => setIsTrackAnalyzerOpen(false)}
                />
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {locationSummary && (
              <div className="absolute left-1/2 top-20 -translate-x-1/2 z-[960]" key="loc-summary">
                <LocationSummarizer
                  latlng={locationSummary.latlng}
                  activeLayers={activeLayers}
                  onClose={() => setLocationSummary(null)}
                />
              </div>
            )}
          </AnimatePresence>

          {/* Bottom-right: drawing tools + save/load */}
          <div className="absolute right-4 bottom-8 z-[950] flex flex-col items-end gap-2">
            <button
              onClick={() => setShowMyTracks(p => !p)}
              className={`p-3 rounded-xl shadow-lg transition-all duration-300 border ${
                showMyTracks
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white/95 backdrop-blur-xl text-slate-700 hover:bg-white border-slate-200/50'
              }`}
              title="My GPS Tracks"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 7" />
              </svg>
            </button>
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
              isNavOpen={isNavOpen}
              onNavToggle={() => setIsNavOpen(p => !p)}
              isAskMapOpen={isAskMapOpen}
              onAskMapToggle={() => setIsAskMapOpen(p => !p)}
              isTrackAnalyzerOpen={isTrackAnalyzerOpen}
              onTrackAnalyzerToggle={() => setIsTrackAnalyzerOpen(p => !p)}
            />
          </div>
        </>
      )}

      {/* My Tracks panel (mobile) */}
      {isMobile && showMyTracks && (
        <div className="absolute bottom-16 right-12 z-[960]">
          <MyTracks
            gpsTrack={gpsTrack}
            onLoadTrack={handleLoadTrack}
            onClose={() => setShowMyTracks(false)}
          />
        </div>
      )}

      {/* Layer panel (both) */}
      <LayerPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        activeBaseLayers={activeBaseLayers}
        onToggleBaseLayer={handleToggleBaseLayer}
        onBaseOpacityChange={handleBaseOpacityChange}
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        onOpacityChange={handleOpacityChange}
      />

      {/* Navigation Panel — available on both mobile and desktop */}
      <NavigationPanel
        onRouteResult={handleRouteResult}
        isOpen={isNavOpen}
        onToggle={() => setIsNavOpen(p => !p)}
        onClose={() => setIsNavOpen(false)}
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