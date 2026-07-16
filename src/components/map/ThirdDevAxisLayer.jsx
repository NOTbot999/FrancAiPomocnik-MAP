import React, { useEffect, useState } from "react";
import { Polyline, CircleMarker, Tooltip, LayerGroup, Marker } from "react-leaflet";
import L from "leaflet";
import { fetchOverpass } from "@/lib/overpass";

// Tretja razvojna os (3RO) — povlečeno iz OpenStreetMap ob vklopu sloja.
//
// Severni krak = "Hitra cesta H8" (highway=construction, construction=trunk, 2029)
//   Realna OSM geometrija, pravi predori (tunnel=yes) in mostovi (bridge=yes).
// Vzhodni krak = relacija "Hitra cesta 3RO" (Ptuj → Ormož, ref=3RO).
// Južni krak (Novo mesto → Metlika → Črnomelj) ŠE NI v OSM — prikazan kot načrt.

const COLOR_NORTH = "#dc2626";
const COLOR_EAST = "#7c3aed";
const COLOR_SOUTH_PLAN = "#ea580c";
const CACHE_KEY = "slomap_3ro_v2";

// Načrtovana aproksimativna južna trasa (ni v OSM)
const SOUTH_PLANNED = [
  [45.8030, 15.1680], [45.7820, 15.1980], [45.7650, 15.2100],
  [45.7520, 15.2250], [45.7250, 15.2620], [45.7150, 15.2720],
  [45.7020, 15.2850], [45.6850, 15.3150], [45.6550, 15.3160],
  [45.6436, 15.3144], [45.6120, 15.2880], [45.6000, 15.2780],
  [45.5780, 15.2380], [45.5614, 15.1897],
];

function emojiIcon(emoji, size = 20) {
  return L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: "tda-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function wayCenter(pts) {
  if (!pts || !pts.length) return null;
  const m = pts[Math.floor(pts.length / 2)];
  return [m[0], m[1]];
}

