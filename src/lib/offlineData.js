// Access to the data bundled in public/data/*.json (built by `npm run fetch-data`).
// Every loader in the app tries this first, then falls back to its live source.

const memo = new Map();

export const DATA_BASE = "/data";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  // Vite dev server / SPA fallbacks return index.html for missing files
  if (ct.includes("text/html")) throw new Error("not found");
  return res.json();
}

/**
 * Load a bundled dataset by id (e.g. "caves", "castle", "municipalities").
 * Resolves to null (never throws) when the file is missing or unreadable.
 */
export async function loadBundled(id) {
  if (!id) return null;
  if (memo.has(id)) return memo.get(id);
  const p = fetchJson(`${DATA_BASE}/${id}.json`)
    .then(d => (Array.isArray(d) && d.length > 0 ? d : null))
    .catch(() => null);
  memo.set(id, p);
  const result = await p;
  if (result === null) memo.delete(id); // allow a retry later (e.g. after SW cache warm-up)
  return result;
}

/** Manifest of bundled files: { built_at, files: { id: { count, bytes, built_at } } } or null. */
export async function getManifest() {
  if (memo.has("__manifest")) return memo.get("__manifest");
  const p = fetchJson(`${DATA_BASE}/manifest.json`).catch(() => null);
  memo.set("__manifest", p);
  const m = await p;
  if (!m) memo.delete("__manifest");
  return m;
}

/** Fetch every bundled file once so the service worker stores it in Cache Storage. */
export async function warmAllBundled(onProgress) {
  const m = await getManifest();
  const ids = Object.keys(m?.files || {});
  let done = 0;
  for (const id of ids) {
    try { await fetch(`${DATA_BASE}/${id}.json`); } catch { /* offline */ }
    done++;
    onProgress?.({ done, total: ids.length, id });
  }
  return { done, total: ids.length };
}
