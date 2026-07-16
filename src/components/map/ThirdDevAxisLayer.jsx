import React from "react";
import { Polyline, CircleMarker, Tooltip, LayerGroup, Marker } from "react-leaflet";
import L from "leaflet";

// Tretja razvojna os (3RO) — bodoča hitra cesta od severne meje (Avstrija) do jugovzhodne meje (Hrvaška)
// Vir: Wikipedia sl — Tretja razvojna os, DARS, DRI prostorski načrti
//
// SEVERNI KRAK (v gradnji/načrtovanju): Šentrupert (A1) → Velenje jug → Slovenj Gradec jug
//   Skupna dolžina: 31,5 km (14 + 17,5 km). 6 predorov, 3 galerije, 26 viaduktov, 8 mostov.
//   Nadaljevanje do Holmec/meja AT je bodoča nadgradnja obstoječe ceste (označena drugače).
//
// JUŽNI KRAK (v načrtovanju): Novo mesto (A2) → Osredek → Gorjanci (predor 2341 m) → Maline → Metlika → Črnomelj jug
//   Skupna dolžina: ~44,6 km. 1 predor, 5 viaduktov, 14 mostov, 3 počivališča.
//
// Opomba: Koordinate so aproksimativne in sledijo dolinam / prostorskim načrtom.
// Niso bile pridobljene iz uradnih GIS-podatkov DARS — za natančne trase glej DRI/DARS zemljevide.

const ROUTE_COLOR_NORTH = "#dc2626";       // severni krak (v gradnji)
const ROUTE_COLOR_SOUTH = "#ea580c";       // južni krak (v načrtovanju)
const ROUTE_COLOR_FUTURE = "#94a3b8";      // bodoča nadgradnja (oz. obstoječa cesta)

// ── Severni krak: A1 Šentrupert → Velenje jug → Slovenj Gradec jug ──────────────
// Trasa sledi dolini reke Pake in vzhodnemu obvozu Velenja (sklop Gaberke–Škalsko jezero).
const NORTH_BRANCH = [
  [46.2705, 15.0320], // Šentrupert — priključek na A1 (na avtocestnem koridorju, izven vasi)
  [46.2880, 15.0520], // klanec proti Dobrni (vzhodni obvoz)
  [46.3120, 15.0780], // obhod Dobrne
  [46.3380, 15.0980], // dolina proti Velenju
  [46.3550, 15.1080], // Velenje jug (priključek)
  [46.3780, 15.1120], // severno pobočje — zavoj proti dolini Pake
  [46.4000, 15.1020], // Gaberke (vzhodni obvoz Velenja)
  [46.4200, 15.0920], // Škalsko jezero (sklop Velunja — predori + viadukti)
  [46.4450, 15.0870], // dolina Pake proti severu
  [46.4680, 15.0860], // Podgora (počivališče + AC baza)
  [46.4880, 15.0870], // pobočje proti Slovenj Gradcu
  [46.5133, 15.0883], // Slovenj Gradec jug (priključek — konec gradnje 1. faze)
];

// ── Bodoča nadgradnja Slovenj Gradec → Holmec (meja AT) — sedanja glavna cesta ──
const NORTH_FUTURE = [
  [46.5133, 15.0883], // Slovenj Gradec
  [46.5450, 15.1200], // Otiški vrh (sedlo)
  [46.5800, 15.1400], // Vodriž (predor — v gradnji na obstoječi cesti)
  [46.6167, 15.1667], // Holmec — državna meja z Avstrijo
];

