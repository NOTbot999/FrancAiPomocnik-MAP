import React, { useEffect, useState } from "react";
import { Polyline, CircleMarker, Tooltip, LayerGroup, Marker } from "react-leaflet";
import L from "leaflet";

// Tretja razvojna os (3RO) — povlečeno iz OpenStreetMap (100% natančna geometrija)
//
// Severni krak = "Hitra cesta H8" (highway=construction, construction=trunk, odprtje 2029)
//   73 odsekov, 4 predori (tunnel=yes), 28 mostov/vijaduktov (bridge=yes)
// Vzhodni krak = relacija "Hitra cesta 3RO" (Ptuj → Ormož, ref=3RO)
// Južni krak (Novo mesto → Metlika → Črnomelj) ŠE NI v OSM — prikazan kot načrtovana
//   aproksimativna črka z jasnim označevalom "ni v OSM".

const COLOR_NORTH = "#dc2626";    // severni krak (v gradnji)
const COLOR_EAST = "#7c3aed";      // vzhodni krak (Ptuj–Ormož)
const COLOR_SOUTH_PLAN = "#ea580c"; // južni krak — načrt (ni v OSM)
const CACHE_KEY = "slomap_3ro_v1";

// Načrtovana aproksimativna južna trasa (samo za prikaz, ker ni v OSM)
const SOUTH_PLANNED = [
  [45.8030, 15.1680], [45.7820, 15.1980], [45.7650, 15.2100],
  [45.7520, 15.2250], [45.7250, 15.2620], [45.7150, 15.2720],
  [45.7020, 15.2850], [45.6850, 15.3150], [45.6550, 15.3160],
  [45.6436, 15.3144], [45.6120, 15.2880], [45.6000, 15.2780],
  [45.5780, 15.2380], [45.5614, 15.1897],
];

