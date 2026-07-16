import React from "react";
import { Polyline, CircleMarker, Tooltip, LayerGroup, Marker } from "react-leaflet";
import L from "leaflet";

// Tretja razvojna os (3RO) — bodoča hitra cesta od severne meje (Avstrija) do jugovzhodne meje (Hrvaška)
// Vir: Wikipedia sl — Tretja razvojna os, DARS, DRI prostorski načrti
// Koordinate so aproksimativne (zasovneženje tras po dolinah in priključkih)

const ROUTE_COLOR = "#dc2626";
const ROUTE_COLOR_SOUTH = "#ea580c";

// ── Severni krak: Šentrupert (A1) → Velenje jug → Velenje → Šoštanj → Slovenj Gradec → Otiški vrh → Holmec (meja) ──
const NORTH_BRANCH = [
  [46.2836, 15.0383], // Šentrupert — priključek na A1
  [46.3050, 15.0580], // Braslovče obvoz
  [46.3300, 15.0850], // Dobrná
  [46.3480, 15.1050], // Velenje jug (priključek)
  [46.3775, 15.1164], // Velenje
  [46.3800, 15.0800], // Šoštanj
  [46.4200, 15.0650], // Škale
  [46.4550, 15.0700], // Podgora (počivališče)
  [46.4700, 15.0800], // Slovenj Gradec jug (priključek)
  [46.5133, 15.0883], // Slovenj Gradec
  [46.5450, 15.1200], // Otiški vrh
  [46.5800, 15.1400], // Vodriž (predor — v gradnji)
  [46.6167, 15.1667], // Holmec — državna meja z Avstrijo
];

// ── Južni krak: Novo mesto (A2) → Osredek → Gorjanci (predor) → Maline → Metlika → Gradnik → Črnomelj jug ──
const SOUTH_BRANCH = [
  [45.8030, 15.1680], // Novo mesto — priključek na A2
  [45.7850, 15.1850], // NO obvoz
  [45.7650, 15.2100], // Osredek (priključek)
  [45.7400, 15.2400], // Težka Voda (počivališče)
  [45.7300, 15.2650], // Gorjanci — predor (2341 m)
  [45.7050, 15.2900], // Drganjica
  [45.6850, 15.3150], // Maline (priključek)
  [45.6650, 15.3150], // Metlika sever (priključek)
  [45.6436, 15.3144], // Metlika
  [45.6200, 15.3050], // Metlika MMP
  [45.6000, 15.2800], // Gradnik (razcep)
  [45.5800, 15.2400], // Brstovec (počivališče)
  [45.5700, 15.2150], // Krevljica (počivališče)
  [45.5614, 15.1897], // Črnomelj jug (priključek)
];

// ── Predori (tuneli) na trasi 3RO ────────────────────────────────────────────
const TUNNELS = [
  { pos: [46.5800, 15.1400], label: "Predor Vodriž (~1200 m, v načrtu)", branch: "N", length: 1200 },
  { pos: [46.5600, 15.1250], label: "Predor Otiški vrh (~800 m, v načrtu)", branch: "N", length: 800 },
  { pos: [45.7300, 15.2650], label: "Predor Gorjanci (2341 m, v načrtu)", branch: "S", length: 2341 },
  { pos: [45.6100, 15.2750], label: "Predor Gradnik (~600 m, v načrtu)", branch: "S", length: 600 },
];

// ── Vijadukti na trasi 3RO ───────────────────────────────────────────────────
const VIADUCTS = [
  { pos: [46.3050, 15.0580], label: "Vijadukt Braslovče (v načrtu)", branch: "N", length: 280 },
  { pos: [46.3300, 15.0850], label: "Vijadukt Dobrna (v načrtu)", branch: "N", length: 350 },
  { pos: [46.4200, 15.0650], label: "Vijadukt Škale (v načrtu)", branch: "N", length: 420 },
  { pos: [45.7400, 15.2400], label: "Vijadukt Težka Voda (v načrtu)", branch: "S", length: 380 },
  { pos: [45.7050, 15.2900], label: "Vijadukt Drganjica (v načrtu)", branch: "S", length: 260 },
  { pos: [45.6200, 15.3050], label: "Vijadukt Metlika MMP (v načrtu)", branch: "S", length: 310 },
  { pos: [45.5800, 15.2400], label: "Vijadukt Brstovec (v načrtu)", branch: "S", length: 340 },
];