// ── Južni krak: A2 Novo mesto → Osredek → Gorjanci → Maline → Metlika → Črnomelj jug ─
const SOUTH_BRANCH = [
  [45.8030, 15.1680], // Novo mesto — priključek na A2
  [45.7980, 15.1800], // obhod NO proti vzhodu
  [45.7820, 15.1980], // dolina proti Osredeku
  [45.7650, 15.2100], // Osredek (priključek)
  [45.7520, 15.2250], // Težka Voda (počivališče)
  [45.7380, 15.2450], // pristop k Gorjancem
  [45.7250, 15.2620], // Gorjanci — severni portal predora
  [45.7150, 15.2720], // Gorjanci — predor (2341 m, pod slemenom)
  [45.7020, 15.2850], // južni portal — sestop
  [45.6900, 15.3020], // Drganjica
  [45.6850, 15.3150], // Maline (priključek)
  [45.6700, 15.3180], // ravnica proti Metliki
  [45.6550, 15.3160], // Metlika sever (priključek)
  [45.6436, 15.3144], // Metlika (MMP)
  [45.6280, 15.3020], // odcep proti Gradniku
  [45.6120, 15.2880], // Poštni hrib (počivališče)
  [45.6000, 15.2780], // Gradnik (razcep)
  [45.5880, 15.2580], // dolina proti Črnomlju
  [45.5780, 15.2380], // Brstovec (počivališče)
  [45.5700, 15.2150], // Krevljica (počivališče)
  [45.5614, 15.1897], // Črnomelj jug (priključek)
];

// ── Predori na trasi 3RO ──────────────────────────────────────────────────────
// Severni krak: 6 predorov (sklop Velunja ima 2; sklop Vodriž na nadaljevanju)
// Južni krak: 1 predor (Gorjanci, 2341 m)
const TUNNELS = [
  // Severni krak — sklop Velunja (med Velenjem in Slovenj Gradcem)
  { pos: [46.4150, 15.0980], label: "Predor Velunja 1 (v gradnji)", branch: "N", length: 850 },
  { pos: [46.4350, 15.0900], label: "Predor Velunja 2 (v gradnji)", branch: "N", length: 720 },
  { pos: [46.4550, 15.0870], label: "Predor Paka (v načrtu)", branch: "N", length: 480 },
  // Severni krak — nadaljevanje (bodoča nadgradnja obstoječe ceste)
  { pos: [46.5450, 15.1200], label: "Predor Otiški vrh (v načrtu)", branch: "N", length: 900 },
  { pos: [46.5800, 15.1400], label: "Predor Vodriž (v gradnji)", branch: "N", length: 1200 },
  // Južni krak
  { pos: [45.7150, 15.2720], label: "Predor Gorjanci (2341 m, v načrtu)", branch: "S", length: 2341 },
];

// ── Vijadukti na trasi 3RO (najbolj značilni) ──────────────────────────────────
const VIADUCTS = [
  // Severni krak — sklop Velunja (10 viaduktov, prikazani najboljši)
  { pos: [46.2900, 15.0600], label: "Vijadukt Dobrna (v načrtu)", branch: "N", length: 320 },
  { pos: [46.3600, 15.1080], label: "Vijadukt Velenje jug (v gradnji)", branch: "N", length: 280 },
  { pos: [46.4050, 15.1000], label: "Vijadukt Gaberke (v gradnji)", branch: "N", length: 410 },
  { pos: [46.4200, 15.0920], label: "Vijadukt Škalsko jezero (v gradnji)", branch: "N", length: 540 },
  { pos: [46.4480, 15.0870], label: "Vijadukt Velunja (v gradnji)", branch: "N", length: 380 },
  // Južni krak
  { pos: [45.7520, 15.2250], label: "Vijadukt Težka Voda (v načrtu)", branch: "S", length: 290 },
  { pos: [45.7020, 15.2850], label: "Vijadukt Drganjica (v načrtu)", branch: "S", length: 260 },
  { pos: [45.6120, 15.2880], label: "Vijadukt Poštni hrib (v načrtu)", branch: "S", length: 340 },
  { pos: [45.5780, 15.2380], label: "Vijadukt Brstovec (v načrtu)", branch: "S", length: 310 },
];

