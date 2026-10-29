/**
 * App entry point: state, wiring and rendering.
 */
import { getLatestRates, getHistory, ApiError } from './api.js';
import { load, save, pushRecent } from './storage.js';
import {
  t, setLanguage, getLanguage, getLocale, detectLanguage, translateDom, formatWhen,
} from './i18n.js';
import { CURRENCY_REGIONS, currencyInfo, currencyForLocale } from './currencies.js';
import {
  parseAmount, convert, pairRate, formatNumber, formatInput, debounce, seriesStats,
} from './utils.js';
import { CurrencyPicker, renderCurrencyButton, toast } from './ui.js';
import { drawChart, clearChart } from './chart.js';

const $ = (id) => document.getElementById(id);
const CODE_RE = /^[A-Z]{3}$/;
const HISTORY_MAX = 20;
const DEFAULT_TARGETS = ['EUR', 'ZAR', 'GBP', 'CNY'];

const state = {
  amount: 100,
  from: 'USD',
  to: 'MZN',
  targets: load('targets', DEFAULT_TARGETS),
  favorites: load('favorites', []),
  history: load('history', []),
  range: load('range', 30),
  mode: 'single',
  /** @type {import('./api.js').RatesResult|null} */
  rates: null,
  ratesError: null,
};

const els = {};

/* ------------------------------------------------------------------ init */

function init() {
  [
    'amount', 'amountCode', 'amountError', 'fromBtn', 'toBtn', 'swapBtn', 'result', 'resultFrom',
    'resultValue', 'rateLine', 'inverseLine', 'copyBtn', 'shareBtn', 'updatedText', 'banner',
    'bannerText', 'bannerRetry', 'multiList', 'addTargetBtn', 'toField', 'chart', 'chartMsg',
    'chartPair', 'statHigh', 'statLow', 'statChange', 'historyList', 'historyEmpty',
    'clearHistory', 'themeToggle', 'rangeGroup',
  ].forEach((id) => { els[id] = $(id); });

  setLanguage(load('lang', null) || detectLanguage());
  applyLanguage();
  readInitialState();

  els.amount.value = formatInput(state.amount, getLocale());
  renderPair();
  renderHistory();
  renderRangeButtons();

  picker = new CurrencyPicker({
    getCodes: availableCodes,
    getFavorites: () => state.favorites,
    toggleFavorite,
  });

  bindEvents();
  refreshRates();
  setupChartObserver();
  registerServiceWorker();
  setInterval(() => refreshRates({ quiet: true }), 15 * 60 * 1000);
}

/** @type {CurrencyPicker} */
let picker;

/**
 * URL parameters win, then the last pair used, then a locale-based guess.
 */
function readInitialState() {
  const params = new URLSearchParams(location.search);
  const last = load('pair', null);
  const localCur = currencyForLocale(navigator.language);

  let from = (params.get('from') || '').toUpperCase();
  let to = (params.get('to') || '').toUpperCase();
  if (!CODE_RE.test(from)) from = last?.from || 'USD';
  if (!CODE_RE.test(to)) to = last?.to || (localCur && localCur !== from ? localCur : 'MZN');
  if (to === from) to = from === 'MZN' ? 'USD' : 'MZN';

  const urlAmount = parseAmount(params.get('amount') || '', 'en');
  state.amount = urlAmount ?? last?.amount ?? 100;
  state.from = from;
  state.to = to;
}

/* ---------------------------------------------------------------- events */

