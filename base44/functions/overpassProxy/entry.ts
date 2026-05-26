import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query } = await req.json();
    if (!query) return Response.json({ error: 'Missing query' }, { status: 400 });

    let data = null;
    let lastErr = null;
    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) throw new Error(lastErr?.message || "Vsi Overpass strežniki nedosegljivi");

    return Response.json({ elements: data.elements || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});