/**
 * Pure helpers: parsing, conversion maths and formatting.
 * No DOM access here, so everything is unit-testable in Node.
 */

/**
 * Decimal separator for a locale ("," for pt-MZ, "." for en).
 * @param {string} locale
 * @returns {string}
 */
export function decimalSeparator(locale) {
  const part = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal');
  return part ? part.value : '.';
}

/**
 * Parse a human-typed amount. Accepts "1,500.50", "1.500,50", "1 500,50",
 * "1500", "$ 20", "1'000.5". When a single separator is followed by exactly
 * three digits ("1,500" / "1.500") it is ambiguous, so the locale decides.
 * @param {string} input raw text
 * @param {string} [locale='en']
 * @returns {number|null} the number, or null when the text is not a valid amount
 */
export function parseAmount(input, locale = 'en') {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  // strip currency symbols, letters and every kind of space / apostrophe grouping
  s = s.replace(/[\s  '’]/g, '').replace(/[^\d.,\-+]/g, '');
  if (!s || /[-+]/.test(s.slice(1))) return null;
  if (s.startsWith('-')) return null; // negative money makes no sense here
  s = s.replace(/^\+/, '');
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimal = null;

  if (lastDot !== -1 && lastComma !== -1) {
    decimal = lastDot > lastComma ? '.' : ',';
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const count = s.split(sep).length - 1;
    const after = s.length - s.lastIndexOf(sep) - 1;
    if (count > 1) {
      decimal = null; // "1.000.000" → grouping only
      // but "1.000.000" with groups that are not 3 digits is invalid
      const groups = s.split(sep);
      if (groups.slice(1).some((g) => g.length !== 3)) return null;
    } else if (after === 3 && s.indexOf(sep) > 0) {
      decimal = decimalSeparator(locale) === sep ? sep : null;
    } else {
      decimal = sep;
    }
  }

  let normalised;
  if (decimal) {
    const [intPart, ...rest] = s.split(decimal);
    if (rest.length !== 1) return null;
    normalised = `${intPart.replace(/[.,]/g, '')}.${rest[0]}`;
    if (/[.,]/.test(rest[0])) return null;
  } else {
    normalised = s.replace(/[.,]/g, '');
  }
  if (normalised.startsWith('.')) normalised = `0${normalised}`;
  if (!/^\d+(\.\d*)?$/.test(normalised)) return null;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert between two currencies using rates that share one base.
 * @param {number} amount
 * @param {string} from ISO code
 * @param {string} to ISO code
 * @param {Record<string, number>} rates rates relative to a common base
 * @returns {number|null} converted amount, or null when a rate is missing
 */
export function convert(amount, from, to, rates) {
  if (!Number.isFinite(amount) || !rates) return null;
  if (from === to) return amount;
  const rFrom = rates[from];
  const rTo = rates[to];
  if (!(rFrom > 0) || !(rTo > 0)) return null;
  return (amount / rFrom) * rTo;
}

/**
 * Unit rate between two currencies (1 from = x to).
 * @param {string} from
 * @param {string} to
 * @param {Record<string, number>} rates
 * @returns {number|null}
 */
export function pairRate(from, to, rates) {
  return convert(1, from, to, rates);
}

/**
 * How many fraction digits a money value deserves: 2 normally, more for tiny
 * values so that 1 MZN = 0.0157 USD does not collapse into "0.02".
 * @param {number} value
 * @returns {number} between 2 and 8
 */
export function fractionDigitsFor(value) {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs === 0 || abs >= 1) return 2;
  // keep 4 significant digits
  const digits = Math.ceil(-Math.log10(abs)) + 3;
  return Math.min(8, Math.max(2, digits));
}

/**
 * Round half away from zero without float artefacts (1.005 → 1.01).
 * @param {number} value
 * @param {number} digits
 * @returns {number}
 */
export function roundMoney(value, digits = 2) {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const [m, e = '0'] = String(Math.abs(value)).split('e');
  const shifted = Math.round(Number(`${m}e${Number(e) + digits}`));
  const [m2, e2 = '0'] = String(shifted).split('e');
  return sign * Number(`${m2}e${Number(e2) - digits}`);
}

/**
 * Locale-aware number formatting with smart precision.
 * @param {number} value
 * @param {string} locale
 * @param {number} [digits] fixed fraction digits; auto when omitted
 * @returns {string}
 */
export function formatNumber(value, locale, digits) {
  if (!Number.isFinite(value)) return '—';
  const d = digits ?? fractionDigitsFor(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Math.min(2, d),
    maximumFractionDigits: d,
  }).format(roundMoney(value, d));
}

/**
 * Format an amount typed by the user, keeping up to 8 decimals they entered.
 * @param {number} value
 * @param {string} locale
 * @returns {string}
 */
export function formatInput(value, locale) {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(value);
}

/**
 * Debounce a function.
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} wait ms
 * @returns {F & {cancel: () => void}}
 */
export function debounce(fn, wait) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/**
 * Summary statistics for a rate series.
 * @param {{date: string, rate: number}[]} points ordered oldest → newest
 * @returns {{high: number, low: number, change: number, changePct: number}|null}
 */
export function seriesStats(points) {
  const values = points.map((p) => p.rate).filter((v) => Number.isFinite(v));
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  return {
    high: Math.max(...values),
    low: Math.min(...values),
    change: last - first,
    changePct: first ? ((last - first) / first) * 100 : 0,
  };
}

/**
 * ISO dates (YYYY-MM-DD) to sample for a history range, oldest first.
 * Large ranges are sampled so the chart needs at most ~maxPoints requests.
 * @param {number} days range length
 * @param {Date} [today]
 * @param {number} [maxPoints=16]
 * @returns {string[]}
 */
export function sampleDates(days, today = new Date(), maxPoints = 16) {
  const step = Math.max(1, Math.ceil(days / (maxPoints - 1)));
  const out = [];
  for (let back = days; back > 0; back -= step) {
    out.push(isoDate(addDays(today, -back)));
  }
  out.push(isoDate(addDays(today, -1)));
  return [...new Set(out)];
}

function addDays(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** @param {Date} d @returns {string} */
export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
