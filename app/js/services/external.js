// External services — the only place that knows third-party URLs.
// Every call still goes through api.js (fetchJSON / overpass), so the desktop app,
// the Android app and the web version all cache and proxy it the same way.
import { fetchJSON, overpass } from "./api.js";

const DAY = 86400;

// ── Nominatim (search and reverse geocoding) ──
export const nominatim = {
  search: (q, limit = 8) =>
    fetchJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1&countrycodes=si,hr,at,it,hu&viewbox=13.3,46.9,16.7,45.4&accept-language=sl`, 30 * DAY),
  reverse: (lat, lng) =>
    fetchJSON(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&format=json&addressdetails=1&namedetails=1&zoom=18&accept-language=sl`, 30 * DAY),
};

// ── Overpass API (POI categories) ──
export { overpass };

// ── Routing: BRouter (walking, cycling, …) and OSRM (car) ──
export const routing = {
  brouter: (points, profile, alt = 0) => {
    const lonlats = points.map((p) => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join("|");
    return fetchJSON(`https://brouter.de/brouter?lonlats=${lonlats}&profile=${profile}&alternativeidx=${alt}&format=geojson`, 30 * DAY);
  },
  osrm: (points) =>
    fetchJSON(`https://router.project-osrm.org/route/v1/driving/${points.map((p) => `${p[1]},${p[0]}`).join(";")}?overview=full&geometries=geojson`, 30 * DAY),
};

// ── Open-Meteo (elevation and weather) ──
export const openMeteo = {
  // pts: [[lat, lng], …] (max ~100 per call)
  elevation: (pts) =>
    fetchJSON(`https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(5)).join(",")}&longitude=${pts.map((p) => p[1].toFixed(5)).join(",")}`, 365 * DAY),
  current: (lat, lng) =>
    fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&timezone=auto`, 900),
  currentGrid: (pts) =>
    fetchJSON("https://api.open-meteo.com/v1/forecast?latitude=" + pts.map((p) => p[0]).join(",")
      + "&longitude=" + pts.map((p) => p[1]).join(",")
      + "&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover&timezone=Europe%2FLjubljana", 1800),
};

// ── RainViewer (radar and satellite frames) ──
export const rainviewer = {
  maps: () => fetchJSON("https://api.rainviewer.com/public/weather-maps.json", 300),
};

// ── adsb.lol (live flights around Slovenia) ──
export const flights = {
  aroundSlovenia: () => fetchJSON("https://api.adsb.lol/v2/lat/46.15/lon/14.99/dist/200", 45),
};
