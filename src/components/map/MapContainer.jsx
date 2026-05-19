import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  WMSTileLayer,
  useMap,
  useMapEvents,
  Marker,
  Popup,
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
    if (location) {
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
const SNAP_THRESHOLD_PX = 20;

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
    html: `<div style="width:10px;height:10px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:translate(-5px,-5px)"></div>`,
    iconSize: [0, 0],
  });

  // First-point snap indicator
  const snapIcon = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;background:rgba(16,185,129,0.3);border:2px solid #10b981;border-radius:50%;box-shadow:0 0 6px #10b981;transform:translate(-9px,-9px)"></div>`,
    iconSize: [0, 0],
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

function getAllLayersFlat() {
  const map = {};
  OVERLAY_CATEGORIES.forEach((cat) => cat.layers.forEach((l) => { map[l.id] = l; }));
  return map;
}

// ArcGIS MapServer export as a Leaflet TileLayer (dynamic tiles via /export endpoint)
// bboxSR=4326 works best with ARSO D96TM cached services; bboxSR=3857 for dynamic services like LIDAR
function ArcGISExportLayer({ url, opacity, layerIds, maxZoom, bboxSR, transparent, format, sharp }) {
   const map = useMap();
   const layerRef = useRef(null);
   const useSR = bboxSR || 3857;
   const useFormat = format || (transparent ? "png32" : "jpg");
   const useTransparent = transparent !== false;

   useEffect(() => {
     const arcLayer = L.tileLayer("about:blank", {
       tileSize: 256,
       opacity,
       maxZoom: maxZoom || 22,
       maxNativeZoom: 19,
       bounds: [[45.3, 13.3], [46.9, 16.8]],
     });

     if (sharp) {
       arcLayer.createTile = function(coords, done) {
         const img = document.createElement("img");
         img.style.imageRendering = "pixelated";
         img.style.filter = "contrast(1.35) brightness(1.08) sharpen(1)";
         img.onload = () => done(null, img);
         img.onerror = (e) => done(e, img);
         img.src = arcLayer.getTileUrl(coords);
         img.crossOrigin = "anonymous";
         return img;
       };
     }

    arcLayer.getTileUrl = function (coords) {
      const tileBounds = this._tileCoordsToBounds(coords);
      const size = this.getTileSize();
      let bbox;
      if (useSR === 4326) {
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
        `?bbox=${bbox}&bboxSR=${useSR}&imageSR=3857&size=${size.x},${size.y}&f=image&format=${useFormat}&transparent=${useTransparent}` +
        (layerIds ? `&layers=${layerIds}` : "")
      );
    };

    arcLayer.addTo(map);
    layerRef.current = arcLayer;
    return () => { arcLayer.remove(); };
  }, [url, opacity, layerIds, map, useSR, useFormat, useTransparent]);

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
}) {
  const allLayers = getAllLayersFlat();
  const activeBaseLayerEntries = activeBaseLayers
    ? Object.entries(activeBaseLayers)
    : [['osm', { opacity: 1 }]];

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
      {/* Base layers (multi-select) */}
      {activeBaseLayerEntries.map(([layerId, config]) => {
        const bl = BASE_LAYERS.find(l => l.id === layerId);
        if (!bl) return null;
        const opacity = config?.opacity ?? 1;
        if (bl.type === 'arcgis_export') {
          const isLidar = bl.id?.includes('lidar') || bl.arcgisUrl?.toLowerCase().includes('lidar');
          return <ArcGISExportLayer key={bl.id} url={bl.arcgisUrl} opacity={opacity} bboxSR={bl.bboxSR} transparent={bl.transparent} format={bl.format} sharp={isLidar} />;
        }
        return <TileLayer key={bl.id} url={bl.url} opacity={opacity} attribution={bl.attribution || ""} maxZoom={22} maxNativeZoom={bl.maxNativeZoom || 19} />;
      })}

      {/* Active overlay layers — rendered in layerOrder (bottom→top) */}
      {(layerOrder && layerOrder.length > 0 ? layerOrder : Object.keys(activeLayers)).map((layerId) => {
        const config = activeLayers[layerId];
        if (!config) return null;
        const layer = allLayers[layerId];
        if (!layer) return null;
        const opacity = config.opacity ?? layer.opacity ?? 0.7;

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
             />
           );
         }

        // ArcGIS MapServer export dynamic tiles
         if (layer.type === "arcgis_export") {
           const isLidar = layerId?.includes('lidar') || layer.url?.toLowerCase().includes('lidar');
           return (
             <ArcGISExportLayer
               key={layerId}
               url={layer.url}
               opacity={opacity}
               layerIds={layer.layerIds}
               maxZoom={22}
               bboxSR={layer.bboxSR}
               transparent={layer.transparent}
               format={layer.format}
               sharp={isLidar}
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