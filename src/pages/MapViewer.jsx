import React, { useState, useCallback, useEffect, useRef } from "react";
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
import Map3DView from "@/components/map/Map3DView";
import LocationSummarizer from "@/components/map/LocationSummarizer";
import DesktopToolbar from "@/components/map/DesktopToolbar";
import { useUserSettings } from "@/hooks/useUserSettings";
import { base44 } from "@/api/base44Client";
import { scopedGet, scopedSet } from "@/lib/userPrefs";
import Mobile3DMenu from "@/components/map/Mobile3DMenu";
import { Layers, Locate, Navigation, Route, WifiOff, Brain, TrendingUp, Box } from "lucide-react";


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

  // Radio-style: samo ena osnovna karta naenkrat
  const handleToggleBaseLayer = useCallback((layerId) => {
    setActiveBaseLayers(prev => {
      const next = { [layerId]: { opacity: 1 } };
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

  // Custom layers: session + favorites persisted; each has a `visible` flag for ON/OFF
  const [customLayers, setCustomLayers] = useState(() => scopedGet("savedCustomLayers") || []);
  const [favoritedCustomLayerIds, setFavoritedCustomLayerIds] = useState(() => scopedGet("favCustomLayerIds") || []);
  const [customLayerOpacities, setCustomLayerOpacities] = useState(() => scopedGet("customLayerOpacities") || {});
  const [customLayerVisible, setCustomLayerVisible] = useState(() => scopedGet("customLayerVisible") || {});

  const handleAddCustomLayer = useCallback((layer) => {
    const id = layer.id || `custom_${Date.now()}`;
    setCustomLayers(prev => {
      // Prevent duplicates — replace existing layer with same id
      const filtered = prev.filter(l => l.id !== id);
      return [...filtered, { ...layer, id }];
    });
    setCustomLayerVisible(prev => {
      const next = { ...prev, [id]: true };
      scopedSet("customLayerVisible", next);
      return next;
    });
  }, []);

  const handleToggleCustomLayerVisible = useCallback((layerId) => {
    setCustomLayerVisible(prev => {
      const next = { ...prev, [layerId]: !prev[layerId] };
      scopedSet("customLayerVisible", next);
      return next;
    });
  }, []);

  const handleCustomLayerOpacity = useCallback((layerId, opacity) => {
    setCustomLayerOpacities(prev => {
      const next = { ...prev, [layerId]: opacity };
      scopedSet("customLayerOpacities", next);
      return next;
    });
  }, []);

  const handleFavoriteCustomLayer = useCallback((layerId) => {
    setCustomLayers(prev => {
      const layer = prev.find(l => l.id === layerId);
      setFavoritedCustomLayerIds(favs => {
        const isFav = favs.includes(layerId);
        if (isFav) {
          const next = favs.filter(id => id !== layerId);
          scopedSet("favCustomLayerIds", next);
          return next;
        } else {
          const next = [...favs, layerId];
          scopedSet("favCustomLayerIds", next);
          if (layer) {
            const saved = scopedGet("savedCustomLayers") || [];
            scopedSet("savedCustomLayers", [...saved.filter(l => l.id !== layerId), layer]);
          }
          return next;
        }
      });
      return prev;
    });
  }, []);

  const handleRemoveCustomLayer = useCallback((layerId) => {
    setCustomLayers(prev => prev.filter(l => l.id !== layerId));
    setFavoritedCustomLayerIds(prev => {
      const next = prev.filter(id => id !== layerId);
      scopedSet("favCustomLayerIds", next);
      const saved = scopedGet("savedCustomLayers") || [];
      scopedSet("savedCustomLayers", saved.filter(l => l.id !== layerId));
      return next;
    });
    setCustomLayerVisible(prev => { const next = { ...prev }; delete next[layerId]; scopedSet("customLayerVisible", next); return next; });
    setCustomLayerOpacities(prev => { const next = { ...prev }; delete next[layerId]; scopedSet("customLayerOpacities", next); return next; });
  }, []);

  // Shared search category active layers — lifted up so both mobile and desktop SearchBar share state
  const [activeSearchLayers, setActiveSearchLayers] = useState({});

  const [routePolyline, setRoutePolyline] = useState(null);
  const [aiRoutePolyline, setAiRoutePolyline] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isOfflineOpen, setIsOfflineOpen] = useState(false);
  const [isTrackAnalyzerOpen, setIsTrackAnalyzerOpen] = useState(false);
  const [is3DOpen, setIs3DOpen] = useState(false);
  const [mapLibreEverOpened, setMapLibreEverOpened] = useState(false);
  const [use3DMode, setUse3DMode] = useState(true); // true = 3D terrain, false = 2D rotatable
  const [activeMLBase, setActiveMLBase] = useState("satellite");
  const map3DRef = useRef(null);
  const [locationSummary, setLocationSummary] = useState(null); // { latlng: [lat, lng] }
  const [mapCenter, setMapCenter] = useState([46.1512, 14.9955]);
  const [mapZoom, setMapZoom] = useState(9);
  const [isMobile3DMenuOpen, setIsMobile3DMenuOpen] = useState(false);
  const [mobileButtonPrefs, setMobileButtonPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem("mobileButtonPrefs");
      return saved ? JSON.parse(saved) : { order: [], hidden: [] };
    } catch { return { order: [], hidden: [] }; }
  });

  // Listen for preference changes
  useEffect(() => {
    const handlePrefsChange = (e) => {
      setMobileButtonPrefs(e.detail);
    };
    window.addEventListener("mobilePrefsChanged", handlePrefsChange);
    return () => window.removeEventListener("mobilePrefsChanged", handlePrefsChange);
  }, []);

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
  const [hasSeenAuthPrompt, setHasSeenAuthPrompt] = useState(
    () => !!localStorage.getItem('hasSeenAuthPrompt')
  );
  useEffect(() => {
    const loggedIn = localStorage.getItem('userUsername');
    setCurrentUser(loggedIn);
    // Show auth modal only for users who have never seen it and are not logged in
    if (!loggedIn && !localStorage.getItem('hasSeenAuthPrompt')) {
      setShowAuthModal(true);
    }
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: "#e8ede8", backgroundImage: "url('https://media.base44.com/images/public/69ad3ce309822f8e71f66838/b15473e19_5992128811794894233.jpg')", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>

      {/* MapLibre 3D/2D-rotatable map — kept mounted once initialized to avoid re-init on toggle */}
      <div style={{ position: "absolute", inset: 0, visibility: is3DOpen ? "visible" : "hidden", pointerEvents: is3DOpen ? "auto" : "none", display: mapLibreEverOpened ? undefined : "none" }}>
        <Map3DView
          ref={map3DRef}
          center={mapCenter}
          zoom={mapZoom}
          is3D={use3DMode}
          isVisible={is3DOpen}
          onClose={() => setIs3DOpen(false)}
          activeBaseLayers={Object.fromEntries(Object.entries(activeBaseLayers).map(([id]) => [id, true]))}
          activeLayers={Object.fromEntries(Object.entries(activeLayers).map(([id]) => [id, true]))}
          layerOpacities={Object.fromEntries(Object.entries(activeLayers).map(([id, v]) => [id, v?.opacity ?? 0.7]))}
          baseLayerOpacities={Object.fromEntries(Object.entries(activeBaseLayers).map(([id, v]) => [id, v?.opacity ?? 1]))}
          activeMLBase={activeMLBase}
          onMLBaseChange={(id) => { setActiveMLBase(id); }}
          customLayers={customLayers}
          customLayerVisible={customLayerVisible}
          customLayerOpacities={customLayerOpacities}
          gpsTrack={gpsTrack}
          onPinPicked={isPinPicking ? (latlng) => { setPinnedLocation([latlng.lat, latlng.lng]); setIsPinPicking(false); } : null}
        />
      </div>

      {/* Leaflet 2D map — hidden (not unmounted) when 3D is active to preserve state */}
      <div style={{ position: "absolute", inset: 0, visibility: is3DOpen ? "hidden" : "visible", pointerEvents: is3DOpen ? "none" : "auto" }}>
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
        customLayers={customLayers}
        customLayerOpacities={customLayerOpacities}
        customLayerVisible={customLayerVisible}
        onRemoveCustomLayer={handleRemoveCustomLayer}
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
          isTrackAnalyzerOpen,
          onTrackAnalyzerToggle: () => setIsTrackAnalyzerOpen(p => !p),
          measurements,
          onAddCustomLayer: handleAddCustomLayer,
          onRemoveCustomLayer: handleRemoveCustomLayer,
          activeSearchLayers,
          onSearchLayersChange: setActiveSearchLayers,
          is3DOpen,
          on3DToggle: () => { setIs3DOpen(p => !p); setMapLibreEverOpened(true); },
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
      </div>

      {/* ── DESKTOP ONLY ── */}
      {!isMobile && (
        <>
          {/* Search bar — centered top */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[950] w-full max-w-md px-4">
            <SearchBar onLocationSelect={(loc) => handleLocate(loc)} mapCenter={mapCenter} onAddCustomLayer={handleAddCustomLayer} onRemoveCustomLayer={handleRemoveCustomLayer} activeSearchLayers={activeSearchLayers} onSearchLayersChange={setActiveSearchLayers} />
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
                onAddCustomLayer={handleAddCustomLayer}
                onRemoveCustomLayer={handleRemoveCustomLayer}
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
            is3DOpen={is3DOpen}
            on3DToggle={() => { setIs3DOpen(p => !p); setMapLibreEverOpened(true); }}
            use3DMode={use3DMode}
            onToggle3DMode={() => { setUse3DMode(p => !p); setIs3DOpen(true); setMapLibreEverOpened(true); }}
          />
        </>
      )}

      {/* Mobile 3D overlay controls — visible on top of MapLibre when 3D is active */}
      {isMobile && is3DOpen && (
        <>
          {/* Right side tool stack - vertical column with close and settings at top */}
          <div className="absolute top-3 right-3 z-[960] flex flex-col gap-2" style={{ pointerEvents: "auto" }}>
            {/* Close 3D */}
            <button
              onClick={() => setIs3DOpen(false)}
              className="flex items-center justify-center rounded-xl border border-red-400/50 shadow-md bg-black/40 backdrop-blur"
              style={{ padding: "10px", color: "#f87171" }}
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            {/* Settings button */}
            <button
              onClick={() => setIsMobile3DMenuOpen(true)}
              className="flex items-center justify-center rounded-xl border border-slate-400/40 shadow-md bg-black/40 backdrop-blur"
              style={{ padding: "10px", color: "#fff" }}
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg>
            </button>
            {mobileButtonPrefs.order?.map((btnId) => {
              if (mobileButtonPrefs.hidden?.includes(btnId)) return null;
              
              const buttonConfigs = {
                layers: { Icon: Layers, label: "Sloji", onClick: () => setIsPanelOpen(p => !p), isActive: isPanelOpen },
                locate: { Icon: Locate, label: "Moja lokacija", onClick: () => handleLocate(mapCenter), isActive: false },
                gps: { Icon: Navigation, label: "GPS sled", onClick: () => handleGpsToggle(), isActive: isGpsTracking },
                nav: { Icon: Route, label: "Navigacija", onClick: () => setIsNavOpen(p => !p), isActive: isNavOpen },
                offline: { Icon: WifiOff, label: "Offline karte", onClick: () => setIsOfflineOpen(p => !p), isActive: isOfflineOpen },
                ai: { Icon: Brain, label: "AI Asistent", onClick: () => setIsAIOpen(p => !p), isActive: isAIOpen },
                trackanalyzer: { Icon: TrendingUp, label: "Analiza sledi", onClick: () => setIsTrackAnalyzerOpen(p => !p), isActive: isTrackAnalyzerOpen },
                view3d: { Icon: Box, label: "3D Pogled", onClick: () => { setIs3DOpen(p => !p); setMapLibreEverOpened(true); }, isActive: is3DOpen },
              };
              
              const config = buttonConfigs[btnId];
              if (!config) return null;
              const Icon = config.Icon;
              
              return (
                <button
                  key={btnId}
                  onClick={config.onClick}
                  className="flex items-center justify-center rounded-xl border shadow-md bg-black/40 backdrop-blur relative"
                  style={{ padding: "10px", color: config.isActive ? "#10b981" : "#fff", borderColor: config.isActive ? "rgba(16, 185, 129, 0.6)" : "rgba(148, 163, 184, 0.4)" }}
                  title={config.label}
                >
                  <Icon width={20} height={20} />
                </button>
              );
            })}
          </div>
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
            onAddCustomLayer={handleAddCustomLayer}
            onRemoveCustomLayer={handleRemoveCustomLayer}
          />
        </div>
      )}

      {/* Pin picking overlay — works both on Leaflet and MapLibre */}
      {isPinPicking && (
        <div className="absolute inset-0 z-[970] pointer-events-none flex items-center justify-center" style={{ cursor: "crosshair" }}>
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-xl shadow-xl pointer-events-auto">
            Klikni na karto za izbiro točke analize
            <button onClick={() => setIsPinPicking(false)} className="ml-3 text-slate-400 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* TrackAnalyzer panel (mobile) */}
      {isMobile && isTrackAnalyzerOpen && (
        <div className="absolute bottom-16 right-12 z-[960]">
          <TrackAnalyzer
            gpsTrack={gpsTrack}
            onClose={() => setIsTrackAnalyzerOpen(false)}
          />
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
        customLayers={customLayers}
        customLayerOpacities={customLayerOpacities}
        customLayerVisible={customLayerVisible}
        onToggleCustomLayerVisible={handleToggleCustomLayerVisible}
        onCustomLayerOpacity={handleCustomLayerOpacity}
        onRemoveCustomLayer={handleRemoveCustomLayer}
        favoritedCustomLayerIds={favoritedCustomLayerIds}
        onFavoriteCustomLayer={handleFavoriteCustomLayer}
        is3DOpen={is3DOpen}
        activeMLBase={activeMLBase}
        onMLBaseChange={(id) => { setActiveMLBase(id); map3DRef.current?.switchBase(id); }}
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
          onClose={() => {
            setShowAuthModal(false);
            // Mark that user has seen the prompt so it doesn't show again
            localStorage.setItem('hasSeenAuthPrompt', '1');
            setHasSeenAuthPrompt(true);
          }}
          onSuccess={(data) => {
            setCurrentUser(data?.username || localStorage.getItem('userUsername'));
            setShowAuthModal(false);
            localStorage.setItem('hasSeenAuthPrompt', '1');
            if (data?.is_premium) setIsPremium(true);
          }}
        />
      )}

      {/* Mobile 3D Menu */}
      {isMobile3DMenuOpen && (
        <Mobile3DMenu
          onClose={() => setIsMobile3DMenuOpen(false)}
          isPanelOpen={isPanelOpen}
          onTogglePanel={() => setIsPanelOpen(p => !p)}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          isGpsTracking={isGpsTracking}
          onGpsToggle={handleGpsToggle}
          isNavOpen={isNavOpen}
          onNavToggle={() => setIsNavOpen(p => !p)}
          isOfflineOpen={isOfflineOpen}
          onOfflineToggle={() => setIsOfflineOpen(p => !p)}
          isTrackAnalyzerOpen={isTrackAnalyzerOpen}
          onTrackAnalyzerToggle={() => setIsTrackAnalyzerOpen(p => !p)}
          isAIOpen={isAIOpen}
          onAIToggle={() => setIsAIOpen(p => !p)}
          onLocate={handleLocate}
          measurements={measurements}
          gpsTrack={gpsTrack}
          showMyTracks={showMyTracks}
          onShowMyTracks={() => setShowMyTracks(p => !p)}
          onLoadTrack={handleLoadTrack}
          is3DOpen={is3DOpen}
          on3DToggle={() => { setIs3DOpen(p => !p); setMapLibreEverOpened(true); }}
          onAddCustomLayer={handleAddCustomLayer}
          onRemoveCustomLayer={handleRemoveCustomLayer}
          activeSearchLayers={activeSearchLayers}
          onSearchLayersChange={setActiveSearchLayers}
        />
      )}
    </div>
  );
}