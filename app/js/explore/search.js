// Global search: coordinates (WGS84 / D96), local POIs + drawings, Nominatim geocoder
import { map } from "../map/map.js";
import { nominatim } from "../services/external.js";
import { esc, debounce, parseCoords, $, fmtLatLng } from "../shared/util.js";
import { getLoadedFeatures, getCaves } from "./poi.js";
import { getDrawings } from "../create/draw.js";
import { pointPopup } from "./popup.js";

const TYPE_EMOJI = { city: "🏙️", town: "🏘️", village: "🏡", hamlet: "🏠", peak: "⛰️", river: "🌊", lake: "💧", water: "💧", house: "🏠", residential: "🛣️", road: "🛣️", castle: "🏰", church: "⛪", restaurant: "🍽️", hotel: "🏨", school: "🏫", station: "🚉", forest: "🌲", wood: "🌲", administrative: "🗺️" };

export async function geocode(q, limit = 8) {
  const res = await nominatim.search(q, limit);
  return (res || []).map((r) => {
    const a = r.address || {};
    const name = r.name || r.display_name.split(",")[0];
    const place = a.village || a.town || a.city || a.hamlet || a.municipality || "";
    return {
      lat: +r.lat, lng: +r.lon, title: name,
      sub: [place !== name ? place : "", a.county, a.country_code !== "si" ? a.country : ""].filter(Boolean).join(", ") || r.display_name,
      emoji: TYPE_EMOJI[r.type] || TYPE_EMOJI[r.class] || "📍",
      bbox: r.boundingbox?.map(Number),
    };
  });
}

export function localMatches(q, limit = 8) {
  const ql = q.toLowerCase();
  const out = [];
  for (const f of getDrawings()) {
    if (f.name.toLowerCase().includes(ql)) {
      const ll = f.type === "marker" ? f.coords : f.coords[0];
      out.push({ lat: ll[0], lng: ll[1], title: f.name, sub: "Moje risbe", emoji: "✏️" });
    }
  }
  for (const f of getLoadedFeatures()) {
    if (out.length >= limit * 3) break;
    if (f.id?.startsWith("cave/")) continue; // caves are searched below (always, even when hidden)
    if (f.name.toLowerCase().includes(ql)) out.push({ lat: f.lat, lng: f.lng, title: f.name, sub: f.catLabel, emoji: f.emoji, tags: f.tags });
  }
  let nc = 0;
  for (const c of getCaves()) {
    if (nc >= limit * 2) break;
    if (c.name.toLowerCase().includes(ql)) {
      nc++;
      out.push({ lat: c.lat, lng: c.lng, title: c.name, sub: `Jama · kataster št. ${c.ref}${c.len ? ` · ${c.len} m` : ""}`, emoji: "🕳️", tags: c.tags });
    }
  }
  out.sort((a, b) => (b.title.toLowerCase().startsWith(ql) ? 1 : 0) - (a.title.toLowerCase().startsWith(ql) ? 1 : 0));
  return out.slice(0, limit);
}

let searchMarker = null;
export function goTo(r) {
  if (r.bbox && r.bbox[0] !== r.bbox[1]) {
    const [s, n, w, e] = r.bbox;
    map.flyToBounds([[s, w], [n, e]], { maxZoom: 16, duration: 0.8 });
  } else map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  searchMarker && map.removeLayer(searchMarker);
  searchMarker = L.circleMarker([r.lat, r.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#e11d48", fillOpacity: 1, pane: "top" }).addTo(map);
  searchMarker.on("click", () => pointPopup([r.lat, r.lng], { title: `${r.emoji || "📍"} ${r.title}`, subtitle: r.sub, tags: r.tags || {} }));
  map.once("movestart", () => {}); // keep marker until next search
  setTimeout(() => pointPopup([r.lat, r.lng], { title: `${r.emoji || "📍"} ${r.title}`, subtitle: r.sub, tags: r.tags || {} }), 850);
}

export function initSearch() {
  const input = $("#search-input"), box = $("#search-results");
  let items = [], active = -1, seq = 0;

  const render = (groups, loading) => {
    items = groups.flatMap((g) => g.items);
    if (!items.length && !loading) { box.innerHTML = `<div class="dd-empty">Ni zadetkov.</div>`; box.classList.remove("hidden"); return; }
    let i = 0;
    box.innerHTML = groups.filter((g) => g.items.length).map((g) => `<div class="dd-group">${g.title}</div>` + g.items.map((r) => `
      <div class="dd-item ${i === active ? "active" : ""}" data-i="${i++}"><span class="em">${r.emoji || "📍"}</span>
        <div style="min-width:0"><div class="t ellipsis">${esc(r.title)}</div><div class="s">${esc(r.sub || "")}</div></div></div>`).join("")).join("")
      + (loading ? `<div class="dd-empty"><span class="spinner"></span> Iščem…</div>` : "");
    box.classList.remove("hidden");
  };

  const run = debounce(async (q) => {
    const my = ++seq;
    const coords = parseCoords(q);
    const groups = [];
    if (coords) groups.push({ title: "Koordinate", items: [{ lat: coords[0], lng: coords[1], title: fmtLatLng(coords[0], coords[1]), sub: "Pojdi na koordinate", emoji: "🎯" }] });
    groups.push({ title: "Na karti", items: localMatches(q, 6) });
    active = 0;
    render(groups, true);
    try {
      const geo = await geocode(q);
      if (my !== seq) return;
      groups.push({ title: "Kraji in naslovi", items: geo });
    } catch {
      if (my !== seq) return;
      groups.push({ title: "Kraji in naslovi (brez povezave)", items: [] });
    }
    render(groups, false);
  }, 350);

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (q.length < 2) { box.classList.add("hidden"); seq++; return; }
    run(q);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      box.querySelectorAll(".dd-item").forEach((el) => el.classList.toggle("active", +el.dataset.i === active));
      box.querySelector(".dd-item.active")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const r = items[active] || items[0];
      if (r) { goTo(r); box.classList.add("hidden"); input.blur(); }
    } else if (e.key === "Escape") { box.classList.add("hidden"); input.blur(); }
  });
  input.addEventListener("focus", () => { if (input.value.trim().length >= 2 && box.innerHTML) box.classList.remove("hidden"); });
  box.addEventListener("mousedown", (e) => {
    const it = e.target.closest(".dd-item");
    if (!it) return;
    e.preventDefault();
    goTo(items[+it.dataset.i]);
    box.classList.add("hidden");
    input.blur();
  });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#search")) box.classList.add("hidden"); });
}
