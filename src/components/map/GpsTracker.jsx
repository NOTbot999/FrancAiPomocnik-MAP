import React, { useEffect, useRef } from "react";
import { useMap, Polyline, Marker } from "react-leaflet";
import L from "leaflet";

// Pulsing dot icon for current position
const pulseIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;position:relative;">
    <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;border:2.5px solid white;box-shadow:0 0 0 0 rgba(59,130,246,0.6);animation:gpsPulse 1.5s infinite;"></div>
  </div>
  <style>@keyframes gpsPulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,0.6)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}</style>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function GpsTracker({ isTracking, gpsTrack, onTrackUpdate, followLocation }) {
  const map = useMap();
  const watchIdRef = useRef(null);
  const userDraggingRef = useRef(false);

  // Pause follow when user drags, resume after 3s of no interaction
  useEffect(() => {
    let resumeTimer = null;
    const onDragStart = () => {
      userDraggingRef.current = true;
      clearTimeout(resumeTimer);
    };
    const onDragEnd = () => {
      resumeTimer = setTimeout(() => { userDraggingRef.current = false; }, 3000);
    };
    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);
    return () => {
      map.off('dragstart', onDragStart);
      map.off('dragend', onDragEnd);
      clearTimeout(resumeTimer);
    };
  }, [map]);

  useEffect(() => {
    if (isTracking) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const pt = [pos.coords.latitude, pos.coords.longitude];
          onTrackUpdate(pt);
          if (followLocation && !userDraggingRef.current) {
            map.panTo(pt, { animate: true });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isTracking, followLocation, map, onTrackUpdate]);

  if (gpsTrack.length === 0) return null;

  const currentPos = gpsTrack[gpsTrack.length - 1];

  return (
    <>
      {gpsTrack.length >= 2 && (
        <Polyline
          positions={gpsTrack}
          pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.85, dashArray: null }}
        />
      )}
      <Marker position={currentPos} icon={pulseIcon} />
    </>
  );
}