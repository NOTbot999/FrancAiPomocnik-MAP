// Shared, persisted settings for "Označi na karti" emoji markers.
// Read by SearchCategoryLayer (canvas renderer) and edited from the
// DesktopToolbar settings panel.

const SIZE_KEY = "searchCatMarkerSize";
const EMOJI_KEY = "searchCatEmojiOverrides";
export const SETTINGS_EVENT = "searchcat-settings-changed";

export function getMarkerSize() {
  try {
    const v = Number(localStorage.getItem(SIZE_KEY));
    if (Number.isFinite(v) && v >= 8 && v <= 60) return v;
  } catch {}
  return 15;
}

export function setMarkerSize(n) {
  const clamped = Math.max(8, Math.min(60, Math.round(Number(n) || 15)));
  try { localStorage.setItem(SIZE_KEY, String(clamped)); } catch {}
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function getEmojiOverrides() {
  try {
    const raw = localStorage.getItem(EMOJI_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function setEmojiOverride(categoryId, emoji) {
  const all = getEmojiOverrides();
  const trimmed = (emoji || "").trim();
  if (trimmed) all[categoryId] = trimmed;
  else delete all[categoryId];
  try { localStorage.setItem(EMOJI_KEY, JSON.stringify(all)); } catch {}
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function resolveEmoji(categoryId, fallback) {
  const all = getEmojiOverrides();
  return all[categoryId] || fallback;
}