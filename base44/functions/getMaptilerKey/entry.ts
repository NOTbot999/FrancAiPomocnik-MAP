Deno.serve(async (req) => {
  const key = Deno.env.get("MAPTILER_API_KEY");
  if (!key) return Response.json({ error: "MAPTILER_API_KEY not set" }, { status: 500 });
  return Response.json({ key });
});