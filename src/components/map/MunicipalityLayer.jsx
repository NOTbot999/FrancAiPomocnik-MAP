import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { fetchOverpass } from "@/lib/overpass";
import { loadBundled } from "@/lib/offlineData";
import { MUNICIPALITY_QUERY, PLACES_QUERY } from "@/data/categories";
import { parseMunicipalities, parsePlaces } from "@/data/parsers";

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

async function fetchMunicipalities() {
  // 1. Bundled /data/municipalities.json (npm run fetch-data) — works offline
  const bundled = await loadBundled("municipalities");
  if (bundled) return bundled;
  // 2. Overpass. ISO3166-2=SI-* filter keeps only ~212 Slovenian municipalities (~7 MB).
  const data = await fetchOverpass(MUNICIPALITY_QUERY, 90000);
  return parseMunicipalities(data);
}

async function fetchPlaces() {
  const bundled = await loadBundled("places");
  if (bundled) return bundled;
  const data = await fetchOverpass(PLACES_QUERY);
  return parsePlaces(data);
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
      // Single shared canvas renderer for ALL vector shapes — far fewer DOM nodes, much faster pan/zoom
      const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 0 });

      // Draw municipality polygons + labels
      for (const f of municipalities) {
        const positions = f.holes?.length > 0 ? [f.outerRing, ...f.holes] : f.outerRing;
        const poly = L.polygon(positions, {
          renderer: canvasRenderer,
          color: "#dc2626",       // red border
          weight: 1.5,
          fillColor: "#fde68a",
          fillOpacity: 0.1,
          pane: "overlayPane",
          interactive: false,
        });
        group.addLayer(poly);

        // Municipality name label — blue
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            font-size: 10px;
            font-weight: 800;
            color: #1d4ed8;
            -webkit-text-stroke: 2.5px white;
            paint-order: stroke fill;
            white-space: nowrap;
            pointer-events: none;
            transform: translate(-50%, -50%);
            letter-spacing: 0.04em;
            text-transform: uppercase;
          ">${f.name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        group.addLayer(L.marker(f.centroid, { icon, interactive: false, pane: "tooltipPane" }));
      }

      // Draw place dots (canvas renderer — no SVG per dot)
      for (const p of places) {
        const isLarger = p.place === "town";
        const cm = L.circleMarker([p.lat, p.lon], {
          renderer: canvasRenderer,
          radius: isLarger ? 4 : 2.5,
          color: "white",
          weight: 1,
          fillColor: "#15803d",
          fillOpacity: 0.9,
          pane: "overlayPane",
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

    load().catch(() => { /* Overpass nedosegljiv — tiho odpoved */ });

    return () => {
      cancelled = true;
      if (groupRef.current) { groupRef.current.remove(); groupRef.current = null; }
    };
  }, [visible, map]);

  return null;
}