// ── Izvozi / priključki (ločeno od drugih ključnih točk) ──────────────────────
const EXITS = [
  { pos: [46.2836, 15.0383], label: "Izvoz Šentrupert (A1)", branch: "N" },
  { pos: [46.3480, 15.1050], label: "Izvoz Velenje jug", branch: "N" },
  { pos: [46.4700, 15.0800], label: "Izvoz Slovenj Gradec jug", branch: "N" },
  { pos: [46.5133, 15.0883], label: "Izvoz Slovenj Gradec", branch: "N" },
  { pos: [45.8030, 15.1680], label: "Izvoz Novo mesto (A2)", branch: "S" },
  { pos: [45.7650, 15.2100], label: "Izvoz Osredek", branch: "S" },
  { pos: [45.6850, 15.3150], label: "Izvoz Maline", branch: "S" },
  { pos: [45.6650, 15.3150], label: "Izvoz Metlika sever", branch: "S" },
  { pos: [45.6000, 15.2800], label: "Razcep Gradnik", branch: "S" },
  { pos: [45.5614, 15.1897], label: "Izvoz Črnomelj jug", branch: "S" },
];

// Ključne točke (mejni prehodi, razcepi, mesta)
const KEY_POINTS = [
  { pos: [46.3775, 15.1164], label: "Velenje", branch: "N" },
  { pos: [46.6167, 15.1667], label: "Holmec — meja AT", branch: "N" },
  { pos: [45.6436, 15.3144], label: "Metlika", branch: "S" },
  { pos: [46.5450, 15.1200], label: "Otiški vrh (sedlo)", branch: "N" },
];

// Helper: ustvari emoji ikono za marker
function emojiIcon(emoji, size = 22) {
  return L.divIcon({
    html: `<div style="font-size:${size}px; line-height:1; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: "tda-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function ThirdDevAxisLayer({ opacity = 0.85 }) {
  return (
    <LayerGroup>
      {/* Severni krak — senca za vidnost na vseh podlagah */}
      <Polyline
        positions={NORTH_BRANCH}
        pathOptions={{
          color: "#ffffff",
          weight: 8,
          opacity: opacity * 0.45,
          lineCap: "round",
        }}
      />
      <Polyline
        positions={NORTH_BRANCH}
        pathOptions={{
          color: ROUTE_COLOR,
          weight: 5,
          opacity,
          dashArray: "12,6",
          lineCap: "round",
        }}
      />

      {/* Južni krak — senca + polna črta */}
      <Polyline
        positions={SOUTH_BRANCH}
        pathOptions={{
          color: "#ffffff",
          weight: 8,
          opacity: opacity * 0.45,
          lineCap: "round",
        }}
      />
      <Polyline
        positions={SOUTH_BRANCH}
        pathOptions={{
          color: ROUTE_COLOR_SOUTH,
          weight: 5,
          opacity,
          dashArray: "12,6",
          lineCap: "round",
        }}
      />

      {/* Ključne točke (mesta, meja, razcep) */}
      {KEY_POINTS.map((pt, i) => (
        <CircleMarker
          key={`kp-${i}`}
          center={pt.pos}
          radius={5}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: pt.branch === "N" ? ROUTE_COLOR : ROUTE_COLOR_SOUTH,
            fillOpacity: 0.95,
          }}
        >
          <Tooltip permanent={false} direction="top" offset={[0, -8]}>
            <span className="text-xs font-semibold">{pt.label}</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Izvozi / priključki — modri marker */}
      {EXITS.map((pt, i) => (
        <Marker key={`exit-${i}`} position={pt.pos} icon={emojiIcon("🚏", 18)}>
          <Tooltip permanent={false} direction="top" offset={[0, -10]}>
            <span className="text-xs font-medium text-blue-700">{pt.label}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* Predori — črn marker */}
      {TUNNELS.map((pt, i) => (
        <Marker key={`tun-${i}`} position={pt.pos} icon={emojiIcon("🚇", 22)}>
          <Tooltip permanent={false} direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold text-slate-800">
              {pt.label}
              <br />
              <span className="text-[10px] text-slate-500">Dolžina: ~{pt.length} m</span>
            </span>
          </Tooltip>
        </Marker>
      ))}

      {/* Vijadukti — vijolični marker */}
      {VIADUCTS.map((pt, i) => (
        <Marker key={`via-${i}`} position={pt.pos} icon={emojiIcon("🌉", 22)}>
          <Tooltip permanent={false} direction="top" offset={[0, -12]}>
            <span className="text-xs font-semibold text-purple-700">
              {pt.label}
              <br />
              <span className="text-[10px] text-slate-500">Dolžina: ~{pt.length} m</span>
            </span>
          </Tooltip>
        </Marker>
      ))}
    </LayerGroup>
  );
}