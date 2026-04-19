import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { action } = body;

  if (action === "geocode") {
    const { query } = body;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return Response.json({ results: [], status: data.status, error: data.error_message });
    }
    const results = (data.results || []).map(r => ({
      display_name: r.formatted_address,
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng,
      type: r.types?.[0] || "place",
    }));
    return Response.json({ results });
  }

  if (action === "directions") {
    const { origin, destination, waypoints = [] } = body;
    // waypoints is array of {lat, lng}
    const waypointStr = waypoints.length
      ? `&waypoints=${waypoints.map(w => `${w.lat},${w.lng}`).join("|")}`
      : "";
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointStr}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return Response.json({ error: data.status, error_message: data.error_message }, { status: 400 });
    }

    // Decode all legs into a flat polyline
    const points = [];
    for (const leg of data.routes[0].legs) {
      for (const step of leg.steps) {
        const decoded = decodePolyline(step.polyline.points);
        points.push(...decoded);
      }
    }

    const legs = data.routes[0].legs.map(leg => ({
      distance: leg.distance.text,
      duration: leg.duration.text,
      start_address: leg.start_address,
      end_address: leg.end_address,
    }));

    const totalDistance = data.routes[0].legs.reduce((s, l) => s + l.distance.value, 0);
    const totalDuration = data.routes[0].legs.reduce((s, l) => s + l.duration.value, 0);

    return Response.json({
      polyline: points,
      legs,
      totalDistance: formatDistance(totalDistance),
      totalDuration: formatDuration(totalDuration),
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});

function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}