import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { event, track_id, track_name, change_type } = await req.json();

    // Get all user accounts
    const accounts = await base44.asServiceRole.entities.UserAccount.list();
    
    const messages = [];
    for (const account of accounts) {
      if (!account.email) continue;

      let subject = '';
      let body = '';

      if (change_type === 'closed') {
        subject = `Pohodniška pot zaprta: ${track_name}`;
        body = `Pot "${track_name}" je bila zaprta in ni več dostopna. Prosimo, izberite drugo pot za svoje pohode.`;
      } else if (change_type === 'modified') {
        subject = `Pohodniška pot spremenjena: ${track_name}`;
        body = `Pot "${track_name}" je bila spremenjena. Preverite najnovejšo verzijo na zemljevidu.`;
      } else if (change_type === 'reopened') {
        subject = `Pohodniška pot znova odprta: ${track_name}`;
        body = `Pot "${track_name}" je spet dostopna po nedavni zaključeni vzdrževalnih delih.`;
      }

      if (subject && body) {
        await base44.integrations.Core.SendEmail({
          to: account.email,
          subject: subject,
          body: body
        });
        messages.push(`Email poslan: ${account.email}`);
      }
    }

    return Response.json({ 
      success: true, 
      notifications_sent: messages.length,
      messages 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});