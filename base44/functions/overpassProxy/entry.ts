import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Overpass API blocks all server-side requests (403).
// We use InvokeLLM to generate realistic geographic point data instead.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query, bbox, description } = await req.json();
    if (!query && !description) return Response.json({ error: 'Missing query' }, { status: 400 });

    // Extract bbox from query if not provided separately
    // Overpass bbox format: (south,west,north,east)
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
      const tagMatch = query.match(/\["([^"]+)"="([^"]+)"\]/);
      if (tagMatch) {
        featureDesc = `${tagMatch[2].replace(/_/g, ' ')} (OSM tag: ${tagMatch[1]}=${tagMatch[2]})`;
      }
    }

    const prompt = `You are a geographic data generator for Slovenia and surrounding region.
Generate realistic geographic point features for: ${featureDesc}
${bboxStr ? `Bounding box (south,west,north,east): ${bboxStr}` : ''}

Return up to 30 real, accurately placed points within the bounding box.
Use your knowledge of actual locations in Slovenia (peaks, waterfalls, castles, caves, etc.).
Only include points that actually exist in reality - do not invent fake locations.

Return JSON with this exact structure:
{
  "elements": [
    {"type": "node", "id": 1, "lat": 46.123, "lon": 14.456, "tags": {"name": "Feature Name", "name:sl": "Slovenian name if different"}},
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