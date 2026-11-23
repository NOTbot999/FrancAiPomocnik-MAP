// "Promet v živo" — live traffic from NAP Slovenija (nap.si), through the app's own backend proxy
// (/api/nap/data?sloj=<key>; desktop app.py + nap_proxy.py, Android NapProxy.java). The app never
// sees NAP credentials. Dataset configuration: web/data/nap_datasets.json (codes editable in the panel).
//   • every GeoJSON dataset = its own layer (Sloji → Promet v živo), refreshed by its own interval,
//     only while the layer is on and the window is visible
//   • last good response stored locally → shown offline with "Podatki z dne …, brez povezave"
//   • "Prometno poročilo" (JSON text) is shown in the Promet panel and offered to the AI assistant
import { map, toggleOverlay } from "../map/map.js";
import { api, store, IS_WEB } from "../services/api.js";
import { esc, toast } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { setLiveStatus, removeLiveStatus, fmtTime } from "../map/livestatus.js";

const ATTR = "Promet: NAP Slovenija (CC BY-SA 4.0)";
const WEB_NOTE = "Promet v živo deluje v aplikaciji za Windows in Android — prijava v NAP potrebuje strežnik (backend proxy), ki ga spletna stran nima.";
let napStatus = null;            // from /api/nap/status
const sampleLogged = new Set();
const lastOk = {};               // key → { ts, data, offline, error }
let report = null;               // { ts, data, offline, error }

export async function loadNapStatus(force = false) {
  if (napStatus && !force) return napStatus;
  if (IS_WEB) { napStatus = { web: true, configured: false, datasets: {} }; return napStatus; }
  try { napStatus = await api("/api/nap/status"); } catch (e) { napStatus = { error: e.message, datasets: {} }; }
  return napStatus;
}

// one fetch through the proxy; falls back to the stored copy
async function getDataset(key) {
  const cacheKey = `nap_${key}`;
  try {
    if (IS_WEB) throw Object.assign(new Error(WEB_NOTE), { status: 0 });
    const data = await api(`/api/nap/data?sloj=${encodeURIComponent(key)}`);
    const rec = { ts: Date.now(), data };
    store.set(cacheKey, rec, 0);
    if (!sampleLogged.has(key)) {           // field names aren't known yet → show one example
      sampleLogged.add(key);
      const f = data?.features?.[0];
      console.info(`NAP »${key}«: ${data?.features?.length ?? "?"} featurejev; primer:`, f ? JSON.parse(JSON.stringify(f)) : data);
    }
    return { ...rec, offline: false, error: null };
  } catch (e) {
    const saved = await store.get(cacheKey, null);
    return { ts: saved?.ts || null, data: saved?.data || null, offline: !!saved, error: e.message };
  }
}

// ── styling (event types get their own colours once the NAP field names are known) ──
export function stilSloja(feature) {   // eslint-disable-line no-unused-vars
  return { color: "#475569", fillColor: "#64748b", weight: 4, opacity: 0.9, fillOpacity: 0.85 };
}

const IMG_RE = /^https?:\/\/\S+\.(jpe?g|png|gif|webp)(\?\S*)?$/i;
function popupHtml(name, props) {
  const rows = [], imgs = [];
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (typeof v === "string" && IMG_RE.test(v)) imgs.push(v);
    rows.push(`<tr><th>${esc(k)}</th><td>${esc(s.length > 600 ? s.slice(0, 600) + " …" : s)}</td></tr>`);
  }
  return `<div class="pop stack st-pop" style="min-width:240px;max-width:340px">
    <b>🚦 ${esc(name)}</b>
    ${imgs.map((u) => `<img class="nap-img" src="${esc(u)}" alt="Slika kamere" loading="lazy">`).join("")}
    <div class="st-all"><table>${rows.join("") || '<tr><td class="muted">Ni podatkov.</td></tr>'}</table></div>
    <div class="small muted">${ATTR}</div></div>`;
}

function statusRow(key, ime, rec, configured) {
  setLiveStatus(`nap_${key}`, {
    label: `🚦 ${ime}`,
    time: rec?.ts || null,
    note: !configured ? "ni nastavljeno — vpiši kodo nabora (panel Promet)" : rec?.offline ? `Podatki z dne ${fmtTime(rec.ts)}, brez povezave` : "",
    warn: rec?.error && !rec?.offline ? [rec.error] : rec?.offline && rec?.error ? [rec.error] : [],
    onRefresh: configured ? () => layers.get(key)?._refresh(true) : null,
  });
}