function bindEvents() {
  const live = debounce(() => update(), 180);
  els.amount.addEventListener('input', () => {
    live();
  });
  els.amount.addEventListener('blur', () => {
    const n = parseAmount(els.amount.value, getLocale());
    if (n != null) els.amount.value = formatInput(n, getLocale());
  });
  els.amount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      live.cancel();
      update({ record: true });
    }
  });

  els.fromBtn.addEventListener('click', () => choose('from'));
  els.toBtn.addEventListener('click', () => choose('to'));
  els.swapBtn.addEventListener('click', swap);
  els.copyBtn.addEventListener('click', copyResult);
  els.shareBtn.addEventListener('click', share);
  els.addTargetBtn.addEventListener('click', addTarget);
  els.multiList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    state.targets = state.targets.filter((c) => c !== btn.dataset.remove);
    save('targets', state.targets);
    renderMulti();
    els.addTargetBtn.focus();
  });

  els.historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-index]');
    if (!btn) return;
    const item = state.history[Number(btn.dataset.index)];
    if (!item) return;
    state.from = item.from;
    state.to = item.to;
    state.amount = item.amount;
    els.amount.value = formatInput(item.amount, getLocale());
    renderPair();
    update();
    loadChart();
    els.amount.focus();
  });
  els.clearHistory.addEventListener('click', () => {
    state.history = [];
    save('history', []);
    renderHistory();
  });

  els.rangeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-range]');
    if (!btn) return;
    state.range = Number(btn.dataset.range);
    save('range', state.range);
    renderRangeButtons();
    loadChart();
  });

  document.querySelectorAll('[data-lang]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const prevLocale = getLocale();
      setLanguage(btn.dataset.lang);
      save('lang', getLanguage());
      applyLanguage();
      const n = parseAmount(els.amount.value, prevLocale);
      if (n != null) {
        state.amount = n;
        els.amount.value = formatInput(n, getLocale());
      }
      renderPair();
      renderHistory();
      update();
      loadChart();
    }));

  els.themeToggle.addEventListener('click', toggleTheme);
  els.bannerRetry.addEventListener('click', () => refreshRates({ force: true }));

  setupTabs();
  document.addEventListener('keydown', onShortcut);
  window.addEventListener('online', () => refreshRates({ force: true }));
  window.addEventListener('offline', () => renderStatus());
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    updateThemeLabel();
    loadChart();
  });
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((tb) => {
      const on = tb === tab;
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      $(tb.getAttribute('aria-controls')).hidden = !on;
    });
    state.mode = tab.id === 'tab-multi' ? 'multi' : 'single';
    els.toField.hidden = state.mode === 'multi';
    els.swapBtn.hidden = state.mode === 'multi';
    if (state.mode === 'multi') renderMulti();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      select(next);
    });
  });
}

