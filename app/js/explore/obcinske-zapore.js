// obcinskeZapore — PRAZEN modul za zapore občinskih cest.
// NAP Slovenija nima posebnega nabora za občinske ceste: prometni dogodki vsebujejo lokalne ceste le,
// če so sporočeni v sistem. Sem se kasneje dodajajo viri posameznih občin (spletne strani, RSS, GeoJSON).
// Zaenkrat se NE polni in ni vklopljen kot sloj.
//
// Enoten format (GeoJSON Feature):
//   { type: "Feature",
//     geometry: Point | LineString | Polygon (WGS84),
//     properties: { naslov, opis, od, do, vir, url } }   // od/do = ISO datum (YYYY-MM-DD ali z uro)

/** Seznam virov občin: { id, obcina, url, parse: async (odgovor) → Feature[] } — trenutno prazen. */
export const OBCINSKE_ZAPORE_VIRI = [];

/** Sestavi enoten zapis zapore. */
export function zapora({ naslov, opis = "", od = null, do: doDatum = null, vir, url = null, geometry }) {
  return { type: "Feature", geometry, properties: { naslov, opis, od, do: doDatum, vir, url } };
}

/** Vse zapore iz vseh virov — trenutno vedno prazna zbirka. */
export async function naloziObcinskeZapore() {
  const features = [];
  for (const v of OBCINSKE_ZAPORE_VIRI) {
    try { features.push(...(await v.parse(await (await fetch(v.url)).text()))); } catch (e) { console.warn("Občinske zapore", v.id, e); }
  }
  return { type: "FeatureCollection", features };
}