export default function ThirdDevAxisLayer({ opacity = 0.85 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, payload } = JSON.parse(cached);
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
          setData(payload);
          setLoading(false);
          return;
        }
      }
    } catch {}

    const qH8 = `[out:json][timeout:25];
way["name"~"Hitra cesta H8|Hira cesta H8"](45.4,13.4,46.9,16.6);
out geom;`;
    const qEast = `[out:json][timeout:25];
relation["ref"="3RO"](45.4,13.4,46.9,16.6);
way(r);
out geom;`;
    const qJct = `[out:json][timeout:15];
node["highway"="motorway_junction"](46.35,15.05,46.52,15.12);
out;`;

    Promise.all([
      fetchOverpass(qH8).catch(() => ({ elements: [] })),
      fetchOverpass(qEast).catch(() => ({ elements: [] })),
      fetchOverpass(qJct).catch(() => ({ elements: [] })),
    ])
      .then(([h8json, eastJson, jctJson]) => {
        if (cancelled) return;

        const h8Ways = (h8json.elements || []).filter(e => e.type === "way" && e.geometry);
        const h8Lines = h8Ways.map(w => (w.geometry || []).map(p => [p.lat, p.lon]));
        const h8Tunnels = h8Ways
          .filter(w => w.tags?.tunnel === "yes" || w.tags?.tunnel === "building_passage")
          .map(w => ({ pos: wayCenter((w.geometry || []).map(p => [p.lat, p.lon])), name: w.tags?.name || "Predor H8" }));
        const h8Bridges = h8Ways
          .filter(w => w.tags?.bridge === "yes" || w.tags?.bridge === "viaduct")
          .map(w => ({ pos: wayCenter((w.geometry || []).map(p => [p.lat, p.lon])), name: w.tags?.name || "Vijadukt H8" }));

        const eastWays = (eastJson.elements || []).filter(e => e.type === "way" && e.geometry);
        const eastLines = eastWays.map(w => (w.geometry || []).map(p => [p.lat, p.lon]));

        const junctions = (jctJson.elements || [])
          .filter(e => e.type === "node" && e.tags?.highway === "motorway_junction")
          .map(n => ({ pos: [n.lat, n.lon], name: n.tags?.name || "", ref: n.tags?.ref || "" }));

        if (h8Lines.length === 0 && eastLines.length === 0) {
          setError("Ni podatkov");
          setLoading(false);
          return;
        }

        const payload = { h8Lines, h8Tunnels, h8Bridges, eastLines, junctions };
        setData(payload);
        setLoading(false);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload })); } catch {}
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <LayerGroup>
        <CircleMarker center={[46.43, 15.09]} radius={10} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.4 }} />
        <Tooltip permanent>Nalagam 3RO iz OSM…</Tooltip>
      </LayerGroup>
    );
  }

  if (error || !data) {
    return (
      <LayerGroup>
        <CircleMarker center={[46.43, 15.09]} radius={10} pathOptions={{ color: "#94a3b8", fillColor: "#94a3b8", fillOpacity: 0.4 }} />
        <Tooltip permanent>3RO: poskusi znova (Overpass)</Tooltip>
      </LayerGroup>
    );
  }

  return (
    <LayerGroup>
      {/* Severni krak: H8 (realna OSM geometrija) */}
      {data.h8Lines.map((pts, i) => (
        <Polyline key={`h8w-${i}`} positions={pts} pathOptions={{ color: "#ffffff", weight: 7, opacity: opacity * 0.4, lineCap: "round" }} />
      ))}
      {data.h8Lines.map((pts, i) => (
        <Polyline key={`h8f-${i}`} positions={pts} pathOptions={{ color: COLOR_NORTH, weight: 4.5, opacity, lineCap: "round" }} />
      ))}

      {/* Vzhodni krak: relacija 3RO (Ptuj–Ormož) */}
      {data.eastLines.map((pts, i) => (
        <Polyline key={`ew-${i}`} positions={pts} pathOptions={{ color: "#ffffff", weight: 6, opacity: opacity * 0.35, lineCap: "round" }} />
      ))}
      {data.eastLines.map((pts, i) => (
        <Polyline key={`ef-${i}`} positions={pts} pathOptions={{ color: COLOR_EAST, weight: 3.5, opacity, dashArray: "10,5", lineCap: "round" }} />
      ))}

      {/* Južni krak: načrt (ni v OSM) */}
      <Polyline positions={SOUTH_PLANNED} pathOptions={{ color: "#ffffff", weight: 5, opacity: opacity * 0.25, lineCap: "round" }} />
      <Polyline positions={SOUTH_PLANNED} pathOptions={{ color: COLOR_SOUTH_PLAN, weight: 2.5, opacity: opacity * 0.6, dashArray: "4,10", lineCap: "round" }} />
      <Marker position={[45.715, 15.27]} icon={emojiIcon("⚠️", 16)}>
        <Tooltip direction="top">
          <span className="text-xs font-semibold text-orange-600">Južni krak: načrtovano</span>
          <span className="block text-[10px] text-slate-500">Trasa še ni v OSM</span>
        </Tooltip>
      </Marker>

      {/* Izvozi */}
      {data.junctions.filter(j => j.pos).map((j, i) => (
        <Marker key={`j-${i}`} position={j.pos} icon={emojiIcon("🚏", 17)}>
          <Tooltip direction="top" offset={[0, -10]}>
            <span className="text-xs font-medium text-blue-700">{j.name}{j.ref ? ` (št. ${j.ref})` : ""}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* Predori */}
      {data.h8Tunnels.filter(t => t.pos).map((t, i) => (
        <Marker key={`t-${i}`} position={t.pos} icon={emojiIcon("🚇", 20)}>
          <Tooltip direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold text-slate-800">{t.name}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* Vijadukti / mostovi */}
      {data.h8Bridges.filter(b => b.pos).map((b, i) => (
        <Marker key={`b-${i}`} position={b.pos} icon={emojiIcon("🌉", 20)}>
          <Tooltip direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold text-purple-700">{b.name}</span>
          </Tooltip>
        </Marker>
      ))}
    </LayerGroup>
  );
}