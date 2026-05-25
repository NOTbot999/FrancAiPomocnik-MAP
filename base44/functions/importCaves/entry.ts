import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const FILE_URL = 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json';
    console.log('[INFO] Fetching cave data...');
    
    const response = await fetch(FILE_URL);
    const allCaves = await response.json();
    console.log(`[INFO] Loaded ${allCaves.length} caves from JSON`);

    const mapped = allCaves.map(c => ({
      cave_id: c.cave_id ? parseFloat(c.cave_id) : null,
      name: c.name || 'Neznana jama',
      latitude: c.latitude ? parseFloat(c.latitude) : null,
      longitude: c.longitude ? parseFloat(c.longitude) : null,
      length_m: c.length_m ? parseFloat(c.length_m) : null,
      depth_m: c.depth_m ? parseFloat(c.depth_m) : null,
      area_m2: c.area_m2 ? parseFloat(c.area_m2) : null,
    })).filter(c => c.latitude && c.longitude);

    console.log(`[INFO] Importing ${mapped.length} caves with valid coordinates...`);

    const BATCH_SIZE = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      try {
        await base44.asServiceRole.entities.Cave.bulkCreate(batch);
        inserted += batch.length;
        console.log(`[INFO] Batch ${i/BATCH_SIZE + 1}: inserted ${batch.length}`);
      } catch (e) {
        console.error(`[ERR] Batch ${i/BATCH_SIZE + 1}:`, e.message);
        errors += batch.length;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[DONE] Total: ${inserted} inserted, ${errors} errors`);
    return Response.json({ total: allCaves.length, inserted, errors, done: true });
  } catch (e) {
    console.error('[ERR]', e.message);
    return Response.json({ error: e.message, done: false }, { status: 500 });
  }
});