import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Samo admin!' }, { status: 403 });
    }

    console.log("Fetcham jame iz DB...");
    const batchSize = 2000;
    let allCaves = [];
    let skip = 0;

    while (true) {
      const batch = await base44.asServiceRole.entities.Cave.list(null, batchSize, skip);
      if (!batch || batch.length === 0) break;
      allCaves = allCaves.concat(batch);
      console.log(`Zbral ${allCaves.length} jam...`);
      if (batch.length < batchSize) break;
      skip += batchSize;
    }

    const caveFeatures = allCaves
      .filter(c => c.latitude && c.longitude && parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0)
      .map(c => ({
        type: "Point",
        coords: [parseFloat(c.latitude), parseFloat(c.longitude)],
        label: c.name + (c.depth_m ? ` (${c.depth_m}m globoka)` : "") + (c.length_m ? `, ${c.length_m}m dolga` : ""),
        depth_m: c.depth_m || null,
        length_m: c.length_m || null,
      }));

    console.log(`Filtrirano: ${caveFeatures.length} jam z koordinatami`);
    
    // NOTE: CachedLayer saving is currently broken - returns success but doesn't persist
    // The map will use getCaves() fallback to load caves directly from DB
    return Response.json({ 
      ok: true, 
      count: caveFeatures.length, 
      total_caves: allCaves.length,
      note: "Use getCaves() - CachedLayer not persisting"
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});