/** @param {KeyboardEvent} e */
function onShortcut(e) {
  if (picker.isOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  const editing = e.target instanceof HTMLElement &&
    (e.target.matches('input, textarea, select') || e.target.isContentEditable);
  if (e.key === '/') {
    // "/" is never part of an amount, so it works even from the amount field
    e.preventDefault();
    if (state.mode === 'multi') addTarget();
    else choose('to');
  } else if (!editing && (e.key === 's' || e.key === 'S') && state.mode === 'single') {
    e.preventDefault();
    swap();
  }
}

/* --------------------------------------------------------------- actions */

async function choose(side) {
  const btn = side === 'from' ? els.fromBtn : els.toBtn;
  const code = await picker.open({
    selected: state[side],
    title: `${t(side)} · ${t('chooseCurrency')}`,
  });
  btn.focus();
  if (!code || code === state[side]) return;
  const other = side === 'from' ? 'to' : 'from';
  if (code === state[other]) state[other] = state[side]; // picking the other side's currency swaps
  state[side] = code;
  renderPair();
  update();
  loadChart();
}

async function addTarget() {
  const code = await picker.open({
    exclude: [state.from, ...state.targets],
    title: t('addCurrency'),
  });
  els.addTargetBtn.focus();
  if (!code) return;
  state.targets = [...state.targets, code];
  save('targets', state.targets);
  renderMulti();
}

function swap() {
  [state.from, state.to] = [state.to, state.from];
  els.swapBtn.classList.toggle('spin');
  renderPair();
  update();
  loadChart();
}

function toggleFavorite(code) {
  state.favorites = state.favorites.includes(code)
    ? state.favorites.filter((c) => c !== code)
    : [...state.favorites, code];
  save('favorites', state.favorites);
}

async function copyResult() {
  const r = currentResult();
  if (!r) return;
  const text = `${formatNumber(r.value, getLocale())} ${state.to}`;
  (await copyText(text)) ? toast(t('copied')) : toast(t('copyFailed'));
}

async function share() {
  const r = currentResult();
  const url = location.href;
  const text = r
    ? t('shareText', {
      amount: formatInput(r.amount, getLocale()),
      from: state.from,
      result: formatNumber(r.value, getLocale()),
      to: state.to,
    })
    : t('appTitle');
  if (navigator.share) {
    try {
      await navigator.share({ title: t('appTitle'), text, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  (await copyText(url)) ? toast(t('linkCopied')) : toast(t('copyFailed'));
}

/**
 * Copy with the async Clipboard API, falling back to execCommand.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function toggleTheme() {
  const root = document.documentElement;
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  save('theme', next);
  updateThemeLabel();
  loadChart();
}

function isDark() {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateThemeLabel() {
  els.themeToggle.setAttribute('aria-label', t(isDark() ? 'themeToLight' : 'themeToDark'));
  els.themeToggle.title = els.themeToggle.getAttribute('aria-label');
}

/* ----------------------------------------------------------------- rates */

let refreshing = false;
async function refreshRates({ force = false, quiet = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  if (!state.rates && !quiet) setBusy(true);
  try {
    state.rates = await getLatestRates({ force });
    state.ratesError = state.rates.stale ? state.rates.error : null;
  } catch (err) {
    state.ratesError = err;
  } finally {
    refreshing = false;
    setBusy(false);
    renderStatus();
    update();
  }
}

function setBusy(busy) {
  els.result.setAttribute('aria-busy', String(busy));
}

/** @returns {string[]} */
function availableCodes() {
  const codes = state.rates ? Object.keys(state.rates.rates) : Object.keys(CURRENCY_REGIONS);
  return codes.filter((c) => CODE_RE.test(c));
}

function currentResult() {
  if (!state.rates) return null;
  const amount = parseAmount(els.amount.value, getLocale());
  if (amount == null) return null;
  const value = convert(amount, state.from, state.to, state.rates.rates);
  return value == null ? null : { amount, value };
}

/* ---------------------------------------------------------------- render */

function applyLanguage() {
  document.documentElement.lang = getLanguage() === 'pt' ? 'pt-MZ' : 'en';
  translateDom();
  document.querySelectorAll('[data-lang]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.lang === getLanguage())));
  document.title = `${t('appTitle')} — ${t('tagline')}`;
  updateThemeLabel();
  if (state.rates) renderStatus();
}

function renderPair() {
  renderCurrencyButton(els.fromBtn, state.from);
  renderCurrencyButton(els.toBtn, state.to);
  els.amountCode.textContent = state.from;
  els.chartPair.textContent = `${state.from} → ${state.to}`;
  save('pair', { from: state.from, to: state.to, amount: state.amount });
}

const recordLater = debounce(() => recordHistory(), 1500);
const syncUrlLater = debounce(() => syncUrl(), 400);

/**
 * Recalculate and redraw the conversion.
 * @param {{record?: boolean}} [opts]
 */
function update({ record = false } = {}) {
  const locale = getLocale();
  const raw = els.amount.value;
  const amount = parseAmount(raw, locale);
  const wrap = els.amount.parentElement;

  let error = '';
  if (!raw.trim()) error = t('errorEmpty');
  else if (amount == null) error = t('errorInvalid');
  els.amountError.textContent = error;
  wrap.classList.toggle('is-invalid', Boolean(error) && Boolean(raw.trim()));
  els.amount.setAttribute('aria-invalid', String(Boolean(error) && Boolean(raw.trim())));

  if (amount != null) state.amount = amount;
  renderMulti();

  if (!state.rates) {
    if (state.ratesError) showResultError(t('errorNoData'));
    return;
  }
  const rates = state.rates.rates;
  const missing = [state.from, state.to].find((c) => !(rates[c] > 0));
  if (missing) {
    showResultError(t('errorMissing', { code: missing }));
    return;
  }
  els.result.classList.remove('is-error');

  const rate = pairRate(state.from, state.to, rates);
  const inverse = pairRate(state.to, state.from, rates);
  els.rateLine.textContent = t('rateLine', { from: state.from, to: state.to, rate: formatNumber(rate, locale) });
  els.inverseLine.textContent = t('rateLine', { from: state.to, to: state.from, rate: formatNumber(inverse, locale) });
  els.updatedText.textContent = t('updated', { time: formatWhen(state.rates.updatedAt) });

  if (amount == null) {
    els.resultFrom.textContent = '';
    els.resultValue.textContent = '—';
    return;
  }
  const value = convert(amount, state.from, state.to, rates);
  els.resultFrom.textContent = `${formatInput(amount, locale)} ${currencyInfo(state.from, locale).name} =`;
  const next = formatNumber(value, locale);
  if (els.resultValue.dataset.value !== `${next}${state.to}`) {
    els.resultValue.innerHTML = '';
    els.resultValue.append(next);
    const code = document.createElement('span');
    code.className = 'code';
    code.textContent = state.to;
    els.resultValue.append(code);
    els.resultValue.dataset.value = `${next}${state.to}`;
    els.resultValue.classList.remove('bump');
    void els.resultValue.offsetWidth; // restart animation
    els.resultValue.classList.add('bump');
  }

  save('pair', { from: state.from, to: state.to, amount });
  syncUrlLater();
  if (record) {
    recordLater.cancel();
    recordHistory();
  } else {
    recordLater();
  }
}

function showResultError(message) {
  els.result.classList.add('is-error');
  els.resultFrom.textContent = '';
  els.resultValue.textContent = message;
  els.resultValue.dataset.value = '';
  els.rateLine.textContent = '';
  els.inverseLine.textContent = '';
}

function renderStatus() {
  const err = state.ratesError;
  const r = state.rates;
  const offline = !navigator.onLine || err?.kind === 'offline' || err?.kind === 'timeout';
  let text = '';
  let isError = false;
  if (!r && err) {
    text = err.kind === 'offline' || !navigator.onLine ? t('errorNoData') : t('errorServer');
    isError = true;
  } else if (r && err) {
    if (err.kind === 'rate-limit') text = t('rateLimited');
    else if (offline) text = t('offlineBanner', { time: formatWhen(r.fetchedAt) });
    else text = t('staleBanner', { time: formatWhen(r.fetchedAt) });
  } else if (r && !navigator.onLine) {
    text = t('offlineBanner', { time: formatWhen(r.fetchedAt) });
  }
  els.banner.hidden = !text;
  els.banner.classList.toggle('is-error', isError);
  els.bannerText.textContent = text;
  if (r) els.updatedText.textContent = t('updated', { time: formatWhen(r.updatedAt) });
}

function renderMulti() {
  if (state.mode !== 'multi') return;
  const locale = getLocale();
  const rates = state.rates?.rates;
  const amount = parseAmount(els.amount.value, locale);
  const frag = document.createDocumentFragment();
  state.targets.filter((c) => c !== state.from).forEach((code) => {
    const info = currencyInfo(code, locale);
    const value = rates && amount != null ? convert(amount, state.from, code, rates) : null;
    const rate = rates ? pairRate(state.from, code, rates) : null;
    const li = document.createElement('li');
    li.className = 'multi-item';
    li.innerHTML = `<span class="flag" aria-hidden="true"></span>
      <div class="multi-main"><div class="multi-value"></div><div class="multi-sub"></div></div>
      <button type="button" class="icon-btn" data-remove="${code}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>`;
    li.querySelector('.flag').textContent = info.flag;
    li.querySelector('.multi-value').textContent = value == null ? `— ${code}` : `${formatNumber(value, locale)} ${code}`;
    li.querySelector('.multi-sub').textContent = rate == null
      ? info.name
      : `${info.name} · ${t('rateLine', { from: state.from, to: code, rate: formatNumber(rate, locale) })}`;
    li.querySelector('button').setAttribute('aria-label', t('remove', { code }));
    frag.append(li);
  });
  els.multiList.replaceChildren(frag);
}

function recordHistory() {
  const r = currentResult();
  if (!r || r.amount === 0) return;
  const item = { from: state.from, to: state.to, amount: r.amount, value: r.value, at: Date.now() };
  state.history = pushRecent(state.history, item, HISTORY_MAX,
    (a, b) => a.from === b.from && a.to === b.to && a.amount === b.amount);
  save('history', state.history);
  renderHistory();
}

function renderHistory() {
  const locale = getLocale();
  const frag = document.createDocumentFragment();
  state.history.forEach((h, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.index = String(i);
    const text = `${formatInput(h.amount, locale)} ${h.from} → ${formatNumber(h.value, locale)} ${h.to}`;
    btn.innerHTML = '<span class="h-main"></span><span class="h-time"></span>';
    btn.querySelector('.h-main').textContent = text;
    btn.querySelector('.h-time').textContent = formatWhen(h.at);
    btn.setAttribute('aria-label', t('reuse', { text }));
    li.append(btn);
    frag.append(li);
  });
  els.historyList.replaceChildren(frag);
  els.historyEmpty.hidden = state.history.length > 0;
  els.clearHistory.hidden = state.history.length === 0;
}

function renderRangeButtons() {
  els.rangeGroup.querySelectorAll('[data-range]').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.range) === state.range)));
}

function syncUrl() {
  const params = new URLSearchParams({ from: state.from, to: state.to, amount: String(state.amount) });
  const url = `${location.pathname}?${params}`;
  if (url !== `${location.pathname}${location.search}`) history.replaceState(null, '', url);
}

/* ----------------------------------------------------------------- chart */

let chartVisible = false;
let chartToken = 0;

function setupChartObserver() {
  const card = document.querySelector('.chart-card');
  if (!('IntersectionObserver' in window)) {
    chartVisible = true;
    loadChart();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      chartVisible = true;
      io.disconnect();
      loadChart();
    }
  }, { rootMargin: '200px' });
  io.observe(card);
}

async function loadChart() {
  if (!chartVisible) return;
  const token = ++chartToken;
  const box = els.chart.parentElement;
  const locale = getLocale();
  const setStats = (high, low, change, cls = '') => {
    els.statHigh.textContent = high;
    els.statLow.textContent = low;
    els.statChange.textContent = change;
    els.statChange.className = cls;
  };

  if (state.from === state.to) {
    clearChart();
    els.chartMsg.textContent = t('chartSameCurrency');
    setStats('—', '—', '—');
    return;
  }
  box.classList.add('loading');
  els.chartMsg.textContent = t('chartLoading');
  try {
    const points = await getHistory(state.from, state.to, state.range);
    if (token !== chartToken) return;
    const stats = seriesStats(points);
    if (!stats) throw new ApiError('bad-data');
    await drawChart(els.chart, points, { locale, label: `${state.from}/${state.to}` });
    if (token !== chartToken) return;
    const sign = stats.changePct > 0 ? '+' : '';
    const pct = `${sign}${formatNumber(stats.changePct, locale, 2)}%`;
    setStats(formatNumber(stats.high, locale), formatNumber(stats.low, locale), pct,
      stats.changePct > 0 ? 'up' : stats.changePct < 0 ? 'down' : '');
    els.chart.setAttribute('aria-label',
      `${t('chartTitle')} ${state.from} → ${state.to}: ${t('high')} ${formatNumber(stats.high, locale)}, ` +
      `${t('low')} ${formatNumber(stats.low, locale)}, ${t('change')} ${pct}`);
    els.chartMsg.textContent = '';
  } catch (err) {
    if (token !== chartToken) return;
    clearChart();
    setStats('—', '—', '—');
    els.chartMsg.textContent = err?.kind === 'offline' || !navigator.onLine ? t('chartOffline') : t('chartError');
  } finally {
    if (token === chartToken) box.classList.remove('loading');
  }
}

/* ------------------------------------------------------------------- pwa */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const register = () => navigator.serviceWorker.register('sw.js').catch(() => { /* non-fatal */ });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
