import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Plus, LogIn, Send, MapPin, Copy, Check, Trash2, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { loadTheme } from "@/components/map/ThemeCustomizer";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const USER_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

function colorForUser(username) {
  if (!username) return USER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export default function CollabPanel({ onClose, onDropPin, onFlyTo, isMobile }) {
  const theme = loadTheme();
  const username = localStorage.getItem("userUsername") || null;

  const [view, setView] = useState("home"); // home | session
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pins, setPins] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDropping, setIsDropping] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (view === "session" && session) {
      loadMessages();
      loadPins();
      pollRef.current = setInterval(() => { loadMessages(); loadPins(); }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [view, session?.id]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  async function loadMessages() {
    if (!session) return;
    const msgs = await base44.entities.CollabMessage.filter({ session_id: session.id }, "created_date", 50);
    setMessages(msgs);
  }

  async function loadPins() {
    if (!session) return;
    const ps = await base44.entities.CollabPin.filter({ session_id: session.id });
    setPins(ps);
    // Notify map of updated pins
    if (onDropPin) onDropPin(ps);
  }

  async function createSession() {
    if (!username) { setError("Prijavite se za ustvarjanje seje."); return; }
    if (!sessionName.trim()) { setError("Vnesite ime seje."); return; }
    setLoading(true); setError("");
    try {
      const code = generateCode();
      const sess = await base44.entities.CollabSession.create({
        name: sessionName.trim(),
        invite_code: code,
        owner_username: username,
        member_usernames: [username],
        is_active: true,
      });
      setSession(sess);
      setView("session");
    } catch (err) {
      setError("Napaka pri ustvarjanju seje: " + (err?.message || "Neznana napaka"));
    } finally {
      setLoading(false);
    }
  }

  async function joinSession() {
    if (!username) { setError("Prijavite se za pridružitev seje."); return; }
    if (!joinCode.trim()) { setError("Vnesite kodo seje."); return; }
    setLoading(true); setError("");
    try {
      const results = await base44.entities.CollabSession.filter({ invite_code: joinCode.trim().toUpperCase() });
      if (results.length === 0) { setError("Seja ni najdena."); return; }
      const sess = results[0];
      const members = sess.member_usernames || [];
      if (!members.includes(username)) {
        await base44.entities.CollabSession.update(sess.id, { member_usernames: [...members, username] });
      }
      const updated = { ...sess, member_usernames: members.includes(username) ? members : [...members, username] };
      setSession(updated);
      setView("session");
    } catch (err) {
      setError("Napaka pri pridružitvi: " + (err?.message || "Neznana napaka"));
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(pinRef = null) {
    if (!msgText.trim() && !pinRef) return;
    const text = msgText.trim() || (pinRef ? `📍 ${pinRef.label || "Nova oznaka"}` : "");
    setMsgText("");
    await base44.entities.CollabMessage.create({
      session_id: session.id,
      username,
      text,
      ...(pinRef ? { pin_ref: pinRef } : {}),
    });
    await loadMessages();
  }

  async function handleDropPin() {
    setIsDropping(true);
    onClose?.(); // close panel so user can click map
  }

  // Called from parent when user picks a location while isDropping
  async function placePin(lat, lng) {
    if (!session) return;
    const label = `${username || "Marker"} — ${new Date().toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}`;
    const pin = await base44.entities.CollabPin.create({
      session_id: session.id,
      username,
      lat, lng,
      label,
      color: colorForUser(username),
    });
    await loadPins();
    await base44.entities.CollabMessage.create({
      session_id: session.id,
      username,
      text: `📍 Dodal(-a) oznako`,
      pin_ref: { lat, lng, label },
    });
    await loadMessages();
  }

  async function removePin(pinId) {
    await base44.entities.CollabPin.delete(pinId);
    await loadPins();
  }

  async function leaveSession() {
    clearInterval(pollRef.current);
    if (session && username) {
      const members = (session.member_usernames || []).filter(u => u !== username);
      await base44.entities.CollabSession.update(session.id, { member_usernames: members });
      if (onDropPin) onDropPin([]);
    }
    setSession(null);
    setMessages([]);
    setPins([]);
    setView("home");
  }

  async function copyCode() {
    if (!session) return;
    await navigator.clipboard.writeText(session.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const panelStyle = {
    backgroundColor: theme.menuBg || "#fff",
    color: theme.menuText || "#1e293b",
    borderColor: `${theme.menuText}18`,
  };

  if (!username) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="rounded-2xl shadow-2xl border p-5 w-80"
        style={panelStyle}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: theme.buttonActiveBg }} />
            <span className="font-semibold text-sm">Skupno delo</span>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
        </div>
        <p className="text-xs opacity-60">Za skupno delo se morate prijaviti.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      className="rounded-2xl shadow-2xl border flex flex-col"
      style={{ ...panelStyle, width: isMobile ? "calc(100vw - 24px)" : 320, maxHeight: isMobile ? "75vh" : 520 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: `${theme.menuText}18` }}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: theme.buttonActiveBg }} />
          <span className="font-semibold text-sm">
            {view === "session" ? session?.name : "Skupno delo"}
          </span>
          {view === "session" && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-lg opacity-60 border"
                style={{ borderColor: `${theme.menuText}22` }}>
                {session?.invite_code}
              </span>
              <button onClick={copyCode} className="opacity-60 hover:opacity-100 transition">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {view === "session" && (
            <button onClick={leaveSession} className="opacity-50 hover:opacity-80 transition mr-1" title="Zapusti sejo">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
        </div>
      </div>

      {/* Home view */}
      <AnimatePresence mode="wait">
        {view === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Create session */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase opacity-50 tracking-wide">Nova seja</p>
              <input
                className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                style={{ backgroundColor: `${theme.menuText}08`, borderColor: `${theme.menuText}22`, color: theme.menuText }}
                placeholder="Ime seje…"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createSession()}
              />
              <button
                onClick={createSession}
                disabled={loading || !sessionName.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                style={{ backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText || "#fff" }}
              >
                <Plus className="w-4 h-4" />
                {loading ? "Ustvarjam..." : "Ustvari sejo"}
              </button>
            </div>

            <div className="flex items-center gap-2 opacity-30">
              <div className="flex-1 h-px bg-current" />
              <span className="text-xs">ali</span>
              <div className="flex-1 h-px bg-current" />
            </div>

            {/* Join session */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase opacity-50 tracking-wide">Pridruži se</p>
              <input
                className="w-full text-sm px-3 py-2 rounded-xl border outline-none font-mono tracking-widest uppercase"
                style={{ backgroundColor: `${theme.menuText}08`, borderColor: `${theme.menuText}22`, color: theme.menuText }}
                placeholder="Koda seje (npr. AB12CD)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                maxLength={6}
                onKeyDown={e => e.key === "Enter" && joinSession()}
              />
              <button
                onClick={joinSession}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition border"
                style={{ borderColor: theme.buttonActiveBg, color: theme.buttonActiveBg }}
              >
                <LogIn className="w-4 h-4" />
                Pridruži se
              </button>
            </div>
          </motion.div>
        )}

        {/* Session view */}
        {view === "session" && session && (
          <motion.div key="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col flex-1 min-h-0">

            {/* Members bar */}
            <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap border-b" style={{ borderColor: `${theme.menuText}18` }}>
              {(session.member_usernames || []).map(u => (
                <div key={u} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: colorForUser(u) + "22", color: colorForUser(u) }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorForUser(u) }} />
                  {u}
                </div>
              ))}
            </div>

            {/* Pins section */}
            {pins.length > 0 && (
              <div className="px-3 py-2 border-b" style={{ borderColor: `${theme.menuText}18` }}>
                <p className="text-[10px] font-semibold uppercase opacity-40 mb-1.5">Oznake na karti</p>
                <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
                  {pins.map(pin => (
                    <div key={pin.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pin.color || "#10b981" }} />
                      <span className="flex-1 truncate opacity-70">{pin.label || `${pin.lat?.toFixed(4)}, ${pin.lng?.toFixed(4)}`}</span>
                      <button onClick={() => onFlyTo && onFlyTo({ lat: pin.lat, lng: pin.lng, zoom: 15 })}
                        className="opacity-40 hover:opacity-80 transition">
                        <MapPin className="w-3 h-3" />
                      </button>
                      {pin.username === username && (
                        <button onClick={() => removePin(pin.id)} className="opacity-40 hover:text-red-400 hover:opacity-100 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 min-h-0">
              {messages.length === 0 && (
                <p className="text-xs opacity-30 text-center mt-4">Ni še sporočil. Pozdravite skupino! 👋</p>
              )}
              {messages.map(msg => {
                const isMe = msg.username === username;
                return (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <span className="text-[10px] px-1 opacity-50" style={{ color: colorForUser(msg.username) }}>
                        {msg.username}
                      </span>
                    )}
                    <div
                      className="max-w-[85%] text-xs px-3 py-1.5 rounded-2xl leading-relaxed"
                      style={{
                        backgroundColor: isMe ? theme.buttonActiveBg : `${theme.menuText}12`,
                        color: isMe ? (theme.buttonActiveText || "#fff") : theme.menuText,
                        borderBottomRightRadius: isMe ? 4 : undefined,
                        borderBottomLeftRadius: !isMe ? 4 : undefined,
                      }}
                    >
                      {msg.text}
                      {msg.pin_ref && (
                        <button
                          onClick={() => onFlyTo && onFlyTo({ lat: msg.pin_ref.lat, lng: msg.pin_ref.lng, zoom: 15 })}
                          className="block mt-0.5 opacity-70 hover:opacity-100 text-[10px] underline"
                        >
                          🗺 Pokaži na karti
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-2 border-t flex items-center gap-1.5" style={{ borderColor: `${theme.menuText}18` }}>
              <button
                onClick={async () => {
                  // Signal parent to enter pin-drop mode
                  if (onDropPin) {
                    window._collabPanelPlacePin = async (lat, lng) => { await placePin(lat, lng); };
                  }
                  onClose?.();
                  // Re-open after pin placed via _collabPanelPlacePin callback
                }}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border transition hover:scale-105"
                style={{ borderColor: `${theme.menuText}22`, color: theme.menuText }}
                title="Postavi oznako na karto"
              >
                <MapPin className="w-4 h-4" />
              </button>
              <input
                className="flex-1 text-xs px-3 py-2 rounded-xl border outline-none"
                style={{ backgroundColor: `${theme.menuText}08`, borderColor: `${theme.menuText}22`, color: theme.menuText }}
                placeholder="Sporočilo…"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!msgText.trim()}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition hover:scale-105 disabled:opacity-30"
                style={{ backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText || "#fff" }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}