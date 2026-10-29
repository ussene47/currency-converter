/**
 * All network access lives here, so the rate provider can be swapped by
 * editing this one file.
 *
 * Latest rates: ExchangeRate-API open access endpoint (no key, daily updates).
 * History:      fawazahmed0/exchange-api via jsDelivr, Cloudflare Pages fallback.
 */
import { loadCached, saveCached, load, save } from './storage.js';
import { sampleDates } from './utils.js';

export const LATEST_URL = 'https://open.er-api.com/v6/latest/USD';
export const HISTORY_PRIMARY = (date, base) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base}.min.json`;
export const HISTORY_FALLBACK = (date, base) =>
  `https://${date}.currency-api.pages.dev/v1/currencies/${base}.min.json`;

export const SOURCE = { name: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com' };

const RATES_KEY = 'rates:USD';
const RATES_TTL = 60 * 60 * 1000; // 1 hour
const TIMEOUT_MS = 10000;

/** Error with a machine-readable `kind` the UI maps to a friendly message. */
export class ApiError extends Error {
  /** @param {'offline'|'rate-limit'|'server'|'timeout'|'bad-data'} kind */
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind;
  }
}

/**
 * fetch() with a timeout and normalised errors.
 * @param {string} url
 * @returns {Promise<any>} parsed JSON
 */
async function fetchJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (err) {
    throw new ApiError(err?.name === 'AbortError' ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new ApiError('rate-limit');
  if (!res.ok) throw new ApiError('server', `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ApiError('bad-data');
  }
}

/**
 * @typedef {Object} RatesResult
 * @property {Record<string, number>} rates rates relative to USD
 * @property {number} updatedAt provider update time (ms epoch)
 * @property {number} fetchedAt when this device fetched them (ms epoch)
 * @property {boolean} fromCache served from local cache
 * @property {boolean} stale cache used because the network failed
 * @property {ApiError} [error] the network error when stale
 */

/**
 * Latest rates, cached for one hour. Falls back to any cached copy (however
 * old) when the network fails, and flags the result as stale.
 * @param {{force?: boolean}} [opts]
 * @returns {Promise<RatesResult>}
 */
export async function getLatestRates({ force = false } = {}) {
  const cached = loadCached(RATES_KEY, RATES_TTL);
  if (cached && cached.fresh && !force) {
    return { ...cached.data, fetchedAt: cached.savedAt, fromCache: true, stale: false };
  }
  try {
    const json = await fetchJSON(LATEST_URL);
    if (json?.result !== 'success' || !json.rates || typeof json.rates.USD !== 'number') {
      throw new ApiError(json?.['error-type'] === 'rate-limited' ? 'rate-limit' : 'bad-data');
    }
    const data = {
      rates: json.rates,
      updatedAt: (json.time_last_update_unix || Date.now() / 1000) * 1000,
    };
    saveCached(RATES_KEY, data);
    return { ...data, fetchedAt: Date.now(), fromCache: false, stale: false };
  } catch (error) {
    if (cached) {
      return { ...cached.data, fetchedAt: cached.savedAt, fromCache: true, stale: true, error };
    }
    throw error;
  }
}

/**
 * One historical rate, trying the jsDelivr CDN first and then the fallback.
 * @param {string} date YYYY-MM-DD
 * @param {string} from ISO code
 * @param {string} to ISO code
 * @returns {Promise<number|null>}
 */
async function fetchHistoricalRate(date, from, to) {
  const base = from.toLowerCase();
  const target = to.toLowerCase();
  for (const build of [HISTORY_PRIMARY, HISTORY_FALLBACK]) {
    try {
      const json = await fetchJSON(build(date, base));
      const rate = json?.[base]?.[target];
      return typeof rate === 'number' && rate > 0 ? rate : null;
    } catch (err) {
      if (err.kind === 'offline') throw err;
    }
  }
  return null;
}

/**
 * Run async tasks with limited parallelism.
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @returns {Promise<PromiseSettledResult<T>[]>}
 */
async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/**
 * Rate history for a pair. Past daily rates never change, so every point
 * fetched is cached permanently and only missing dates hit the network.
 * @param {string} from
 * @param {string} to
 * @param {number} days 7 | 30 | 90 | 365
 * @returns {Promise<{date: string, rate: number}[]>} oldest first
 */
export async function getHistory(from, to, days) {
  const key = `hist:${from}-${to}`;
  const known = load(key, {});
  const dates = sampleDates(days, new Date(), days <= 7 ? 8 : 16);
  const missing = dates.filter((d) => !(d in known));

  if (missing.length) {
    const results = await pool(
      missing.map((d) => () => fetchHistoricalRate(d, from, to)),
      4,
    );
    let offline = false;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value != null) known[missing[i]] = r.value;
      if (r.status === 'rejected' && r.reason?.kind === 'offline') offline = true;
    });
    // keep the cache bounded: most recent ~400 points per pair
    const trimmed = Object.fromEntries(Object.entries(known).sort().slice(-400));
    save(key, trimmed);
    const have = dates.filter((d) => d in trimmed);
    if (!have.length) throw new ApiError(offline ? 'offline' : 'server');
  }
  return dates.filter((d) => d in known).map((date) => ({ date, rate: known[date] }));
}
