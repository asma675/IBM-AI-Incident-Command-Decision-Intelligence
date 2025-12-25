/*
  Tiny local "database" backed by localStorage (when available).
  Falls back to in-memory storage during SSR/build.

  Tables are stored as arrays of records.
  Each record has at least: { id, created_date, updated_date }
*/

const STORAGE_KEY = "icdi_local_db_v1";
const META_KEY = "icdi_local_meta_v1";

const hasLocalStorage = () => {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
};

const memory = {
  db: null,
  meta: null,
};

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  // Browser-safe UUID.
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function loadJson(key, fallback) {
  if (!hasLocalStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadDb() {
  if (memory.db) return memory.db;
  const initial = { tables: {}, version: 1 };
  memory.db = hasLocalStorage() ? loadJson(STORAGE_KEY, initial) : initial;
  return memory.db;
}

function saveDb() {
  if (!memory.db) return;
  saveJson(STORAGE_KEY, memory.db);
}

function loadMeta() {
  if (memory.meta) return memory.meta;
  const initial = { seeded: false, currentUser: null };
  memory.meta = hasLocalStorage() ? loadJson(META_KEY, initial) : initial;
  return memory.meta;
}

function saveMeta() {
  if (!memory.meta) return;
  saveJson(META_KEY, memory.meta);
}

function ensureTable(table) {
  const d = loadDb();
  if (!d.tables[table]) d.tables[table] = [];
  return d.tables[table];
}

function sortByField(items, sort) {
  if (!sort) return items;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  const copy = [...items];
  copy.sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    // Dates often stored as ISO strings; lexical sort works.
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
  return copy;
}

function matchesWhere(record, where) {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (Array.isArray(v)) {
      // Match any overlap for arrays.
      const rv = record?.[k];
      if (!Array.isArray(rv)) return false;
      return v.some((x) => rv.includes(x));
    }
    return record?.[k] === v;
  });
}

export const db = {
  // meta helpers
  getMeta(key) {
    const m = loadMeta();
    return m[key];
  },
  setMeta(key, value) {
    const m = loadMeta();
    m[key] = value;
    saveMeta();
  },

  // table helpers
  async list(table, { sort = "-created_date", limit = 100 } = {}) {
    const t = ensureTable(table);
    return sortByField(t, sort).slice(0, limit);
  },

  async filter(table, { where = {}, sort = "-created_date", limit = 1000 } = {}) {
    const t = ensureTable(table);
    const filtered = t.filter((r) => matchesWhere(r, where));
    return sortByField(filtered, sort).slice(0, limit);
  },

  async create(table, data) {
    const t = ensureTable(table);
    const rec = {
      id: uuid(),
      created_date: nowIso(),
      updated_date: nowIso(),
      ...data,
    };
    t.push(rec);
    saveDb();
    return rec;
  },

  async update(table, id, patch) {
    const t = ensureTable(table);
    const idx = t.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Record not found: ${table}.${id}`);
    t[idx] = { ...t[idx], ...patch, updated_date: nowIso() };
    saveDb();
    return t[idx];
  },

  async remove(table, id) {
    const t = ensureTable(table);
    const idx = t.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: true };
    t.splice(idx, 1);
    saveDb();
    return { ok: true };
  },

  // for debugging / export
  _unsafeDump() {
    return loadDb();
  },
};
