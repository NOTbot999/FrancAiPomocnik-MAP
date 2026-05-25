import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const skip = parseInt(body.skip ?? 0);
    const limit = parseInt(body.limit ?? 2000);

    // Cave RLS allows everyone to read — use service role to bypass auth requirement for guests
    const caves = await base44.asServiceRole.entities.Cave.list('-created_date', limit, skip);

    return Response.json({ caves, count: caves.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});