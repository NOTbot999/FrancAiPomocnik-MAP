// Skupno delo (shared work) — live sessions on the same Wi-Fi or through a server address,
// plus workspace files for sharing by any other channel.
import { map } from "../map/map.js";
import { api, IS_ANDROID, IS_WEB } from "../services/api.js";
import { state, saveSettings, emit, on } from "../runtime/state.js";
import { esc, uid, toast, saveTextFile, openTextFiles, copyText, $ } from "../shared/util.js";
import { icon } from "../shared/icons.js";
import { pinIcon } from "../shared/tools.js";
import { getDrawings, addFeature } from "./draw.js";
import { getTracks, addTracks } from "./tracks.js";

let panelEl = null;
let session = null;        // last snapshot from the server
let connected = false;
let host = null;           // { hosting, code, port, addresses, local } when this PC hosts
let pollTimer = null, lastError = "", sharingPos = null;
let layer = null;
let lastMsgCount = 0;

const cfg = () => state.settings.collab;
function ensureMember() {
  const c = cfg();
  c.member ||= uid("m");
  c.name ||= IS_ANDROID ? "Telefon" : "Računalnik";
  return c;
}

function call(path, method = "GET", body) {
  const c = cfg();
  return api("/api/collab/call", { method: "POST", body: { server: c.server, path, method, body: body && { code: c.code, member: c.member, ...body } } });
}

export const isCollabConnected = () => connected;

export async function connect() {
  const c = ensureMember();
  if (!c.server || !c.code) return toast("Vpiši naslov strežnika in kodo seje.", "err");
  c.server = c.server.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(c.server)) c.server = "http://" + c.server;
  if (!/:\d+$/.test(c.server.replace(/^https?:\/\//, "").split("/")[0]) && c.server.startsWith("http://")) c.server += ":47800";
  c.code = c.code.trim().toUpperCase();
  saveSettings();
  try {
    session = await call("/collab/join", "POST", { name: c.name });
    connected = true; lastError = "";
    lastMsgCount = session.messages.length;
    toast(`Povezan v sejo »${session.name}«`, "ok");
    startPolling();
    drawSession();
  } catch (e) {
    connected = false;
    lastError = e.message;
    toast(e.message, "err", 5000);
  }
  refresh();
  emit("collab", connected);
}

export async function disconnect() {
  try { await call("/collab/leave", "POST", {}); } catch { /* ignore */ }
  connected = false; session = null;
  clearInterval(pollTimer); pollTimer = null;
  stopSharingPos();
  layer?.clearLayers();
  refresh();
  emit("collab", false);
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!connected) return;
    try {
      const c = cfg();
      session = await call(`/collab/state?code=${encodeURIComponent(c.code)}&member=${encodeURIComponent(c.member)}`);
      lastError = "";
      if (session.messages.length > lastMsgCount) {
        const m = session.messages[session.messages.length - 1];
        if (m.member !== c.member && !panelEl?.isConnected) toast(`💬 ${m.by}: ${m.text}`, "", 4000);
      }
      lastMsgCount = session.messages.length;
      drawSession();
      if (panelEl?.isConnected) refreshLive();
    } catch (e) {
      lastError = e.message;
      if (panelEl?.isConnected) refreshLive();
    }
  }, 2500);
}

