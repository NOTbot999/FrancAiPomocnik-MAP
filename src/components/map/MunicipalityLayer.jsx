import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const WFS_URL =
  "https://storitve.eprostor.gov.si/ows-ins-wfs/wfs?" +
  "SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature" +
  "&TYPENAMES=SI.GURS.KATASTRSKE_SKUPNOSTI:OBCINE" +
  "&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326";

const LS_KEY = "slomapcat_municipalities_v2";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function loadCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, geojson } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(LS_KEY); return null; }
    return geojson;
  } catch { return null; }
}

function saveCache(geojson) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), geojson })); } catch {}
}

// Alternative: fetch from Overpass as polygons/relations
async function fetchMunicipalitiesOverpass() {
  const query = `[out:json][timeout:60];
relation["admin_level"="8"]["boundary"="administrative"](45.4,13.3,46.9,16.7);
out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();

  // Convert Overpass relations to GeoJSON-like polygon features
  const features = [];
  for (const el of data.elements || []) {
    if (el.type !== "relation") continue;
    const name = el.tags?.name || el.tags?.["name:sl"] || "";
    if (!name) continue;

    // Build outer ring from members
    const outerWays = (el.members || [])
      .filter(m => m.type === "way" && m.role === "outer" && m.geometry);
    if (outerWays.length === 0) continue;

    // Stitch ways into a single ring
    let ring = [];
    for (const way of outerWays) {
      const coords = way.geometry.map(g => [g.lat, g.lon]);
      ring = ring.concat(coords);
    }
    if (ring.length < 4) continue;

    // Compute centroid for label
    const lat = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const lon = ring.reduce((s, c) => s + c[1], 0) / ring.length;

    features.push({ name, ring, centroid: [lat, lon] });
  }
  return features;
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
      let features = loadCache();

      if (!features) {
        features = await fetchMunicipalitiesOverpass();
        if (features.length > 0) saveCache(features);
      }

      if (cancelled || !features || features.length === 0) return;

      const group = L.layerGroup();

      for (const f of features) {
        // Polygon outline
        const poly = L.polygon(f.ring, {
          color: "#b45309",
          weight: 1.5,
          fillColor: "#fde68a",
          fillOpacity: 0.18,
          pane: "overlayPane",
        });
        group.addLayer(poly);

        // Label at centroid using divIcon
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            font-size: 9px;
            font-weight: 700;
            color: #7c2d12;
            text-shadow: 0 0 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.7);
            white-space: nowrap;
            pointer-events: none;
            transform: translate(-50%, -50%);
            letter-spacing: 0.03em;
            text-transform: uppercase;
          ">${f.name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const labelMarker = L.marker(f.centroid, { icon, interactive: false, pane: "tooltipPane" });
        group.addLayer(labelMarker);
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