import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Tedensko osveži sloj Tretje razvojne osi (3RO) iz OpenStreetMap.
// Pobere H8 (construction=trunk, opening_date=2029) geometrijo in shrani v CachedLayer.
// Client komponenta najprej prebere ta predpomnilnik; če je prestar ali manjka, pade nazaj na direktni OSS fetch.

const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const Q_H8 = `[out:json][timeout:25];
(
  way["highway"="construction"]["construction"="trunk"]["opening_date"="2029"](45.0,13.0,47.0,17.0);
  way["name"="H8"]["highway"="construction"](45.0,13.0,47.0,17.0);
);
out geom;`;

async function overpassFetch(query) {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);
      const res = await fetch(mirror, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
        headers: { "User-Agent": "SloveniaGISExplorer/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      return await res.json();
    } catch { /* try next mirror */ }
  }
  throw new Error("Overpass nedosegljiv");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Samo admin!' }, { status: 403 });
    }

    const data = await overpassFetch(Q_H8);
    const ways = (data.elements || []).filter(e => e.type === "way" && e.geometry);
    // CachedLayer.coords je flat array številk — zravnamo [lat1,lon1,lat2,lon2,...]
    const features = ways.map(w => ({
      type: "LineString",
      coords: (w.geometry || []).flatMap(p => [p.lat, p.lon]),
      label: w.tags?.name || "H8",
    }));

    // Shrani v CachedLayer (category_id = third_dev_axis)
    const existing = await base44.asServiceRole.entities.CachedLayer.filter({ category_id: "third_dev_axis" });
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.CachedLayer.update(existing[0].id, {
        features,
        feature_count: features.length,
        built_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.CachedLayer.create({
        category_id: "third_dev_axis",
        features,
        feature_count: features.length,
        built_at: new Date().toISOString(),
      });
    }

    return Response.json({ status: "ok", feature_count: features.length, built_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});