function drawSession() {
  layer ||= L.layerGroup().addTo(map);
  layer.clearLayers();
  if (!session) return;
  for (const p of session.pins) {
    L.marker([p.lat, p.lng], { icon: pinIcon(p.color || "#e11d48", "👥"), pane: "top" })
      .bindTooltip(`<b>${esc(p.name)}</b><br><span class="muted">${esc(p.by)}</span>`, { direction: "top" })
      .bindPopup(`<div class="pop"><h3>${esc(p.name)}</h3><div class="sub">Deli: ${esc(p.by)}</div>${p.note ? `<div>${esc(p.note)}</div>` : ""}</div>`)
      .addTo(layer);
  }
  for (const s of session.shapes) {
    const f = s.feature;
    if (!f?.coords) continue;
    const style = { color: f.color || "#7c3aed", weight: 3.5, pane: "vectors", dashArray: "2,6" };
    const ll = f.type === "marker" ? null : f.coords.map((p) => [p[0], p[1]]);
    const l = f.type === "marker" ? L.marker(f.coords, { icon: pinIcon(f.color || "#7c3aed", "👥"), pane: "top" })
      : f.type === "polygon" ? L.polygon(ll, { ...style, fillOpacity: 0.12 }) : L.polyline(ll, style);
    l.bindTooltip(`<b>${esc(f.name || "Risba")}</b><br><span class="muted">${esc(s.by)}</span>`, { sticky: true }).addTo(layer);
  }
  for (const m of session.members) {
    if (!m.pos || m.id === cfg().member) continue;
    L.circleMarker(m.pos, { radius: 8, color: "#fff", weight: 3, fillColor: m.online ? "#7c3aed" : "#94a3b8", fillOpacity: 1, pane: "top" })
      .bindTooltip(`👤 ${esc(m.name)}${m.online ? "" : " (ni na voljo)"}`, { direction: "top", permanent: false }).addTo(layer);
  }
}

export async function sharePin(latlng, name = "Skupna oznaka") {
  if (!connected) return toast("Najprej se poveži v sejo (Skupno delo).", "err");
  try { await call("/collab/pin", "POST", { pin: { lat: latlng[0], lng: latlng[1], name } }); toast("Oznaka deljena z ekipo", "ok"); }
  catch (e) { toast(e.message, "err"); }
}

function startSharingPos() {
  if (!navigator.geolocation) return toast("Lokacija ni na voljo.", "err");
  sharingPos = navigator.geolocation.watchPosition((p) => {
    call("/collab/position", "POST", { lat: p.coords.latitude, lng: p.coords.longitude }).catch(() => {});
  }, (e) => { toast("Lokacija: " + e.message, "err"); stopSharingPos(); refresh(); }, { enableHighAccuracy: true, maximumAge: 5000 });
}
function stopSharingPos() {
  if (sharingPos != null) navigator.geolocation.clearWatch(sharingPos);
  if (sharingPos != null && connected) call("/collab/position", "POST", { lat: null }).catch(() => {});
  sharingPos = null;
}

// ── Workspace files ──
async function exportWorkspace() {
  const ws = {
    type: "francmap-workspace", version: 1, created: new Date().toISOString(), by: cfg().name,
    view: state.settings.view, base: state.settings.base, overlays: state.settings.overlays,
    drawings: getDrawings(), tracks: getTracks(), sharedPins: session?.pins || [],
  };
  await saveTextFile(`delovni-prostor-${new Date().toISOString().slice(0, 10)}.francmap.json`, JSON.stringify(ws), "application/json");
}
async function importWorkspace() {
  const files = await openTextFiles(".json");
  for (const f of files || []) {
    try {
      const ws = JSON.parse(f.content);
      if (ws.type !== "francmap-workspace") throw new Error("To ni datoteka delovnega prostora");
      for (const d of ws.drawings || []) { const { id, ...rest } = d; addFeature(rest); }   // fresh ids
      for (const p of ws.sharedPins || []) addFeature({ type: "marker", coords: [p.lat, p.lng], name: p.name, note: p.note || `Od: ${p.by}` });
      if (ws.tracks?.length) addTracks(ws.tracks);
      if (ws.view) map.setView(ws.view.center, ws.view.zoom);
      toast(`Uvoženo: ${(ws.drawings || []).length} risb, ${(ws.tracks || []).length} sledi, ${(ws.sharedPins || []).length} oznak`, "ok", 4000);
    } catch (e) { toast(`${f.name}: ${e.message}`, "err", 5000); }
  }
}

function refresh() { if (panelEl?.isConnected) collabPanel.render(panelEl); }

// update only the live parts (members, pins count, chat) so typing isn't interrupted
function refreshLive() {
  const live = $("#collab-live", panelEl);
  if (live) live.innerHTML = liveHtml();
  const chat = $("#chat-log", panelEl);
  if (chat) { chat.innerHTML = chatHtml(); chat.scrollTop = chat.scrollHeight; }
}

