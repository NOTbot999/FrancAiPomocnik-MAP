import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const skip = parseInt(body.skip ?? 0);
    const limit = parseInt(body.limit ?? 2000);

    // Use service role to bypass RLS issues for public cave data
    const caves = await base44.asServiceRole.entities.Cave.list(null, limit, skip);

    return Response.json({ caves, count: caves.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});