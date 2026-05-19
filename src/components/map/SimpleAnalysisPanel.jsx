/**
 * SimpleAnalysisPanel — Analiza v1
 * Hitra analiza z OSM podatki + osnoven LLM opis. Brez LIDAR/Claude.
 */
import React, { useState } from "react";
import { Loader2, MapPin, Crosshair, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { OVERLAY_CATEGORIES } from "./layerConfig";

async function fetchOverpassData(minLat, minLng, maxLat, maxLng) {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:20];
(
  node["historic"](${bbox});
  node["tourism"](${bbox});
  node["natural"~"peak|spring|waterfall|cave_entrance"](${bbox});
  node["man_made"~"bunker|tower"](${bbox});
  node["military"](${bbox});
  node["ruins"](${bbox});
  way["historic"](${bbox});
  way["ruins"](${bbox});
  way["military"](${bbox});
  relation["route"~"hiking|bicycle|foot"](${bbox});
);
out center tags 100;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();
  return data.elements || [];
}

function overpassToText(elements) {
  if (!elements.length) return "Ni podatkov v OpenStreetMap za to območje.";
  return elements.slice(0, 60).map(el => {
    const t = el.tags || {};
    const lat = el.lat || el.center?.lat;
    const lng = el.lon || el.center?.lon;
    const name = t.name || t["name:sl"] || "";
    const type = t.historic || t.tourism || t.natural || t.man_made || t.military || t.ruins || el.type || "";
    return `- ${name || "(brez imena)"} [${type}] ${lat?.toFixed(4)}, ${lng?.toFixed(4)}`;
  }).join("\n");
}

const AREA_OPTIONS = [
  { label: "500 m", latDelta: 0.00225, lngDelta: 0.0036, km: 0.5 },
  { label: "1 km", latDelta: 0.0045, lngDelta: 0.0072, km: 1 },
  { label: "3 km", latDelta: 0.0135, lngDelta: 0.0215, km: 3 },
  { label: "5 km", latDelta: 0.0225, lngDelta: 0.036, km: 5 },
  { label: "10 km", latDelta: 0.045, lngDelta: 0.072, km: 10 },
];

