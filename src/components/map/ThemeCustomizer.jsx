import React, { useState } from "react";
import { Palette, X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const THEME_KEY = "mapUiTheme";

export const DEFAULT_THEME = {
  toolbarBg: "#ffffff",
  toolbarText: "#475569",
  buttonActiveBg: "#10b981",
  buttonActiveText: "#ffffff",
  panelBg: "#0f172a",
  panelText: "#e2e8f0",
  accentColor: "#10b981",
};

export function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_THEME };
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
}

const FIELDS = [
  { key: "toolbarBg",       label: "Toolbar Background" },
  { key: "toolbarText",     label: "Toolbar Icons" },
  { key: "buttonActiveBg",  label: "Active Button" },
  { key: "buttonActiveText",label: "Active Button Text" },
  { key: "panelBg",         label: "Panel Background" },
  { key: "panelText",       label: "Panel Text" },
  { key: "accentColor",     label: "Accent / Highlights" },
];

export default function ThemeCustomizer({ isOpen, onClose, theme, onThemeChange }) {
  const handleChange = (key, value) => {
    const next = { ...theme, [key]: value };
    onThemeChange(next);
    saveTheme(next);
  };

  const handleReset = () => {
    onThemeChange({ ...DEFAULT_THEME });
    saveTheme({ ...DEFAULT_THEME });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, x: 6 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, x: 6 }}
          className="bg-white/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-4 w-60"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-800">Theme</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleReset} title="Reset to defaults" className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-600 flex-1">{label}</span>
                <div className="relative flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-lg border border-slate-200 cursor-pointer shadow-sm overflow-hidden"
                    style={{ backgroundColor: theme[key] }}
                  >
                    <input
                      type="color"
                      value={theme[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono w-14">{theme[key]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Preview swatch */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">Preview</p>
            <div className="flex gap-2 items-center p-2 rounded-xl" style={{ backgroundColor: theme.toolbarBg, border: "1px solid #e2e8f0" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: theme.buttonActiveBg, color: theme.buttonActiveText }}>A</div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: theme.toolbarBg, border: "1px solid #e2e8f0" }}>
                <Palette className="w-3.5 h-3.5" style={{ color: theme.toolbarText }} />
              </div>
              <div className="flex-1 h-7 rounded-lg flex items-center px-2" style={{ backgroundColor: theme.panelBg }}>
                <span className="text-[10px]" style={{ color: theme.panelText }}>Panel</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}