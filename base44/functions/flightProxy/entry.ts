// Leti v realnem času — strežniško pridobivanje ADS-B podatkov (brez CORS / brez ključa).
// adsb.lol ne pošilja CORS glav (brskalnik ga ne more klicati neposredno), zato
// podatke pridobivamo tukaj in vrnemo filtrirano za okolico Slovenije.
// Enote: adsb.lol uporablja čevlje (ft) in vozle (kt); klient pričakuje metre in m/s.
// Osvežitev (klient): vsakih 90 s — adsb.lol je rad prijaznemu IP-ju.

const ADSB_LOL = "https://api.adsb.lol/v2/lat/46.15/lon/14.99/dist/200"; // 200 NM okrog Slovenije
const SLO_BBOX = { lamin: 45.0, lomin: 12.8, lamax: 47.0, lomax: 17.2 };
const UA = "FrancAiMap/1.0 (Slovenia flight tracker; contact: franc-ai)";

function parseAdsbLol(data, bbox) {
  if (!data || !Array.isArray(data.ac)) throw new Error("Brez podatkov (ac)");
  return data.ac
    .filter((a) => {
      if (a == null || a.lat == null || a.lon == null) return false;
      return a.lat >= bbox.lamin && a.lat <= bbox.lamax && a.lon >= bbox.lomin && a.lon <= bbox.lomax;
    })
    .map((a) => {
      const onGround = a.alt_baro === "ground" || a.alt_baro == null;
      const altFt = onGround ? 0 : (typeof a.alt_baro === "number" ? a.alt_baro : null);
      return {
        icao24: a.hex || "—",
        callsign: (a.flight || "").trim() || (a.hex || "—"),
        country: a.t || "",
        reg: a.r || "",
        lat: a.lat,
        lon: a.lon,
        altitude: altFt != null ? Math.round(altFt * 0.3048) : null, // ft -> m
        onGround,
        velocity: a.gs != null ? +(a.gs * 0.514444).toFixed(1) : null, // kt -> m/s
        heading: a.track ?? a.mag_heading ?? 0,
      };
    });
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export default async function (req) {
  try {
    let lastErr = "neznan";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await fetchWithTimeout(ADSB_LOL, 6000);
        const flights = parseAdsbLol(data, SLO_BBOX);
        return Response.json({ flights, source: "adsb.lol", count: flights.length, at: Date.now() });
      } catch (e) {
        lastErr = e.message;
        if (attempt < 1) await new Promise((r) => setTimeout(r, 800));
      }
    }

    return Response.json(
      { error: "Podatki o letih trenutno niso na voljo (adsb.lol).", details: lastErr },
      { status: 502 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}