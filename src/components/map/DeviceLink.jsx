import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Copy, Check, Link2, X } from "lucide-react";

export default function DeviceLink({ deviceId, onClose }) {
  const [view, setView] = useState("menu"); // menu | generate | enter
  const [code, setCode] = useState("");
  const [myCode, setMyCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  const generateCode = async () => {
    setLoading(true);
    setMessage(null);
    const res = await base44.functions.invoke("guestTracks", { action: "generate_code", device_id: deviceId });
    setMyCode(res.data.code);
    setExpiresAt(res.data.expires_at);
    setLoading(false);
    setView("generate");
  };

  const useCode = async () => {
    if (inputCode.length !== 6) return;
    setLoading(true);
    setMessage(null);
    const res = await base44.functions.invoke("guestTracks", { action: "use_code", device_id: deviceId, code: inputCode });
    setLoading(false);
    if (res.data.error) {
      setMessage({ type: "error", text: res.data.error });
    } else {
      setMessage({ type: "success", text: `Imported ${res.data.imported} track(s) successfully! Reload to see them.` });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minutesLeft = expiresAt ? Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 60000)) : null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-sm text-slate-800">Link Devices</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {view === "menu" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500 mb-1">Transfer your tracks to another device without an account.</p>
          <button
            onClick={generateCode}
            disabled={loading}
            className="w-full py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate a code (this device)"}
          </button>
          <button
            onClick={() => setView("enter")}
            className="w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition"
          >
            Enter a code (new device)
          </button>
        </div>
      )}

      {view === "generate" && myCode && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-slate-500 text-center">Share this code on your other device. Valid for {minutesLeft} min.</p>
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-3 rounded-xl">
            <span className="text-2xl font-mono font-bold tracking-widest text-slate-800">{myCode}</span>
            <button onClick={copyCode} className="ml-2 text-slate-400 hover:text-emerald-500 transition">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => setView("menu")} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
        </div>
      )}

      {view === "enter" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">Enter the 6-digit code shown on your other device.</p>
          <input
            type="text"
            maxLength={6}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full text-center text-xl font-mono font-bold tracking-widest border border-slate-300 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {message && (
            <p className={`text-xs text-center ${message.type === "error" ? "text-red-500" : "text-emerald-600"}`}>
              {message.text}
            </p>
          )}
          <button
            onClick={useCode}
            disabled={loading || inputCode.length !== 6}
            className="w-full py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import Tracks"}
          </button>
          <button onClick={() => setView("menu")} className="text-xs text-slate-400 hover:text-slate-600 text-center">← Back</button>
        </div>
      )}
    </div>
  );
}