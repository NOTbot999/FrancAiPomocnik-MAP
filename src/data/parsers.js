// Pure parsers shared by the app and scripts/fetch-offline-data.mjs.
// Every function here turns a raw remote payload into the exact shape the
// map components consume, so bundled JSON and live fetches are identical.

// ── Overpass → point features ───────────────────────────────────────────────
export function parseOverpassPoints(data) {
  return (data?.elements || []).map(el => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) return null;
    return { type: "Point", coords: [lat, lon], label: el.tags?.name || el.tags?.["name:sl"] || el.tags?.ref || "" };
  }).filter(Boolean);
}

// ── Caves ───────────────────────────────────────────────────────────────────
const CAVE_FIELDS = [
  "catalog_number", "cave_id", "name", "synonyms", "type_1", "type_2", "latitude", "longitude",
  "entrance_elevation_m", "length_m", "depth_m", "area_m2", "survey_method", "cadastral_municipality",
  "administrative_unit", "entry_regime", "access", "general_condition", "archaeological",
  "cave_system", "notes", "organization",
];
const CAVE_NUMERIC = new Set(["catalog_number", "cave_id", "latitude", "longitude", "entrance_elevation_m", "length_m", "depth_m", "area_m2"]);

/** Normalise a raw cadastre record into the Cave entity shape; null if it has no usable coordinates. */
export function normalizeCave(raw) {
  const out = {};
  for (const k of CAVE_FIELDS) {
    let v = raw?.[k];
    if (v === undefined || v === null || v === "") continue;
    if (CAVE_NUMERIC.has(k)) { v = parseFloat(v); if (!Number.isFinite(v)) continue; }
    out[k] = v;
  }
  if (!out.name) out.name = "Neznana jama";
  if (!out.latitude || !out.longitude || out.latitude === 0 || out.longitude === 0) return null;
  return out;
}

export function hasCoords(c) {
  return !!(c && c.latitude && c.longitude && parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0);
}

export function cavesToLayerFeatures(caves) {
  return caves.map(c => {
    const parts = [c.name];
    if (c.synonyms) parts.push(`(${c.synonyms})`);
    const dims = [];
    if (c.depth_m) dims.push(`${c.depth_m}m globoka`);
    if (c.length_m) dims.push(`${c.length_m}m dolga`);
    if (c.entrance_elevation_m) dims.push(`${c.entrance_elevation_m}m nmv`);
    if (dims.length) parts.push(`— ${dims.join(", ")}`);
    if (c.entry_regime) parts.push(`[${c.entry_regime}]`);
    return {
      type: "Point",
      coords: [parseFloat(c.latitude), parseFloat(c.longitude)],
      label: parts.join(" "),
      depth_m: c.depth_m,
      length_m: c.length_m,
      entrance_elevation_m: c.entrance_elevation_m,
      entry_regime: c.entry_regime,
      administrative_unit: c.administrative_unit,
    };
  });
}

// ── Municipalities ──────────────────────────────────────────────────────────
function dist(a, b) {
  if (!a || !b) return Infinity;
  const dlat = a[0] - b[0];
  const dlon = a[1] - b[1];
  return dlat * dlat + dlon * dlon;
}

// Stitch way segments into closed rings
export function stitchWays(ways) {
  if (!ways || ways.length === 0) return [];
  const segments = ways.map(w => (w.geometry || []).map(g => [g.lat, g.lon]));
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  const result = [...segments[0]];
  const remaining = segments.slice(1);
  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let bestIdx = -1, bestReverse = false, bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      if (!seg || seg.length === 0) continue;
      const d1 = dist(last, seg[0]);
      const d2 = dist(last, seg[seg.length - 1]);
      if (d1 < bestDist) { bestDist = d1; bestIdx = i; bestReverse = false; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; bestReverse = true; }
    }
    if (bestIdx === -1) break;
    const seg = remaining.splice(bestIdx, 1)[0];
    const toAdd = bestReverse ? [...seg].reverse() : seg;
    result.push(...toAdd.slice(1));
  }
  return result;
}

export function relationToFeature(el) {
  const name = el.tags?.name || el.tags?.["name:sl"] || "";
  if (!name) return null;
  const iso = el.tags?.["ISO3166-2"] || "";
  if (!iso.startsWith("SI-")) return null;
  const outerWays = (el.members || []).filter(m => m.type === "way" && m.role === "outer" && m.geometry?.length > 0);
  const innerWays = (el.members || []).filter(m => m.type === "way" && m.role === "inner" && m.geometry?.length > 0);
  if (outerWays.length === 0) return null;
  const outerRing = stitchWays(outerWays);
  if (outerRing.length < 4) return null;
  const holes = innerWays.length > 0 ? [stitchWays(innerWays)] : [];
  const lat = outerRing.reduce((s, c) => s + c[0], 0) / outerRing.length;
  const lon = outerRing.reduce((s, c) => s + c[1], 0) / outerRing.length;
  return { name, outerRing, holes, centroid: [lat, lon] };
}

export function parseMunicipalities(data) {
  const seen = new Map();
  for (const el of data?.elements || []) {
    if (el.type !== "relation" || seen.has(el.id)) continue;
    const f = relationToFeature(el);
    if (f) seen.set(el.id, f);
  }
  return Array.from(seen.values());
}

export function parsePlaces(data) {
  return (data?.elements || []).map(el => ({
    lat: el.lat, lon: el.lon,
    name: el.tags?.name || "",
    place: el.tags?.place || "village",
  })).filter(el => el.lat && el.lon);
}

// ── 3RO / H8 ────────────────────────────────────────────────────────────────
export function parseH8Lines(data) {
  return (data?.elements || [])
    .filter(e => e.type === "way" && e.geometry)
    .map(w => (w.geometry || []).map(p => [p.lat, p.lon]))
    .filter(line => line.length >= 2);
}

// ── Non-OSM sources ─────────────────────────────────────────────────────────
export function parseOpenChargeMap(data) {
  return (data || [])
    .filter(p => p.AddressInfo?.Latitude && p.AddressInfo?.Longitude)
    .map(p => ({
      type: "Point",
      coords: [p.AddressInfo.Latitude, p.AddressInfo.Longitude],
      label: p.AddressInfo.Title || p.AddressInfo.AddressLine1 || "Polnilnica",
    }));
}

export function parseWikidata(data) {
  return (data?.results?.bindings || [])
    .filter(b => b.lat && b.lon)
    .map(b => ({
      type: "Point",
      coords: [parseFloat(b.lat.value), parseFloat(b.lon.value)],
      label: b.itemLabel?.value || b.item?.value || "",
    }));
}

export function parseWikipedia(data) {
  return (data?.query?.geosearch || []).map(g => ({
    type: "Point",
    coords: [g.lat, g.lon],
    label: g.title || "",
  }));
}
