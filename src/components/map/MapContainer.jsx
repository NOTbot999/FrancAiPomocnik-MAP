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

function DrawingHandler({ activeTool, onMeasurement, drawings, setDrawings }) {
  const [currentPoints, setCurrentPoints] = useState([]);
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    if (activeTool === "distance" || activeTool === "area" || activeTool === "marker") {
      el.style.cursor = "crosshair";
    } else {
      el.style.cursor = "";
    }
    setCurrentPoints([]);
    return () => { el.style.cursor = ""; };
  }, [activeTool, map]);

  useMapEvents({
    click(e) {
      if (activeTool === "marker") {
        setDrawings((prev) => ({
          ...prev,
          markers: [...(prev.markers || []), { lat: e.latlng.lat, lng: e.latlng.lng }],
        }));
      } else if (activeTool === "distance") {
        const pts = [...currentPoints, [e.latlng.lat, e.latlng.lng]];
        setCurrentPoints(pts);
        if (pts.length >= 2) {
          let total = 0;
          for (let i = 1; i < pts.length; i++)
            total += L.latLng(pts[i - 1]).distanceTo(L.latLng(pts[i]));
          onMeasurement(`Distance: ${formatDistance(total)}`);
        }
      } else if (activeTool === "area") {
        const pts = [...currentPoints, [e.latlng.lat, e.latlng.lng]];
        setCurrentPoints(pts);
        if (pts.length >= 3) onMeasurement(`Area: ${formatArea(computeArea(pts))}`);
      }
    },
    dblclick(e) {
      if (activeTool === "distance" && currentPoints.length >= 2) {
        setDrawings((prev) => ({ ...prev, lines: [...(prev.lines || []), currentPoints] }));
        setCurrentPoints([]);
      } else if (activeTool === "area" && currentPoints.length >= 3) {
        setDrawings((prev) => ({ ...prev, polygons: [...(prev.polygons || []), currentPoints] }));
        setCurrentPoints([]);
      }
    },
  });

  const dotIcon = L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:translate(-5px,-5px)"></div>`,
    iconSize: [0, 0],
  });

  return (
    <>
      {currentPoints.length >= 2 && activeTool === "distance" && (
        <Polyline positions={currentPoints} color="#10b981" weight={3} dashArray="8 4" />
      )}
      {currentPoints.length >= 3 && activeTool === "area" && (
        <Polygon positions={currentPoints} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.2 }} />
      )}
      {currentPoints.map((p, i) => <Marker key={`mp-${i}`} position={p} icon={dotIcon} />)}
      {(drawings.lines || []).map((line, i) => (
        <Polyline key={`l-${i}`} positions={line} color="#10b981" weight={2.5} />
      ))}
      {(drawings.polygons || []).map((poly, i) => (
        <Polygon key={`pg-${i}`} positions={poly} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.15 }} />
      ))}
      {(drawings.markers || []).map((m, i) => (
        <Marker key={`mk-${i}`} position={[m.lat, m.lng]}>
          <Popup>
            <span className="font-mono text-xs">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</span>
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
function ArcGISExportLayer({ url, opacity, layerIds }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    // ArcGIS MapServer export: dynamic tiles via /export endpoint with bbox injection
    const arcLayer = L.tileLayer(
      url + "?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&format=png&transparent=true&" + (layerIds ? `layers=${layerIds}` : ""),
      {
        tileSize: 256,
        opacity,
        bounds: [[45.4, 13.3], [46.9, 16.7]],
      }
    );

    // Override getTileUrl to inject proper bbox
    arcLayer.getTileUrl = function (coords) {
      const tileBounds = this._tileCoordsToBounds(coords);
      const sw = map.options.crs.project(tileBounds.getSouthWest());
      const ne = map.options.crs.project(tileBounds.getNorthEast());
      const bbox = `${sw.x},${sw.y},${ne.x},${ne.y}`;
      const size = this.getTileSize();
      return (
        url +
        `?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${size.x},${size.y}&f=image&format=png32&transparent=true` +
        (layerIds ? `&layers=${layerIds}` : "")
      );
    };

    arcLayer.addTo(map);
    layerRef.current = arcLayer;
    return () => { arcLayer.remove(); };
  }, [url, opacity, layerIds, map]);

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
      onPinPicked(e.latlng);
    }
  });
  return null;
}

export default function MapContainerComponent({
  activeBaseLayers,
  activeLayers,
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
          return <ArcGISExportLayer key={bl.id} url={bl.arcgisUrl} opacity={opacity} />;
        }
        return <TileLayer key={bl.id} url={bl.url} opacity={opacity} attribution={bl.attribution || ""} maxZoom={22} maxNativeZoom={19} />;
      })}

      {/* Active overlay layers */}
      {Object.entries(activeLayers).map(([layerId, config]) => {
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
              maxZoom={layer.maxZoom || 19}
              maxNativeZoom={layer.maxZoom || 19}
              attribution={layer.attribution || ""}
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