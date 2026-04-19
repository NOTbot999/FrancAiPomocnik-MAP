import React, { useEffect, useState } from "react";
import { CircleMarker, Circle, useMap } from "react-leaflet";

// Shows a blue dot at the user's current location (one-shot, not tracking)
export default function MyLocationDot({ trigger }) {
  const map = useMap();
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  useEffect(() => {
    if (!trigger) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [trigger]);

  if (!position) return null;

  return (
    <>
      {accuracy && accuracy < 500 && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1, opacity: 0.4 }}
        />
      )}
      <CircleMarker
        center={position}
        radius={9}
        pathOptions={{ color: "white", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 }}
      />
      <CircleMarker
        center={position}
        radius={4}
        pathOptions={{ color: "white", fillColor: "#1d4ed8", fillOpacity: 1, weight: 0 }}
      />
    </>
  );
}