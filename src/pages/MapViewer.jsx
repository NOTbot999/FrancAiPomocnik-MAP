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
import AIPanel from "@/components/map/AIPanel";
import TrackAnalyzer from "@/components/map/TrackAnalyzer";
import LocationSummarizer from "@/components/map/LocationSummarizer";
import DesktopToolbar from "@/components/map/DesktopToolbar";
import { useUserSettings } from "@/hooks/useUserSettings";
import { base44 } from "@/api/base44Client";


export default function MapViewer() {
  const { settings, updateSettings, isLoaded } = useUserSettings();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeBaseLayers, setActiveBaseLayers] = useState({ osm: { opacity: 1 } });
  const [activeLayers, setActiveLayers] = useState({});
  const [layerOrder, setLayerOrder] = useState([]); // ordered array of layerIds (bottom→top)
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [activeTool, setActiveTool] = useState("pointer");
  const [measurements, setMeasurements] = useState(null); // { type, meters, points }
  const [drawings, setDrawings] = useState({ markers: [], lines: [], polygons: [] });
  const [gpsTrack, setGpsTrack] = useState([]);
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [showMyTracks, setShowMyTracks] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState(null);
  const [isPinPicking, setIsPinPicking] = useState(false);

  // Check premium status — read from UserAccount entity via backend (service role)
  const [isPremium, setIsPremium] = useState(false);
  useEffect(() => {
    const checkPremium = async () => {
      try {
        const role = localStorage.getItem("userRole");
        if (role === "admin") { setIsPremium(true); return; }

        const username = localStorage.getItem("userUsername");
        if (!username) return;
        const res = await base44.functions.invoke('getMyPremiumStatus', { username });
        if (res.data?.is_premium === true) setIsPremium(true);
      } catch {}
    };
    checkPremium();
  }, []);

  // Restore saved settings once loaded
  useEffect(() => {
    if (!isLoaded || !settings) return;
    if (settings.active_base_layers && Object.keys(settings.active_base_layers).length > 0) {
      setActiveBaseLayers(settings.active_base_layers);
    }
    // Note: active overlay layers are intentionally NOT restored on load
    // so the counter always starts at 0/6
  }, [isLoaded]);

  const handleLocate = useCallback((loc) => {
    setFlyToLocation(loc);
    setLocateTrigger(t => t + 1);
  }, []);
  const handleToggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => {
      let next;
      if (prev[layerId]) {
        next = { ...prev };
        delete next[layerId];
        setLayerOrder(o => o.filter(id => id !== layerId));
      } else {
        let defaultOpacity = 0.7;
        for (const cat of OVERLAY_CATEGORIES) {
          const found = cat.layers.find(l => l.id === layerId);
          if (found) { defaultOpacity = found.opacity; break; }
        }
        next = { ...prev, [layerId]: { opacity: defaultOpacity } };
        setLayerOrder(o => [...o.filter(id => id !== layerId), layerId]);
      }
      updateSettings({ active_layers: next });
      return next;
    });
  }, [updateSettings]);

  const handleOpacityChange = useCallback((layerId, opacity) => {
    setActiveLayers(prev => {
      const next = { ...prev, [layerId]: { ...prev[layerId], opacity } };
      updateSettings({ active_layers: next });
      return next;
    });
  }, [updateSettings]);

  const handleToggleBaseLayer = useCallback((layerId, defaultOpacity = 1) => {
    setActiveBaseLayers(prev => {
      let next;
      if (prev[layerId]) {
        next = { ...prev };
        delete next[layerId];
      } else {
        next = { ...prev, [layerId]: { opacity: defaultOpacity } };
      }
      updateSettings({ active_base_layers: next });
      return next;
    });
  }, [updateSettings]);

  const handleBaseOpacityChange = useCallback((layerId, opacity) => {
    setActiveBaseLayers(prev => {
      const next = { ...prev, [layerId]: { ...prev[layerId], opacity } };
      updateSettings({ active_base_layers: next });
      return next;
    });
  }, [updateSettings]);

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
  const [aiRoutePolyline, setAiRoutePolyline] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isOfflineOpen, setIsOfflineOpen] = useState(false);
  const [isTrackAnalyzerOpen, setIsTrackAnalyzerOpen] = useState(false);
  const [locationSummary, setLocationSummary] = useState(null); // { latlng: [lat, lng] }
  const [mapCenter, setMapCenter] = useState([46.1512, 14.9955]);
  const [mapZoom, setMapZoom] = useState(9);

  const handleRouteResult = useCallback((data) => {
    setRoutePolyline(data ? data.polyline : null);
  }, []);

  const handleLayerReorder = useCallback((newOrder) => {
    setLayerOrder(newOrder);
  }, []);

  const activeLayerCount = Object.keys(activeLayers).length;
  const isMobile = useIsMobile();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('userUsername'));
  useEffect(() => {
    const loggedIn = localStorage.getItem('userUsername');
    setCurrentUser(loggedIn);
    if (!loggedIn) setShowAuthModal(true);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: "#e8ede8", backgroundImage: "url('https://media.base44.com/images/public/69ad3ce309822f8e71f66838/b15473e19_5992128811794894233.jpg')", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      <MapContainerComponent
        activeBaseLayers={activeBaseLayers}
        activeLayers={activeLayers}
        layerOrder={layerOrder}
        flyToLocation={flyToLocation}
        activeTool={activeTool}
        onMeasurement={(m) => setMeasurements(m)}
        drawings={drawings}
        setDrawings={setDrawings}
        routePolyline={routePolyline}
        aiRoutePolyline={aiRoutePolyline}
        offlineOpen={isOfflineOpen}
        onOfflineClose={() => setIsOfflineOpen(false)}
        showZoomControls={!isMobile}
        onLocationSummary={(latlng) => setLocationSummary({ latlng })}
        onMapMove={(center, zoom) => { setMapCenter(center); setMapZoom(zoom); }}
        mobileProps={isMobile ? {
          onTogglePanel: () => setIsPanelOpen(p => !p),
          isPanelOpen,
          activeLayerCount,
          onLocate: handleLocate,
          activeTool,
          onToolChange: setActiveTool,
          onClear: handleClearDrawings,
          onLocationSelect: setFlyToLocation,
          mapCenter,
          isGpsTracking,
          onGpsToggle: handleGpsToggle,
          onShowTracks: () => setShowMyTracks(p => !p),
          gpsTrack,
          onLoadTrack: handleLoadTrack,
          onRouteResult: handleRouteResult,
          isAIOpen,
          onAIToggle: () => setIsAIOpen(p => !p),
          measurements,
        } : null}
        isPinPicking={isPinPicking}
        onPinPicked={(latlng) => { setPinnedLocation([latlng.lat, latlng.lng]); setIsPinPicking(false); }}
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
            <SearchBar onLocationSelect={(loc) => handleLocate(loc)} mapCenter={mapCenter} />
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

          {/* AI Panel — desktop */}
          {isAIOpen && (
            <div className="absolute right-20 bottom-8 z-[960]">
              <AIPanel
                onClose={() => setIsAIOpen(false)}
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                isPremium={isPremium}
                pinnedLocation={pinnedLocation}
                onRequestPin={(mode) => {
                  if (mode === null) { setPinnedLocation(null); return; }
                  setIsPinPicking(true);
                }}
                onShowRoute={(coords) => setAiRoutePolyline(coords)}
                onFlyTo={(loc) => setFlyToLocation(loc)}
                onAddMarkers={(markers) => {
                  const newMarkers = markers.filter(m => m.lat && m.lng).map(m => ({ lat: m.lat, lng: m.lng, label: m.label, isAi: true }));
                  if (newMarkers.length > 0) {
                    setDrawings(prev => ({ ...prev, markers: [...prev.markers, ...newMarkers] }));
                  }
                }}
                onRemoveAiMarkers={() => {
                  setDrawings(prev => ({ ...prev, markers: prev.markers.filter(m => !m.isAi) }));
                  setAiRoutePolyline(null);
                }}
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
            isAIOpen={isAIOpen}
            onAIToggle={() => setIsAIOpen(p => !p)}
            isTrackAnalyzerOpen={isTrackAnalyzerOpen}
            onTrackAnalyzerToggle={() => setIsTrackAnalyzerOpen(p => !p)}
            drawings={drawings}
            gpsTrack={gpsTrack}
            onLoadDrawings={handleLoadDrawings}
          />
        </>
      )}

      {/* AI Panel — mobile */}
      {isMobile && isAIOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-[960] flex justify-center pb-4 px-3">
          <AIPanel
            onClose={() => setIsAIOpen(false)}
            activeLayers={activeLayers}
            onToggleLayer={handleToggleLayer}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            isPremium={isPremium}
            pinnedLocation={pinnedLocation}
            onRequestPin={(mode) => {
              if (mode === null) { setPinnedLocation(null); return; }
              setIsPinPicking(true);
              setIsAIOpen(false);
            }}
            onShowRoute={(coords) => setAiRoutePolyline(coords)}
            onFlyTo={(loc) => setFlyToLocation(loc)}
            onAddMarkers={(markers) => {
              const newMarkers = markers.filter(m => m.lat && m.lng).map(m => ({ lat: m.lat, lng: m.lng, label: m.label, isAi: true }));
              if (newMarkers.length > 0) {
                setDrawings(prev => ({ ...prev, markers: [...prev.markers, ...newMarkers] }));
              }
            }}
            onRemoveAiMarkers={() => {
              setDrawings(prev => ({ ...prev, markers: prev.markers.filter(m => !m.isAi) }));
              setAiRoutePolyline(null);
            }}
          />
        </div>
      )}

      {/* Pin picking overlay */}
      {isPinPicking && (
        <div className="absolute inset-0 z-[970] pointer-events-none flex items-center justify-center">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-xl shadow-xl pointer-events-auto">
            Klikni na karto za izbiro točke analize
            <button onClick={() => setIsPinPicking(false)} className="ml-3 text-slate-400 hover:text-white">✕</button>
          </div>
        </div>
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
        layerOrder={layerOrder}
        onLayerReorder={handleLayerReorder}
      />

      {/* Navigation Panel — available on both mobile and desktop */}
      <NavigationPanel
        onRouteResult={handleRouteResult}
        isOpen={isNavOpen}
        onToggle={() => setIsNavOpen(p => !p)}
        onClose={() => setIsNavOpen(false)}
      />


      {/* User badge — top left on desktop */}
      {!isMobile && currentUser && (
        <div className="absolute top-4 left-4 z-[940] flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md border border-slate-200/60">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{currentUser.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-xs font-medium text-slate-700">{currentUser}</span>
            {isPremium && <span className="text-[9px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full">PRO</span>}
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/auth';
              }}
              className="text-[10px] text-slate-400 hover:text-red-500 transition ml-1"
              title="Odjava"
            >✕</button>
          </div>
        </div>
      )}

      {!isMobile && !currentUser && (
        <div className="absolute top-4 left-4 z-[940]">
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md border border-slate-200/60 text-xs font-medium text-slate-700 hover:bg-white transition"
          >
            🔑 Prijava
          </button>
        </div>
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(data) => {
            setCurrentUser(data?.username || localStorage.getItem('userUsername'));
            setShowAuthModal(false);
            if (data?.is_premium) setIsPremium(true);
          }}
        />
      )}
    </div>
  );
}