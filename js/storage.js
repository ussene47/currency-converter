/**
 * Safe localStorage wrapper. Private windows, full quotas or disabled storage
 * must never break the app, so every access is guarded and falls back to an
 * in-memory map.
 */

const PREFIX = 'cc:';
const memory = new Map();

function backend() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = `${PREFIX}probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

let ls = backend();

/** Re-detect storage (used by tests that swap globalThis.localStorage). */
export function resetStorageBackend() {
  ls = backend();
  memory.clear();
}

/**
 * Read a JSON value.
 * @template T
 * @param {string} key
 * @param {T} fallback returned when missing or unreadable
 * @returns {T}
 */
export function load(key, fallback) {
  try {
    const raw = ls ? ls.getItem(PREFIX + key) : memory.get(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Write a JSON value. Silently keeps it in memory when storage fails.
 * @param {string} key
 * @param {unknown} value
 */
export function save(key, value) {
  const raw = JSON.stringify(value);
  try {
    if (ls) ls.setItem(PREFIX + key, raw);
    else memory.set(key, raw);
  } catch {
    memory.set(key, raw);
  }
}

/** @param {string} key */
export function remove(key) {
  try {
    if (ls) ls.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

/**
 * Store data together with the time it was fetched.
 * @param {string} key
 * @param {unknown} data
 * @param {number} [now=Date.now()]
 */
export function saveCached(key, data, now = Date.now()) {
  save(key, { savedAt: now, data });
}

/**
 * Read cached data and report whether it is still fresh.
 * @template T
 * @param {string} key
 * @param {number} maxAgeMs
 * @param {number} [now=Date.now()]
 * @returns {{data: T, savedAt: number, fresh: boolean}|null}
 */
export function loadCached(key, maxAgeMs, now = Date.now()) {
  const entry = load(key, null);
  if (!entry || typeof entry.savedAt !== 'number' || entry.data == null) return null;
  const age = now - entry.savedAt;
  return { data: entry.data, savedAt: entry.savedAt, fresh: age >= 0 && age < maxAgeMs };
}

/**
 * Keep a bounded most-recent-first list without duplicates.
 * @template T
 * @param {T[]} list
 * @param {T} item
 * @param {number} max
 * @param {(a: T, b: T) => boolean} [same]
 * @returns {T[]} new list
 */
export function pushRecent(list, item, max, same = (a, b) => a === b) {
  return [item, ...list.filter((x) => !same(x, item))].slice(0, max);
}
