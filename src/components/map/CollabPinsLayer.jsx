/**
 * CollabPinsLayer — renders collaborative session pins on the Leaflet map.
 */
import React from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

function makeIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    tooltipAnchor: [0, -36],
  });
}

export default function CollabPinsLayer({ pins = [] }) {
  const validPins = pins.filter(pin => pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng));
  return (
    <>
      {validPins.map(pin => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={makeIcon(pin.color || "#10b981")}
        >
          <Tooltip permanent={false} direction="top">
            <div className="text-xs font-medium">
              <span style={{ color: pin.color || "#10b981" }}>●</span>{" "}
              {pin.label || `${pin.lat?.toFixed(4)}, ${pin.lng?.toFixed(4)}`}
              {pin.username && <div className="opacity-60 text-[10px]">{pin.username}</div>}
            </div>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}