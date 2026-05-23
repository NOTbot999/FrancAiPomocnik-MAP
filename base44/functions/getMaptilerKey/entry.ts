import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    // Allow anyone (guests use localStorage auth) — just return the key
    const key = Deno.env.get("MAPTILER_API_KEY");
    if (!key) return Response.json({ error: "MAPTILER_API_KEY not set" }, { status: 500 });
    return Response.json({ key });
  } catch {
    const key = Deno.env.get("MAPTILER_API_KEY");
    if (!key) return Response.json({ error: "MAPTILER_API_KEY not set" }, { status: 500 });
    return Response.json({ key });
  }
});