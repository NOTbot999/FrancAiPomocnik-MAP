#!/usr/bin/env node
// Downloads every dataset the map needs and writes it to public/data/*.json so the
// app can run fully offline. Node 18+ (uses global fetch), no dependencies.
//
//   npm run fetch-data            # skips files fresher than 7 days
//   npm run fetch-data -- --force # re-download everything
//   npm run fetch-data -- --only castle,peak,caves
//
// Datasets: caves, municipalities, places, third_dev_axis, every Overpass POI
// category from src/data/categories.js, OpenChargeMap, Wikidata ×3, Wikipedia.

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  CATEGORIES, MUNICIPALITY_QUERY, PLACES_QUERY, H8_QUERY, CAVES_SOURCE_URL,
  OPENCHARGEMAP_URL, EV_CHARGING_OSM_QUERY, WIKIDATA_SPARQL_URL, WIKIDATA_QUERIES, wikipediaGeosearchUrl, SI_BBOX,
} from "../src/data/categories.js";
import {
  parseOverpassPoints, normalizeCave, parseMunicipalities, parsePlaces, parseH8Lines,
  parseOpenChargeMap, parseWikidata, parseWikipedia,
} from "../src/data/parsers.js";
import { fetchOverpass, OVERPASS_MIRRORS } from "../src/lib/overpass.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "data");
const MAX_AGE_DAYS = 7;
const OVERPASS_DELAY_MS = 1500;
// Mirror order for the script; override with OVERPASS_MIRRORS="https://a/api/interpreter,https://b/..."
const MIRRORS = process.env.OVERPASS_MIRRORS
  ? process.env.OVERPASS_MIRRORS.split(",").map(s => s.trim()).filter(Boolean)
  : OVERPASS_MIRRORS;

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  console.warn("HTTPS_PROXY is set but NODE_USE_ENV_PROXY is not — Node's fetch ignores the proxy. Run with NODE_USE_ENV_PROXY=1 if downloads fail.");
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? new Set((args[onlyIdx + 1] || "").split(",").filter(Boolean)) : null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, init = {}, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { Accept: "application/json", "User-Agent": "SloveniaGISExplorer/1.0 offline-data (contact: github FrancAiPomocnik-MAP)", ...(init.headers || {}) } });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);
        await sleep(Math.max(retryAfter * 1000, 15000 * (i + 1))); // rate limited: wait and retry
        throw new Error("HTTP 429");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (!/429/.test(String(e.message))) await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

async function overpass(query, timeoutMs = 60000, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fetchOverpass(query, timeoutMs, MIRRORS); }
    catch (e) { lastErr = e; await sleep(5000 * (i + 1)); }
  }
  throw lastErr;
}

async function isFresh(id) {
  if (force) return false;
  try {
    const s = await stat(path.join(OUT_DIR, `${id}.json`));
    return Date.now() - s.mtimeMs < MAX_AGE_DAYS * 86400 * 1000 && s.size > 2;
  } catch { return false; }
}

// ── Dataset definitions ─────────────────────────────────────────────────────
const datasets = [];

datasets.push({
  id: "caves", kind: "caves",
  run: async () => {
    const raw = await fetchJson(CAVES_SOURCE_URL);
    const list = Array.isArray(raw) ? raw : (raw.caves || raw.data || []);
    return list.map(normalizeCave).filter(Boolean);
  },
});

datasets.push({ id: "municipalities", kind: "overpass", run: async () => parseMunicipalities(await overpass(MUNICIPALITY_QUERY, 120000)) });
datasets.push({ id: "places", kind: "overpass", run: async () => parsePlaces(await overpass(PLACES_QUERY)) });
datasets.push({ id: "third_dev_axis", kind: "overpass", run: async () => parseH8Lines(await overpass(H8_QUERY)) });

