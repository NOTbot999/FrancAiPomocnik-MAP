// Local, offline replacement for the Base44 SDK client.
// Implements only the surface the app uses:
//   entities.<Name>.list/filter/create/update/delete/bulkCreate  → localStorage
//   entities.CachedLayer.filter                                  → bundled /data json
//   functions.invoke                                             → benign local answers
//   auth.me/logout/redirectToLogin                               → local guest user
//   analytics.track                                              → no-op
//   integrations.Core.InvokeLLM/UploadFile                       → reject (AI needs a backend)
import { loadBundled } from "@/lib/offlineData";

const LS_PREFIX = "francmap_local_";

function readTable(name) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + name) || "[]"); } catch { return []; }
}
function writeTable(name, rows) {
  try { localStorage.setItem(LS_PREFIX + name, JSON.stringify(rows)); } catch { /* quota */ }
}
function uid() {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const av = a?.[key], bv = b?.[key];
    if (av === bv) return 0;
    const r = av > bv ? 1 : -1;
    return desc ? -r : r;
  });
}
function matches(row, where) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) return true; // operators unsupported → match all
    return row?.[k] === v || String(row?.[k] ?? "").toLowerCase() === String(v ?? "").toLowerCase();
  });
}

function makeEntity(name) {
  return {
    async list(sort, limit, skip = 0) {
      const rows = sortRows(readTable(name), sort);
      return rows.slice(skip, limit ? skip + limit : undefined);
    },
    async filter(where, sort, limit) {
      const rows = sortRows(readTable(name).filter(r => matches(r, where)), sort);
      return limit ? rows.slice(0, limit) : rows;
    },
    async get(id) {
      return readTable(name).find(r => r.id === id) || null;
    },
    async create(data) {
      const row = { id: uid(), created_date: new Date().toISOString(), updated_date: new Date().toISOString(), ...data };
      writeTable(name, [...readTable(name), row]);
      return row;
    },
    async bulkCreate(list) {
      const rows = readTable(name);
      const created = (list || []).map(d => ({ id: uid(), created_date: new Date().toISOString(), ...d }));
      writeTable(name, [...rows, ...created]);
      return created;
    },
    async update(id, data) {
      const rows = readTable(name);
      const i = rows.findIndex(r => r.id === id);
      if (i === -1) throw new Error(`${name} ${id} not found`);
      rows[i] = { ...rows[i], ...data, updated_date: new Date().toISOString() };
      writeTable(name, rows);
      return rows[i];
    },
    async delete(id) {
      writeTable(name, readTable(name).filter(r => r.id !== id));
      return { ok: true };
    },
  };
}

// CachedLayer: read-only view over bundled data (writes are accepted but ignored)
const cachedLayerEntity = {
  ...makeEntity("CachedLayer"),
  async filter(where) {
    const id = where?.category_id;
    if (!id) return [];
    const features = await loadBundled(id);
    if (!features) return [];
    return [{ id: `bundled_${id}`, category_id: id, features, feature_count: features.length, built_at: new Date().toISOString() }];
  },
  async list() { return []; },
  async create(data) { return { id: `bundled_${data?.category_id || "x"}`, ...data }; },
  async update(id, data) { return { id, ...data }; },
};

// Cave: read-only view over bundled caves.json (paginated like the Base44 entity)
const caveEntity = {
  ...makeEntity("Cave"),
  async list(sort, limit = 2000, skip = 0) {
    const caves = (await loadBundled("caves")) || [];
    return caves.slice(skip, skip + limit);
  },
  async filter(where, sort, limit) {
    const caves = (await loadBundled("caves")) || [];
    const rows = caves.filter(r => matches(r, where));
    return limit ? rows.slice(0, limit) : rows;
  },
};

const entityCache = {};
const entities = new Proxy({}, {
  get(_, name) {
    if (typeof name !== "string") return undefined;
    if (name === "CachedLayer") return cachedLayerEntity;
    if (name === "Cave") return caveEntity;
    if (!entityCache[name]) entityCache[name] = makeEntity(name);
    return entityCache[name];
  },
});

const GUEST_USER = { id: "local-user", full_name: "Lokalni uporabnik", email: "", role: "admin" };

function offlineError(what) {
  const e = new Error(`${what} ni na voljo v načinu brez povezave (offline build brez Base44).`);
  e.status = 503;
  e.offline = true;
  return e;
}

// Local answers for backend functions the UI calls (features degrade gracefully)
async function invoke(name, payload = {}) {
  switch (name) {
    case "getMaptilerKey":
    case "getCesiumToken":
      return { data: { key: null, token: null } };
    case "flightProxy":
      return { data: { states: [], flights: [] } };
    case "guestTracks": {
      const key = `${LS_PREFIX}guest_tracks_${payload.device_id || "default"}`;
      if (payload.action === "save") {
        try { localStorage.setItem(key, JSON.stringify(payload.tracks || [])); } catch { /* quota */ }
        return { data: { ok: true, tracks: payload.tracks || [] } };
      }
      if (payload.action === "generate_code") return { data: { code: null, error: "offline" } };
      if (payload.action === "use_code") return { data: { ok: false, error: "offline" } };
      let tracks = [];
      try { tracks = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* ignore */ }
      return { data: { ok: true, tracks } };
    }
    case "getMyPremiumStatus":
      return { data: { is_premium: true, role: "admin" } };
    case "collabSession":
      return { data: { ok: false, error: "offline", pins: [], messages: [] } };
    case "submitLagReport":
      return { data: { ok: true, stored: "local" } };
    case "getCaves": {
      const caves = (await loadBundled("caves")) || [];
      const skip = payload.skip || 0, limit = payload.limit || 2000;
      const page = caves.slice(skip, skip + limit);
      return { data: { caves: page, count: page.length } };
    }
    default:
      return { data: { ok: false, error: "offline" } };
  }
}

export const localClient = {
  __offline: true,
  entities,
  functions: { invoke },
  auth: {
    async me() { return GUEST_USER; },
    isAuthenticated() { return true; },
    logout() { /* nothing to clear */ },
    redirectToLogin() { /* no login in offline mode */ },
  },
  analytics: { track() { /* no-op */ } },
  integrations: {
    Core: {
      async InvokeLLM() { throw offlineError("AI pomočnik"); },
      async UploadFile() { throw offlineError("Nalaganje datotek"); },
      async SendEmail() { throw offlineError("Pošiljanje e-pošte"); },
    },
  },
};