const layers = new Map();   // key → active layer
function napLayer(cfg, opacity) {
  const key = cfg.dataset;
  const g = L.featureGroup();
  let timer = null, op = opacity;
  g.getAttribution = () => ATTR;
  const draw = (data) => {
    g.clearLayers();
    if (!data) return;
    const gj = L.geoJSON(data, {
      pane: "vectors",
      style: (f) => ({ ...stilSloja(f), opacity: op }),
      pointToLayer: (f, ll) => L.circleMarker(ll, { ...stilSloja(f), radius: 7, color: "#fff", weight: 2, fillOpacity: op, pane: "top" }),
      onEachFeature: (f, l) => l.bindPopup(() => popupHtml(cfg.name, f.properties), { maxWidth: 360 }),
    });
    g.addLayer(gj);
  };
  g._refresh = async (manual = false) => {
    const st = await loadNapStatus();
    const ds = st.datasets?.[key];
    const configured = !IS_WEB && !!ds?.configured;
    if (!configured) {
      const saved = await store.get(`nap_${key}`, null);
      if (saved) draw(saved.data);
      statusRow(key, cfg.name, IS_WEB ? { error: WEB_NOTE } : null, IS_WEB ? true : false);
      return;
    }
    setLiveStatus(`nap_${key}`, { busy: true });
    const rec = await getDataset(key);
    lastOk[key] = rec;
    if (rec.data) draw(rec.data);
    statusRow(key, cfg.name, rec, true);
    setLiveStatus(`nap_${key}`, { busy: false });
    if (manual && rec.error && !rec.offline) toast(`${cfg.name}: ${rec.error}`, "err", 4000);
  };
  g.on("add", async () => {
    layers.set(key, g);
    const saved = await store.get(`nap_${key}`, null);   // show the stored copy at once
    if (saved?.data) draw(saved.data);
    await g._refresh();
    const sec = (await loadNapStatus()).datasets?.[key]?.osvezi || 300;
    timer = setInterval(() => { if (document.visibilityState === "visible") g._refresh(); }, Math.max(30, sec) * 1000);
  });
  g.on("remove", () => { clearInterval(timer); layers.delete(key); removeLiveStatus(`nap_${key}`); });
  g.setOpacity = (v) => { op = v; g.eachLayer((l) => l.setStyle?.({ opacity: v, fillOpacity: v })); };
  return g;
}
export const createNapLayer = (cfg, opacity) => napLayer(cfg, opacity);

// ── Prometno poročilo (text, not a layer) ──
export async function loadTrafficReport() {
  const st = await loadNapStatus();
  if (IS_WEB || !st.datasets?.porocilo?.configured) return report;
  report = await getDataset("porocilo");
  return report;
}
/** For the AI assistant: latest report as plain text (or null). */
export function trafficReportText() {
  const d = report?.data;
  if (!d) return null;
  const pick = (o) => (typeof o === "string" ? o : Array.isArray(o) ? o.map(pick).filter(Boolean).join("\n") : o && typeof o === "object" ? Object.values(o).map(pick).filter(Boolean).join("\n") : "");
  return pick(d).replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, 8000) || null;
}

