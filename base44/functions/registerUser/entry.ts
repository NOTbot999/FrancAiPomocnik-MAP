import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { encode } from 'npm:js-base64@3.7.5';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { username, password, email } = body;

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Check if username already exists
    const existing = await base44.asServiceRole.entities.User.filter({
      username: username.toLowerCase()
    });

    if (existing.length > 0) {
      return Response.json({ error: 'Username already taken' }, { status: 409 });
    }

    const passwordHash = encode(password);

    const ua = req.headers.get('user-agent') || '';
    const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'unknown';
    const browser = /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'unknown';

    const account = await base44.asServiceRole.entities.User.create({
      username: username.toLowerCase(),
      email: email || null,
      password_hash: passwordHash,
      login_method: email ? 'both' : 'username',
      device_type: isMobile ? 'mobile' : 'desktop',
      os,
      browser,
      is_base44_user: false
    });

    return Response.json({ success: true, accountId: account.id });
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});