export default function SimpleAnalysisPanel({ mapCenter, pinnedLocation, onRequestPin, onAddCustomLayer, theme }) {
  const [area, setArea] = useState(AREA_OPTIONS[1]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [customLayerSuggestions, setCustomLayerSuggestions] = useState([]);

  const lat = pinnedLocation?.[0] ?? mapCenter?.[0];
  const lng = pinnedLocation?.[1] ?? mapCenter?.[1];

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    setCustomLayerSuggestions([]);

    const minLat = lat - area.latDelta, maxLat = lat + area.latDelta;
    const minLng = lng - area.lngDelta, maxLng = lng + area.lngDelta;

    let placeName = "";
    let osmElements = [];
    try {
      const [geo, osm] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=sl`).then(r => r.json()),
        fetchOverpassData(minLat, minLng, maxLat, maxLng),
      ]);
      const a = geo.address || {};
      placeName = [a.village || a.town || a.city || a.hamlet || "", a.municipality || ""].filter(Boolean).join(", ");
      osmElements = osm;
    } catch {}

    const osmText = overpassToText(osmElements);

    const prompt = `Si GIS asistent za Slovenijo. VEDNO odgovarjaj v SLOVENŠČINI.
Območje: "${placeName || `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}", polmer ${area.km} km

OSM podatki:
${osmText}

1. V 3-5 stavkih opiši kaj je v tem območju (narava, zanimivosti, infrastruktura).
2. Naštej do 5 najpomembnejših točk z imenom in tipom.
3. Predlagaj 1-2 custom layer-ja za vizualizacijo na karti (poti, reke, zanimivosti) v formatu:
<custom_layers>[{"name":"Naziv","color":"#hexcolor","features":[{"type":"LineString","coords":[[lat,lng],[lat,lng]]}]}]</custom_layers>
Koordinate moraj biti realne za to območje (${lat?.toFixed(3)}, ${lng?.toFixed(3)}).`;

    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    const text = typeof res === "string" ? res : res?.content || "";

    // Parse custom layers
    const clMatch = text.match(/<custom_layers>(.*?)<\/custom_layers>/s);
    let cleanText = text.replace(/<custom_layers>.*?<\/custom_layers>/s, "").trim();
    if (clMatch) {
      try {
        const layers = JSON.parse(clMatch[1]);
        setCustomLayerSuggestions(Array.isArray(layers) ? layers : [layers]);
      } catch {}
    }

    setResult(cleanText);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {/* Location */}
      <div className="rounded-xl p-2.5 text-left" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}20` }}>
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-1.5" style={{ color: theme.panelText }}>Lokacija</p>
        {pinnedLocation ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-400">Označena točka</p>
              <p className="text-[10px] font-mono opacity-60" style={{ color: theme.panelText }}>{pinnedLocation[0].toFixed(5)}, {pinnedLocation[1].toFixed(5)}</p>
            </div>
            <button onClick={() => onRequestPin(null)} className="text-[10px] opacity-50 hover:opacity-80" style={{ color: theme.panelText }}>Počisti</button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono opacity-50" style={{ color: theme.panelText }}>{lat?.toFixed(5)}, {lng?.toFixed(5)}</p>
            <button
              onClick={() => onRequestPin && onRequestPin("pick")}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{ backgroundColor: `${theme.accentColor || "#10b981"}20`, color: theme.accentColor || "#10b981", border: `1px solid ${theme.accentColor || "#10b981"}40` }}
            >
              <Crosshair className="w-3 h-3" /> Označi točko
            </button>
          </div>
        )}
      </div>

      {/* Area */}
      <div className="flex gap-1">
        {AREA_OPTIONS.map(opt => (
          <button key={opt.label} onClick={() => setArea(opt)}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
            style={area.label === opt.label
              ? { backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText }
              : { backgroundColor: `${theme.panelText}10`, color: theme.panelText, opacity: 0.6 }
            }
          >{opt.label}</button>
        ))}
      </div>

      <button onClick={analyze} disabled={loading || !lat}
        className="w-full py-2.5 font-semibold rounded-xl text-white transition disabled:opacity-50"
        style={{ background: "linear-gradient(to right, #10b981, #3b82f6)" }}
      >
        {loading ? "Analiziram..." : "⚡ Hitra analiza"}
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <p className="text-xs opacity-60" style={{ color: theme.panelText }}>Pridobivam OSM podatke...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <div className="prose prose-xs max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="text-xs mb-1.5 leading-relaxed opacity-80" style={{ color: theme.panelText }}>{children}</p>,
                ul: ({ children }) => <ul className="text-xs ml-3 space-y-0.5 mb-1.5 opacity-80 list-disc" style={{ color: theme.panelText }}>{children}</ul>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold" style={{ color: theme.panelText }}>{children}</strong>,
                h2: ({ children }) => <h2 className="text-xs font-bold mt-2 mb-1" style={{ color: theme.panelText }}>{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold mt-1.5 mb-0.5" style={{ color: theme.panelText }}>{children}</h3>,
              }}
            >{result}</ReactMarkdown>
          </div>

          {/* Custom layer suggestions */}
          {customLayerSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: theme.panelText }}>🎨 Predlagani custom sloji</p>
              {customLayerSuggestions.map((layer, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: `${theme.panelText}10`, border: `1px solid ${theme.panelText}18` }}>
                  <div className="w-3 h-3 rounded-full shrink-0 border border-white/30" style={{ backgroundColor: layer.color || "#e11d48" }} />
                  <span className="text-xs flex-1" style={{ color: theme.panelText }}>{layer.name}</span>
                  <span className="text-[9px] opacity-40" style={{ color: theme.panelText }}>{layer.features?.length || 0} feature-jev</span>
                  {onAddCustomLayer && (
                    <button
                      onClick={() => onAddCustomLayer({ ...layer, id: `custom_${Date.now()}_${i}` })}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition"
                      style={{ backgroundColor: `${theme.accentColor || "#10b981"}25`, color: theme.accentColor || "#10b981" }}
                    >
                      + Dodaj
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { setResult(null); setCustomLayerSuggestions([]); }}
            className="w-full py-1.5 text-[10px] font-medium rounded-xl transition opacity-40 hover:opacity-70"
            style={{ border: `1px solid ${theme.panelText}33`, color: theme.panelText }}>
            Počisti
          </button>
        </div>
      )}
    </div>
  );
}