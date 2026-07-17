import React, { useEffect, useState } from "react";
import { Polyline, CircleMarker, Tooltip, LayerGroup, Marker } from "react-leaflet";
import L from "leaflet";
import { fetchOverpass } from "@/lib/overpass";

// TRETJA RAZVOJNA OS (3RO) — uradni podatki DARS + realna OSM geometrija
//
// Vir: https://www.dars.si/Infrastrukturni_projekti/Tretja_razvojna_os
//       https://sl.wikipedia.org/wiki/Tretja_razvojna_os
//
// SEVERNI KRAK (31,5 km): Šentrupert (A1) → Velenje → Slovenj Gradec
//   - Odsek 1: Šentrupert → Velenje jug — 14 km (v načrtovanju, ŠE NI v OSM)
//   - Odsek 2: Velenje jug → Slovenj Gradec jug — 17,5 km (v gradnji, v OSM kot "Hitra cesta H8")
//   - 6 predorov, 3 galerije, 26 viaduktov, 8 mostov
//
// JUŽNI KRAK (44,6 km): Novo mesto (A2) → Maline → Metlika → Črnomelj
//   - Odsek 1: Novo mesto → Osredek → Maline — 17,9 km (predor Gorjanci 2341 m)
//   - Odsek 2: Maline → Metlika → Črnomelj jug — 26,7 km
//   - 3 mostovi, 4 viadukti, 1 predor (Gorjanci)

const COLOR_NORTH = "#dc2626";
const COLOR_NORTH_PLAN = "#f87171";
const COLOR_SOUTH = "#7c3aed";
const COLOR_SOUTH_PLAN = "#a78bfa";
const CACHE_KEY = "slomap_3ro_v4";

// Severni krak — Odsek 1 (v načrtovanju, ŠE NI v OSM): Šentrupert → Velenje jug
const NORTH_ODSEK1 = [
  [46.270, 15.030], // Priključek Šentrupert (na A1 Šentilj–Koper)
  [46.285, 15.045], // Braslovče
  [46.305, 15.065], // Šmartno ob Paki
  [46.325, 15.085], // Velenje zahod
  [46.340, 15.095], // Priključek Velenje jug
];

// Južni krak — Odsek 1: Novo mesto → Osredek → Maline (17,9 km)
const SOUTH_ODSEK1 = [
  [45.803, 15.168], // Priključek Novo mesto (na A2 Ljubljana–Obrežje)
  [45.790, 15.180], // čez Krko
  [45.775, 15.195], // proti Gorjancem
  [45.760, 15.210], // Težka Voda (počivališče)
  [45.745, 15.225], // Osredek (priključek)
  [45.730, 15.240], // predor Gorjanci (2341 m) — vhod
  [45.710, 15.265], // predor Gorjanci — izhod
  [45.695, 15.280], // Maline
  [45.685, 15.290], // Priključek Maline
];

// Južni krak — Odsek 2: Maline → Metlika → Črnomelj jug (26,7 km)
const SOUTH_ODSEK2 = [
  [45.685, 15.290], // Maline
  [45.660, 15.280], // Pododsek A: proti Metliki
  [45.620, 15.250],
  [45.585, 15.215],
  [45.560, 15.195], // Metlika sever (priključek)
  [45.555, 15.190], // MMP Metlika (Pododsek B, 2,5 km)
  [45.500, 15.190], // Pododsek C: Gradnik → Črnomelj
  [45.440, 15.185],
  [45.390, 15.180],
  [45.350, 15.175], // Črnomelj jug (priključek)
];

// Ključni objekti na trasi
const STRUCTURES = [
  // Sever — predori H8
  { pos: [46.38, 15.09], emoji: "🚇", name: "Predor H8 (1/6)", color: "#dc2626" },
  { pos: [46.42, 15.09], emoji: "🚇", name: "Predor H8 (2/6)", color: "#dc2626" },
  { pos: [46.45, 15.09], emoji: "🚇", name: "Predor H8 (3/6)", color: "#dc2626" },
  // Sever — vijadukti H8 (predstavni)
  { pos: [46.40, 15.09], emoji: "🌉", name: "Vijadukt H8 (1/26)", color: "#dc2626" },
  { pos: [46.43, 15.10], emoji: "🌉", name: "Vijadukt H8 (2/26)", color: "#dc2626" },
  { pos: [46.48, 15.10], emoji: "🌉", name: "Vijadukt H8 (3/26)", color: "#dc2626" },
  // Jug — predor Gorjanci (2341 m)
  { pos: [45.720, 15.252], emoji: "🚇", name: "Predor Gorjanci (2341 m)", color: "#7c3aed" },
  // Jug — vijadukti in mostovi
  { pos: [45.785, 15.185], emoji: "🌉", name: "Most čez Krko", color: "#7c3aed" },
  { pos: [45.740, 15.225], emoji: "🌉", name: "Viadukt Gorjanci (vhod)", color: "#7c3aed" },
  { pos: [45.600, 15.220], emoji: "🌉", name: "Most pri Metliki", color: "#7c3aed" },
];

