import React from "react";
import { Polyline, CircleMarker, Tooltip, LayerGroup } from "react-leaflet";

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

// Ključni priključki in točke za označitev
const KEY_POINTS = [
  { pos: [46.2836, 15.0383], label: "Šentrupert (A1)", branch: "N" },
  { pos: [46.3480, 15.1050], label: "Velenje jug", branch: "N" },
  { pos: [46.3775, 15.1164], label: "Velenje", branch: "N" },
  { pos: [46.4700, 15.0800], label: "Slovenj Gradec jug", branch: "N" },
  { pos: [46.5133, 15.0883], label: "Slovenj Gradec", branch: "N" },
  { pos: [46.5800, 15.1400], label: "Vodriž (predor)", branch: "N" },
  { pos: [46.6167, 15.1667], label: "Holmec — meja AT", branch: "N" },
  { pos: [45.8030, 15.1680], label: "Novo mesto (A2)", branch: "S" },
  { pos: [45.7650, 15.2100], label: "Osredek", branch: "S" },
  { pos: [45.7300, 15.2650], label: "Gorjanci (predor)", branch: "S" },
  { pos: [45.6850, 15.3150], label: "Maline", branch: "S" },
  { pos: [45.6436, 15.3144], label: "Metlika", branch: "S" },
  { pos: [45.6000, 15.2800], label: "Gradnik (razcep)", branch: "S" },
  { pos: [45.5614, 15.1897], label: "Črnomelj jug", branch: "S" },
];

export default function ThirdDevAxisLayer({ opacity = 0.85 }) {
  return (
    <LayerGroup>
      {/* Severni krak — polna črta (v gradnji) */}
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

      {/* Južni krak — polna črta (v načrtovanju) */}
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

      {/* Ključne točke / priključki */}
      {KEY_POINTS.map((pt, i) => (
        <CircleMarker
          key={i}
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
    </LayerGroup>
  );
}