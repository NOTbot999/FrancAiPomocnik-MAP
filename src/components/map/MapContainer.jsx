import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  WMSTileLayer,
  useMap,
  useMapEvents,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  Polygon,
} from "react-leaflet";
import { createPortal } from "react-dom";
import ZoomControls from "./ZoomControls";
import MobileTopBar from "./MobileTopBar";
import MapScaleBar from "./MapScaleBar";
import GpsTracker from "./GpsTracker";
import MyLocationDot from "./MyLocationDot";
import OfflineManager from "./OfflineManager";
import SearchCategoryLayer from "./SearchCategoryLayer";
import MunicipalityLayer from "./MunicipalityLayer";

function OfflineManagerPortal({ onClose }) {
  const map = useMap();
  const container = map.getContainer().parentElement;
  return createPortal(
    <div className="absolute right-20 bottom-56 z-[960]" style={{ position: "absolute" }}>
      <OfflineManager onClose={onClose} />
    </div>,
    container
  );
}
import { BASE_LAYERS, OVERLAY_CATEGORIES, SLOVENIA_CENTER, DEFAULT_ZOOM } from "./layerConfig";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function FlyToLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location && location.lat !== undefined && location.lng !== undefined) {
      map.flyTo([location.lat, location.lng], location.zoom || 15, { duration: 1.5 });
    }
  }, [location, map]);
  return null;
}

