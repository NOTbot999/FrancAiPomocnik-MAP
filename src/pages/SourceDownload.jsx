import React, { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

export default function SourceDownload() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const data = (await import("@/appSourceData")).default;
      const blob = new Blob([data], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "francaimap_source.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Izvorna koda aplikacije</h1>
        <p className="text-sm text-slate-500 mb-6">
          Prenesi celotno izvorno kodo aplikacije FrancAiMap (168 datotek, ~950 KB) v eni .txt datoteki.
        </p>
        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {loading ? "Pripravljam..." : "Prenesi .txt"}
        </button>
        {done && (
          <p className="text-xs text-emerald-600 mt-4">✅ Prenos se je začel.</p>
        )}
      </div>
    </div>
  );
}