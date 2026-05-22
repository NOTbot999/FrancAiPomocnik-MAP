import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { username, description, user_agent, reported_at, screenshot_urls } = await req.json();

    if (!description || !description.trim()) {
      return Response.json({ error: 'Description is required' }, { status: 400 });
    }

    const report = await base44.asServiceRole.entities.LagReport.create({
      username: username || "gost",
      description: description.trim(),
      user_agent: user_agent || "",
      reported_at: reported_at || new Date().toISOString(),
      screenshot_urls: screenshot_urls || [],
    });

    return Response.json({ success: true, id: report.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});