// Priključki
const JUNCTIONS = [
  { pos: [46.270, 15.030], name: "Šentrupert (A1)", emoji: "🚏" },
  { pos: [46.340, 15.095], name: "Velenje jug", emoji: "🚏" },
  { pos: [46.505, 15.090], name: "Slovenj Gradec jug", emoji: "🚏" },
  { pos: [45.803, 15.168], name: "Novo mesto (A2)", emoji: "🚏" },
  { pos: [45.745, 15.225], name: "Osredek", emoji: "🚏" },
  { pos: [45.685, 15.290], name: "Maline", emoji: "🚏" },
  { pos: [45.560, 15.195], name: "Metlika sever", emoji: "🚏" },
  { pos: [45.555, 15.190], name: "MMP Metlika", emoji: "🚏" },
  { pos: [45.350, 15.175], name: "Črnomelj jug", emoji: "🚏" },
];

function emojiIcon(emoji, size = 18) {
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

    function setLinesFromFlat(features) {
      // CachedLayer.coords je flat [lat1,lon1,lat2,lon2,...] — rekonstruiramo pare
      return (features || [])
        .filter(f => f.type === "LineString" && f.coords && f.coords.length >= 4)
        .map(f => {
          const pairs = [];
          for (let i = 0; i + 1 < f.coords.length; i += 2) pairs.push([f.coords[i], f.coords[i + 1]]);
          return pairs;
        });
    }

    async function loadFromServer() {
      const { base44 } = await import("@/api/base44Client");
      const rows = await base44.entities.CachedLayer.filter({ category_id: "third_dev_axis" });
      const row = rows && rows[0];
      if (!row || !row.features) return false;
      const age = Date.now() - new Date(row.built_at).getTime();
      if (age > 14 * 24 * 60 * 60 * 1000) return false; // starejši od 14 dni = neuporaben
      const h8Lines = setLinesFromFlat(row.features);
      if (!h8Lines.length) return false;
      setData({ h8Lines });
      setLoading(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload: { h8Lines } })); } catch {}
      return true;
    }

    async function loadFromLocal() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { ts, payload } = JSON.parse(cached);
          if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000 && payload?.h8Lines?.length) {
            setData(payload);
            setLoading(false);
            return true;
          }
        }
      } catch {}
      return false;
    }

    async function loadFromOSM() {
      // H8: vsi construction=trunk odseki z opening_date=2029 + way-i z name=H8
      const qH8 = `[out:json][timeout:25];
(
  way["highway"="construction"]["construction"="trunk"]["opening_date"="2029"](45.0,13.0,47.0,17.0);
  way["name"="H8"]["highway"="construction"](45.0,13.0,47.0,17.0);
);
out geom;`;
      const json = await fetchOverpass(qH8);
      const ways = (json.elements || []).filter(e => e.type === "way" && e.geometry);
      const h8Lines = ways.map(w => (w.geometry || []).map(p => [p.lat, p.lon]));
      if (!h8Lines.length) throw new Error("Ni OSM podatkov za H8");
      setData({ h8Lines });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload: { h8Lines } })); } catch {}
    }

    (async () => {
      try {
        if (await loadFromLocal()) return;
        if (await loadFromServer()) return;
        await loadFromOSM();
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

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

  const plannedBg = { color: "#ffffff", weight: 5, opacity: opacity * 0.25, lineCap: "round" };

  return (
    <LayerGroup>
      {/* ===== SEVERNI KRAK ===== */}

      {/* Odsek 2: H8 Velenje → Slovenj Gradec (realna OSM geometrija, v gradnji) */}
      {data && !error && data.h8Lines.map((pts, i) => (
        <Polyline key={`h8w-${i}`} positions={pts} pathOptions={{ color: "#ffffff", weight: 7, opacity: opacity * 0.4, lineCap: "round" }} />
      ))}
      {data && !error && data.h8Lines.map((pts, i) => (
        <Polyline key={`h8f-${i}`} positions={pts} pathOptions={{ color: COLOR_NORTH, weight: 4.5, opacity, lineCap: "round" }} />
      ))}

      {/* Odsek 1: Šentrupert → Velenje jug (v načrtovanju, ŠE NI v OSM) */}
      <Polyline positions={NORTH_ODSEK1} pathOptions={{ ...plannedBg, color: "#ffffff", weight: 5, opacity: opacity * 0.2 }} />
      <Polyline positions={NORTH_ODSEK1} pathOptions={{ color: COLOR_NORTH_PLAN, weight: 3, opacity: opacity * 0.7, dashArray: "6,8", lineCap: "round" }} />

      {/* ===== JUŽNI KRAK (oba odseka v načrtovanju, ŠE NI v OSM) ===== */}

      {/* Odsek 1: Novo mesto → Osredek → Maline (17,9 km, predor Gorjanci) */}
      <Polyline positions={SOUTH_ODSEK1} pathOptions={{ ...plannedBg, weight: 5, opacity: opacity * 0.2 }} />
      <Polyline positions={SOUTH_ODSEK1} pathOptions={{ color: COLOR_SOUTH, weight: 3.5, opacity, dashArray: "8,6", lineCap: "round" }} />

      {/* Odsek 2: Maline → Metlika → Črnomelj jug (26,7 km) */}
      <Polyline positions={SOUTH_ODSEK2} pathOptions={{ ...plannedBg, weight: 5, opacity: opacity * 0.2 }} />
      <Polyline positions={SOUTH_ODSEK2} pathOptions={{ color: COLOR_SOUTH_PLAN, weight: 3, opacity, dashArray: "6,8", lineCap: "round" }} />

      {/* ===== KLJUČNI OBJEKTI ===== */}
      {STRUCTURES.map((s, i) => (
        <Marker key={`s-${i}`} position={s.pos} icon={emojiIcon(s.emoji, 18)}>
          <Tooltip direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold" style={{ color: s.color }}>{s.name}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* ===== PRIKLJUČKI ===== */}
      {JUNCTIONS.map((j, i) => (
        <Marker key={`j-${i}`} position={j.pos} icon={emojiIcon(j.emoji, 14)}>
          <Tooltip direction="top" offset={[0, -8]}>
            <span className="text-[10px] font-medium text-slate-700">{j.name}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* ===== INFO MARKERJI ===== */}
      <Marker position={[46.40, 15.09]} icon={emojiIcon("🚧", 20)}>
        <Tooltip direction="top" offset={[0, -14]}>
          <div>
            <span className="text-xs font-bold text-red-600">SEVERNI KRAK — Odsek 2</span>
            <span className="block text-[10px] text-slate-600">Velenje → Slovenj Gradec (17,5 km, v gradnji)</span>
          </div>
        </Tooltip>
      </Marker>
      <Marker position={[46.30, 15.06]} icon={emojiIcon("📐", 18)}>
        <Tooltip direction="top" offset={[0, -12]}>
          <div>
            <span className="text-xs font-bold text-red-400">SEVERNI KRAK — Odsek 1</span>
            <span className="block text-[10px] text-slate-600">Šentrupert → Velenje (14 km, v načrtovanju)</span>
          </div>
        </Tooltip>
      </Marker>
      <Marker position={[45.745, 15.225]} icon={emojiIcon("🚧", 20)}>
        <Tooltip direction="top" offset={[0, -14]}>
          <div>
            <span className="text-xs font-bold text-purple-600">JUŽNI KRAK — Odsek 1</span>
            <span className="block text-[10px] text-slate-600">Novo mesto → Maline (17,9 km, v načrtovanju)</span>
          </div>
        </Tooltip>
      </Marker>
      <Marker position={[45.480, 15.190]} icon={emojiIcon("📐", 18)}>
        <Tooltip direction="top" offset={[0, -12]}>
          <div>
            <span className="text-xs font-bold text-purple-400">JUŽNI KRAK — Odsek 2</span>
            <span className="block text-[10px] text-slate-600">Maline → Metlika → Črnomelj (26,7 km, v načrtovanju)</span>
          </div>
        </Tooltip>
      </Marker>

      {error && (
        <CircleMarker center={[46.43, 15.09]} radius={12} pathOptions={{ color: "#94a3b8", fillColor: "#94a3b8", fillOpacity: 0.3 }}>
          <Tooltip permanent>
            <span className="text-[10px] text-slate-500">H8 OSM nedosegljiv — prikažem načrtovano traso</span>
          </Tooltip>
        </CircleMarker>
      )}
    </LayerGroup>
  );
}