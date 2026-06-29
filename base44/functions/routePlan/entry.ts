import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Route planner — direct fetch to free services, no integration credits used.
//   forest  → BRouter "trekking"    (pohodništvo po gozdu, pohodniške/gozdne poti)
//   foot    → OSRM /foot/           (peš po poteh in pločnikih)
//   main    → BRouter "car-strict"  (glavne/regionalne ceste — izogiba avtocestam)
//   highway → BRouter "car-fast"    (avtoceste — najhitrejša vožnja po avtocestah)

const EARTH_R = 6371000;
function toRad(d) { return d * Math.PI / 180; }
function haversine(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BROUTER_PROFILES = {
  forest: "trekking",
  main: "moped",      // mopedi ne smejo na avtoceste → sledi glavnim/regionalnim cestam
  highway: "car-fast",
};
const OSRM_PROFILES = { foot: "foot" };
// Realna povprečna hitrost za glavne ceste (m/s) — prepišemo BRouterjev moped-čas
const MAIN_ROAD_SPEED_MS = 70 / 3.6;

function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
function fmtDur(s) {
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}min`;
  return `${Math.round(s / 60)} min`;
}

async function tryBrouter(profile, points) {
  const lonlats = points.map(p => `${p.lng},${p.lat}`).join("|");
  const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=${encodeURIComponent(profile)}&alternativeidx=0&format=geojson`;
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

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { points, profile } = body;
    if (!Array.isArray(points) || points.length < 2) {
      return Response.json({ error: "Potrebna sta vsaj dve točki." }, { status: 400 });
    }

    let polyline = [];
    let totalMeters = 0;
    let totalSeconds = 0;
    let usedFallback = false;

    if (BROUTER_PROFILES[profile]) {
      try {
        const r = await tryBrouter(BROUTER_PROFILES[profile], points);
        polyline = r.polyline; totalMeters = r.meters; totalSeconds = r.seconds;
        // Za "main" (moped profil) prepiši čas z realno hitrostjo avta na glavnih cestah
        if (profile === "main" && totalMeters > 0) {
          totalSeconds = Math.round(totalMeters / MAIN_ROAD_SPEED_MS);
        }
      } catch (e) {
        // Za cestna profila poskusi OSRM driving kot rezervo (vrne avtocestno trto)
        if (profile === "main" || profile === "highway") {
          try {
            const r = await tryOsrm("driving", points);
            polyline = r.polyline; totalMeters = r.meters; totalSeconds = r.seconds;
            usedFallback = true;
          } catch (e2) {
            return Response.json({ error: "Usmerjevalnik ni dosegljiv: " + (e2.message || e.message) }, { status: 502 });
          }
        } else {
          return Response.json({ error: "Usmerjevalnik (BRouter) ni dosegljiv: " + (e.message || "napaka") }, { status: 502 });
        }
      }
    } else if (OSRM_PROFILES[profile]) {
      try {
        const r = await tryOsrm(OSRM_PROFILES[profile], points);
        polyline = r.polyline; totalMeters = r.meters; totalSeconds = r.seconds;
      } catch (e) {
        return Response.json({ error: "Usmerjevalnik (OSRM) ni dosegljiv: " + (e.message || "napaka") }, { status: 502 });
      }
    } else {
      // privzeto: avtoceste
      try {
        const r = await tryBrouter("car-fast", points);
        polyline = r.polyline; totalMeters = r.meters; totalSeconds = r.seconds;
      } catch (e) {
        const r = await tryOsrm("driving", points);
        polyline = r.polyline; totalMeters = r.meters; totalSeconds = r.seconds;
        usedFallback = true;
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

    return Response.json({
      polyline,
      legs: legs.map(l => ({ distance: fmtDist(l.distance), duration: fmtDur(l.duration) })),
      totalDistance: fmtDist(totalMeters),
      totalDuration: fmtDur(totalSeconds),
      usedFallback,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Napaka pri načrtovanju poti." }, { status: 500 });
  }
});