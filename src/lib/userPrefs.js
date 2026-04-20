/**
 * User-scoped localStorage helpers.
 * All keys are prefixed with the logged-in username (from localStorage) or "guest".
 */

function getUserPrefix() {
  const username = localStorage.getItem("userUsername");
  return username ? `user_${username}__` : "guest__";
}

export function scopedGet(key) {
  try {
    const raw = localStorage.getItem(getUserPrefix() + key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function scopedSet(key, value) {
  try {
    localStorage.setItem(getUserPrefix() + key, JSON.stringify(value));
  } catch {}
}

export function scopedRemove(key) {
  try {
    localStorage.removeItem(getUserPrefix() + key);
  } catch {}
}