function CoordsDisplay({ onMapMove }) {
  const [coords, setCoords] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  useMapEvents({
    mousemove: (e) => setCoords({ lat: e.latlng.lat, lng: e.latlng.lng }),
    zoom: (e) => {
      const z = e.target.getZoom();
      const c = e.target.getCenter();
      setZoom(z);
      if (onMapMove) onMapMove([c.lat, c.lng], z);
    },
    moveend: (e) => {
      const c = e.target.getCenter();
      const z = e.target.getZoom();
      if (onMapMove) onMapMove([c.lat, c.lng], z);
    },
  });
  if (!coords) return null;
  return (
    <div className="absolute bottom-2 left-2 z-[800] bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-mono px-2.5 py-1 rounded-lg pointer-events-none">
      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} | z{zoom}
    </div>
  );
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
function formatArea(sqm) {
  if (sqm < 10000) return `${Math.round(sqm)} m²`;
  if (sqm < 1000000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${(sqm / 1000000).toFixed(2)} km²`;
}
function computeArea(points) {
  let area = 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area +=
      toRad(points[j][1] - points[i][1]) *
      (2 + Math.sin(toRad(points[i][0])) + Math.sin(toRad(points[j][0])));
  }
  return Math.abs((area * 6378137 * 6378137) / 2);
}

// SNAP_THRESHOLD_PX: if click is within this many pixels of the first point, auto-close polygon
const SNAP_THRESHOLD_PX = 35;

function DrawingHandler({ activeTool, onMeasurement, drawings, setDrawings }) {
  const [currentPoints, setCurrentPoints] = useState([]);
  const [editingMarkerIdx, setEditingMarkerIdx] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    if (activeTool === "distance" || activeTool === "marker") {
      el.style.cursor = "crosshair";
    } else {
      el.style.cursor = "";
    }
    setCurrentPoints([]);
    return () => { el.style.cursor = ""; };
  }, [activeTool, map]);

  function isUIClick(e) {
    const orig = e.originalEvent;
    if (!orig) return false;
    const target = orig.target;
    if (!target) return false;
    if (target.closest("button, input, select, textarea, [role='button'], .leaflet-control, .leaflet-popup")) return true;
    let el = target;
    while (el && el !== document.body) {
      const z = parseInt(window.getComputedStyle(el).zIndex, 10);
      if (!isNaN(z) && z >= 900) return true;
      el = el.parentElement;
    }
    return false;
  }

  // Check if latlng is within SNAP_THRESHOLD_PX pixels of the first drawn point
  function isNearFirstPoint(latlng) {
    if (currentPoints.length < 2) return false;
    const first = L.latLng(currentPoints[0]);
    const firstPx = map.latLngToContainerPoint(first);
    const clickPx = map.latLngToContainerPoint(latlng);
    const dx = firstPx.x - clickPx.x;
    const dy = firstPx.y - clickPx.y;
    return Math.sqrt(dx * dx + dy * dy) < SNAP_THRESHOLD_PX;
  }

  useMapEvents({
    click(e) {
      if (isUIClick(e)) return;
      if (activeTool === "marker") {
        setDrawings((prev) => ({
          ...prev,
          markers: [...(prev.markers || []), { lat: e.latlng.lat, lng: e.latlng.lng, label: "" }],
        }));
        return;
      }
      if (activeTool !== "distance") return;

      // Check snap-to-first-point → close as polygon
      if (isNearFirstPoint(e.latlng)) {
        const pts = currentPoints;
        // Save as polygon
        setDrawings((prev) => ({ ...prev, polygons: [...(prev.polygons || []), { points: pts, label: "" }] }));
        // Compute distance + area
        let totalDist = 0;
        for (let i = 1; i < pts.length; i++)
          totalDist += L.latLng(pts[i - 1]).distanceTo(L.latLng(pts[i]));
        // close the loop
        totalDist += L.latLng(pts[pts.length - 1]).distanceTo(L.latLng(pts[0]));
        const area = computeArea(pts);
        onMeasurement({ type: "both", meters: totalDist, areaSqm: area, points: pts });
        setCurrentPoints([]);
        return;
      }

      const pts = [...currentPoints, [e.latlng.lat, e.latlng.lng]];
      setCurrentPoints(pts);
      if (pts.length >= 2) {
        let total = 0;
        for (let i = 1; i < pts.length; i++)
          total += L.latLng(pts[i - 1]).distanceTo(L.latLng(pts[i]));
        onMeasurement({ type: "distance", meters: total, points: pts });
      }
    },
    dblclick(e) {
      if (activeTool === "distance" && currentPoints.length >= 2) {
        setDrawings((prev) => ({ ...prev, lines: [...(prev.lines || []), { points: currentPoints, label: "" }] }));
        setCurrentPoints([]);
        onMeasurement(null);
      }
    },
  });

  const dotIcon = L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  // First-point snap indicator — iconSize and iconAnchor ensure correct centering
  const snapIcon = L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;background:rgba(16,185,129,0.25);border:2.5px solid #10b981;border-radius:50%;box-shadow:0 0 8px #10b981"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const markerIcon = L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;transform:translate(-12px,-24px)"><svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='#10b981' stroke='white' stroke-width='1.5'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z'/></svg></div>`,
    iconSize: [0, 0],
  });

  return (
    <>
      {/* Live drawing line — solid, no dashes */}
      {currentPoints.length >= 2 && activeTool === "distance" && (
        <Polyline positions={currentPoints} color="#10b981" weight={3} />
      )}
      {/* Snap preview polygon fill when >= 3 points */}
      {currentPoints.length >= 3 && activeTool === "distance" && (
        <Polygon positions={currentPoints} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.08, weight: 2 }} />
      )}
      {/* Drawing dots */}
      {currentPoints.map((p, i) => (
        <Marker key={`mp-${i}`} position={p} icon={i === 0 && currentPoints.length >= 2 ? snapIcon : dotIcon} />
      ))}

      {/* Saved lines */}
      {(drawings.lines || []).map((line, i) => {
        const pts = line.points || line; // support both old array format and new {points, label}
        return (
          <React.Fragment key={`l-${i}`}>
            <Polyline positions={pts} color="#10b981" weight={2.5} />
          </React.Fragment>
        );
      })}

      {/* Saved polygons */}
      {(drawings.polygons || []).map((poly, i) => {
        const pts = poly.points || poly;
        return (
          <React.Fragment key={`pg-${i}`}>
            <Polygon positions={pts} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.15 }} />
          </React.Fragment>
        );
      })}

      {/* Markers with rename popup */}
      {(drawings.markers || []).map((m, i) => (
        <Marker key={`mk-${i}`} position={[m.lat, m.lng]} icon={markerIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              {editingMarkerIdx === i ? (
                <div className="flex flex-col gap-1">
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        setDrawings(prev => {
                          const markers = [...prev.markers];
                          markers[i] = { ...markers[i], label: editLabel };
                          return { ...prev, markers };
                        });
                        setEditingMarkerIdx(null);
                      }
                      if (e.key === "Escape") setEditingMarkerIdx(null);
                    }}
                    className="border border-slate-300 rounded px-2 py-1 text-xs w-full outline-none focus:border-emerald-500"
                    placeholder="Vnesi ime..."
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setDrawings(prev => {
                          const markers = [...prev.markers];
                          markers[i] = { ...markers[i], label: editLabel };
                          return { ...prev, markers };
                        });
                        setEditingMarkerIdx(null);
                      }}
                      className="flex-1 bg-emerald-500 text-white text-xs py-1 rounded hover:bg-emerald-600"
                    >Shrani</button>
                    <button
                      onClick={() => setEditingMarkerIdx(null)}
                      className="flex-1 bg-slate-100 text-slate-600 text-xs py-1 rounded hover:bg-slate-200"
                    >Prekliči</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {m.label && <div className="font-semibold text-xs text-slate-800">{m.label}</div>}
                  <span className="font-mono text-[10px] text-slate-500">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</span>
                  <button
                    onClick={() => { setEditingMarkerIdx(i); setEditLabel(m.label || ""); }}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-1 text-left"
                  >✏️ Preimenuj oznako</button>
                  <button
                    onClick={() => setDrawings(prev => ({ ...prev, markers: prev.markers.filter((_, idx) => idx !== i) }))}
                    className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded px-2 py-1 text-left"
                  >🗑 Odstrani</button>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// Renders base layer using a stable Leaflet tile layer (no key change = overlays stay on top)
function BaseLayerRenderer({ activeBaseLayerEntries }) {
  const map = useMap();
  const layerRef = useRef(null);
  const arcLayerRef = useRef(null);

  const entry = activeBaseLayerEntries[0]; // radio select — always one
  const layerId = entry?.[0];
  const opacity = entry?.[1]?.opacity ?? 1;
  const bl = layerId ? BASE_LAYERS.find(l => l.id === layerId) : null;

  useEffect(() => {
    // Remove any existing layers
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    if (arcLayerRef.current) { arcLayerRef.current.remove(); arcLayerRef.current = null; }
    if (!bl) return;

    if (bl.type === 'arcgis_export') {
      const arcLayer = L.tileLayer("about:blank", {
        tileSize: 256, opacity, maxZoom: 22, maxNativeZoom: 19,
        bounds: [[45.3, 13.3], [46.9, 16.8]],
        keepBuffer: 2, updateWhenIdle: true, updateWhenZooming: false,
        pane: "tilePane",
      });
      const useSR = bl.bboxSR || 3857;
      const useFormat = bl.format || "jpg";
      arcLayer.getTileUrl = function (coords) {
        const tileBounds = this._tileCoordsToBounds(coords);
        const size = this.getTileSize();
        let bbox;
        if (useSR === 4326) {
          const sw = tileBounds.getSouthWest(); const ne = tileBounds.getNorthEast();
          bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
        } else {
          const sw = map.options.crs.project(tileBounds.getSouthWest());
          const ne = map.options.crs.project(tileBounds.getNorthEast());
          bbox = `${sw.x},${sw.y},${ne.x},${ne.y}`;
        }
        return bl.arcgisUrl + `?bbox=${bbox}&bboxSR=${useSR}&imageSR=${useSR}&size=${size.x},${size.y}&f=image&format=${useFormat}&transparent=false`;
      };
      arcLayer.addTo(map);
      arcLayerRef.current = arcLayer;
    } else {
      const tl = L.tileLayer(bl.url, {
        attribution: bl.attribution || "",
        maxZoom: 22, maxNativeZoom: bl.maxNativeZoom || 19,
        opacity, keepBuffer: 4, updateWhenIdle: false, updateWhenZooming: false,
        pane: "tilePane",
      });
      tl.addTo(map);
      layerRef.current = tl;
    }
  }, [layerId]); // only re-create when layer TYPE changes

  // Update opacity without re-creating
  useEffect(() => {
    if (layerRef.current) layerRef.current.setOpacity(opacity);
    if (arcLayerRef.current) arcLayerRef.current.setOpacity(opacity);
  }, [opacity]);

  // Ensure base layer is always below overlays (bring to back)
  useEffect(() => {
    if (layerRef.current?.bringToBack) layerRef.current.bringToBack();
    if (arcLayerRef.current?.bringToBack) arcLayerRef.current.bringToBack();
  });

  return null;
}

function getAllLayersFlat() {
  const map = {};
  OVERLAY_CATEGORIES.forEach((cat) => cat.layers.forEach((l) => { map[l.id] = l; }));
  return map;
}

// ArcGIS MapServer export as a Leaflet TileLayer (dynamic tiles via /export endpoint)
// bboxSR=4326 works best with ARSO D96TM cached services; bboxSR=3857 for dynamic services like LIDAR
function ArcGISExportLayer({ url, opacity, layerIds, maxZoom, maxNativeZoom, bboxSR, imageSR, transparent, format, pane, zIndex, enhance }) {
   const map = useMap();
   const layerRef = useRef(null);
   const useBboxSR = bboxSR || 3857;
   const useImageSR = imageSR || useBboxSR || 3857;
   const useFormat = format || (transparent ? "png32" : "jpg");
   const useTransparent = transparent !== false;

   useEffect(() => {
     const arcLayer = L.tileLayer("about:blank", {
       tileSize: 256,
       opacity,
       maxZoom: maxZoom || 22,
       maxNativeZoom: maxNativeZoom || 19,
       bounds: [[45.3, 13.3], [46.9, 16.8]],
       keepBuffer: 2,
       updateWhenIdle: true,
       updateWhenZooming: false,
       pane: pane || "overlayPane",
       zIndex: zIndex || 400,
     });

    arcLayer.getTileUrl = function (coords) {
      const tileBounds = this._tileCoordsToBounds(coords);
      const size = this.getTileSize();
      let bbox;
      if (useBboxSR === 4326) {
        const sw = tileBounds.getSouthWest();
        const ne = tileBounds.getNorthEast();
        bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
      } else {
        const sw = map.options.crs.project(tileBounds.getSouthWest());
        const ne = map.options.crs.project(tileBounds.getNorthEast());
        bbox = `${sw.x},${sw.y},${ne.x},${ne.y}`;
      }
      return (
        url +
        `?bbox=${bbox}&bboxSR=${useBboxSR}&imageSR=${useImageSR}&size=${size.x},${size.y}&f=image&format=${useFormat}&transparent=${useTransparent}` +
        (layerIds ? `&layers=${layerIds}` : "")
      );
    };

    arcLayer.addTo(map);
    // Apply CSS image-rendering + filter for sharper hillshade
    if (enhance) {
      arcLayer.on("tileload", (e) => {
        e.tile.style.imageRendering = "crisp-edges";
        e.tile.style.filter = "contrast(1.25) brightness(1.05)";
      });
    }
    layerRef.current = arcLayer;
    return () => { arcLayer.remove(); };
    }, [url, opacity, layerIds, map, useBboxSR, useImageSR, useFormat, useTransparent, enhance]);

  // Update opacity
  useEffect(() => {
    if (layerRef.current) layerRef.current.setOpacity(opacity);
  }, [opacity]);

  return null;
}

function RightClickHandler({ onLocationSummary }) {
  useMapEvents({
    contextmenu(e) {
      if (onLocationSummary) onLocationSummary([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

function PinPickHandler({ onPinPicked }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.cursor = "crosshair";
    return () => { map.getContainer().style.cursor = ""; };
  }, [map]);
  useMapEvents({
    click(e) {
      const orig = e.originalEvent;
      if (orig?.target?.closest("button, input, select, [role='button'], .leaflet-control")) return;
      onPinPicked(e.latlng);
    }
  });
  return null;
}

// Fetch MapTiler key once and cache globally
let _maptilerKeyCache = null;
async function getMaptilerKeyOnce() {
  if (_maptilerKeyCache) return _maptilerKeyCache;
  if (window.__maptilerKey) { _maptilerKeyCache = window.__maptilerKey; return _maptilerKeyCache; }
  try {
    const { base44 } = await import("@/api/base44Client");
    const res = await base44.functions.invoke("getMaptilerKey", {});
    _maptilerKeyCache = res.data?.key || null;
    if (_maptilerKeyCache) window.__maptilerKey = _maptilerKeyCache;
  } catch {}
  return _maptilerKeyCache;
}

export default function MapContainerComponent({
  activeBaseLayers,
  activeLayers,
  layerOrder,
  flyToLocation,
  activeTool,
  onMeasurement,
  drawings,
  setDrawings,
  routePolyline,
  showZoomControls = true,
  mobileProps,
  gpsTracking,
  locateTrigger,
  offlineOpen,
  onOfflineClose,
  onLocationSummary,
  onMapMove,
  isPinPicking,
  onPinPicked,
  aiRoutePolyline,
  customLayers,
  customLayerOpacities,
  customLayerVisible,
  onRemoveCustomLayer,
}) {
  const [maptilerKey, setMaptilerKey] = useState(window.__maptilerKey || null);
  useEffect(() => {
    if (!maptilerKey) getMaptilerKeyOnce().then(k => { if (k) setMaptilerKey(k); });
  }, []);

  const allLayers = getAllLayersFlat();
  const activeBaseLayerEntries = activeBaseLayers && Object.keys(activeBaseLayers).length > 0
    ? Object.entries(activeBaseLayers)
    : [];

  return (
    <LeafletMapContainer
      center={SLOVENIA_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={7}
      maxZoom={22}
      className="w-full h-full"
      zoomControl={false}
      attributionControl={false}
      doubleClickZoom={activeTool === "pointer"}
      style={{ zIndex: 1 }}
    >
      {/* Base layer — always rendered with stable key="base-layer" so overlay layers stay on top when switching */}
      <BaseLayerRenderer activeBaseLayerEntries={activeBaseLayerEntries} />

      {/* Active overlay layers — rendered in layerOrder (bottom→top), each in its own overlayPane so they always sit above the base */}
      {(layerOrder && layerOrder.length > 0 ? layerOrder : Object.keys(activeLayers)).map((layerId, index) => {
        const config = activeLayers[layerId];
        if (!config) return null;
        const layer = allLayers[layerId];
        if (!layer) return null;
        const opacity = config.opacity ?? layer.opacity ?? 0.7;
        // Use overlayPane (z-index 400 in Leaflet) — always above tilePane (z-index 200)
        const pane = "overlayPane";

        // MapTiler tile layer (requires API key)
                 if (layer.type === "maptiler_tile") {
                   if (!maptilerKey) return null;
                   const resolvedUrl = layer.urlTemplate.replace("{key}", maptilerKey);
                   return (
                     <TileLayer
                       key={`${layerId}-${maptilerKey}`}
                       url={resolvedUrl}
                       opacity={opacity}
                       tileSize={256}
                       maxZoom={22}
                       maxNativeZoom={layer.maxNativeZoom || 12}
                       attribution={layer.attribution || ""}
                       keepBuffer={4}
                       updateWhenIdle={false}
                       updateWhenZooming={false}
                       pane={pane}
                       zIndex={400 + index}
                     />
                   );
                 }

        // Standard tile layer
        if (layer.type === "tile") {
           return (
             <TileLayer
               key={layerId}
               url={layer.url}
               opacity={opacity}
               tileSize={256}
               maxZoom={22}
               maxNativeZoom={layer.maxNativeZoom || layer.maxZoom || 19}
               attribution={layer.attribution || ""}
               keepBuffer={4}
               updateWhenIdle={false}
               updateWhenZooming={false}
               pane={pane}
               zIndex={400 + index}
             />
           );
         }

        // ArcGIS MapServer export dynamic tiles
         if (layer.type === "arcgis_export") {
           return (
             <ArcGISExportLayer
              key={layerId}
              url={layer.url}
              opacity={opacity}
              layerIds={layer.layerIds}
              maxZoom={22}
              maxNativeZoom={layer.maxNativeZoom}
              bboxSR={layer.bboxSR}
              transparent={layer.transparent}
              format={layer.format}
              pane={pane}
              zIndex={400 + index}
              enhance={layer.enhance}
             />
           );
         }

        // All WMS layers (standard + katasterjam_caves uses wmsUrl fallback)
        const wmsUrl = layer.wmsUrl || layer.url;
        const wmsLayers = layer.wmsLayers || layer.layers;
        if (wmsUrl && wmsLayers && (layer.type === "wms" || layer.type === "arcgis_dynamic" || layer.type === "geojson_api")) {
          return (
            <WMSTileLayer
              key={layerId}
              url={wmsUrl}
              layers={wmsLayers}
              format={layer.format || "image/png"}
              transparent={layer.transparent !== false}
              version={layer.version || "1.1.1"}
              opacity={opacity}
              crs={L.CRS.EPSG3857}
              tileSize={layer.tileSize || 512}
              detectRetina={false}
              keepBuffer={2}
              updateWhenIdle={true}
              updateWhenZooming={false}
              pane={pane}
              zIndex={400 + index}
            />
          );
        }

        return null;
      })}

      {offlineOpen && <OfflineManagerPortal onClose={onOfflineClose} />}
      {showZoomControls && <ZoomControls />}
      <MapScaleBar />
      {mobileProps && <MobileTopBar {...mobileProps} />}
      <MyLocationDot trigger={locateTrigger} />
      {gpsTracking && (
        <GpsTracker
          isTracking={gpsTracking.isTracking}
          gpsTrack={gpsTracking.track}
          onTrackUpdate={gpsTracking.onTrackUpdate}
          followLocation={gpsTracking.isTracking}
        />
      )}
      {routePolyline && routePolyline.length > 0 && (
        <Polyline positions={routePolyline} color="#2563eb" weight={5} opacity={0.85} />
      )}
      {aiRoutePolyline && aiRoutePolyline.length > 1 && (
        <Polyline positions={aiRoutePolyline} color="#f59e0b" weight={4} opacity={0.9} dashArray="8,5" />
      )}
      {/* Municipality polygon layer — special dedicated component */}
      {(() => {
        const munLayer = (customLayers || []).find(l => l._municipalityLayer);
        const visible = munLayer && customLayerVisible?.[munLayer.id] !== false;
        return <MunicipalityLayer key="municipalities" visible={!!visible} />;
      })()}

      {/* Search category layers — canvas renderer, no lag with thousands of points, always on top */}
      {(customLayers || []).filter(l => l._searchCat && !l._municipalityLayer).map((layer) => {
        const isVisible = customLayerVisible?.[layer.id] !== false;
        if (!isVisible) return null;
        return <SearchCategoryLayer key={layer.id} layer={layer} />;
      })}

      {/* Custom AI layers (non-search) */}
      {(customLayers || []).filter(l => !l._searchCat).map((layer) => {
        const isVisible = customLayerVisible?.[layer.id] !== false;
        if (!isVisible) return null;
        const opacity = customLayerOpacities?.[layer.id] ?? 0.9;
        return (
          <React.Fragment key={layer.id}>
            {(layer.features || []).map((f, fi) => {
              const color = layer.color || "#e11d48";
              if (f.type === "LineString" && f.coords?.length > 1) {
                return (
                  <Polyline key={fi} positions={f.coords} color={color} weight={3} opacity={opacity}>
                    {f.label && <Tooltip sticky>{f.label}</Tooltip>}
                  </Polyline>
                );
              }
              if (f.type === "Polygon" && f.coords?.length > 2) {
                return (
                  <Polygon key={fi} positions={f.coords} pathOptions={{ color, fillColor: color, fillOpacity: opacity * 0.4, weight: 2, opacity }}>
                    {f.label && <Tooltip sticky>{f.label}</Tooltip>}
                  </Polygon>
                );
              }
              if (f.type === "Point" && f.coords?.length === 2) {
                const icon = L.divIcon({
                  className: "",
                  html: `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.5);transform:translate(-6px,-6px);opacity:${opacity}"></div>`,
                  iconSize: [0, 0],
                });
                return (
                  <Marker key={fi} position={f.coords} icon={icon}>
                    {f.label && (
                      <Tooltip permanent={false} sticky direction="top" offset={[0, -8]}>
                        <span className="text-xs font-semibold">{f.label}</span>
                      </Tooltip>
                    )}
                  </Marker>
                );
              }
              return null;
            })}
          </React.Fragment>
        );
      })}
      <FlyToLocation location={flyToLocation} />
      <CoordsDisplay onMapMove={onMapMove} />
      <RightClickHandler onLocationSummary={onLocationSummary} />
      {isPinPicking && onPinPicked && <PinPickHandler onPinPicked={onPinPicked} />}
      <DrawingHandler
        activeTool={activeTool}
        onMeasurement={onMeasurement}
        drawings={drawings}
        setDrawings={setDrawings}
      />
    </LeafletMapContainer>
  );
}