for (const cat of CATEGORIES) {
  if (cat._caveDbLayer || cat._municipalityLayer) continue;
  if (cat._source === "openchargemap") {
    // OpenChargeMap needs an API key (OPENCHARGEMAP_API_KEY); otherwise use OSM charging stations
    const ocmKey = process.env.OPENCHARGEMAP_API_KEY;
    datasets.push({
      id: cat.id, kind: ocmKey ? "external" : "overpass",
      run: async () => ocmKey
        ? parseOpenChargeMap(await fetchJson(`${OPENCHARGEMAP_URL}&key=${encodeURIComponent(ocmKey)}`))
        : parseOverpassPoints(await overpass(EV_CHARGING_OSM_QUERY)),
    });
  } else if (cat._source?.startsWith("wikidata_")) {
    const sparql = WIKIDATA_QUERIES[cat.id];
    datasets.push({
      id: cat.id, kind: "external",
      run: async () => parseWikidata(await fetchJson(`${WIKIDATA_SPARQL_URL}?format=json&query=${encodeURIComponent(sparql)}`, { headers: { Accept: "application/sparql-results+json" } })),
    });
  } else if (cat._source === "wikipedia") {
    // geosearch returns at most 500 hits per call → sweep Slovenia in 0.25° cells and dedupe by pageid
    datasets.push({
      id: cat.id, kind: "external",
      run: async () => {
        const STEP = 0.25;
        const byId = new Map();
        for (let lat = SI_BBOX.minLat; lat < SI_BBOX.maxLat; lat += STEP) {
          for (let lon = SI_BBOX.minLon; lon < SI_BBOX.maxLon; lon += STEP) {
            const top = Math.min(lat + STEP, SI_BBOX.maxLat), right = Math.min(lon + STEP, SI_BBOX.maxLon);
            const url = wikipediaGeosearchUrl(top.toFixed(3), lon.toFixed(3), lat.toFixed(3), right.toFixed(3));
            const feats = parseWikipedia(await fetchJson(url));
            for (const f of feats) byId.set(f.pageid ?? `${f.coords[0]},${f.coords[1]}`, f);
            await sleep(1200); // be polite to the Wikimedia API
          }
        }
        return Array.from(byId.values()).map(({ pageid: _p, ...f }) => f);
      },
    });
  } else if (cat.query) {
    datasets.push({ id: cat.id, kind: "overpass", run: async () => parseOverpassPoints(await overpass(cat.query)) });
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
await mkdir(OUT_DIR, { recursive: true });

let manifest = { built_at: null, files: {} };
try { manifest = JSON.parse(await readFile(path.join(OUT_DIR, "manifest.json"), "utf8")); } catch { /* first run */ }

const rows = [];
for (const ds of datasets) {
  if (only && !only.has(ds.id)) continue;
  if (await isFresh(ds.id)) { rows.push([ds.id, "fresh", manifest.files?.[ds.id]?.count ?? "?"]); continue; }
  process.stdout.write(`${ds.id.padEnd(18)} … `);
  try {
    const data = await ds.run();
    if (!Array.isArray(data) || data.length === 0) throw new Error("empty result");
    const json = JSON.stringify(data);
    await writeFile(path.join(OUT_DIR, `${ds.id}.json`), json);
    manifest.files[ds.id] = { count: data.length, bytes: Buffer.byteLength(json), built_at: new Date().toISOString(), kind: ds.kind };
    rows.push([ds.id, "ok", data.length]);
    console.log(`${data.length} (${(Buffer.byteLength(json) / 1024).toFixed(0)} KB)`);
  } catch (e) {
    rows.push([ds.id, "FAILED", e.message]);
    console.log(`FAILED: ${e.message}`);
  }
  if (ds.kind === "overpass") await sleep(OVERPASS_DELAY_MS);
}

manifest.built_at = new Date().toISOString();
await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log("\nSummary");
for (const [id, status, info] of rows) console.log(`  ${id.padEnd(18)} ${status.padEnd(7)} ${info}`);
const failed = rows.filter(r => r[1] === "FAILED").length;
console.log(`\n${rows.length - failed}/${rows.length} datasets ready in public/data (manifest built_at ${manifest.built_at})`);
process.exit(failed ? 1 : 0);
