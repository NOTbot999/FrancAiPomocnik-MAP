/**
 * Fixed scale bar shown in the bottom-left corner of the map.
 * Updates on zoom/pan to always show the correct real-world distance.
 */
import { useEffect, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

function getScaleInfo(map) {
  const y = map.getSize().y / 2;
  const maxMeters = map.distance(
    map.containerPointToLatLng(L.point(0, y)),
    map.containerPointToLatLng(L.point(100, y))
  );

  // Pick a nice round number
  const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  let best = STEPS[0];
  for (const s of STEPS) {
    if (s <= maxMeters) best = s;
    else break;
  }

  const pxWidth = Math.round((best / maxMeters) * 100);
  const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
  return { pxWidth, label };
}

function ScaleBarInner() {
  const map = useMap();
  const [scale, setScale] = useState(() => getScaleInfo(map));

  const update = () => setScale(getScaleInfo(map));

  useMapEvents({ zoom: update, move: update, resize: update });

  useEffect(() => { update(); }, []);

  return (
    <div
      className="absolute bottom-6 left-3 z-[800] pointer-events-none select-none"
      style={{ minWidth: 60 }}
    >
      <div className="flex flex-col items-start">
        <span className="text-[10px] font-mono text-slate-700 drop-shadow-sm mb-0.5 bg-white/70 px-1 rounded">
          {scale.label}
        </span>
        <div
          className="h-1.5 rounded-sm border border-slate-600 bg-white/80"
          style={{
            width: scale.pxWidth,
            backgroundImage: `repeating-linear-gradient(to right, #334155 0, #334155 50%, white 50%, white 100%)`,
            backgroundSize: `${scale.pxWidth / 2}px 100%`,
          }}
        />
      </div>
    </div>
  );
}

export default function MapScaleBar() {
  return <ScaleBarInner />;
}