// ExternalLayers.jsx — Fetchers for non-OSM data sources
// OpenChargeMap (EV polnilnice), Wikidata SPARQL (spomeniki/gradovi/muzeji), Wikipedia GeoSearch

const SI_BBOX = { minLat: 45.4, minLon: 13.4, maxLat: 46.9, maxLon: 16.6 };

// ── OpenChargeMap — EV charging stations ──────────────────────────────────────
export async function loadOpenChargeMap() {
  const url = "https://api.openchargemap.io/v3/poi/?output=json&countrycode=SI&maxresults=2000&compact=true";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json();
  return (data || [])
    .filter((p) => p.AddressInfo?.Latitude && p.AddressInfo?.Longitude)
    .map((p) => ({
      type: "Point",
      coords: [p.AddressInfo.Latitude, p.AddressInfo.Longitude],
      label: p.AddressInfo.Title || p.AddressInfo.AddressLine1 || "Polnilnica",
    }));
}

// ── Wikidata SPARQL ──────────────────────────────────────────────────────────
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

async function wikidataQuery(sparql) {
  const url = WIKIDATA_SPARQL + "?format=json&query=" + encodeURIComponent(sparql);
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
  const data = await res.json();
  return (data.results?.bindings || [])
    .filter((b) => b.lat && b.lon)
    .map((b) => ({
      type: "Point",
      coords: [parseFloat(b.lat.value), parseFloat(b.lon.value)],
      label: b.itemLabel?.value || b.item?.value || "",
    }));
}

export async function loadWikidataCastles() {
  const sparql = `
    SELECT ?item ?itemLabel ?lat ?lon WHERE {
      ?item wdt:P17 wd:Q215 .
      ?item wdt:P31/wdt:P279* wd:Q23413 .
      ?item p:P625 ?stmt . ?stmt psv:P625 ?node .
      ?node wikibase:geoLatitude ?lat . ?node wikibase:geoLongitude ?lon .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "sl,en" . }
    } LIMIT 500`;
  return await wikidataQuery(sparql);
}

export async function loadWikidataMonuments() {
  const sparql = `
    SELECT ?item ?itemLabel ?lat ?lon WHERE {
      ?item wdt:P17 wd:Q215 .
      ?item wdt:P1435 ?heritage .
      ?item p:P625 ?stmt . ?stmt psv:P625 ?node .
      ?node wikibase:geoLatitude ?lat . ?node wikibase:geoLongitude ?lon .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "sl,en" . }
    } LIMIT 1000`;
  return await wikidataQuery(sparql);
}

export async function loadWikidataMuseums() {
  const sparql = `
    SELECT ?item ?itemLabel ?lat ?lon WHERE {
      ?item wdt:P17 wd:Q215 .
      ?item wdt:P31/wdt:P279* wd:Q33506 .
      ?item p:P625 ?stmt . ?stmt psv:P625 ?node .
      ?node wikibase:geoLatitude ?lat . ?node wikibase:geoLongitude ?lon .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "sl,en" . }
    } LIMIT 500`;
  return await wikidataQuery(sparql);
}

// ── Wikipedia GeoSearch — Articles with coordinates in Slovenia ──────────────
export async function loadWikipediaArticles() {
  const url =
    `https://sl.wikipedia.org/w/api.php?action=query&list=geosearch` +
    `&gsbbox=${SI_BBOX.minLat},${SI_BBOX.minLon}%7C${SI_BBOX.maxLat},${SI_BBOX.maxLon}` +
    `&gslimit=500&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.query?.geosearch || []).map((g) => ({
    type: "Point",
    coords: [g.lat, g.lon],
    label: g.title || "",
  }));
}