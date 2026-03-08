import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer as LeafletMapContainer, TileLayer, WMSTileLayer, useMap, useMapEvents, Marker, Popup, Polyline, Polygon } from "react-leaflet";
import { BASE_LAYERS, OVERLAY_CATEGORIES, SLOVENIA_CENTER, DEFAULT_ZOOM, SLOVENIA_BOUNDS } from "./layerConfig";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix leaflet default marker icons
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

function CoordsDisplay() {
  const [coords, setCoords] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  useMapEvents({
    mousemove: (e) => setCoords({ lat: e.latlng.lat, lng: e.latlng.lng }),
    zoom: (e) => setZoom(e.target.getZoom()),
  });

  if (!coords) return null;
  return (
    <div className="absolute bottom-2 left-2 z-[800] bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-mono px-2.5 py-1 rounded-lg">
      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} | z{zoom}
    </div>
  );
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatArea(sqMeters) {
  if (sqMeters < 10000) return `${sqMeters.toFixed(0)} m²`;
  if (sqMeters < 1000000) return `${(sqMeters / 10000).toFixed(2)} ha`;
  return `${(sqMeters / 1000000).toFixed(2)} km²`;
}

function DrawingHandler({ activeTool, onMeasurement, drawings, setDrawings }) {
  const [currentPoints, setCurrentPoints] = useState([]);
  const map = useMap();

  useEffect(() => {
    if (activeTool === "distance" || activeTool === "area") {
      map.getContainer().style.cursor = "crosshair";
    } else if (activeTool === "marker") {
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }
    setCurrentPoints([]);
    return () => { map.getContainer().style.cursor = ""; };
  }, [activeTool, map]);

  useMapEvents({
    click: (e) => {
      if (activeTool === "marker") {
        setDrawings(prev => ({
          ...prev,
          markers: [...(prev.markers || []), { lat: e.latlng.lat, lng: e.latlng.lng }]
        }));
      } else if (activeTool === "distance") {
        const newPoints = [...currentPoints, [e.latlng.lat, e.latlng.lng]];
        setCurrentPoints(newPoints);
        if (newPoints.length >= 2) {
          let total = 0;
          for (let i = 1; i < newPoints.length; i++) {
            total += L.latLng(newPoints[i-1]).distanceTo(L.latLng(newPoints[i]));
          }
          onMeasurement(`Distance: ${formatDistance(total)}`);
        }
      } else if (activeTool === "area") {
        const newPoints = [...currentPoints, [e.latlng.lat, e.latlng.lng]];
        setCurrentPoints(newPoints);
        if (newPoints.length >= 3) {
          const area = L.GeometryUtil
            ? L.GeometryUtil.geodesicArea(newPoints.map(p => L.latLng(p)))
            : computeArea(newPoints);
          onMeasurement(`Area: ${formatArea(Math.abs(area))}`);
        }
      }
    },
    dblclick: (e) => {
      if (activeTool === "distance" && currentPoints.length >= 2) {
        setDrawings(prev => ({
          ...prev,
          lines: [...(prev.lines || []), currentPoints]
        }));
        setCurrentPoints([]);
      } else if (activeTool === "area" && currentPoints.length >= 3) {
        setDrawings(prev => ({
          ...prev,
          polygons: [...(prev.polygons || []), currentPoints]
        }));
        setCurrentPoints([]);
      }
    }
  });

  return (
    <>
      {/* Current measuring line */}
      {currentPoints.length >= 2 && activeTool === "distance" && (
        <Polyline positions={currentPoints} color="#10b981" weight={3} dashArray="8 4" />
      )}
      {currentPoints.length >= 3 && activeTool === "area" && (
        <Polygon positions={currentPoints} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.2 }} />
      )}
      {/* Points while measuring */}
      {currentPoints.map((p, i) => (
        <Marker key={`measure-${i}`} position={p} icon={L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:translate(-5px,-5px)"></div>`,
          iconSize: [0, 0]
        })} />
      ))}
      {/* Saved drawings */}
      {drawings.lines?.map((line, i) => (
        <Polyline key={`line-${i}`} positions={line} color="#10b981" weight={3} />
      ))}
      {drawings.polygons?.map((poly, i) => (
        <Polygon key={`poly-${i}`} positions={poly} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.15 }} />
      ))}
      {drawings.markers?.map((m, i) => (
        <Marker key={`marker-${i}`} position={[m.lat, m.lng]}>
          <Popup>
            <span className="text-xs font-mono">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</span>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function computeArea(points) {
  // Shoelace formula approximation for small areas
  const toRad = (deg) => deg * Math.PI / 180;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += toRad(points[j][1] - points[i][1]) * (2 + Math.sin(toRad(points[i][0])) + Math.sin(toRad(points[j][0])));
  }
  area = area * 6378137 * 6378137 / 2;
  return Math.abs(area);
}

function getAllLayersFlat() {
  const map = {};
  OVERLAY_CATEGORIES.forEach(cat => {
    cat.layers.forEach(layer => {
      map[layer.id] = layer;
    });
  });
  return map;
}

export default function MapContainerComponent({
  activeBaseLayer,
  activeLayers,
  flyToLocation,
  activeTool,
  onMeasurement,
  drawings,
  setDrawings,
}) {
  const baseLayer = BASE_LAYERS.find(l => l.id === activeBaseLayer) || BASE_LAYERS[0];
  const allLayers = getAllLayersFlat();

  return (
    <LeafletMapContainer
      center={SLOVENIA_CENTER}
      zoom={DEFAULT_ZOOM}
      maxBounds={[[44.5, 12.5], [47.5, 17.5]]}
      minZoom={7}
      maxZoom={19}
      className="w-full h-full"
      zoomControl={false}
      doubleClickZoom={activeTool === "pointer"}
    >
      {/* Base layer */}
      <TileLayer
        key={baseLayer.id}
        url={baseLayer.url}
        attribution={baseLayer.attribution}
      />

      {/* Active overlay layers */}
      {Object.entries(activeLayers).map(([layerId, config]) => {
        if (!config) return null;
        const layer = allLayers[layerId];
        if (!layer) return null;
        
        if (layer.type === "wms") {
          return (
            <WMSTileLayer
              key={layerId}
              url={layer.url}
              layers={layer.layers}
              format={layer.format || "image/png"}
              transparent={layer.transparent !== false}
              version={layer.version || "1.3.0"}
              opacity={config.opacity ?? layer.opacity}
              crs={L.CRS.EPSG3857}
            />
          );
        }
        
        if (layer.type === "tile") {
          return (
            <TileLayer
              key={layerId}
              url={layer.url}
              opacity={config.opacity ?? layer.opacity}
              tileSize={layer.tileSize || 256}
            />
          );
        }
        
        return null;
      })}

      <FlyToLocation location={flyToLocation} />
      <CoordsDisplay />
      <DrawingHandler
        activeTool={activeTool}
        onMeasurement={onMeasurement}
        drawings={drawings}
        setDrawings={setDrawings}
      />
    </LeafletMapContainer>
  );
}