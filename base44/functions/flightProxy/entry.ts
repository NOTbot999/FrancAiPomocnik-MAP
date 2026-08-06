// Leti v realnem času — podatke pridobiva strežniško (brez CORS omejitve).
// ADS-B viri (adsb.lol / adsb.fi) blokirajo shared cloud IP-je (429/403), zato
// uporabljamo OpenSky Network, ki je občasno nestabilen (522/timeout) — zato
// ga poskusimo večkrat. Rezultat filtriramo na okolico Slovenije.
// Brez ključa; javni endpoint (deluje za vse uporabnike, vključno z gosti).

const OPENSKY_API = "https://opensky-network.org/api/states/all";
// Anonimni OpenSky bbox filter pogosto ignorira, zato še filtriramo strežniško.
const SLO_BBOX = { lamin: 45.0, lomin: 12.8, lamax: 47.0, lomax: 17.2 };
const UA = "FrancAiMap/1.0 (Slovenia flight tracker; contact: franc-ai)";

function parseOpensky(data, bbox) {
  if (!data || !data.states) throw new Error("Brez podatkov (states)");
  return data.states
    .filter((s) => {
      const lon = s[5];
      const lat = s[6];
      if (lon == null || lat == null) return false;
      return lat >= bbox.lamin && lat <= bbox.lamax && lon >= bbox.lomin && lon <= bbox.lomax;
    })
    .map((s) => ({
      icao24: s[0],
      callsign: (s[1] || "").trim() || "—",
      country: s[2] || "",
      lon: s[5],
      lat: s[6],
      altitude: s[7] ?? s[13] ?? null,
      onGround: !!s[8],
      velocity: s[9] ?? null,
      heading: s[10] ?? 0,
    }));
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
    const { lamin, lomin, lamax, lomax } = SLO_BBOX;
    const url = `${OPENSKY_API}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    // OpenSky je občasno nestabilen (522/timeout) — krajši timeout, več poskusov.
    let lastErr = "neznan";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await fetchWithTimeout(url, 5000);
        const flights = parseOpensky(data, SLO_BBOX);
        return Response.json({ flights, source: "opensky", count: flights.length, at: Date.now() });
      } catch (e) {
        lastErr = e.message;
        if (attempt < 1) await new Promise((r) => setTimeout(r, 800));
      }
    }

    return Response.json(
      { error: "Podatki o letih trenutno niso na voljo — brezplačni viri blokirajo strežnik. Potreben OpenSky račun (OAuth2).", details: lastErr },
      { status: 502 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}