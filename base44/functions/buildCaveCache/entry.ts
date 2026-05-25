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
    let all = [];
    let skip = 0;

    while (true) {
      const batch = await base44.asServiceRole.entities.Cave.list('-created_date', batchSize, skip);
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      console.log(`Zbral ${all.length} jam...`);
      if (batch.length < batchSize) break;
      skip += batchSize;
    }

    const features = all
      .filter(c => c.latitude && c.longitude && parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0)
      .map(c => ({
        type: "Point",
        coords: [parseFloat(c.latitude), parseFloat(c.longitude)],
        label: c.name + (c.depth_m ? ` (${c.depth_m}m globoka)` : "") + (c.length_m ? `, ${c.length_m}m dolga` : ""),
        depth_m: c.depth_m || null,
        length_m: c.length_m || null,
      }));

    console.log(`Filtrirano: ${features.length} jam z koordinatami`);

    // Save to CachedLayer
    const existing = await base44.asServiceRole.entities.CachedLayer.filter({ category_id: "cave" });
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.CachedLayer.update(existing[0].id, {
        features,
        feature_count: features.length,
        built_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.CachedLayer.create({
        category_id: "cave",
        features,
        feature_count: features.length,
        built_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, count: features.length, total_caves: all.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});