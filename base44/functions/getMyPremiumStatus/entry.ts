import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const { username } = await req.json();
    if (!username) return Response.json({ is_premium: false });

    const base44 = createClientFromRequest(req);

    const accounts = await base44.asServiceRole.entities.UserAccount.filter({ username });
    const account = accounts?.[0];
    return Response.json({ is_premium: account?.is_premium === true });
  } catch (error) {
    return Response.json({ is_premium: false });
  }
});