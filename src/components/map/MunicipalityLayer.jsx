import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const LS_KEY_MUN = "slomapcat_mun_v4";
const LS_KEY_PLACES = "slomapcat_places_v2";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

function loadCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function saveCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// Stitch way segments into closed rings
function stitchWays(ways) {
  if (!ways || ways.length === 0) return [];

  // Build segments as arrays of [lat,lon]
  const segments = ways.map(w => (w.geometry || []).map(g => [g.lat, g.lon]));
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  // Greedy stitching
  const result = [...segments[0]];
  const remaining = segments.slice(1);

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let bestIdx = -1;
    let bestReverse = false;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      if (!seg || seg.length === 0) continue;
      const d1 = dist(last, seg[0]);
      const d2 = dist(last, seg[seg.length - 1]);
      if (d1 < bestDist) { bestDist = d1; bestIdx = i; bestReverse = false; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; bestReverse = true; }
    }

    if (bestIdx === -1) break;
    const seg = remaining.splice(bestIdx, 1)[0];
    const toAdd = bestReverse ? [...seg].reverse() : seg;
    // Skip duplicate first point
    result.push(...toAdd.slice(1));
  }

  return result;
}

function dist(a, b) {
  if (!a || !b) return Infinity;
  const dlat = a[0] - b[0];
  const dlon = a[1] - b[1];
  return dlat * dlat + dlon * dlon;
}

async function fetchMunicipalities() {
  const query = `[out:json][timeout:90];
relation["admin_level"="8"]["boundary"="administrative"](45.4,13.3,46.9,16.7);
out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();

  const features = [];
  for (const el of data.elements || []) {
    if (el.type !== "relation") continue;
    const name = el.tags?.name || el.tags?.["name:sl"] || "";
    if (!name) continue;

    const outerWays = (el.members || []).filter(m => m.type === "way" && m.role === "outer" && m.geometry?.length > 0);
    const innerWays = (el.members || []).filter(m => m.type === "way" && m.role === "inner" && m.geometry?.length > 0);

    if (outerWays.length === 0) continue;

    const outerRing = stitchWays(outerWays);
    if (outerRing.length < 4) continue;

    // Holes
    const holes = innerWays.length > 0 ? [stitchWays(innerWays)] : [];

    // Centroid from outer ring
    const lat = outerRing.reduce((s, c) => s + c[0], 0) / outerRing.length;
    const lon = outerRing.reduce((s, c) => s + c[1], 0) / outerRing.length;

    features.push({ name, outerRing, holes, centroid: [lat, lon] });
  }
  return features;
}

async function fetchPlaces() {
  const query = `[out:json][timeout:30];node["place"~"town|village|hamlet"](45.4,13.3,46.9,16.7);out;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();
  return (data.elements || []).map(el => ({
    lat: el.lat, lon: el.lon,
    name: el.tags?.name || "",
    place: el.tags?.place || "village",
  })).filter(el => el.lat && el.lon);
}

export default function MunicipalityLayer({ visible }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (groupRef.current) { groupRef.current.remove(); groupRef.current = null; }
      return;
    }

    let cancelled = false;

    async function load() {
      // Load municipalities and places in parallel
      let [municipalities, places] = await Promise.all([
        (async () => {
          const cached = loadCache(LS_KEY_MUN);
          if (cached) return cached;
          const data = await fetchMunicipalities();
          if (data.length > 0) saveCache(LS_KEY_MUN, data);
          return data;
        })(),
        (async () => {
          const cached = loadCache(LS_KEY_PLACES);
          if (cached) return cached;
          const data = await fetchPlaces();
          if (data.length > 0) saveCache(LS_KEY_PLACES, data);
          return data;
        })(),
      ]);

      if (cancelled) return;

      const group = L.layerGroup();
      const renderer = L.canvas({ padding: 0.5 });

      // Draw municipality polygons + labels
      for (const f of municipalities) {
        const positions = f.holes?.length > 0 ? [f.outerRing, ...f.holes] : f.outerRing;
        const poly = L.polygon(positions, {
          color: "#92400e",
          weight: 1.8,
          fillColor: "#fde68a",
          fillOpacity: 0.15,
          pane: "overlayPane",
          interactive: false,
        });
        group.addLayer(poly);

        // Municipality name label
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            font-size: 10px;
            font-weight: 800;
            color: #7c2d12;
            text-shadow: 0 0 4px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.9);
            white-space: nowrap;
            pointer-events: none;
            transform: translate(-50%, -50%);
            letter-spacing: 0.05em;
            text-transform: uppercase;
          ">${f.name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        group.addLayer(L.marker(f.centroid, { icon, interactive: false, pane: "tooltipPane" }));
      }

      // Draw place dots + labels
      for (const p of places) {
        const isLarger = p.place === "town";
        const cm = L.circleMarker([p.lat, p.lon], {
          renderer,
          radius: isLarger ? 4 : 2.5,
          color: "white",
          weight: 1,
          fillColor: "#15803d",
          fillOpacity: 0.9,
          pane: "markerPane",
          interactive: false,
        });
        group.addLayer(cm);
      }

      if (!cancelled) {
        group.addTo(map);
        groupRef.current = group;
      } else {
        group.remove();
      }
    }

    load();

    return () => {
      cancelled = true;
      if (groupRef.current) { groupRef.current.remove(); groupRef.current = null; }
    };
  }, [visible, map]);

  return null;
}