// ExternalLayers.jsx — Fetchers for non-OSM data sources
// OpenChargeMap (EV polnilnice), Wikidata SPARQL (spomeniki/gradovi/muzeji), Wikipedia GeoSearch
// URLs/queries and parsers are shared with scripts/fetch-offline-data.mjs.
import { OPENCHARGEMAP_URL, EV_CHARGING_OSM_QUERY, WIKIDATA_SPARQL_URL, WIKIDATA_QUERIES, WIKIPEDIA_GEOSEARCH_URL } from "@/data/categories";
import { parseOpenChargeMap, parseOverpassPoints, parseWikidata, parseWikipedia } from "@/data/parsers";
import { fetchOverpass } from "@/lib/overpass";

// ── EV charging stations — OpenChargeMap (needs VITE_OPENCHARGEMAP_KEY) or OSM fallback ───────
export async function loadOpenChargeMap() {
  const key = import.meta.env.VITE_OPENCHARGEMAP_KEY;
  if (key) {
    const res = await fetch(`${OPENCHARGEMAP_URL}&key=${encodeURIComponent(key)}`, { headers: { Accept: "application/json" } });
    if (res.ok) return parseOpenChargeMap(await res.json());
  }
  return parseOverpassPoints(await fetchOverpass(EV_CHARGING_OSM_QUERY));
}

// ── Wikidata SPARQL ──────────────────────────────────────────────────────────
async function wikidataQuery(sparql) {
  const url = WIKIDATA_SPARQL_URL + "?format=json&query=" + encodeURIComponent(sparql);
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
  return parseWikidata(await res.json());
}

export async function loadWikidataCastles() { return wikidataQuery(WIKIDATA_QUERIES.wd_castles); }
export async function loadWikidataMonuments() { return wikidataQuery(WIKIDATA_QUERIES.wd_monuments); }
export async function loadWikidataMuseums() { return wikidataQuery(WIKIDATA_QUERIES.wd_museums); }

// ── Wikipedia GeoSearch — Articles with coordinates in Slovenia ──────────────
export async function loadWikipediaArticles() {
  const res = await fetch(WIKIPEDIA_GEOSEARCH_URL);
  return parseWikipedia(await res.json()).map(({ pageid: _p, ...f }) => f);
}
