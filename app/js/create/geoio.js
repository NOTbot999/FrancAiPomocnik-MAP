// GPX / KML / GeoJSON import & export
// Internal feature: { id, type: "marker"|"line"|"polygon", name, color, note, coords }
//   marker coords: [lat, lng]; line/polygon: [[lat, lng, ele?, time?], ...]
import { esc, uid, COLORS } from "../shared/util.js";

const xmlEsc = (s) => esc(s);

// layerName(f) → name of the feature's layer ("Moje karte"); kept as properties.layer / KML <Folder>
export function toGeoJSON(features, { name, description, layerName } = {}) {
  return JSON.stringify({
    type: "FeatureCollection",
    ...(name ? { name } : {}), ...(description ? { description } : {}),
    features: features.map((f) => {
      let geometry;
      if (f.type === "marker") geometry = { type: "Point", coordinates: [f.coords[1], f.coords[0]] };
      else if (f.type === "polygon") geometry = { type: "Polygon", coordinates: [[...f.coords, f.coords[0]].map((p) => [p[1], p[0]])] };
      else geometry = { type: "LineString", coordinates: f.coords.map((p) => (p[2] != null ? [p[1], p[0], p[2]] : [p[1], p[0]])) };
      return { type: "Feature", properties: { name: f.name, color: f.color, note: f.note || "", kind: f.kind || f.type, ...(layerName ? { layer: layerName(f) } : {}) }, geometry };
    }),
  }, null, 1);
}

