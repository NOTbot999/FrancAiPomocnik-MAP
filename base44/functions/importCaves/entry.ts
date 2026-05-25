import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json().catch(() => ({}));
  const offset = body.offset || 0;
  const limit = body.limit || 2000;

  const FILE_URL = 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json';

  const response = await fetch(FILE_URL);
  const allCaves = await response.json();
  const total = allCaves.length;

  const slice = allCaves.slice(offset, offset + limit);

  const mapped = slice.map(c => ({
    cave_id: c.cave_id ? parseFloat(c.cave_id) : null,
    name: c.name || 'Neznana jama',
    latitude: c.latitude ? parseFloat(c.latitude) : null,
    longitude: c.longitude ? parseFloat(c.longitude) : null,
    length_m: c.length_m ? parseFloat(c.length_m) : null,
    depth_m: c.depth_m ? parseFloat(c.depth_m) : null,
    area_m2: c.area_m2 ? parseFloat(c.area_m2) : null,
  }));

  const BATCH_SIZE = 200;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await base44.asServiceRole.entities.Cave.bulkCreate(batch);
        inserted += batch.length;
        success = true;
        break;
      } catch (e) {
        console.error(`[ERR] Batch ${offset + i} attempt ${attempt}:`, e.message);
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
    if (!success) errors += batch.length;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[DONE] offset=${offset}, inserted=${inserted}, errors=${errors}`);
  return Response.json({ total, offset, processed: slice.length, inserted, errors, done: offset + limit >= total });
});