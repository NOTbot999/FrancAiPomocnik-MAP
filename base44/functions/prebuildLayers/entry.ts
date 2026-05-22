import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const CATEGORIES = [
  { id: "castle",        query: `[out:json][timeout:30];(node["historic"="castle"](45.4,13.4,46.9,16.6);way["historic"="castle"](45.4,13.4,46.9,16.6););out center;` },
  { id: "peak",          query: `[out:json][timeout:30];node["natural"="peak"](45.4,13.4,46.9,16.6);out;` },
  { id: "waterfall",     query: `[out:json][timeout:30];node["waterway"="waterfall"](45.4,13.4,46.9,16.6);out;` },
  { id: "viewpoint",     query: `[out:json][timeout:30];node["tourism"="viewpoint"](45.4,13.4,46.9,16.6);out;` },
  { id: "cave",          query: `[out:json][timeout:30];node["natural"="cave_entrance"](45.4,13.4,46.9,16.6);out;` },
  { id: "museum",        query: `[out:json][timeout:30];(node["tourism"="museum"](45.4,13.4,46.9,16.6);way["tourism"="museum"](45.4,13.4,46.9,16.6););out center;` },
  { id: "ruins",         query: `[out:json][timeout:30];(node["historic"="ruins"](45.4,13.4,46.9,16.6);way["historic"="ruins"](45.4,13.4,46.9,16.6););out center;` },
  { id: "spring",        query: `[out:json][timeout:30];node["natural"="spring"](45.4,13.4,46.9,16.6);out;` },
  { id: "lake",          query: `[out:json][timeout:45];(way["natural"="water"]["water"~"lake|reservoir|pond"](45.4,13.4,46.9,16.6);way["natural"="water"][!"water"](45.4,13.4,46.9,16.6);way["landuse"="reservoir"](45.4,13.4,46.9,16.6);relation["natural"="water"](45.4,13.4,46.9,16.6););out center;` },
  { id: "park",          query: `[out:json][timeout:30];(way["leisure"="park"](45.4,13.4,46.9,16.6);relation["leisure"="park"](45.4,13.4,46.9,16.6););out center;` },
  { id: "chapel",        query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"]["building"~"chapel|wayside_shrine"](45.4,13.4,46.9,16.6);node["historic"="wayside_shrine"](45.4,13.4,46.9,16.6););out;` },
  { id: "church",        query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6);way["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fuel",          query: `[out:json][timeout:45];(node["amenity"="fuel"](45.4,13.4,46.9,16.6);way["amenity"="fuel"](45.4,13.4,46.9,16.6);node["fuel"="yes"](45.4,13.4,46.9,16.6););out center;` },
  { id: "parking",       query: `[out:json][timeout:30];(node["amenity"="parking"](45.4,13.4,46.9,16.6);way["amenity"="parking"](45.4,13.4,46.9,16.6););out center;` },
  { id: "supermarket",   query: `[out:json][timeout:30];(node["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6);way["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6););out center;` },
  { id: "atm",           query: `[out:json][timeout:45];(node["amenity"="atm"](45.4,13.4,46.9,16.6);node["amenity"="bank"]["atm"!="no"](45.4,13.4,46.9,16.6);way["amenity"="bank"]["atm"!="no"](45.4,13.4,46.9,16.6););out center;` },
  { id: "hospital",      query: `[out:json][timeout:45];(node["amenity"="hospital"](45.4,13.4,46.9,16.6);way["amenity"="hospital"](45.4,13.4,46.9,16.6);node["amenity"="health_post"](45.4,13.4,46.9,16.6);relation["amenity"="hospital"](45.4,13.4,46.9,16.6););out center;` },
  { id: "clinic",        query: `[out:json][timeout:45];(node["amenity"~"clinic|doctors|health_centre"](45.4,13.4,46.9,16.6);way["amenity"~"clinic|doctors|health_centre"](45.4,13.4,46.9,16.6);node["healthcare"~"centre|clinic|doctor|general_practitioner"](45.4,13.4,46.9,16.6);way["healthcare"~"centre|clinic"](45.4,13.4,46.9,16.6););out center;` },
  { id: "dentist",       query: `[out:json][timeout:30];(node["amenity"="dentist"](45.4,13.4,46.9,16.6);way["amenity"="dentist"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pharmacy",      query: `[out:json][timeout:30];(node["amenity"="pharmacy"](45.4,13.4,46.9,16.6);way["amenity"="pharmacy"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fire_station",  query: `[out:json][timeout:30];(node["amenity"="fire_station"](45.4,13.4,46.9,16.6);way["amenity"="fire_station"](45.4,13.4,46.9,16.6););out center;` },
  { id: "police",        query: `[out:json][timeout:30];(node["amenity"="police"](45.4,13.4,46.9,16.6);way["amenity"="police"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pipe",          query: `[out:json][timeout:30];node["amenity"="drinking_water"](45.4,13.4,46.9,16.6);out;` },
  { id: "bus_station",   query: `[out:json][timeout:30];(node["amenity"="bus_station"](45.4,13.4,46.9,16.6);node["highway"="bus_stop"](45.4,13.4,46.9,16.6););out;` },
  { id: "train_station", query: `[out:json][timeout:30];(node["railway"="station"](45.4,13.4,46.9,16.6);node["railway"="halt"](45.4,13.4,46.9,16.6););out;` },
  { id: "camp",          query: `[out:json][timeout:30];(node["tourism"="camp_site"](45.4,13.4,46.9,16.6);way["tourism"="camp_site"](45.4,13.4,46.9,16.6););out center;` },
  { id: "aerodrome",     query: `[out:json][timeout:30];(node["aeroway"="aerodrome"](45.4,13.4,46.9,16.6);way["aeroway"="aerodrome"](45.4,13.4,46.9,16.6););out center;` },
  { id: "cemetery",      query: `[out:json][timeout:30];(node["landuse"="cemetery"](45.4,13.4,46.9,16.6);way["landuse"="cemetery"](45.4,13.4,46.9,16.6););out center;` },
  { id: "motorway_jct",  query: `[out:json][timeout:30];node["highway"="motorway_junction"](45.4,13.4,46.9,16.6);out;` },
];

async function overpassFetch(query) {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);
      const res = await fetch(mirror, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      return await res.json();
    } catch { /* try next */ }
  }
  throw new Error("Overpass nedosegljiv");
}

function parseFeatures(data) {
  return (data.elements || []).map(el => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) return null;
    return {
      type: "Point",
      coords: [lat, lon],
      label: el.tags?.name || el.tags?.["name:sl"] || el.tags?.ref || "",
    };
  }).filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Samo admin!' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetId = body.category_id || null; // optional: rebuild only one

    const cats = targetId ? CATEGORIES.filter(c => c.id === targetId) : CATEGORIES;

    const results = [];

    for (const cat of cats) {
      try {
        console.log(`Fetcham: ${cat.id}`);
        const data = await overpassFetch(cat.query);
        const features = parseFeatures(data);

        // Check if record already exists
        const existing = await base44.asServiceRole.entities.CachedLayer.filter({ category_id: cat.id });

        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.CachedLayer.update(existing[0].id, {
            features,
            feature_count: features.length,
            built_at: new Date().toISOString(),
          });
        } else {
          await base44.asServiceRole.entities.CachedLayer.create({
            category_id: cat.id,
            features,
            feature_count: features.length,
            built_at: new Date().toISOString(),
          });
        }

        results.push({ id: cat.id, count: features.length, status: "ok" });
        console.log(`OK: ${cat.id} — ${features.length} točk`);
      } catch (err) {
        results.push({ id: cat.id, status: "error", error: err.message });
        console.error(`Napaka pri ${cat.id}: ${err.message}`);
      }
    }

    return Response.json({ results, total: results.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});