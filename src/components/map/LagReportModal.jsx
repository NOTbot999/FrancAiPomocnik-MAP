import React, { useState, useRef } from "react";
import { X, Send, AlertTriangle, CheckCircle2, Loader2, ImagePlus, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

export default function LagReportModal({ onClose, username }) {
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [images, setImages] = useState([]); // [{ file, preview, url }]
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageAdd = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const remaining = 3 - images.length;
    const toAdd = files.slice(0, remaining);

    for (let i = 0; i < toAdd.length; i++) {
      const file = toAdd[i];
      const preview = URL.createObjectURL(file);
      const idx = images.length + i;
      setUploadingIdx(idx);
      setImages(prev => [...prev, { file, preview, url: null }]);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setImages(prev => prev.map((img, j) => j === idx ? { ...img, url: file_url } : img));
      } catch (err) {
        console.error("Upload error:", err);
        setImages(prev => prev.filter((_, j) => j !== idx));
      }
      setUploadingIdx(null);
    }
    e.target.value = "";
  };

  const handleRemoveImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!description.trim()) return;
    setSending(true);
    try {
      const imageUrls = images.filter(i => i.url).map(i => i.url);
      await base44.entities.LagReport.create({
        username: username || "gost",
        description: description.trim() + (imageUrls.length ? `\n\nSlike: ${imageUrls.join(", ")}` : ""),
        user_agent: navigator.userAgent,
        reported_at: new Date().toISOString(),
      });
      base44.analytics.track({ eventName: "lag_report_submitted", properties: { username: username || "gost" } });
      setSent(true);
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      console.error("LagReport error:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 mx-4 overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-700">Poročaj o zaostanku</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-medium text-slate-700">Poročilo poslano!</p>
              <p className="text-xs text-slate-400">Hvala za povratne informacije.</p>
            </div>
          ) : (
            <>
              {/* Username display */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Uporabnik</p>
                <div className="px-3 py-2 rounded-xl bg-slate-100 text-sm font-medium text-slate-700">
                  {username || "gost"}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Opis napake / zaostanka</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opiši kaj se dogaja, kdaj se pojavi zaostanek ali napaka..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  rows={4}
                />
              </div>

              {/* Screenshots */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Posnetki zaslona</p>
                  <span className="text-[10px] text-slate-400">{images.length}/3</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      {uploadingIdx === idx && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 bg-white rounded-full shadow"
                      >
                        <XCircle className="w-4 h-4 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && uploadingIdx === null && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 bg-slate-50 flex flex-col items-center justify-center gap-1 transition-colors flex-shrink-0"
                    >
                      <ImagePlus className="w-5 h-5 text-slate-400" />
                      <span className="text-[9px] text-slate-400">Dodaj</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageAdd}
                />
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!description.trim() || sending || uploadingIdx !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-sm transition-all"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Pošiljam...</>
                ) : (
                  <><Send className="w-4 h-4" /> Pošlji</>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}