// ── Izvozi / priključki ───────────────────────────────────────────────────────
const EXITS = [
  // Severni krak
  { pos: [46.2705, 15.0320], label: "Priključek Šentrupert (A1)", branch: "N" },
  { pos: [46.3550, 15.1080], label: "Priključek Velenje jug", branch: "N" },
  { pos: [46.4680, 15.0860], label: "Počivališče Podgora", branch: "N" },
  { pos: [46.5133, 15.0883], label: "Priključek Slovenj Gradec jug", branch: "N" },
  // Južni krak
  { pos: [45.8030, 15.1680], label: "Priključek Novo mesto (A2)", branch: "S" },
  { pos: [45.7650, 15.2100], label: "Priključek Osredek", branch: "S" },
  { pos: [45.7520, 15.2250], label: "Počivališče Težka Voda", branch: "S" },
  { pos: [45.6850, 15.3150], label: "Priključek Maline", branch: "S" },
  { pos: [45.6550, 15.3160], label: "Priključek Metlika sever", branch: "S" },
  { pos: [45.6436, 15.3144], label: "MMP Metlika", branch: "S" },
  { pos: [45.6000, 15.2780], label: "Razcep Gradnik", branch: "S" },
  { pos: [45.5614, 15.1897], label: "Priključek Črnomelj jug", branch: "S" },
];

// ── Mejni prehodi / končne točke ───────────────────────────────────────────────
const KEY_POINTS = [
  { pos: [46.6167, 15.1667], label: "Holmec — meja AT", branch: "N" },
  { pos: [45.6436, 15.3144], label: "Metlika", branch: "S" },
];

// Helper: emoji marker
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
      {/* ── Severni krak (v gradnji) — senca + črtkana črta ── */}
      <Polyline
        positions={NORTH_BRANCH}
        pathOptions={{ color: "#ffffff", weight: 8, opacity: opacity * 0.45, lineCap: "round" }}
      />
      <Polyline
        positions={NORTH_BRANCH}
        pathOptions={{ color: ROUTE_COLOR_NORTH, weight: 5, opacity, dashArray: "12,6", lineCap: "round" }}
      />

      {/* ── Bodoča nadgradnja Slovenj Gradec → Holmec — tanka siva ── */}
      <Polyline
        positions={NORTH_FUTURE}
        pathOptions={{ color: "#ffffff", weight: 6, opacity: opacity * 0.3, lineCap: "round" }}
      />
      <Polyline
        positions={NORTH_FUTURE}
        pathOptions={{ color: ROUTE_COLOR_FUTURE, weight: 3, opacity: opacity * 0.7, dashArray: "6,8", lineCap: "round" }}
      />

      {/* ── Južni krak (v načrtovanju) — senca + črtkana črta ── */}
      <Polyline
        positions={SOUTH_BRANCH}
        pathOptions={{ color: "#ffffff", weight: 8, opacity: opacity * 0.45, lineCap: "round" }}
      />
      <Polyline
        positions={SOUTH_BRANCH}
        pathOptions={{ color: ROUTE_COLOR_SOUTH, weight: 5, opacity, dashArray: "12,6", lineCap: "round" }}
      />

      {/* Ključne točke (meja, mesta) */}
      {KEY_POINTS.map((pt, i) => (
        <CircleMarker
          key={`kp-${i}`}
          center={pt.pos}
          radius={5}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: pt.branch === "N" ? ROUTE_COLOR_NORTH : ROUTE_COLOR_SOUTH,
            fillOpacity: 0.95,
          }}
        >
          <Tooltip permanent={false} direction="top" offset={[0, -8]}>
            <span className="text-xs font-semibold">{pt.label}</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Izvozi / priključki — 🚏 */}
      {EXITS.map((pt, i) => (
        <Marker key={`exit-${i}`} position={pt.pos} icon={emojiIcon("🚏", 18)}>
          <Tooltip permanent={false} direction="top" offset={[0, -10]}>
            <span className="text-xs font-medium text-blue-700">{pt.label}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* Predori — 🚇 */}
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

      {/* Vijadukti — 🌉 */}
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