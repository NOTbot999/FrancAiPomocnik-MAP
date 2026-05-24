import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  console.log('[AUTH] user:', JSON.stringify(user));
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden', user: user }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const offset = body.offset || 0;
  const batchLimit = body.batchLimit || 2000; // how many records to insert this run

  const FILE_URL = 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json';

  const response = await fetch(FILE_URL);
  const allCaves = await response.json();
  const caves = allCaves.slice(offset, offset + batchLimit);

  const BATCH_SIZE = 100;
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
      console.log(`Inserted batch at offset ${offset + i}, total inserted: ${inserted}`);
    } catch (e) {
      errors += batch.length;
      console.error(`Batch error at offset ${offset + i}:`, e.message, JSON.stringify(e.data));
    }

    // Delay between batches to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return Response.json({ inserted, errors, total: allCaves.length, offset, processed: caves.length });
});