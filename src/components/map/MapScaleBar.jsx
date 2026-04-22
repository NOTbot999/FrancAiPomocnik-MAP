/**
 * Proper cartographic scale bar (like on printed maps).
 * Shows alternating black/white segments with tick marks at ends and middle.
 */
import { useEffect, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Nice round numbers for scale bar distances (meters)
const NICE_DISTANCES = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000
];

function getScaleInfo(map) {
  const mapSizePx = map.getSize().x;
  const targetPx = mapSizePx * 0.2; // aim for ~20% of map width

  const center = map.getCenter();
  const leftPt = L.point(0, map.getSize().y / 2);
  const rightPt = L.point(mapSizePx, map.getSize().y / 2);
  const metersPerPx = map.distance(
    map.containerPointToLatLng(leftPt),
    map.containerPointToLatLng(rightPt)
  ) / mapSizePx;

  const targetMeters = targetPx * metersPerPx;

  // Pick the nicest round number close to target
  let best = NICE_DISTANCES[0];
  for (const d of NICE_DISTANCES) {
    if (d <= targetMeters) best = d;
    else break;
  }

  const pxWidth = Math.round(best / metersPerPx);
  const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
  const halfLabel = best >= 2000 ? `${best / 2000} km` : best >= 2 ? `${best / 2} m` : null;

  return { pxWidth, label, halfLabel };
}

function ScaleBarInner() {
  const map = useMap();
  const [scale, setScale] = useState(() => getScaleInfo(map));

  const update = () => setScale(getScaleInfo(map));
  useMapEvents({ zoom: update, move: update, resize: update });
  useEffect(() => { update(); }, []);

  const { pxWidth, label, halfLabel } = scale;

  return (
    <div
      className="absolute bottom-7 left-1/2 z-[800] pointer-events-none select-none"
      style={{ width: pxWidth + 2, transform: "translateX(-50%)" }}
    >
      {/* Top label row: 0 on left, half in middle, full on right */}
      <div className="relative flex items-end mb-0.5" style={{ height: 14 }}>
        <span className="absolute left-0 text-[9px] font-mono text-slate-800 leading-none" style={{ transform: "translateX(-50%)" }}>0</span>
        {halfLabel && (
          <span className="absolute text-[9px] font-mono text-slate-800 leading-none" style={{ left: pxWidth / 2, transform: "translateX(-50%)" }}>{halfLabel}</span>
        )}
        <span className="absolute right-0 text-[9px] font-mono text-slate-800 leading-none" style={{ transform: "translateX(50%)" }}>{label}</span>
      </div>

      {/* Scale bar: two alternating segments with outer border */}
      <div
        className="relative border border-slate-800"
        style={{ width: pxWidth, height: 6, display: "flex" }}
      >
        {/* Left half — black */}
        <div style={{ width: "50%", height: "100%", backgroundColor: "#1e293b" }} />
        {/* Right half — white */}
        <div style={{ width: "50%", height: "100%", backgroundColor: "#ffffff" }} />
        {/* Middle tick line */}
        <div
          className="absolute top-0 bottom-0 border-l border-slate-800"
          style={{ left: "50%" }}
        />
      </div>
    </div>
  );
}

export default function MapScaleBar() {
  return <ScaleBarInner />;
}