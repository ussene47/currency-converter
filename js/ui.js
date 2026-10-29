/**
 * Reusable UI pieces: currency picker (combobox + listbox in a dialog),
 * toast notifications and small render helpers.
 */
import { t, getLocale } from './i18n.js';
import { currencyInfo, searchCurrencies, POPULAR } from './currencies.js';

const STAR_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>';

/**
 * Fill a currency button (flag, code, localised name).
 * @param {HTMLElement} btn
 * @param {string} code
 */
export function renderCurrencyButton(btn, code) {
  const info = currencyInfo(code, getLocale());
  btn.querySelector('.flag').textContent = info.flag;
  btn.querySelector('.cur-code').textContent = code;
  btn.querySelector('.cur-name').textContent = info.name;
  btn.dataset.code = code;
}

let toastTimer;
/**
 * Show a short status message.
 * @param {string} message
 */
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/**
 * Accessible currency picker. One instance is shared by every currency
 * field; open() resolves with the chosen code (or null when dismissed).
 */
export class CurrencyPicker {
  /**
   * @param {{
   *   getCodes: () => string[],
   *   getFavorites: () => string[],
   *   toggleFavorite: (code: string) => void,
   * }} deps
   */
  constructor(deps) {
    this.deps = deps;
    this.dialog = /** @type {HTMLDialogElement} */ (document.getElementById('picker'));
    this.search = /** @type {HTMLInputElement} */ (document.getElementById('pickerSearch'));
    this.list = document.getElementById('pickerList');
    this.options = [];
    this.active = -1;
    this.selected = null;
    this.exclude = [];
    this.resolve = null;

    this.search.addEventListener('input', () => this.render());
    this.search.addEventListener('keydown', (e) => this.onKey(e));
    this.list.addEventListener('click', (e) => this.onClick(e));
    this.list.addEventListener('mousemove', (e) => {
      const opt = e.target.closest('[role="option"]');
      if (opt) this.setActive(this.options.indexOf(opt), false);
    });
    document.getElementById('pickerClose').addEventListener('click', () => this.close(null));
    this.dialog.addEventListener('close', () => this.finish(null));
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close(null); // backdrop click
    });
  }

  /** @returns {boolean} */
  get isOpen() {
    return this.dialog.open;
  }

  /**
   * Open the picker.
   * @param {{selected?: string, exclude?: string[], title?: string}} [opts]
   * @returns {Promise<string|null>}
   */
  open({ selected = null, exclude = [], title } = {}) {
    this.selected = selected;
    this.exclude = exclude;
    document.getElementById('pickerTitle').textContent = title || t('chooseCurrency');
    this.search.value = '';
    this.render();
    this.dialog.showModal();
    this.search.focus();
    const idx = this.options.findIndex((o) => o.dataset.code === selected);
    this.setActive(idx >= 0 ? idx : 0, true);
    return new Promise((res) => {
      this.resolve = res;
    });
  }

  /** @param {string|null} code */
  close(code) {
    this.finish(code);
    if (this.dialog.open) this.dialog.close();
  }

  finish(code) {
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r(code);
    }
  }

  render() {
    const locale = getLocale();
    const all = this.deps.getCodes().filter((c) => !this.exclude.includes(c));
    const q = this.search.value;
    const favs = this.deps.getFavorites().filter((c) => all.includes(c));
    const frag = document.createDocumentFragment();
    this.options = [];

    const addGroup = (label, codes) => {
      if (!codes.length) return;
      const head = document.createElement('li');
      head.className = 'picker-group';
      head.setAttribute('role', 'presentation');
      head.textContent = label;
      frag.append(head);
      codes.forEach((code) => frag.append(this.option(code, favs.includes(code), locale)));
    };

    if (q.trim()) {
      addGroup(t('allCurrencies'), searchCurrencies(all, q, locale));
    } else {
      const top = favs.length ? favs : POPULAR.filter((c) => all.includes(c));
      addGroup(favs.length ? t('favorites') : t('popular'), top);
      addGroup(t('allCurrencies'), [...all].sort().filter((c) => !top.includes(c)));
    }

    this.list.replaceChildren(frag);
    if (!this.options.length) {
      const empty = document.createElement('li');
      empty.className = 'picker-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = t('noResults');
      this.list.append(empty);
    }
    this.setActive(this.options.length ? 0 : -1, false);
  }

  option(code, isFav, locale) {
    const info = currencyInfo(code, locale);
    const li = document.createElement('li');
    li.className = 'option';
    li.id = `opt-${code}-${this.options.length}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(code === this.selected));
    li.dataset.code = code;
    li.innerHTML = `<span class="flag" aria-hidden="true"></span>
      <span class="opt-text"><span class="opt-code"></span><span class="opt-name"></span></span>
      <span class="star${isFav ? ' on' : ''}" data-star title="">${STAR_SVG}</span>`;
    li.querySelector('.flag').textContent = info.flag;
    li.querySelector('.opt-code').textContent = code;
    li.querySelector('.opt-name').textContent = info.name;
    const star = li.querySelector('.star');
    star.title = t(isFav ? 'removeFavorite' : 'addFavorite', { code });
    li.setAttribute('aria-label', `${code}, ${info.name}${isFav ? ' ★' : ''}`);
    this.options.push(li);
    return li;
  }

  /**
   * @param {number} index
   * @param {boolean} scroll
   */
  setActive(index, scroll = true) {
    this.options[this.active]?.classList.remove('active');
    this.active = index;
    const el = this.options[index];
    if (!el) {
      this.search.removeAttribute('aria-activedescendant');
      return;
    }
    el.classList.add('active');
    this.search.setAttribute('aria-activedescendant', el.id);
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  /** @param {KeyboardEvent} e */
  onKey(e) {
    const n = this.options.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) this.setActive((this.active + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.setActive((this.active - 1 + n) % n);
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      this.setActive(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault();
      this.setActive(n - 1);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      this.setActive(Math.min(n - 1, this.active + 8));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      this.setActive(Math.max(0, this.active - 8));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const el = this.options[this.active];
      if (el) this.close(el.dataset.code);
    } else if ((e.key === 'f' || e.key === 'F' || e.code === 'KeyF') && e.altKey) {
      e.preventDefault();
      const el = this.options[this.active];
      if (el) this.toggleFav(el.dataset.code);
    }
  }

  /** @param {MouseEvent} e */
  onClick(e) {
    const opt = e.target.closest('[role="option"]');
    if (!opt) return;
    if (e.target.closest('[data-star]')) {
      this.toggleFav(opt.dataset.code);
      return;
    }
    this.close(opt.dataset.code);
  }

  toggleFav(code) {
    this.deps.toggleFavorite(code);
    const keep = this.options[this.active]?.dataset.code;
    const scrollTop = this.list.scrollTop;
    this.render();
    this.list.scrollTop = scrollTop;
    const idx = this.options.findIndex((o) => o.dataset.code === keep);
    if (idx >= 0) this.setActive(idx, false);
    const star = this.options[idx]?.querySelector('.star');
    if (star) {
      star.classList.add('pop');
      setTimeout(() => star.classList.remove('pop'), 200);
    }
    const isFav = this.deps.getFavorites().includes(code);
    toast(t(isFav ? 'addFavorite' : 'removeFavorite', { code }).replace(/^./, (c) => c.toUpperCase()));
  }
}
