import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const skip = body.skip || 0;

  const FILE_URL = 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json';

  const response = await fetch(FILE_URL);
  const allCaves = await response.json();
  const caves = allCaves.slice(skip);

  const BATCH_SIZE = 200;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < caves.length; i += BATCH_SIZE) {
    const batch = caves.slice(i, i + BATCH_SIZE).map(c => ({
      cave_id: String(c.cave_id),
      name: c.name || '',
      latitude: c.latitude || null,
      longitude: c.longitude || null,
      length_m: c.length_m || null,
      depth_m: c.depth_m || null,
      area_m2: c.area_m2 || null,
    }));

    try {
      await base44.asServiceRole.entities.Cave.bulkCreate(batch);
      inserted += batch.length;
    } catch (e) {
      errors += batch.length;
      console.error(`Batch error at ${skip + i}:`, e.message);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  return Response.json({ inserted, errors, total: allCaves.length, skip });
});