function emojiIcon(emoji, size = 20) {
  return L.divIcon({
    html: `<div style="font-size:${size}px; line-height:1; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: "tda-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Sredina geometrije way-a
function wayCenter(geom) {
  if (!geom || !geom.length) return null;
  const mid = geom[Math.floor(geom.length / 2)];
  return [mid.lat, mid.lon];
}

export default function ThirdDevAxisLayer({ opacity = 0.85 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Cache v localStorage (7 dni)
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

    const query = `[out:json][timeout:60];
(
  way["name"~"Hitra cesta H8|Hira cesta H8"](45.4,13.4,46.9,16.6);
  way["highway"="construction"]["construction"="trunk"]["name"~"Hitra cesta H8"](45.4,13.4,46.9,16.6);
  way["highway"="proposed"]["proposed"="trunk"]["name"~"Hitra cesta H8"](45.4,13.4,46.9,16.6);
  relation["route"="road"]["ref"="3RO"](45.4,13.4,46.9,16.6);
  node["highway"="motorway_junction"](46.35,15.05,46.52,15.12);
  node["highway"="motorway_junction"](46.2,15.6,46.5,16.2);
);
out geom;`;

    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SloveniaGISExplorer/1.0" },
      body: "data=" + encodeURIComponent(query),
    })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const els = json.elements || [];

        // H8 (severni krak) — way z geometrijo
        const h8Ways = els.filter(e => e.type === "way" && e.geometry && /Hitra cesta H8|Hira cesta H8/.test(e.tags?.name || ""));
        const h8Lines = h8Ways.map(w => (w.geometry || []).map(p => [p.lat, p.lon]));
        const h8Tunnels = h8Ways.filter(w => w.tags?.tunnel === "yes" || w.tags?.tunnel === "building_passage");
        const h8Bridges = h8Ways.filter(w => w.tags?.bridge === "yes" || w.tags?.bridge === "viaduct");

        // Vzhodni krak — relacija 3RO (Ptuj–Ormož): vzamemo way članice
        const rel = els.find(e => e.type === "relation" && e.tags?.ref === "3RO");
        const eastMemberIds = new Set((rel?.members || []).map(m => m.ref));
        const eastWays = els.filter(e => e.type === "way" && eastMemberIds.has(e.id) && e.geometry);
        const eastLines = eastWays.map(w => (w.geometry || []).map(p => [p.lat, p.lon]));

        // Izvozi (motorway_junction) — samo tisti ob H8 in vzhodnem kraku
        const junctions = els
          .filter(e => e.type === "node" && e.tags?.highway === "motorway_junction")
          .map(n => ({ pos: [n.lat, n.lon], name: n.tags?.name || "", ref: n.tags?.ref || "" }));

        const payload = {
          h8Lines, h8Tunnels: h8Tunnels.map(w => ({ pos: wayCenter(w.geometry), name: w.tags?.name || "Predor H8", tunnel: w.tags?.tunnel })),
          h8Bridges: h8Bridges.map(w => ({ pos: wayCenter(w.geometry), name: w.tags?.name || "Vijadukt H8", bridge: w.tags?.bridge })),
          eastLines, eastName: rel?.tags?.name || "Hitra cesta 3RO",
          junctions,
        };

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
        <CircleMarker center={[46.43, 15.09]} radius={8} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.5 }} />
        <Tooltip permanent>Nalagam 3RO iz OpenStreetMap…</Tooltip>
      </LayerGroup>
    );
  }

  if (error || !data) {
    return (
      <LayerGroup>
        <CircleMarker center={[46.43, 15.09]} radius={8} pathOptions={{ color: "#94a3b8", fillColor: "#94a3b8", fillOpacity: 0.5 }} />
        <Tooltip permanent>3RO: podatki trenutno nedosegljivi</Tooltip>
      </LayerGroup>
    );
  }

  return (
    <LayerGroup>
      {/* ── Severni krak: Hitra cesta H8 (realna OSM geometrija) ── */}
      {data.h8Lines.map((pts, i) => (
        <Polyline
          key={`h8-${i}`}
          positions={pts}
          pathOptions={{ color: "#ffffff", weight: 7, opacity: opacity * 0.4, lineCap: "round" }}
        />
      ))}
      {data.h8Lines.map((pts, i) => (
        <Polyline
          key={`h8f-${i}`}
          positions={pts}
          pathOptions={{ color: COLOR_NORTH, weight: 4.5, opacity, lineCap: "round" }}
        />
      ))}

      {/* ── Vzhodni krak: Hitra cesta 3RO (Ptuj–Ormož, realna OSM geometrija) ── */}
      {data.eastLines.map((pts, i) => (
        <Polyline
          key={`e-${i}`}
          positions={pts}
          pathOptions={{ color: "#ffffff", weight: 6, opacity: opacity * 0.35, lineCap: "round" }}
        />
      ))}
      {data.eastLines.map((pts, i) => (
        <Polyline
          key={`ef-${i}`}
          positions={pts}
          pathOptions={{ color: COLOR_EAST, weight: 3.5, opacity, dashArray: "10,5", lineCap: "round" }}
        />
      ))}

      {/* ── Južni krak: načrtovano (NI v OSM) — tanka črtkana ── */}
      <Polyline
        positions={SOUTH_PLANNED}
        pathOptions={{ color: "#ffffff", weight: 5, opacity: opacity * 0.25, lineCap: "round" }}
      />
      <Polyline
        positions={SOUTH_PLANNED}
        pathOptions={{ color: COLOR_SOUTH_PLAN, weight: 2.5, opacity: opacity * 0.6, dashArray: "4,10", lineCap: "round" }}
      />
      <Marker position={[45.715, 15.27]} icon={emojiIcon("⚠️", 16)}>
        <Tooltip permanent={false} direction="top">
          <span className="text-xs font-semibold text-orange-600">
            Južni krak: načrtovano<br />
            <span className="text-[10px] text-slate-500">Trasa še ni v OSM — prikaz aproksimativen</span>
          </span>
        </Tooltip>
      </Marker>

      {/* ── Izvozi (motorway_junction iz OSM) ── */}
      {data.junctions.filter(j => j.pos).map((j, i) => (
        <Marker key={`j-${i}`} position={j.pos} icon={emojiIcon("🚏", 17)}>
          <Tooltip permanent={false} direction="top" offset={[0, -10]}>
            <span className="text-xs font-medium text-blue-700">
              {j.name}{j.ref ? ` (št. ${j.ref})` : ""}
            </span>
          </Tooltip>
        </Marker>
      ))}

      {/* ── Predori (tunnel=yes iz OSM) ── */}
      {data.h8Tunnels.filter(t => t.pos).map((t, i) => (
        <Marker key={`t-${i}`} position={t.pos} icon={emojiIcon("🚇", 20)}>
          <Tooltip permanent={false} direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold text-slate-800">{t.name}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* ── Vijadukti / mostovi (bridge=yes iz OSM) ── */}
      {data.h8Bridges.filter(b => b.pos).map((b, i) => (
        <Marker key={`b-${i}`} position={b.pos} icon={emojiIcon("🌉", 20)}>
          <Tooltip permanent={false} direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold text-purple-700">{b.name}</span>
          </Tooltip>
        </Marker>
      ))}
    </LayerGroup>
  );
}