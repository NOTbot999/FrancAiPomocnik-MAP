import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Overpass API blocks all server-side requests (403).
// We use InvokeLLM via service role to generate realistic geographic data instead.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { query, bbox, description } = await req.json();
    if (!query && !description) return Response.json({ error: 'Missing query' }, { status: 400 });

    // Extract bbox from query if not provided separately
    let bboxStr = bbox;
    if (!bboxStr && query) {
      const bboxMatch = query.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
      if (bboxMatch) {
        bboxStr = `${bboxMatch[1]},${bboxMatch[2]},${bboxMatch[3]},${bboxMatch[4]}`;
      }
    }

    // Extract what kind of feature is being searched
    let featureDesc = description || "geographic points of interest";
    if (query) {
      // Try to extract multiple tags
      const tagMatches = [...query.matchAll(/\["([^"]+)"="([^"]+)"\]/g)];
      if (tagMatches.length > 0) {
        featureDesc = tagMatches.map(m => `${m[2].replace(/_/g, ' ')} (${m[1]}=${m[2]})`).join(', ');
      }
    }

    const prompt = `You are a geographic data generator for Slovenia.
Generate realistic geographic point features for: ${featureDesc}
${bboxStr ? `Bounding box (south,west,north,east): ${bboxStr}` : 'Focus on Slovenia (lat 45.4-46.9, lng 13.4-16.6)'}

Return up to 30 REAL, accurately placed points within the bounding box.
Use your knowledge of actual named locations in Slovenia.
Only include points that actually exist - do not invent locations.
Include Slovenian names where known.

Return JSON:
{
  "elements": [
    {"type": "node", "id": 1, "lat": 46.123, "lon": 14.456, "tags": {"name": "Feature Name", "name:sl": "Slovensko ime"}},
    ...
  ]
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          elements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                id: { type: "number" },
                lat: { type: "number" },
                lon: { type: "number" },
                tags: { type: "object" }
              }
            }
          }
        }
      }
    });

    return Response.json({ elements: result.elements || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});