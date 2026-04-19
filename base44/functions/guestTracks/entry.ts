import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // This function is intentionally public (no auth) — device_id acts as the access key
  const base44 = createClientFromRequest(req);
  const serviceBase44 = base44.asServiceRole;
  const body = await req.json();
  const { action, device_id, code, tracks } = body;

  if (!device_id) {
    return Response.json({ error: 'device_id is required' }, { status: 400 });
  }

  // Save or update tracks for this device
  if (action === 'save') {
    const existing = await serviceBase44.entities.GuestSession.filter({ device_id });
    if (existing.length > 0) {
      await serviceBase44.entities.GuestSession.update(existing[0].id, { tracks });
    } else {
      await serviceBase44.entities.GuestSession.create({ device_id, tracks });
    }
    return Response.json({ success: true });
  }

  // Load tracks for this device
  if (action === 'load') {
    const existing = await serviceBase44.entities.GuestSession.filter({ device_id });
    if (existing.length === 0) return Response.json({ tracks: [] });
    return Response.json({ tracks: existing[0].tracks || [] });
  }

  // Generate a 6-digit link code for this device
  if (action === 'generate_code') {
    const linkCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const existing = await serviceBase44.entities.GuestSession.filter({ device_id });
    if (existing.length > 0) {
      await serviceBase44.entities.GuestSession.update(existing[0].id, {
        link_code: linkCode,
        link_code_expires_at: expiresAt,
      });
    } else {
      await serviceBase44.entities.GuestSession.create({
        device_id,
        tracks: [],
        link_code: linkCode,
        link_code_expires_at: expiresAt,
      });
    }
    return Response.json({ code: linkCode, expires_at: expiresAt });
  }

  // Use a code to import tracks from another device
  if (action === 'use_code') {
    if (!code) return Response.json({ error: 'code is required' }, { status: 400 });

    const sessions = await serviceBase44.entities.GuestSession.filter({ link_code: code });
    if (sessions.length === 0) return Response.json({ error: 'Invalid code' }, { status: 404 });

    const source = sessions[0];
    const now = new Date();
    if (new Date(source.link_code_expires_at) < now) {
      return Response.json({ error: 'Code has expired' }, { status: 410 });
    }

    const sourceTracks = source.tracks || [];
    const mySession = await serviceBase44.entities.GuestSession.filter({ device_id });
    if (mySession.length > 0) {
      const merged = [...(mySession[0].tracks || []), ...sourceTracks];
      await serviceBase44.entities.GuestSession.update(mySession[0].id, { tracks: merged });
    } else {
      await serviceBase44.entities.GuestSession.create({ device_id, tracks: sourceTracks });
    }

    // Invalidate the code
    await serviceBase44.entities.GuestSession.update(source.id, {
      link_code: null,
      link_code_expires_at: null,
    });

    return Response.json({ success: true, imported: sourceTracks.length });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});