import React, { useState, useEffect, useRef } from "react";
import { Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";

// Leti v realnem času — OpenSky Network (brezplačna alternativa Flightradar24,
// ki zahteva plačljivo komercialno licenco).
// API: https://opensky-network.org/api/states/all?lamin=..&lomin=..&lamax=..&lomax=..
//
// State vector indeksi v polju:
//  [0] icao24  [1] callsign  [2] origin_country
//  [5] lon  [6] lat  [7] baro_altitude  [8] on_ground  [9] velocity(m/s)
//  [10] true_track(heading°)  [11] vertical_rate  [13] geo_altitude

const OPENSKY_API = "https://opensky-network.org/api/states/all";
const CORS_PROXIES = [
  {
    url: (apiUrl) => `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`,
    parse: (data) => JSON.parse(data.contents),
  },
  {
    url: (apiUrl) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(apiUrl)}`,
    parse: (data) => data,
  },
  {
    url: (apiUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`,
    parse: (data) => data,
  },
];
const SLO_BBOX = { lamin: 45.3, lomin: 13.3, lamax: 46.9, lomax: 16.8 };
const REFRESH_MS = 60000;

function makePlaneIcon(heading, onGround, opacity) {
  const color = onGround ? "#94a3b8" : "#2563eb";
  const rot = heading || 0;
  return L.divIcon({
    className: "",
    html: `<div style="opacity:${opacity};transform:rotate(${rot}deg);display:flex;align-items:center;justify-content:center;width:28px;height:28px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">
        <path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function FlightLayer({ opacity = 0.9 }) {
  const [flights, setFlights] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const fetchFlights = async () => {
    setLoading(true);
    try {
      const { lamin, lomin, lamax, lomax } = SLO_BBOX;
      const apiUrl = `${OPENSKY_API}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
      const attempts = CORS_PROXIES.map(({ url: makeUrl, parse }) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        return fetch(makeUrl(apiUrl), { signal: ctrl.signal })
          .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
          .then(data => parse(data))
          .finally(() => clearTimeout(t));
      });
      const data = await Promise.any(attempts);
      if (!data || !data.states) throw new Error("Brez podatkov");
      const states = data.states;
      const parsed = states
        .filter(s => s[5] != null && s[6] != null)
        .map(s => ({
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
      setFlights(parsed);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      const msg = e instanceof AggregateError
        ? "Proxyji nedelujoči"
        : (e.name === "AbortError" ? "Časovna omejitev" : (e.message || "Napaka"));
      setError(msg);
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
                ICAO: {f.icao24} · {f.country}
              </div>
              <div>🏔 Višina: {f.altitude != null ? Math.round(f.altitude) + " m" : "—"}</div>
              <div>💨 Hitrost: {f.velocity != null ? Math.round(f.velocity * 3.6) + " km/h" : "—"}</div>
              <div>🧭 Smer: {Math.round(f.heading)}°</div>
              <div>{f.onGround ? "🟢 Na tleh" : "🔵 V zraku"}</div>
              {lastUpdate && (
                <div style={{ color: "#94a3b8", fontSize: 9, marginTop: 4 }}>
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