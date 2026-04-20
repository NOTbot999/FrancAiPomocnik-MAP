import React, { useState, useCallback, useEffect } from "react";
import AuthModal from "@/components/AuthModal";
import MapContainerComponent from "@/components/map/MapContainer";
import LayerPanel from "@/components/map/LayerPanel";
import SearchBar from "@/components/map/SearchBar";
import MobileTopBar from "@/components/map/MobileTopBar";
import MyTracks from "@/components/map/MyTracks";
import NavigationPanel from "@/components/map/NavigationPanel";
import OfflineManager from "@/components/map/OfflineManager";
import { OVERLAY_CATEGORIES } from "@/components/map/layerConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import AskMapPanel from "@/components/map/AskMapPanel";
import TrackAnalyzer from "@/components/map/TrackAnalyzer";
import LocationSummarizer from "@/components/map/LocationSummarizer";
import DesktopToolbar from "@/components/map/DesktopToolbar";


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

  const [showAuthModal, setShowAuthModal] = useState(false);
  useEffect(() => {
    const loggedIn = localStorage.getItem('userUsername');
    if (!loggedIn) setShowAuthModal(true);
  }, []);

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
          {/* Search bar — centered top */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[950] w-full max-w-md px-4">
            <SearchBar onLocationSelect={(loc) => handleLocate(loc)} />
          </div>

          {/* My Tracks panel */}
          {showMyTracks && (
            <div className="absolute right-20 bottom-8 z-[960]">
              <MyTracks
                gpsTrack={gpsTrack}
                onLoadTrack={handleLoadTrack}
                onClose={() => setShowMyTracks(false)}
              />
            </div>
          )}

          {/* AI Panels — desktop */}
          {isAskMapOpen && (
            <div className="absolute right-20 bottom-72 z-[960]">
              <AskMapPanel
                onClose={() => setIsAskMapOpen(false)}
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
              />
            </div>
          )}
          {isTrackAnalyzerOpen && (
            <div className="absolute right-20 bottom-72 z-[960]">
              <TrackAnalyzer
                gpsTrack={gpsTrack}
                onClose={() => setIsTrackAnalyzerOpen(false)}
              />
            </div>
          )}
          {locationSummary && (
            <div className="absolute left-1/2 top-20 -translate-x-1/2 z-[960]">
              <LocationSummarizer
                latlng={locationSummary.latlng}
                activeLayers={activeLayers}
                onClose={() => setLocationSummary(null)}
              />
            </div>
          )}

          {/* Unified draggable toolbar */}
          <DesktopToolbar
            isPanelOpen={isPanelOpen}
            onTogglePanel={() => setIsPanelOpen(p => !p)}
            activeLayerCount={activeLayerCount}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            measurements={measurements}
            onClear={handleClearDrawings}
            isGpsTracking={isGpsTracking}
            onGpsToggle={handleGpsToggle}
            showMyTracks={showMyTracks}
            onShowMyTracks={() => setShowMyTracks(p => !p)}
            onLocate={handleLocate}
            isNavOpen={isNavOpen}
            onNavToggle={() => setIsNavOpen(p => !p)}
            isAskMapOpen={isAskMapOpen}
            onAskMapToggle={() => setIsAskMapOpen(p => !p)}
            isTrackAnalyzerOpen={isTrackAnalyzerOpen}
            onTrackAnalyzerToggle={() => setIsTrackAnalyzerOpen(p => !p)}
            drawings={drawings}
            gpsTrack={gpsTrack}
            onLoadDrawings={handleLoadDrawings}
          />
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


      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}