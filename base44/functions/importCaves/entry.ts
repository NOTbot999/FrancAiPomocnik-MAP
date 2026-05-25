import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json().catch(() => ({}));
  const offset = body.offset || 0;
  const batchLimit = body.batchLimit || 200;

  const FILE_URL = 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json';

  const response = await fetch(FILE_URL);
  const allCaves = await response.json();
  const total = allCaves.length;
  
  const caves = allCaves.slice(offset, offset + batchLimit);

  const BATCH_SIZE = 20;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < caves.length; i += BATCH_SIZE) {
    const batch = caves.slice(i, i + BATCH_SIZE).map(c => ({
      cave_id: c.cave_id ? parseFloat(c.cave_id) : null,
      name: c.name || 'Neznana jama',
      latitude: c.latitude ? parseFloat(c.latitude) : null,
      longitude: c.longitude ? parseFloat(c.longitude) : null,
      length_m: c.length_m ? parseFloat(c.length_m) : null,
      depth_m: c.depth_m ? parseFloat(c.depth_m) : null,
      area_m2: c.area_m2 ? parseFloat(c.area_m2) : null,
    }));

    try {
      await base44.asServiceRole.entities.Cave.bulkCreate(batch);
      inserted += batch.length;
      console.log(`[OK] Batch ${offset + i}-${offset + i + batch.length}, inserted: ${inserted}`);
    } catch (e) {
      errors += batch.length;
      console.error(`[ERR] Batch at ${offset + i}:`, e.message);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  return Response.json({ inserted, errors, total, offset, processed: caves.length });
});