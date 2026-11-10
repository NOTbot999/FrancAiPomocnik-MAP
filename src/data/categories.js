// Shared category + data-source definitions.
// Plain JS (no JSX, no browser globals) so both the app and
// scripts/fetch-offline-data.mjs can import it.

export const SI_BBOX = { minLat: 45.4, minLon: 13.4, maxLat: 46.9, maxLon: 16.6 };

// ── All categories — each toggles a full-Slovenia layer ────────────────────────────────────────────
export const CATEGORIES = [
  { id: "castle",        label: "Gradovi",        emoji: "🏰", color: "#b45309", query: `[out:json][timeout:30];(node["historic"="castle"](45.4,13.4,46.9,16.6);way["historic"="castle"](45.4,13.4,46.9,16.6););out center;` },
  { id: "peak",          label: "Vrhovi",         emoji: "⛰️", color: "#6b7280", query: `[out:json][timeout:30];node["natural"="peak"](45.4,13.4,46.9,16.6);out;` },
  { id: "waterfall",     label: "Slapovi",        emoji: "💧", color: "#0ea5e9", query: `[out:json][timeout:30];node["waterway"="waterfall"](45.4,13.4,46.9,16.6);out;` },
  { id: "viewpoint",     label: "Razglediš.",     emoji: "👁️", color: "#8b5cf6", query: `[out:json][timeout:30];node["tourism"="viewpoint"](45.4,13.4,46.9,16.6);out;` },
  { id: "cave",          label: "Jame",           emoji: "🕳️", color: "#78716c", _caveDbLayer: true, query: `` },
  { id: "museum",        label: "Muzeji",         emoji: "🏛️", color: "#a855f7", query: `[out:json][timeout:30];(node["tourism"="museum"](45.4,13.4,46.9,16.6);way["tourism"="museum"](45.4,13.4,46.9,16.6););out center;` },
  { id: "ruins",         label: "Ruševine",       emoji: "🗿", color: "#92400e", query: `[out:json][timeout:30];(node["historic"="ruins"](45.4,13.4,46.9,16.6);way["historic"="ruins"](45.4,13.4,46.9,16.6););out center;` },
  { id: "spring",        label: "Izviri",         emoji: "💦", color: "#06b6d4", query: `[out:json][timeout:30];node["natural"="spring"](45.4,13.4,46.9,16.6);out;` },
  { id: "lake",          label: "Jezera",         emoji: "🌊", color: "#3b82f6", query: `[out:json][timeout:45];(way["natural"="water"]["water"~"lake|reservoir|pond"](45.4,13.4,46.9,16.6);way["natural"="water"][!"water"](45.4,13.4,46.9,16.6);way["landuse"="reservoir"](45.4,13.4,46.9,16.6);relation["natural"="water"](45.4,13.4,46.9,16.6););out center;` },
  { id: "park",          label: "Parki",          emoji: "🌳", color: "#22c55e", query: `[out:json][timeout:30];(way["leisure"="park"](45.4,13.4,46.9,16.6);relation["leisure"="park"](45.4,13.4,46.9,16.6););out center;` },
  { id: "chapel",        label: "Kapelice",       emoji: "⛪", color: "#e879f9", query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"]["building"~"chapel|wayside_shrine"](45.4,13.4,46.9,16.6);node["historic"="wayside_shrine"](45.4,13.4,46.9,16.6););out;` },
  { id: "cross",         label: "Križi",          emoji: "✝️", color: "#a855f7", query: `[out:json][timeout:30];node["historic"="wayside_cross"](45.4,13.4,46.9,16.6);out;` },
  { id: "helipad",       label: "Helikopter.",     emoji: "🚁", color: "#0ea5e9", query: `[out:json][timeout:30];(node["aeroway"="helipad"](45.4,13.4,46.9,16.6);way["aeroway"="helipad"](45.4,13.4,46.9,16.6););out center;` },
  { id: "mosque",        label: "Mošeje",          emoji: "🕌", color: "#16a34a", query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="muslim"](45.4,13.4,46.9,16.6);way["amenity"="place_of_worship"]["religion"="muslim"](45.4,13.4,46.9,16.6););out center;` },
  { id: "synagogue",     label: "Sinagoge",        emoji: "🕍", color: "#2563eb", query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="jewish"](45.4,13.4,46.9,16.6);way["amenity"="place_of_worship"]["religion"="jewish"](45.4,13.4,46.9,16.6););out center;` },
  { id: "church",        label: "Cerkve",         emoji: "🕌", color: "#d946ef", query: `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6);way["amenity"="place_of_worship"]["religion"="christian"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fuel",          label: "Bencinske",      emoji: "⛽", color: "#f59e0b", query: `[out:json][timeout:45];(node["amenity"="fuel"](45.4,13.4,46.9,16.6);way["amenity"="fuel"](45.4,13.4,46.9,16.6);node["fuel"="yes"](45.4,13.4,46.9,16.6););out center;` },
  { id: "parking",       label: "Parkirišča",     emoji: "🅿️", color: "#6366f1", query: `[out:json][timeout:30];(node["amenity"="parking"](45.4,13.4,46.9,16.6);way["amenity"="parking"](45.4,13.4,46.9,16.6););out center;` },
  { id: "supermarket",   label: "Živila",         emoji: "🛒", color: "#f97316", query: `[out:json][timeout:30];(node["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6);way["shop"~"supermarket|grocery|convenience"](45.4,13.4,46.9,16.6););out center;` },
  { id: "atm",           label: "Bankomati",      emoji: "💳", color: "#84cc16", query: `[out:json][timeout:45];(node["amenity"="atm"](45.4,13.4,46.9,16.6);node["amenity"="bank"]["atm"!="no"](45.4,13.4,46.9,16.6);way["amenity"="bank"]["atm"!="no"](45.4,13.4,46.9,16.6););out center;` },
  { id: "hospital",      label: "Bolnice",        emoji: "🏥", color: "#ec4899", query: `[out:json][timeout:45];(node["amenity"="hospital"](45.4,13.4,46.9,16.6);way["amenity"="hospital"](45.4,13.4,46.9,16.6);node["amenity"="health_post"](45.4,13.4,46.9,16.6);relation["amenity"="hospital"](45.4,13.4,46.9,16.6););out center;` },
  { id: "clinic",        label: "Ambulante",      emoji: "🩺", color: "#14b8a6", query: `[out:json][timeout:45];(node["amenity"~"clinic|doctors|health_centre"](45.4,13.4,46.9,16.6);way["amenity"~"clinic|doctors|health_centre"](45.4,13.4,46.9,16.6);node["healthcare"~"centre|clinic|doctor|general_practitioner"](45.4,13.4,46.9,16.6);way["healthcare"~"centre|clinic"](45.4,13.4,46.9,16.6););out center;` },
  { id: "dentist",       label: "Zobozdrav.",     emoji: "🦷", color: "#a855f7", query: `[out:json][timeout:30];(node["amenity"="dentist"](45.4,13.4,46.9,16.6);way["amenity"="dentist"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pharmacy",      label: "Lekarne",        emoji: "💊", color: "#10b981", query: `[out:json][timeout:30];(node["amenity"="pharmacy"](45.4,13.4,46.9,16.6);way["amenity"="pharmacy"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fire_station",  label: "Gasilci",        emoji: "🚒", color: "#ef4444", query: `[out:json][timeout:30];(node["amenity"="fire_station"](45.4,13.4,46.9,16.6);way["amenity"="fire_station"](45.4,13.4,46.9,16.6););out center;` },
  { id: "police",        label: "Policija",       emoji: "🚔", color: "#3b82f6", query: `[out:json][timeout:30];(node["amenity"="police"](45.4,13.4,46.9,16.6);way["amenity"="police"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pipe",          label: "Pipe",           emoji: "🚰", color: "#0ea5e9", query: `[out:json][timeout:30];node["amenity"="drinking_water"](45.4,13.4,46.9,16.6);out;` },
  { id: "bus_station",   label: "Avt. postaje",   emoji: "🚌", color: "#f59e0b", query: `[out:json][timeout:30];(node["amenity"="bus_station"](45.4,13.4,46.9,16.6);node["highway"="bus_stop"](45.4,13.4,46.9,16.6););out;` },
  { id: "train_station", label: "Vlak postaje",   emoji: "🚂", color: "#78716c", query: `[out:json][timeout:30];(node["railway"="station"](45.4,13.4,46.9,16.6);node["railway"="halt"](45.4,13.4,46.9,16.6););out;` },
  { id: "camp",          label: "Kampi",          emoji: "🏕️", color: "#22c55e", query: `[out:json][timeout:30];(node["tourism"="camp_site"](45.4,13.4,46.9,16.6);way["tourism"="camp_site"](45.4,13.4,46.9,16.6););out center;` },
  { id: "aerodrome",     label: "Letališča",      emoji: "✈️", color: "#06b6d4", query: `[out:json][timeout:30];(node["aeroway"="aerodrome"](45.4,13.4,46.9,16.6);way["aeroway"="aerodrome"](45.4,13.4,46.9,16.6););out center;` },
  { id: "cemetery",      label: "Pokopališča",    emoji: "⚰️", color: "#6b7280", query: `[out:json][timeout:30];(node["landuse"="cemetery"](45.4,13.4,46.9,16.6);way["landuse"="cemetery"](45.4,13.4,46.9,16.6););out center;` },
  { id: "municipality",  label: "Občine",         emoji: "🏘️", color: "#b45309", _municipalityLayer: true, query: `` },
  { id: "motorway_jct",  label: "AC uvozi",       emoji: "🛣️", color: "#64748b", query: `[out:json][timeout:30];node["highway"="motorway_junction"](45.4,13.4,46.9,16.6);out;` },

  // ── Novi custom sloji (označi na karti) ──────────────────────────────────────
  { id: "beach",         label: "Plaže",          emoji: "🏖️", color: "#fbbf24", query: `[out:json][timeout:30];(node["natural"="beach"](45.4,13.4,46.9,16.6);way["natural"="beach"](45.4,13.4,46.9,16.6);relation["natural"="beach"](45.4,13.4,46.9,16.6););out center;` },
  { id: "geocache",      label: "Geocacher",      emoji: "🥾", color: "#84cc16", query: `[out:json][timeout:45];(node["geocache"](45.4,13.4,46.9,16.6);node["tourism"="information"]["information"="geocache"](45.4,13.4,46.9,16.6););out;` },
  { id: "racetrack",     label: "Dirkališča",      emoji: "🏁", color: "#ef4444", query: `[out:json][timeout:30];(way["highway"="raceway"](45.4,13.4,46.9,16.6);way["leisure"="track"]["sport"="motorsport"](45.4,13.4,46.9,16.6);way["leisure"="track"]["sport"="karting"](45.4,13.4,46.9,16.6);way["leisure"="track"]["sport"="motor_autocross"](45.4,13.4,46.9,16.6);way["sport"="motorsport"](45.4,13.4,46.9,16.6););out center;` },
  { id: "pitch",         label: "Šport. igrišča", emoji: "⚽", color: "#22c55e", query: `[out:json][timeout:45];(way["leisure"="pitch"](45.4,13.4,46.9,16.6);relation["leisure"="pitch"](45.4,13.4,46.9,16.6););out center;` },
  { id: "fitness",       label: "Outdoor fitnes",  emoji: "💪", color: "#f97316", query: `[out:json][timeout:30];(node["leisure"="fitness_station"](45.4,13.4,46.9,16.6);way["leisure"="fitness_station"](45.4,13.4,46.9,16.6););out center;` },
  { id: "toilets",       label: "Stranišča",      emoji: "🚻", color: "#64748b", query: `[out:json][timeout:30];(node["amenity"="toilets"](45.4,13.4,46.9,16.6);way["amenity"="toilets"](45.4,13.4,46.9,16.6););out center;` },
  { id: "transmitter",   label: "Oddajniki",      emoji: "📡", color: "#0ea5e9", query: `[out:json][timeout:30];(node["man_made"="communications_tower"](45.4,13.4,46.9,16.6);node["man_made"="tower"]["tower:type"="communication"](45.4,13.4,46.9,16.6);way["man_made"="tower"]["tower:type"="communication"](45.4,13.4,46.9,16.6);node["man_made"="mast"]["tower:type"="communication"](45.4,13.4,46.9,16.6););out center;` },
  { id: "speed_camera",   label: "Radarji",       emoji: "📷", color: "#dc2626", query: `[out:json][timeout:30];node["highway"="speed_camera"](45.4,13.4,46.9,16.6);out;` },
  { id: "post_office",   label: "Pošte",          emoji: "📮", color: "#8b5cf6", query: `[out:json][timeout:30];(node["amenity"="post_office"](45.4,13.4,46.9,16.6);way["amenity"="post_office"](45.4,13.4,46.9,16.6););out center;` },
  { id: "sex_shop",      label: "Erotika",        emoji: "💋", color: "#db2777", query: `[out:json][timeout:30];(node["shop"="erotic"](45.4,13.4,46.9,16.6);way["shop"="erotic"](45.4,13.4,46.9,16.6);node["shop"="adult"](45.4,13.4,46.9,16.6);way["shop"="adult"](45.4,13.4,46.9,16.6););out center;` },

  // ── Infrastruktura: predori, vijadukti, mostovi ──────────────────────────────
  { id: "tunnel",         label: "Predori",        emoji: "🚇", color: "#1e293b", query: `[out:json][timeout:45];(way["tunnel"="yes"]["highway"](45.4,13.4,46.9,16.6););out center;` },
  { id: "viaduct",        label: "Vijadukti",      emoji: "🌉", color: "#7c3aed", query: `[out:json][timeout:45];(way["bridge"="yes"]["highway"]["bridge:name"](45.4,13.4,46.9,16.6);way["man_made"="bridge"](45.4,13.4,46.9,16.6);way["bridge"="yes"]["highway"]["bridge:structure"="arch"](45.4,13.4,46.9,16.6););out center;` },
  { id: "motorway_tunnel", label: "AC predori",    emoji: "🕳️", color: "#0f172a", query: `[out:json][timeout:45];(way["highway"~"motorway|motorway_link|trunk|trunk_link"]["tunnel"="yes"](45.4,13.4,46.9,16.6););out center;` },
  { id: "motorway_bridge", label: "AC vijadukti",   emoji: "🏗️", color: "#5b21b6", query: `[out:json][timeout:45];(way["highway"~"motorway|motorway_link|trunk|trunk_link"]["bridge"="yes"](45.4,13.4,46.9,16.6););out center;` },

  // ── Ne-OSM viri (OpenChargeMap, Wikidata, Wikipedia) ────────────────────────
  { id: "ev_charging",     label: "Polnilnice",      emoji: "🔌", color: "#22c55e", _source: "openchargemap", query: "" },
  { id: "wd_castles",      label: "Gradovi (WD)",    emoji: "🏰", color: "#b45309", _source: "wikidata_castles", query: "" },
  { id: "wd_monuments",    label: "Spomeniki (WD)",  emoji: "🗿", color: "#92400e", _source: "wikidata_monuments", query: "" },
  { id: "wd_museums",      label: "Muzeji (WD)",     emoji: "🏛️", color: "#a855f7", _source: "wikidata_museums", query: "" },
  { id: "wiki_articles",   label: "Wikipedija",      emoji: "📖", color: "#3b82f6", _source: "wikipedia", query: "" },

];

// ── Municipalities (Občine) + place names ───────────────────────────────────
// bbox + ISO3166-2=SI-* keeps only the ~212 Slovenian municipalities. A bbox is used instead
// of area["ISO3166-1"="SI"] because the area lookup returns nothing on some Overpass mirrors.
export const MUNICIPALITY_QUERY = `[out:json][timeout:120];
relation["admin_level"="8"]["boundary"="administrative"]["ISO3166-2"~"^SI-"](45.4,13.3,46.9,16.7);
out geom;`;

export const PLACES_QUERY = `[out:json][timeout:30];node["place"~"town|village|hamlet"](45.4,13.3,46.9,16.7);out;`;

// ── Third development axis (3RO) — H8 Velenje → Slovenj Gradec ──────────────
export const H8_QUERY = `[out:json][timeout:25];
(
  way["highway"="construction"]["construction"="trunk"]["opening_date"="2029"](45.0,13.0,47.0,17.0);
  way["name"="H8"]["highway"="construction"](45.0,13.0,47.0,17.0);
);
out geom;`;

// ── Cave cadastre (Kataster jam) — public source file ───────────────────────
export const CAVES_SOURCE_URL =
  "https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json";

// ── Non-OSM sources ─────────────────────────────────────────────────────────
export const OPENCHARGEMAP_URL =
  "https://api.openchargemap.io/v3/poi/?output=json&countrycode=SI&maxresults=2000&compact=true";

export const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

export const WIKIDATA_QUERIES = {
  wd_castles: `
    SELECT ?item ?itemLabel ?lat ?lon WHERE {
      ?item wdt:P17 wd:Q215 .
      ?item wdt:P31/wdt:P279* wd:Q23413 .
      ?item p:P625 ?stmt . ?stmt psv:P625 ?node .
      ?node wikibase:geoLatitude ?lat . ?node wikibase:geoLongitude ?lon .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "sl,en" . }
    } LIMIT 500`,
  wd_monuments: `
    SELECT ?item ?itemLabel ?lat ?lon WHERE {
      ?item wdt:P17 wd:Q215 .
      ?item wdt:P1435 ?heritage .
      ?item p:P625 ?stmt . ?stmt psv:P625 ?node .
      ?node wikibase:geoLatitude ?lat . ?node wikibase:geoLongitude ?lon .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "sl,en" . }
    } LIMIT 1000`,
  wd_museums: `
    SELECT ?item ?itemLabel ?lat ?lon WHERE {
      ?item wdt:P17 wd:Q215 .
      ?item wdt:P31/wdt:P279* wd:Q33506 .
      ?item p:P625 ?stmt . ?stmt psv:P625 ?node .
      ?node wikibase:geoLatitude ?lat . ?node wikibase:geoLongitude ?lon .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "sl,en" . }
    } LIMIT 500`,
};

export const WIKIPEDIA_GEOSEARCH_URL =
  `https://sl.wikipedia.org/w/api.php?action=query&list=geosearch` +
  `&gsbbox=${SI_BBOX.minLat},${SI_BBOX.minLon}%7C${SI_BBOX.maxLat},${SI_BBOX.maxLon}` +
  `&gslimit=500&format=json&origin=*`;

// Bundled data file ids that are not plain POI categories
export const EXTRA_DATASETS = ["caves", "municipalities", "places", "third_dev_axis"];

// Every category that can be bundled as /data/<id>.json
export function bundledCategoryIds() {
  return CATEGORIES.filter(c => !c._caveDbLayer && !c._municipalityLayer).map(c => c.id);
}
