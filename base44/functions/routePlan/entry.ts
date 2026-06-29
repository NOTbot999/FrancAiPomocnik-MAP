import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Route planner — uses BRouter (free, no key, supports hiking/walking/car profiles)
// with OSRM driving as fallback. Direct fetch — no integration credits used.

const EARTH_R = 6371000;
function toRad(d) { return d * Math.PI / 180; }
function haversine(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map user-facing profile → BRouter profile name
const PROFILES = {
  forest: "trekking",   // gozdne poti — pohodništvo po gozdu
  main: "car-eco",      // glavne ceste — vožnja, izogiba avtocestam
  highway: "car-fast",  // avtoceste — najhitrejša vožnja
  foot: "trekking",     // peš — hoja
};

function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
function fmtDur(s) {
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}min`;
  return `${Math.round(s / 60)} min`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { points, profile } = body;
    if (!Array.isArray(points) || points.length < 2) {
      return Response.json({ error: "Potrebna sta vsaj dve točki." }, { status: 400 });
    }

    const brouterProfile = PROFILES[profile] || "car-fast";
    const lonlats = points.map(p => `${p.lng},${p.lat}`).join("|");
    const brouterUrl = `https://brouter.de/brouter?lonlats=${lonlats}&profile=${encodeURIComponent(brouterProfile)}&alternativeidx=0&format=geojson`;

    let polyline = [];
    let totalMeters = 0;
    let totalSeconds = 0;
    let usedFallback = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(brouterUrl, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("BRouter HTTP " + res.status);
      const text = await res.text();
      let geo;
      try { geo = JSON.parse(text); }
      catch { throw new Error("BRouter: " + text.slice(0, 140)); }
      if (geo.error) throw new Error(geo.error);
      const feat = geo.features && geo.features[0];
      if (!feat || !feat.geometry || !feat.geometry.coordinates) throw new Error("BRouter: ni geometrije");
      const coords = feat.geometry.coordinates; // [[lng, lat, ele], ...]
      polyline = coords.map(c => [c[1], c[0]]);
      totalMeters = parseInt(feat.properties["track-length"] || "0", 10) || 0;
      totalSeconds = parseInt(feat.properties["total-time"] || "0", 10) || 0;
    } catch (brouterErr) {
      // Fallback to OSRM driving — only meaningful for car profiles
      if (profile !== "forest" && profile !== "foot") {
        usedFallback = true;
        const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(";");
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(osrmUrl);
        const data = await res.json();
        if (data.code !== "Ok" || !data.routes || !data.routes.length) {
          throw new Error("Poti ni mogoče najti med izbranimi točkami.");
        }
        const route = data.routes[0];
        polyline = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        totalMeters = route.distance;
        totalSeconds = route.duration;
      } else {
        throw new Error("Usmerjevalni strežnik (BRouter) trenutno ni dosegljiv: " + (brouterErr.message || "napaka"));
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