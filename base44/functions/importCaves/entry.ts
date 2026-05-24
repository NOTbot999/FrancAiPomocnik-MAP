import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const offset = body.offset || 0;
  const batchLimit = body.batchLimit || 500;

  const FILE_URL = 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json';

  const response = await fetch(FILE_URL);
  const allCaves = await response.json();
  const caves = allCaves.slice(offset, offset + batchLimit);

  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < caves.length; i += BATCH_SIZE) {
    const batch = caves.slice(i, i + BATCH_SIZE).map(c => ({
      cave_id: String(c.cave_id),
      name: c.name || 'Neznana jama',
      latitude: c.latitude ? parseFloat(c.latitude) : null,
      longitude: c.longitude ? parseFloat(c.longitude) : null,
      length_m: c.length_m ? parseFloat(c.length_m) : null,
      depth_m: c.depth_m ? parseFloat(c.depth_m) : null,
      area_m2: c.area_m2 ? parseFloat(c.area_m2) : null,
    }));

    try {
      const results = await base44.asServiceRole.entities.Cave.bulkCreate(batch);
      inserted += batch.length;
      console.log(`[OK] Batch ${offset + i}-${offset + i + batch.length}, inserted: ${inserted}, first_id: ${results?.[0]?.id}`);
    } catch (e) {
      errors += batch.length;
      console.error(`[ERR] Batch at ${offset + i}:`, e.message);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  // Verify by reading back
  const verify = await base44.asServiceRole.entities.Cave.list('-created_date', 3);
  console.log(`[VERIFY] Total sample from DB after insert:`, JSON.stringify(verify?.slice(0,2)));

  return Response.json({ inserted, errors, total: allCaves.length, offset, processed: caves.length, db_count_sample: verify?.length });
});