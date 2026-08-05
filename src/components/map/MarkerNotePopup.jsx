import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Pencil, Trash2, Save, X, Camera, Loader2 } from "lucide-react";

/**
 * Popup content for a drawing marker.
 * Supports editing a label, a descriptive note, and attaching photos
 * (uploaded via the UploadFile integration; stored as file URLs).
 */
export default function MarkerNotePopup({ marker, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(marker.label || "");
  const [note, setNote] = useState(marker.note || "");
  const [photos, setPhotos] = useState(marker.photos || []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const curLabel = marker.label || "";
  const curNote = marker.note || "";
  const curPhotos = marker.photos || [];

  const startEdit = () => {
    setLabel(curLabel);
    setNote(curNote);
    setPhotos([...curPhotos]);
    setEditing(true);
  };

  const save = () => {
    onChange({ ...marker, label: label.trim(), note: note.trim(), photos });
    setEditing(false);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const res = await base44.integrations.Core.UploadFile({ file: f });
        if (res?.file_url) urls.push(res.file_url);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (err) {
      console.error("Photo upload failed", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = (idx) => setPhotos((p) => p.filter((_, i) => i !== idx));

  if (editing) {
    return (
      <div className="flex flex-col gap-2" style={{ minWidth: 210 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          className="border border-slate-300 rounded px-2 py-1 text-xs w-full outline-none focus:border-emerald-500"
          placeholder="Ime oznake..."
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="border border-slate-300 rounded px-2 py-1 text-xs w-full outline-none focus:border-emerald-500 resize-none"
          placeholder="Opisna opomba..."
        />
        <div className="flex flex-wrap gap-1">
          {photos.map((url, i) => (
            <div key={i} className="relative w-12 h-12 rounded overflow-hidden border border-slate-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="w-12 h-12 rounded border border-dashed border-slate-300 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-1 disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" /> {uploading ? "Nalagam..." : "Dodaj fotografije"}
        </button>
        <div className="flex gap-1">
          <button
            onClick={save}
            className="flex-1 bg-emerald-500 text-white text-xs py-1 rounded hover:bg-emerald-600 flex items-center justify-center gap-1"
          >
            <Save className="w-3 h-3" /> Shrani
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-slate-100 text-slate-600 text-xs py-1 rounded hover:bg-slate-200"
          >
            Prekliči
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" style={{ minWidth: 190 }}>
      {curLabel && <div className="font-semibold text-xs text-slate-800">{curLabel}</div>}
      <span className="font-mono text-[10px] text-slate-500">{marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}</span>
      {curNote && (
        <div className="text-[11px] text-slate-700 whitespace-pre-wrap break-words max-w-[230px]">{curNote}</div>
      )}
      {curPhotos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {curPhotos.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block w-12 h-12 rounded overflow-hidden border border-slate-200"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <button
          onClick={startEdit}
          className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-1 flex items-center justify-center gap-1"
        >
          <Pencil className="w-3 h-3" /> Uredi
        </button>
        <button
          onClick={onRemove}
          className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded px-2 py-1 flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3 h-3" /> Odstrani
        </button>
      </div>
    </div>
  );
}