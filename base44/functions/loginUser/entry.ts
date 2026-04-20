import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { encode } from 'npm:js-base64@3.7.5';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { login, password } = body;

    if (!login || !password) {
      return Response.json({ error: 'Login and password required' }, { status: 400 });
    }

    // Find account by username or email
    const accounts = await base44.asServiceRole.entities.UserAccount.filter([
      { username: login.toLowerCase() },
      { email: login.toLowerCase() }
    ]);

    if (accounts.length === 0) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const account = accounts[0];
    const passwordHash = encode(password);

    // Verify password
    if (account.password_hash !== passwordHash) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login + device info from headers
    const ua = req.headers.get('user-agent') || '';
    const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'unknown';
    const browser = /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'unknown';

    await base44.asServiceRole.entities.UserAccount.update(account.id, {
      last_login: new Date().toISOString(),
      device_type: isMobile ? 'mobile' : 'desktop',
      os,
      browser
    });

    return Response.json({
      success: true,
      accountId: account.id,
      username: account.username,
      email: account.email || null,
      role: account.role || 'user',
      is_premium: account.is_premium || false,
      premium_until: account.premium_until || null
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});