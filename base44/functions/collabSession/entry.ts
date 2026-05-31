import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, invite_code, owner_username, member_usernames } = body;
      const sess = await base44.asServiceRole.entities.CollabSession.create({
        name,
        invite_code,
        owner_username,
        member_usernames: member_usernames || [owner_username],
        is_active: true,
      });
      return Response.json({ session: sess });

    } else if (action === "join") {
      const { invite_code, username } = body;
      const results = await base44.asServiceRole.entities.CollabSession.filter({ invite_code: invite_code.toUpperCase() });
      if (results.length === 0) return Response.json({ error: "Seja ni najdena." }, { status: 404 });
      const sess = results[0];
      const members = sess.member_usernames || [];
      if (!members.includes(username)) {
        await base44.asServiceRole.entities.CollabSession.update(sess.id, { member_usernames: [...members, username] });
        sess.member_usernames = [...members, username];
      }
      return Response.json({ session: sess });

    } else if (action === "leave") {
      const { session_id, username } = body;
      const sess = await base44.asServiceRole.entities.CollabSession.get(session_id);
      if (!sess) return Response.json({ ok: true });
      const members = (sess.member_usernames || []).filter(u => u !== username);
      await base44.asServiceRole.entities.CollabSession.update(session_id, { member_usernames: members });
      return Response.json({ ok: true });

    } else if (action === "listMySessions") {
      const { username } = body;
      // Get all active sessions where user is a member or owner
      const all = await base44.asServiceRole.entities.CollabSession.list("-created_date", 50);
      const mine = all.filter(s => s.is_active && (
        s.owner_username === username || (s.member_usernames || []).includes(username)
      ));
      return Response.json({ sessions: mine });

    } else if (action === "listMessages") {
      const { session_id } = body;
      const msgs = await base44.asServiceRole.entities.CollabMessage.filter({ session_id }, "created_date", 50);
      return Response.json({ messages: msgs });

    } else if (action === "sendMessage") {
      const { session_id, username, text, pin_ref } = body;
      const msg = await base44.asServiceRole.entities.CollabMessage.create({
        session_id, username, text, ...(pin_ref ? { pin_ref } : {})
      });
      return Response.json({ message: msg });

    } else if (action === "listPins") {
      const { session_id } = body;
      const pins = await base44.asServiceRole.entities.CollabPin.filter({ session_id });
      return Response.json({ pins });

    } else if (action === "addPin") {
      const { session_id, username, lat, lng, label, color } = body;
      const pin = await base44.asServiceRole.entities.CollabPin.create({ session_id, username, lat, lng, label, color });
      // Also send a chat message
      await base44.asServiceRole.entities.CollabMessage.create({
        session_id, username, text: `📍 Dodal(-a) oznako`, pin_ref: { lat, lng, label }
      });
      return Response.json({ pin });

    } else if (action === "removePin") {
      const { pin_id } = body;
      await base44.asServiceRole.entities.CollabPin.delete(pin_id);
      return Response.json({ ok: true });

    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});