export function toGPX(features, name = "Franc Map") {
  const wpts = features.filter((f) => f.type === "marker").map((f) =>
    `  <wpt lat="${f.coords[0]}" lon="${f.coords[1]}"><name>${xmlEsc(f.name)}</name>${f.note ? `<desc>${xmlEsc(f.note)}</desc>` : ""}</wpt>`).join("\n");
  const trks = features.filter((f) => f.type !== "marker").map((f) => {
    const pts = f.type === "polygon" ? [...f.coords, f.coords[0]] : f.coords;
    const seg = pts.map((p) => `      <trkpt lat="${p[0]}" lon="${p[1]}">${p[2] != null ? `<ele>${(+p[2]).toFixed(1)}</ele>` : ""}${p[3] ? `<time>${new Date(p[3]).toISOString()}</time>` : ""}</trkpt>`).join("\n");
    return `  <trk><name>${xmlEsc(f.name)}</name><trkseg>\n${seg}\n    </trkseg></trk>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Franc Map Desktop" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xmlEsc(name)}</name></metadata>
${wpts}
${trks}
</gpx>`;
}

export function toKML(features, name = "Franc Map", layerName = null, description = "") {
  const kmlColor = (hex) => { const c = (hex || "#e11d48").replace("#", ""); return `ff${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}`; };
  const pm = features.map((f) => {
    const style = `<Style><LineStyle><color>${kmlColor(f.color)}</color><width>3</width></LineStyle><PolyStyle><color>55${kmlColor(f.color).slice(2)}</color></PolyStyle></Style>`;
    let geom;
    if (f.type === "marker") geom = `<Point><coordinates>${f.coords[1]},${f.coords[0]}</coordinates></Point>`;
    else if (f.type === "polygon") geom = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${[...f.coords, f.coords[0]].map((p) => `${p[1]},${p[0]}`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    else geom = `<LineString><coordinates>${f.coords.map((p) => `${p[1]},${p[0]}${p[2] != null ? "," + p[2] : ""}`).join(" ")}</coordinates></LineString>`;
    return `  <Placemark><name>${xmlEsc(f.name)}</name>${f.note ? `<description>${xmlEsc(f.note)}</description>` : ""}${style}${geom}</Placemark>`;
  });
  let body = pm.join("\n");
  if (layerName) {   // one <Folder> per layer — Google My Maps / Earth show them as layers
    const folders = new Map();
    features.forEach((f, i) => { const k = layerName(f) || "Sloj"; if (!folders.has(k)) folders.set(k, []); folders.get(k).push(pm[i]); });
    body = [...folders].map(([k, items]) => ` <Folder><name>${xmlEsc(k)}</name>\n${items.join("\n")}\n </Folder>`).join("\n");
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xmlEsc(name)}</name>${description ? `<description>${xmlEsc(description)}</description>` : ""}
${body}
</Document></kml>`;
}

// ── Parsing ──
const num = (v) => (v == null || v === "" ? null : +v);

function parseGPX(doc) {
  const out = [];
  const txt = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
  for (const w of doc.getElementsByTagName("wpt")) {
    out.push({ type: "marker", name: txt(w, "name") || "Točka", note: txt(w, "desc"), coords: [+w.getAttribute("lat"), +w.getAttribute("lon")] });
  }
  for (const t of [...doc.getElementsByTagName("trk"), ...doc.getElementsByTagName("rte")]) {
    const pts = [...t.getElementsByTagName("trkpt"), ...t.getElementsByTagName("rtept")].map((p) => {
      const time = txt(p, "time");
      return [+p.getAttribute("lat"), +p.getAttribute("lon"), num(txt(p, "ele")), time ? Date.parse(time) : null];
    });
    if (pts.length > 1) out.push({ type: "line", name: txt(t, "name") || "Sled", coords: pts });
  }
  return out;
}

function parseKML(doc) {
  const out = [];
  for (const pm of doc.getElementsByTagName("Placemark")) {
    const name = pm.getElementsByTagName("name")[0]?.textContent?.trim() || "Element";
    const note = pm.getElementsByTagName("description")[0]?.textContent?.trim() || "";
    // Placemark inside a <Folder> → that folder is its layer (My Maps / Google Earth export)
    const layerName = pm.parentElement?.localName === "Folder" ? [...pm.parentElement.children].find((c) => c.localName === "name")?.textContent?.trim() || null : null;
    const parse = (s) => s.trim().split(/\s+/).map((c) => { const [lng, lat, ele] = c.split(",").map(Number); return [lat, lng, isNaN(ele) ? null : ele]; });
    const pt = pm.getElementsByTagName("Point")[0];
    const ls = pm.getElementsByTagName("LineString")[0];
    const pg = pm.getElementsByTagName("Polygon")[0];
    const gx = pm.getElementsByTagNameNS("*", "Track")[0];
    if (pt) out.push({ type: "marker", name, note, layerName, coords: parse(pt.getElementsByTagName("coordinates")[0].textContent)[0].slice(0, 2) });
    else if (ls) out.push({ type: "line", name, note, layerName, coords: parse(ls.getElementsByTagName("coordinates")[0].textContent) });
    else if (pg) { const c = parse(pg.getElementsByTagName("coordinates")[0].textContent); c.pop(); out.push({ type: "polygon", name, note, layerName, coords: c }); }
    else if (gx) {
      const coords = [...gx.getElementsByTagNameNS("*", "coord")].map((c) => { const [lng, lat, ele] = c.textContent.trim().split(/\s+/).map(Number); return [lat, lng, isNaN(ele) ? null : ele]; });
      if (coords.length > 1) out.push({ type: "line", name, note, layerName, coords });
    }
  }
  return out;
}

function parseGeoJSON(obj) {
  const out = [];
  const feats = obj.type === "FeatureCollection" ? obj.features : obj.type === "Feature" ? [obj] : [{ type: "Feature", geometry: obj, properties: {} }];
  for (const f of feats) {
    const g = f.geometry, p = f.properties || {};
    if (!g) continue;
    const name = p.name || p.title || p.label || "Element";
    const ll = (c) => [c[1], c[0], c[2] ?? null];
    const push = (type, coords) => out.push({ type, name, note: p.note || p.description || "", color: p.color || p.stroke, layerName: p.layer || null, coords });
    if (g.type === "Point") push("marker", [g.coordinates[1], g.coordinates[0]]);
    else if (g.type === "MultiPoint") g.coordinates.forEach((c) => push("marker", [c[1], c[0]]));
    else if (g.type === "LineString") push("line", g.coordinates.map(ll));
    else if (g.type === "MultiLineString") g.coordinates.forEach((l) => push("line", l.map(ll)));
    else if (g.type === "Polygon") { const r = g.coordinates[0].map(ll); r.pop(); push("polygon", r); }
    else if (g.type === "MultiPolygon") g.coordinates.forEach((pg) => { const r = pg[0].map(ll); r.pop(); push("polygon", r); });
  }
  return out;
}

export function parseFile(name, content) {
  const lower = name.toLowerCase();
  let feats;
  if (lower.endsWith(".gpx")) feats = parseGPX(new DOMParser().parseFromString(content, "application/xml"));
  else if (lower.endsWith(".kml")) feats = parseKML(new DOMParser().parseFromString(content, "application/xml"));
  else feats = parseGeoJSON(JSON.parse(content));
  return feats.map((f, i) => ({ id: uid("f"), color: f.color || COLORS[i % COLORS.length], ...f, coords: f.coords }));
}
