// Client-side route planner — direct fetch to free BRouter/OSRM services.
// Replaces the routePlan backend function (avoids 402 on plans without backend functions).
//
//   forest  → BRouter "trekking"    (pohodništvo po gozdu, pohodniške/gozdne poti)
//   foot    → BRouter "trekking"    (peš — izogiba avtocestam)
//   main    → BRouter "moped"       (glavne/regionalne ceste — mopedi ne smejo na AC)
//   highway → BRouter "car-fast"   (avtoceste — najhitrejša vožnja)

const EARTH_R = 6371000;
function toRad(d) { return d * Math.PI / 180; }
export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BROUTER_PROFILES = {
  forest: "trekking",
  foot: "trekking",
  main: "moped",
  highway: "car-fast",
  macadam: "gravel",
};
const MAIN_ROAD_SPEED_MS = 70 / 3.6;
const FOOT_SPEED_MS = 5 / 3.6;

function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
function fmtDur(s) {
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}min`;
  return `${Math.round(s / 60)} min`;
}

async function tryBrouter(profile, points, alternativeidx = 0) {
  const lonlats = points.map(p => `${p.lng},${p.lat}`).join("|");
  const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=${encodeURIComponent(profile)}&alternativeidx=${alternativeidx}&format=geojson`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const res = await fetch(url, { headers: { "Accept": "application/json" }, signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error("BRouter HTTP " + res.status);
  const text = await res.text();
  let geo;
  try { geo = JSON.parse(text); } catch { throw new Error("BRouter: " + text.slice(0, 140)); }
  if (geo.error) throw new Error(geo.error);
  const feat = geo.features && geo.features[0];
  if (!feat || !feat.geometry || !feat.geometry.coordinates) throw new Error("BRouter: ni geometrije");
  const polyline = feat.geometry.coordinates.map(c => [c[1], c[0]]);
  const meters = parseInt(feat.properties["track-length"] || "0", 10) || 0;
  const seconds = parseInt(feat.properties["total-time"] || "0", 10) || 0;
  return { polyline, meters, seconds };
}

async function tryOsrm(osrmProfile, points) {
  const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsStr}?overview=full&geometries=geojson&steps=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error("OSRM HTTP " + res.status);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes || !data.routes.length) {
    throw new Error("Poti ni mogoče najti med izbranimi točkami.");
  }
  const route = data.routes[0];
  return {
    polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    meters: route.distance,
    seconds: route.duration,
  };
}

export async function planRoute(points, profile) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("Potrebna sta vsaj dve točki.");
  }

  const brouterProfile = BROUTER_PROFILES[profile] || "car-fast";

  // Fetch up to 3 alternative routes in parallel (BRouter alternativeidx 0,1,2)
  const altPromises = [0, 1, 2].map(idx =>
    tryBrouter(brouterProfile, points, idx).catch(() => null)
  );
  const altResults = await Promise.all(altPromises);
  const validAlts = altResults.filter(r => r && r.polyline && r.polyline.length > 1);

  let polyline = [];
  let totalMeters = 0;
  let totalSeconds = 0;
  let usedFallback = false;
  let alternatives = [];

  if (validAlts.length > 0) {
    const primary = validAlts[0];
    polyline = primary.polyline;
    totalMeters = primary.meters;
    totalSeconds = primary.seconds;
    if (profile === "main" && totalMeters > 0) {
      totalSeconds = Math.round(totalMeters / MAIN_ROAD_SPEED_MS);
    } else if (profile === "foot" && totalMeters > 0) {
      totalSeconds = Math.round(totalMeters / FOOT_SPEED_MS);
    }
    alternatives = validAlts.map((r, i) => ({
      polyline: r.polyline,
      meters: r.meters,
      isPrimary: i === 0,
    }));
  } else {
    // Fallback to OSRM for driving profiles
    if (profile === "main" || profile === "highway" || profile === "macadam") {
      const r = await tryOsrm("driving", points);
      polyline = r.polyline; totalMeters = r.meters; totalSeconds = r.seconds;
      usedFallback = true;
      alternatives = [{ polyline, meters: totalMeters, isPrimary: true }];
    } else {
      throw new Error("Usmerjevalnik (BRouter) ni dosegljiv.");
    }
  }

  // Build per-leg info by splitting polyline at nearest point to each waypoint
  const legs = [];
  if (polyline.length >= 2 && points.length >= 2) {
    const nearestIdx = points.map(wp => {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < polyline.length; i++) {
        const d = haversine(wp.lat, wp.lng, polyline[i][0], polyline[i][1]);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    });
    for (let i = 1; i < nearestIdx.length; i++) {
      if (nearestIdx[i] < nearestIdx[i - 1]) nearestIdx[i] = nearestIdx[i - 1];
    }
    for (let i = 0; i < nearestIdx.length - 1; i++) {
      const seg = polyline.slice(nearestIdx[i], nearestIdx[i + 1] + 1);
      let d = 0;
      for (let j = 1; j < seg.length; j++) d += haversine(seg[j - 1][0], seg[j - 1][1], seg[j][0], seg[j][1]);
      legs.push({ distance: d, duration: totalMeters > 0 ? (d / totalMeters) * totalSeconds : 0 });
    }
  }

  return {
    polyline,
    alternatives,
    legs: legs.map(l => ({ distance: fmtDist(l.distance), duration: fmtDur(l.duration) })),
    totalDistance: fmtDist(totalMeters),
    totalDuration: fmtDur(totalSeconds),
    usedFallback,
  };
}

// Reverse geocode a lat/lng via Nominatim → short label
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&namedetails=1&accept-language=sl,hr,en`;
    const res = await fetch(url, { headers: { "User-Agent": "SloveniaGISExplorer/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const poiName = data.namedetails?.name || a.amenity || a.tourism || a.shop;
    const place = a.village || a.town || a.city || a.hamlet || a.suburb || a.municipality || a.county;
    const street = a.road || a.pedestrian || a.footway || a.path || a.residential;
    let label;
    if (poiName) label = poiName;
    else if (street && a.house_number) label = `${street} ${a.house_number}`;
    else if (street) label = street;
    else if (place) label = place;
    else label = data.display_name ? data.display_name.split(",").slice(0, 2).join(", ") : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { label, lat, lng };
  } catch {
    return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  }
}