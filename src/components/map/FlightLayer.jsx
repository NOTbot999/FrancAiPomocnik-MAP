import React, { useState, useEffect, useRef } from "react";
import { Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";

// Leti v realnem času — brezplačni odprtokodni ADS-B viri (adsb.lol / adsb.fi),
// združljivi z ADSBexchange v2 API. Brez ključa; primarni poskus je neposredni
// klic (CORS). Če ta spodrsne, pademo na OpenSky Network skozi proste
// CORS proxyje (drugačen vir podatkov = večja zanesljivost).
//
// Odgovor: { ac: [ { hex, flight, lat, lon, alt_baro, gs, track, ... } ] }
//   alt_baro: število (čevlji) ali "ground"
//   gs:      hitrost v vozlih (knots)
//   track:   smer v stopinjah

// Slovenija + okolica: center ~46.1/15.05, polmer 250 NM pokrije celo državo.
const CENTER = { lat: 46.1, lon: 15.05, dist: 250 };
const ADSB_SOURCES = [
  `https://api.adsb.lol/v2/lat/${CENTER.lat}/lon/${CENTER.lon}/dist/${CENTER.dist}`,
  `https://opendata.adsb.fi/api/v3/lat/${CENTER.lat}/lon/${CENTER.lon}/dist/${CENTER.dist}`,
];

// OpenSky (rezerva) — API ne pošilja CORS glav, zato skozi proxyje.
const OPENSKY_API = "https://opensky-network.org/api/states/all";
const SLO_BBOX = { lamin: 45.3, lomin: 13.3, lamax: 46.9, lomax: 16.8 };
const OPENSKY_PROXIES = [
  { url: (apiUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`, parse: (data) => data },
  { url: (apiUrl) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(apiUrl)}`, parse: (data) => data },
  { url: (apiUrl) => `https://cors.eu.org/${apiUrl}`, parse: (data) => data },
];

const REFRESH_MS = 90000;
const KNOTS_TO_MS = 0.514444;
const FT_TO_M = 0.3048;

function parseAdsb(data) {
  if (!data || !Array.isArray(data.ac)) throw new Error("Brez podatkov");
  return data.ac
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({
      icao24: s.hex,
      callsign: (s.flight || "").trim() || "—",
      country: "",
      lon: s.lon,
      lat: s.lat,
      altitude: typeof s.alt_baro === "number" ? s.alt_baro * FT_TO_M : null,
      onGround: s.alt_baro === "ground",
      velocity: s.gs != null ? s.gs * KNOTS_TO_MS : null,
      heading: s.track ?? 0,
    }));
}

function parseOpensky(data) {
  if (!data || !data.states) throw new Error("Brez podatkov");
  return data.states
    .filter((s) => s[5] != null && s[6] != null)
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

function makePlaneIcon(heading, onGround, opacity) {
  const color = onGround ? "#94a3b8" : "#2563eb";
  const rot = heading || 0;
  return L.divIcon({
    className: "",
    html: `<div style="opacity:${opacity};position:relative;width:19px;height:19px">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45)"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(${rot}deg)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white" stroke="rgba(0,0,0,0.25)" stroke-width="0.5">
          <path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/>
        </svg>
      </div>
    </div>`,
    iconSize: [19, 19],
    iconAnchor: [9.5, 9.5],
  });
}

export default function FlightLayer({ opacity = 0.9 }) {
  const [flights, setFlights] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const timerRef = useRef(null);
  const flightsRef = useRef([]);

  useEffect(() => { flightsRef.current = flights; }, [flights]);

  const fetchWithTimeout = (url, ms = 12000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .finally(() => clearTimeout(t));
  };

  const fetchFlights = async () => {
    setLoading(true);
    try {
      // 1) Neposredni ADS-B viri (CORS) — rasamo oba.
      let parsed = null;
      try {
        const data = await Promise.any(ADSB_SOURCES.map((u) => fetchWithTimeout(u, 12000)));
        parsed = parseAdsb(data);
      } catch (e) {
        // 2) Rezerva: OpenSky skozi proxyje.
        const { lamin, lomin, lamax, lomax } = SLO_BBOX;
        const apiUrl = `${OPENSKY_API}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        const data = await Promise.any(
          OPENSKY_PROXIES.map(({ url: makeUrl, parse }) =>
            fetchWithTimeout(makeUrl(apiUrl), 15000).then(parse)
          )
        );
        parsed = parseOpensky(data);
      }
      setFlights(parsed);
      setLastUpdate(new Date());
      setError(null);
      setStale(false);
    } catch (e) {
      // Obdržimo zadnji uspešen snapshot (označen kot zastarel) namesto prazne karte.
      setStale(true);
      const msg = e instanceof AggregateError ? "Vsi viri letov nedelujoči" : (e.message || "Napaka");
      if (flightsRef.current.length === 0) setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlights();
    timerRef.current = setInterval(fetchFlights, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <>
      {error && (
        <div className="leaflet-control" style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, background: "rgba(239,68,68,0.95)", color: "white", fontSize: 11, padding: "4px 10px", borderRadius: 8, pointerEvents: "none" }}>
          ✈ {error}
        </div>
      )}
      {!error && stale && flights.length > 0 && (
        <div className="leaflet-control" style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, background: "rgba(234,179,8,0.95)", color: "white", fontSize: 11, padding: "4px 10px", borderRadius: 8, pointerEvents: "none" }}>
          ✈ Posodobitev neuspešna — prikazan zadnji snapshot
        </div>
      )}
      {loading && flights.length === 0 && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, background: "rgba(15,23,42,0.85)", color: "white", fontSize: 11, padding: "4px 10px", borderRadius: 8, pointerEvents: "none" }}>
          ✈ Nalagam lete…
        </div>
      )}
      {flights.map((f, i) => (
        <Marker
          key={`${f.icao24}-${i}`}
          position={[f.lat, f.lon]}
          icon={makePlaneIcon(f.heading, f.onGround, opacity)}
          zIndexOffset={500}
        >
          <Tooltip direction="top" offset={[0, -12]} opacity={1}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>✈ {f.callsign}</span>
          </Tooltip>
          <Popup>
            <div style={{ minWidth: 180, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>✈ {f.callsign}</div>
              <div style={{ color: "#64748b", fontSize: 10, marginBottom: 6 }}>
                ICAO: {f.icao24}{f.country ? " · " + f.country : ""}
              </div>
              <div>🏔 Višina: {f.altitude != null ? Math.round(f.altitude) + " m" : "—"}</div>
              <div>💨 Hitrost: {f.velocity != null ? Math.round(f.velocity * 3.6) + " km/h" : "—"}</div>
              <div>🧭 Smer: {Math.round(f.heading)}°</div>
              <div>{f.onGround ? "🟢 Na tleh" : "🔵 V zraku"}</div>
              <div style={{ color: "#94a3b8", fontSize: 9, marginTop: 4 }}>
                Vir: adsb.lol / adsb.fi
              </div>
              {lastUpdate && (
                <div style={{ color: "#94a3b8", fontSize: 9 }}>
                  Osveženo: {lastUpdate.toLocaleTimeString("sl-SI")}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}