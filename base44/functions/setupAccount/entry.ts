import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { encode } from 'npm:js-base64@3.7.5';

// Called when an admin pre-created user sets their username & password for the first time
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { accountId, username, password } = body;

    if (!accountId || !username || !password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const account = await base44.asServiceRole.entities.User.get(accountId);
    if (!account) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }
    if (account.password_hash) {
      return Response.json({ error: 'Account already has a password' }, { status: 403 });
    }

    // Check username uniqueness
    const existing = await base44.asServiceRole.entities.User.filter({
      username: username.toLowerCase()
    });
    if (existing.length > 0) {
      return Response.json({ error: 'Username already taken' }, { status: 409 });
    }

    const passwordHash = encode(password);

    await base44.asServiceRole.entities.User.update(accountId, {
      username: username.toLowerCase(),
      password_hash: passwordHash,
      login_method: account.email ? 'both' : 'username',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Setup account error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});