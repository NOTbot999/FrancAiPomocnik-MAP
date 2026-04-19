import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { action, device_id, code, tracks } = body;

  if (!device_id) {
    return Response.json({ error: 'device_id is required' }, { status: 400 });
  }

  // Save or update tracks for this device
  if (action === 'save') {
    const existing = await base44.asServiceRole.entities.GuestSession.filter({ device_id });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.GuestSession.update(existing[0].id, { tracks });
    } else {
      await base44.asServiceRole.entities.GuestSession.create({ device_id, tracks });
    }
    return Response.json({ success: true });
  }

  // Load tracks for this device
  if (action === 'load') {
    const existing = await base44.asServiceRole.entities.GuestSession.filter({ device_id });
    if (existing.length === 0) return Response.json({ tracks: [] });
    return Response.json({ tracks: existing[0].tracks || [] });
  }

  // Generate a 6-digit link code for this device
  if (action === 'generate_code') {
    const linkCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const existing = await base44.asServiceRole.entities.GuestSession.filter({ device_id });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.GuestSession.update(existing[0].id, {
        link_code: linkCode,
        link_code_expires_at: expiresAt,
      });
    } else {
      await base44.asServiceRole.entities.GuestSession.create({
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

    // Find the session with this code
    const sessions = await base44.asServiceRole.entities.GuestSession.filter({ link_code: code });
    if (sessions.length === 0) return Response.json({ error: 'Invalid code' }, { status: 404 });

    const source = sessions[0];
    const now = new Date();
    if (new Date(source.link_code_expires_at) < now) {
      return Response.json({ error: 'Code has expired' }, { status: 410 });
    }

    // Merge tracks into the requesting device's session
    const sourceTracks = source.tracks || [];
    const mySession = await base44.asServiceRole.entities.GuestSession.filter({ device_id });
    let myTracks = [];
    if (mySession.length > 0) {
      myTracks = mySession[0].tracks || [];
      const merged = [...myTracks, ...sourceTracks];
      await base44.asServiceRole.entities.GuestSession.update(mySession[0].id, { tracks: merged });
    } else {
      await base44.asServiceRole.entities.GuestSession.create({ device_id, tracks: sourceTracks });
    }

    // Invalidate the code
    await base44.asServiceRole.entities.GuestSession.update(source.id, {
      link_code: null,
      link_code_expires_at: null,
    });

    return Response.json({ success: true, imported: sourceTracks.length });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});