const ago = (ts) => { const s = Math.round(Date.now() / 1000 - ts); return s < 60 ? "zdaj" : s < 3600 ? `${Math.round(s / 60)} min` : new Date(ts * 1000).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }); };
function liveHtml() {
  if (!session) return "";
  return `${lastError ? `<div class="filter-warn">⚠ ${esc(lastError)}</div>` : ""}
    <div class="slabel" style="margin-top:8px">Člani (${session.members.length})</div>
    ${session.members.map((m) => `<div class="row small" style="padding:3px 0"><span class="swatch" style="border-radius:50%;background:${m.online ? "#16a34a" : "#94a3b8"}"></span><span class="grow">${esc(m.name)}${m.id === cfg().member ? " (jaz)" : ""}</span>${m.pos ? "📍" : ""}</div>`).join("")}
    <div class="slabel" style="margin-top:8px">Deljeno: ${session.pins.length} oznak · ${session.shapes.length} risb</div>`;
}
function chatHtml() {
  if (!session?.messages.length) return `<div class="muted small" style="text-align:center;padding:10px">Ni sporočil.</div>`;
  return session.messages.slice(-80).map((m) => `<div class="chat-msg ${m.member === cfg().member ? "me" : ""}"><b>${esc(m.by)}</b> <span class="muted">${ago(m.ts)}</span><div>${esc(m.text)}</div></div>`).join("");
}

export const collabPanel = {
  id: "collab",
  title: "Skupno delo",
  async onOpen() {
    if (!IS_ANDROID && !IS_WEB) { try { host = await api("/api/collab/hostinfo", { method: "POST", body: {} }); refresh(); } catch { /* ignore */ } }
  },
  render(el) {
    panelEl = el;
    const c = ensureMember();
    const hostCard = IS_ANDROID || IS_WEB ? "" : `
      <div class="card stack">
        <div class="row"><b class="grow">Gosti sejo na tem računalniku</b>${icon("users")}</div>
        ${host?.hosting ? `
          <div class="small">Koda seje: <b style="font-size:18px;letter-spacing:2px">${esc(host.code)}</b> <button class="icon-btn sm" data-copy="${esc(host.code)}">${icon("copy")}</button></div>
          <div class="small">Naslov za druge naprave v istem Wi-Fi:</div>
          ${host.addresses.map((a) => `<div class="row small"><code class="grow">${esc(a)}</code><button class="icon-btn sm" data-copy="${esc(a)}">${icon("copy")}</button></div>`).join("") || `<div class="small muted">Ni omrežnega naslova.</div>`}
          <div class="help" style="margin:0">Če Windows vpraša, dovoli dostop v zasebnem omrežju (požarni zid).</div>
          <button class="btn sm danger" id="c-stophost">Ustavi gostovanje</button>` : `
          <div class="help" style="margin:0">Ta računalnik postane strežnik — telefoni in računalniki v istem Wi-Fi se pridružijo s kodo.</div>
          <button class="btn sm primary" id="c-host">${icon("share")} Začni sejo</button>`}
      </div>`;
    el.innerHTML = connected ? `
      <div class="card stack" style="margin-top:4px">
        <div class="row"><span class="grow"><b>${esc(session?.name || "Seja")}</b><br><span class="small muted">${esc(c.server)} · koda ${esc(c.code)}</span></span>
          <button class="btn sm danger" id="c-leave">Zapusti</button></div>
        <div id="collab-live">${liveHtml()}</div>
        <div class="row wrap">
          <button class="btn sm" id="c-pin">${icon("marker")} Deli središče karte</button>
          <button class="btn sm" id="c-share-draw">${icon("pencil")} Deli moje risbe (${getDrawings().length})</button>
          <button class="btn sm ${sharingPos != null ? "primary" : ""}" id="c-pos">${icon("locate")} ${sharingPos != null ? "Delim lokacijo" : "Deli mojo lokacijo"}</button>
        </div>
        <div class="help" style="margin:0">Desni klik / dolg pritisk na karto → »Deli z ekipo«.</div>
      </div>
      <div class="section"><div class="section-title">Sporočila</div>
        <div id="chat-log" class="chat-log">${chatHtml()}</div>
        <div class="row" style="margin-top:6px"><input class="field grow" id="c-msg" placeholder="Sporočilo ekipi…"><button class="btn primary" id="c-send">${icon("send")}</button></div>
      </div>
      ${hostCard}` : `
      <div class="help">Delite oznake, risbe, lokacijo in sporočila v živo. Brez računa in brez oblaka.</div>
      ${hostCard}
      <div class="card stack" style="margin-top:10px">
        <b>Pridruži se seji</b>
        <input class="field" id="c-server" placeholder="Naslov (npr. 192.168.1.20:47800 ali https://moj-streznik.si)" value="${esc(c.server || "")}">
        <input class="field" id="c-code" placeholder="Koda seje" value="${esc(c.code || "")}" style="text-transform:uppercase;letter-spacing:2px">
        <input class="field" id="c-name" placeholder="Tvoje ime" value="${esc(c.name || "")}">
        <button class="btn primary" id="c-join">${icon("users")} Pridruži se</button>
        ${lastError ? `<div class="filter-warn">⚠ ${esc(lastError)}</div>` : ""}
      </div>
      <div class="section"><div class="section-title">Strežnik na internetu</div>
        <div class="help" style="margin:0">Za skupno delo prek interneta zaženi na strežniku <code>FrancMap.exe --collab-server</code> (ali <code>python app.py --collab-server</code>), nato vpiši njegov naslov zgoraj. Priporočen je HTTPS.</div>
      </div>`;
    el.innerHTML += `
      <div class="section"><div class="section-title">Datoteka delovnega prostora</div>
        <div class="help" style="margin:0 0 8px">Risbe, sledi, deljene oznake in pogled v eni datoteki — pošlji jo po e-pošti, Drive, USB …</div>
        <div class="row"><button class="btn sm grow" id="c-export">${icon("download")} Izvozi</button><button class="btn sm grow" id="c-import">${icon("upload")} Uvozi</button></div>
      </div>`;

    el.oninput = (e) => {
      const t = e.target;
      if (t.id === "c-server") c.server = t.value;
      if (t.id === "c-code") c.code = t.value;
      if (t.id === "c-name") c.name = t.value;
      if (["c-server", "c-code", "c-name"].includes(t.id)) saveSettings();
    };
    el.onkeydown = (e) => { if (e.key === "Enter" && e.target.id === "c-msg") $("#c-send", el).click(); if (e.key === "Enter" && ["c-code", "c-name", "c-server"].includes(e.target.id)) connect(); };
    el.onclick = async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.copy) return copyText(t.dataset.copy);
      switch (t.id) {
        case "c-join": return connect();
        case "c-leave": return disconnect();
        case "c-host":
          try {
            host = await api("/api/collab/host", { method: "POST", body: { name: `${c.name || "Moja"} seja` } });
            c.server = host.local; c.code = host.code; saveSettings();
            await connect();
          } catch (err) { toast(err.message, "err", 5000); }
          return refresh();
        case "c-stophost":
          if (connected && c.server === host?.local) await disconnect();
          host = await api("/api/collab/stophost", { method: "POST", body: {} });
          return refresh();
        case "c-pin": { const m = map.getCenter(); return sharePin([m.lat, m.lng], "Skupna oznaka"); }
        case "c-share-draw": {
          const ds = getDrawings();
          for (const d of ds) await call("/collab/shape", "POST", { feature: { ...d } }).catch(() => {});
          return toast(`Deljenih risb: ${ds.length}`, "ok");
        }
        case "c-pos": sharingPos != null ? stopSharingPos() : startSharingPos(); return refresh();
        case "c-send": {
          const inp = $("#c-msg", el);
          if (!inp.value.trim()) return;
          try { await call("/collab/message", "POST", { text: inp.value }); inp.value = ""; } catch (err) { toast(err.message, "err"); }
          return;
        }
        case "c-export": return exportWorkspace();
        case "c-import": return importWorkspace();
      }
    };
    const log = $("#chat-log", el);
    if (log) log.scrollTop = log.scrollHeight;
  },
};

on("collab-pin", (ll) => sharePin(ll, "Skupna oznaka"));
