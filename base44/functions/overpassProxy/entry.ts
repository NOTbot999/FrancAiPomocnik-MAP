import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Since public Overpass instances block server-side requests (403),
// we use the OSM Nominatim API + LLM fallback for generating geographic features.
// Nominatim is free, open, and works from server-side.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query } = await req.json();
    if (!query) return Response.json({ error: 'Missing query' }, { status: 400 });

    // Try overpass-api.de with a User-Agent header (required to avoid 403)
    const MIRRORS = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

    let data = null;
    let lastErr = null;
    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "GIS-Explorer-Slovenia/1.0 (educational project)",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        lastErr = e;
        console.log(`Mirror ${mirror} failed: ${e.message}`);
      }
    }

    if (!data) {
      throw new Error(lastErr?.message || "Overpass nedosegljiv");
    }

    return Response.json({ elements: data.elements || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});