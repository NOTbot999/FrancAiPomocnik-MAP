import React, { useState, useEffect, useRef } from "react";
import { Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";

// Leti v realnem času — ADS-B viri (adsb.lol / adsb.fi) nimajo CORS glav, zato
// podatke pridobivamo strežniško prek backend funkcije flightProxy (brez ključa,
// deluje za vse uporabnike vključno z gosti). Osvežitev vsakih 90 s.

const REFRESH_MS = 90000;

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

  const fetchFlights = async () => {
    setLoading(true);
    try {
      const resp = await base44.functions.invoke("flightProxy", {});
      const data = resp.data;
      if (!data || !Array.isArray(data.flights)) {
        throw new Error(data?.error || "Brez podatkov");
      }
      setFlights(data.flights);
      setLastUpdate(new Date());
      setError(null);
      setStale(false);
    } catch (e) {
      // Obdržimo zadnji uspešen snapshot (označen kot zastarel) namesto prazne karte.
      setStale(true);
      const msg = e?.response?.data?.error || e?.message || "Napaka pri pridobivanju letov";
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
      {flights.filter(f => f && Number.isFinite(f.lat) && Number.isFinite(f.lon)).map((f, i) => (
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
                Vir: ADS-B (adsb.lol / adsb.fi)
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