// ── Panel "Promet v živo" ──
let panelEl = null;
export const trafficPanel = {
  id: "traffic",
  title: "Promet v živo",
  onOpen() { loadNapStatus(true).then(() => { loadTrafficReport().then(() => panelEl && trafficPanel.render(panelEl)); panelEl && trafficPanel.render(panelEl); }); },
  render(el) {
    panelEl = el;
    const st = napStatus;
    if (!st) { el.innerHTML = `<div class="card"><span class="spinner"></span> Nalagam …</div>`; return; }
    if (st.web) { el.innerHTML = `<div class="help">${esc(WEB_NOTE)}</div>`; return; }
    const rows = Object.entries(st.datasets || {}).map(([k, d]) => `
      <div class="nap-ds">
        <div class="row"><b class="grow">${esc(d.ime)}</b><span class="pill ${d.configured ? "ok" : ""}">${d.configured ? "nastavljeno" : "ni nastavljeno"}</span></div>
        <input class="field" data-code="${esc(k)}" value="${esc(d.code || "")}" placeholder="koda nabora (nap.si → nabor → Več)${d.opomba ? " — " + esc(d.opomba) : ""}">
        <div class="small muted">${d.tip === "json" ? "besedilo (panel spodaj)" : "sloj na karti"} · osvežitev ${d.osvezi >= 3600 ? Math.round(d.osvezi / 3600) + " h" : d.osvezi >= 60 ? Math.round(d.osvezi / 60) + " min" : d.osvezi + " s"}${lastOk[k]?.ts ? " · zadnja " + fmtTime(lastOk[k].ts) : ""}</div>
      </div>`).join("");
    const rep = trafficReportText();
    el.innerHTML = `
      <div class="help">Podatki: NAP Slovenija — nacionalna točka dostopa (nap.si), licenca CC BY-SA 4.0. Sloje vklopiš v Sloji → <b>Promet v živo</b>.</div>
      <div class="section">
        <div class="section-title">Prijava v NAP</div>
        <div class="card stack">
          <div class="small">${st.configured ? `✅ Prijava nastavljena (${esc(st.user || "")}${st.source === "env" ? ", iz NAP_USER / NAP_PASS" : ""}).` : "❌ Prijava ni nastavljena."}</div>
          ${st.source === "env" ? "" : `<input class="field" id="nap-user" placeholder="NAP uporabniško ime" autocomplete="off">
          <input class="field" id="nap-pass" type="password" placeholder="NAP geslo" autocomplete="new-password">
          <div class="row"><button class="btn sm primary" id="nap-cred">Shrani prijavo</button>${st.configured ? `<button class="btn sm danger" id="nap-cred-del">Odstrani</button>` : ""}</div>
          <div class="small muted">Shrani se samo na tem računalniku/telefonu (izven mape aplikacije), nikoli v spletno stran ali git.</div>`}
        </div>
      </div>
      <div class="section">
        <div class="section-title"><span>Nabori</span><button class="btn sm" id="nap-codes">Shrani kode</button></div>
        <div class="stack">${rows}</div>
      </div>
      <div class="section">
        <div class="section-title"><span>Prometno poročilo</span><button class="btn sm" id="nap-rep">${icon("refresh")} Osveži</button></div>
        <div class="card nap-report">${rep ? esc(rep).replace(/\n/g, "<br>") : `<span class="muted">${st.datasets?.porocilo?.configured ? (report?.error ? esc(report.error) : "Ni podatkov.") : "Nabor »Prometno poročilo« ni nastavljen."}</span>`}
          ${report?.ts ? `<div class="small muted" style="margin-top:6px">${report.offline ? "Podatki z dne " + fmtTime(report.ts) + ", brez povezave" : "Posodobljeno " + fmtTime(report.ts)}</div>` : ""}</div>
      </div>`;
    el.onclick = async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.id === "nap-cred" || t.id === "nap-cred-del") {
        const user = t.id === "nap-cred" ? el.querySelector("#nap-user").value.trim() : "";
        const pass = t.id === "nap-cred" ? el.querySelector("#nap-pass").value : "";
        if (t.id === "nap-cred" && (!user || !pass)) return toast("Vpiši uporabniško ime in geslo.", "err");
        napStatus = await api("/api/nap/credentials", { method: "POST", body: { user, pass } });
        toast(t.id === "nap-cred" ? "Prijava shranjena." : "Prijava odstranjena.", "ok");
        // first login: switch on the datasets marked "vklop: true" (e.g. Prometni dogodki, Dela na cesti)
        if (napStatus.configured) for (const [k, d] of Object.entries(napStatus.datasets || {})) if (d.vklop && d.configured && d.tip !== "json") toggleOverlay(`nap_${k}`, true);
        layers.forEach((l) => l._refresh(true));
        return trafficPanel.render(el);
      }
      if (t.id === "nap-codes") {
        const codes = {};
        el.querySelectorAll("[data-code]").forEach((i) => { codes[i.dataset.code] = i.value.trim(); });
        napStatus = await api("/api/nap/codes", { method: "POST", body: { codes } });
        toast("Kode shranjene.", "ok");
        layers.forEach((l) => l._refresh(true));
        return trafficPanel.render(el);
      }
      if (t.id === "nap-rep") { await loadTrafficReport(); return trafficPanel.render(el); }
    };
  },
};
