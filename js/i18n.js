/**
 * Every user-facing string, in Portuguese (Mozambique) and English.
 * Placeholders use {name} and are filled by t().
 */
export const LOCALES = { pt: 'pt-MZ', en: 'en' };

export const STRINGS = {
  pt: {
    appTitle: 'Conversor de Moedas',
    tagline: 'Câmbio ao vivo para mais de 160 moedas',
    amount: 'Valor',
    from: 'De',
    to: 'Para',
    swap: 'Trocar moedas',
    chooseCurrency: 'Escolher moeda',
    rateLine: '1 {from} = {rate} {to}',
    updated: 'Actualizado {time}',
    ratesBy: 'Taxas por',
    offlineBanner: 'Sem ligação: taxas de {time}',
    staleBanner: 'Não foi possível actualizar. A mostrar taxas de {time}',
    rateLimited: 'Demasiados pedidos. A mostrar taxas guardadas; tente de novo daqui a pouco.',
    loading: 'A carregar taxas…',
    retry: 'Tentar de novo',
    errorInvalid: 'Introduza um número válido, por exemplo 1.500,50',
    errorEmpty: 'Introduza um valor para converter',
    errorNoData: 'Não foi possível carregar as taxas. Verifique a ligação à internet.',
    errorServer: 'O serviço de câmbio não está disponível agora.',
    errorMissing: 'Não há taxa disponível para {code}.',
    copy: 'Copiar resultado',
    copied: 'Copiado para a área de transferência',
    copyFailed: 'Não foi possível copiar',
    share: 'Partilhar',
    linkCopied: 'Ligação copiada',
    shareText: '{amount} {from} = {result} {to}',
    multiTitle: 'Várias moedas',
    multiHint: 'Converta o mesmo valor para várias moedas de uma vez.',
    addCurrency: 'Adicionar moeda',
    remove: 'Remover {code}',
    favorites: 'Favoritas',
    popular: 'Populares',
    allCurrencies: 'Todas as moedas',
    addFavorite: 'Adicionar {code} às favoritas',
    removeFavorite: 'Remover {code} das favoritas',
    searchPlaceholder: 'Pesquisar código, nome ou país',
    noResults: 'Nenhuma moeda encontrada',
    close: 'Fechar',
    historyTitle: 'Conversões recentes',
    clearHistory: 'Limpar tudo',
    historyEmpty: 'As suas conversões aparecem aqui.',
    reuse: 'Usar novamente: {text}',
    chartTitle: 'Histórico da taxa',
    high: 'Máxima',
    low: 'Mínima',
    change: 'Variação',
    chartLoading: 'A carregar histórico…',
    chartError: 'Histórico indisponível de momento.',
    chartOffline: 'O histórico precisa de ligação à internet.',
    chartSameCurrency: 'Escolha duas moedas diferentes para ver o histórico.',
    themeToDark: 'Mudar para tema escuro',
    themeToLight: 'Mudar para tema claro',
    language: 'Idioma',
    shortcuts: 'Atalhos: S trocar · / pesquisar · Esc fechar',
    tabConvert: 'Converter',
    tabMulti: 'Várias',
    justNow: 'agora mesmo',
    footer: 'Feito em Moçambique',
    favHint: 'Alt+F: marcar como favorita',
    skipLink: 'Saltar para o conversor',
  },
  en: {
    appTitle: 'Currency Converter',
    tagline: 'Live exchange rates for 160+ currencies',
    amount: 'Amount',
    from: 'From',
    to: 'To',
    swap: 'Swap currencies',
    chooseCurrency: 'Choose currency',
    rateLine: '1 {from} = {rate} {to}',
    updated: 'Updated {time}',
    ratesBy: 'Rates by',
    offlineBanner: 'Offline: rates from {time}',
    staleBanner: "Couldn't refresh. Showing rates from {time}",
    rateLimited: 'Too many requests. Showing saved rates; try again shortly.',
    loading: 'Loading rates…',
    retry: 'Try again',
    errorInvalid: 'Enter a valid number, for example 1,500.50',
    errorEmpty: 'Enter an amount to convert',
    errorNoData: "Couldn't load exchange rates. Check your internet connection.",
    errorServer: 'The exchange rate service is unavailable right now.',
    errorMissing: 'No rate available for {code}.',
    copy: 'Copy result',
    copied: 'Copied to clipboard',
    copyFailed: "Couldn't copy",
    share: 'Share',
    linkCopied: 'Link copied',
    shareText: '{amount} {from} = {result} {to}',
    multiTitle: 'Multiple currencies',
    multiHint: 'Convert one amount into several currencies at once.',
    addCurrency: 'Add currency',
    remove: 'Remove {code}',
    favorites: 'Favourites',
    popular: 'Popular',
    allCurrencies: 'All currencies',
    addFavorite: 'Add {code} to favourites',
    removeFavorite: 'Remove {code} from favourites',
    searchPlaceholder: 'Search code, name or country',
    noResults: 'No currencies found',
    close: 'Close',
    historyTitle: 'Recent conversions',
    clearHistory: 'Clear all',
    historyEmpty: 'Your conversions will appear here.',
    reuse: 'Use again: {text}',
    chartTitle: 'Rate history',
    high: 'High',
    low: 'Low',
    change: 'Change',
    chartLoading: 'Loading history…',
    chartError: 'History is unavailable right now.',
    chartOffline: 'Rate history needs an internet connection.',
    chartSameCurrency: 'Pick two different currencies to see their history.',
    themeToDark: 'Switch to dark theme',
    themeToLight: 'Switch to light theme',
    language: 'Language',
    shortcuts: 'Shortcuts: S swap · / search · Esc close',
    tabConvert: 'Convert',
    tabMulti: 'Multi',
    justNow: 'just now',
    footer: 'Made in Mozambique',
    favHint: 'Alt+F: toggle favourite',
    skipLink: 'Skip to converter',
  },
};

let lang = 'en';

/** @param {'pt'|'en'} next */
export function setLanguage(next) {
  lang = STRINGS[next] ? next : 'en';
}

/** @returns {'pt'|'en'} */
export function getLanguage() {
  return lang;
}

/** @returns {string} BCP 47 locale for Intl APIs */
export function getLocale() {
  return LOCALES[lang];
}

/**
 * Pick a starting language from the browser.
 * @param {readonly string[]} [langs]
 * @returns {'pt'|'en'}
 */
export function detectLanguage(langs = globalThis.navigator?.languages || []) {
  return langs.some((l) => /^pt\b/i.test(l)) ? 'pt' : 'en';
}

/**
 * Translate a key, filling {placeholders}.
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const template = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/**
 * Apply translations to static markup: data-i18n (text), data-i18n-attr
 * ("attr:key,attr:key").
 * @param {ParentNode} root
 */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
}

/**
 * Human-friendly date/time for "updated" labels.
 * @param {number} ms epoch
 * @returns {string}
 */
export function formatWhen(ms) {
  const diff = Date.now() - ms;
  if (diff >= 0 && diff < 60 * 1000) return t('justNow');
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
