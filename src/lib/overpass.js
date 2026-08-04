// Skupni Overpass klient — kliče Overpass API direktno iz brskalnika.
// Server-side (backend funkcije) Overpass blokira (403/406), zato to izvajamo klient-side.

const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const OP_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "sl,en;q=0.8",
  "User-Agent": "SloveniaGISExplorer/1.0 (https://francaimap.app)",
};

/**
 * Pošlje Overpass QL poizvedbo in vrne JSON { elements: [...] }.
 * Preizkusi GET nato POST na vsakem zrcalu, dokler eno ne uspe.
 * @param {string} query  Overpass QL (brez {{bbox}} — že razresen)
 */
export async function fetchOverpass(query, timeoutMs = 25000) {
  const enc = encodeURIComponent(query);
  let lastErr = null;
  for (const mirror of OVERPASS_MIRRORS) {
    for (const method of ["GET", "POST"]) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const url = method === "GET" ? `${mirror}?data=${enc}` : mirror;
        const init = { method, headers: { ...OP_HEADERS }, signal: controller.signal };
        if (method === "POST") {
          init.headers["Content-Type"] = "application/x-www-form-urlencoded";
          init.body = `data=${enc}`;
        }
        const res = await fetch(url, init);
        clearTimeout(timeout);
        if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("json")) { lastErr = new Error("Ne-JSON odgovor"); continue; }
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error(lastErr?.message || "Vsi Overpass strežniki so nedosegljivi");
}

/**
 * Pretvori Overpass JSON elemente v GeoJSON-podobne feature-e
 * (Point / LineString / Polygon), koordinate v [lat, lng].
 */
export function overpassToFeatures(elements) {
  const features = [];
  for (const el of (elements || [])) {
    const label = el.tags?.name || el.tags?.["name:sl"] || "";
    if (el.type === "node" && el.lat != null && el.lon != null) {
      features.push({ type: "Point", coords: [el.lat, el.lon], label });
    } else if (el.type === "way" && el.geometry) {
      const coords = el.geometry.filter(p => p.lat != null && p.lon != null).map(p => [p.lat, p.lon]);
      if (coords.length >= 2) {
        const looksArea = el.tags?.natural === "water" || el.tags?.landuse === "reservoir" ||
          el.tags?.area === "yes" || el.tags?.leisure === "park" || el.tags?.building;
        // Samo zaprte zanke (prva≈zadnja točka) so resnično poligoni. Odprta polilinja
        // (npr. rečna struga) bi Leaflet zapolnil v ravnočrtni napačen lik.
        const closed = coords.length >= 4 &&
          Math.abs(coords[0][0] - coords[coords.length - 1][0]) < 1e-5 &&
          Math.abs(coords[0][1] - coords[coords.length - 1][1]) < 1e-5;
        if (looksArea && closed) {
          features.push({ type: "Polygon", coords, label });
        } else {
          features.push({ type: "LineString", coords, label });
        }
      }
    } else if (el.type === "way" && el.center && el.center.lat != null) {
      // `out center;` — way brez polne geometrije: uporabimo središče kot točko
      features.push({ type: "Point", coords: [el.center.lat, el.center.lon], label });
    } else if (el.type === "relation" && el.members) {
      // Relacija (multipolygon/boundary): članski way-i so le odseki meje, NE zaprte
      // zanke. Če bi jih zapolnili kot poligone, bi Leaflet povezal konce z ravnimi
      // črtami in narisal napačno jezero/močvirje. Zato rišemo samo konturo (črte).
      for (const m of el.members) {
        if (m.geometry && m.geometry.length > 0) {
          const c = m.geometry.map(p => [p.lat, p.lon]);
          if (c.length >= 2) features.push({ type: "LineString", coords: c, label });
        }
      }
    }
  }
  return features;
}