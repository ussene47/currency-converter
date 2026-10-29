/**
 * Currency metadata: ISO 4217 code → ISO 3166 region(s) where it is used.
 * Names are not hard-coded: they are resolved at runtime with Intl.DisplayNames,
 * so they appear correctly in Portuguese and English with zero extra bytes.
 * The first region is used for the flag.
 */
export const CURRENCY_REGIONS = {
  AED: ['AE'], AFN: ['AF'], ALL: ['AL'], AMD: ['AM'], ANG: ['CW', 'SX'], AOA: ['AO'],
  ARS: ['AR'], AUD: ['AU', 'NR', 'KI', 'TV'], AWG: ['AW'], AZN: ['AZ'], BAM: ['BA'],
  BBD: ['BB'], BDT: ['BD'], BGN: ['BG'], BHD: ['BH'], BIF: ['BI'], BMD: ['BM'],
  BND: ['BN'], BOB: ['BO'], BRL: ['BR'], BSD: ['BS'], BTN: ['BT'], BWP: ['BW'],
  BYN: ['BY'], BZD: ['BZ'], CAD: ['CA'], CDF: ['CD'], CHF: ['CH', 'LI'], CLP: ['CL'],
  CNY: ['CN'], COP: ['CO'], CRC: ['CR'], CUP: ['CU'], CVE: ['CV'], CZK: ['CZ'],
  DJF: ['DJ'], DKK: ['DK', 'GL', 'FO'], DOP: ['DO'], DZD: ['DZ'], EGP: ['EG'], ERN: ['ER'],
  ETB: ['ET'], EUR: ['EU', 'PT', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'IE', 'AT', 'FI', 'GR'],
  FJD: ['FJ'], FKP: ['FK'], FOK: ['FO'], GBP: ['GB'], GEL: ['GE'], GGP: ['GG'], GHS: ['GH'],
  GIP: ['GI'], GMD: ['GM'], GNF: ['GN'], GTQ: ['GT'], GYD: ['GY'], HKD: ['HK'], HNL: ['HN'],
  HRK: ['HR'], HTG: ['HT'], HUF: ['HU'], IDR: ['ID'], ILS: ['IL', 'PS'], IMP: ['IM'],
  INR: ['IN'], IQD: ['IQ'], IRR: ['IR'], ISK: ['IS'], JEP: ['JE'], JMD: ['JM'], JOD: ['JO'],
  JPY: ['JP'], KES: ['KE'], KGS: ['KG'], KHR: ['KH'], KID: ['KI'], KMF: ['KM'], KRW: ['KR'],
  KWD: ['KW'], KYD: ['KY'], KZT: ['KZ'], LAK: ['LA'], LBP: ['LB'], LKR: ['LK'], LRD: ['LR'],
  LSL: ['LS'], LYD: ['LY'], MAD: ['MA', 'EH'], MDL: ['MD'], MGA: ['MG'], MKD: ['MK'],
  MMK: ['MM'], MNT: ['MN'], MOP: ['MO'], MRU: ['MR'], MUR: ['MU'], MVR: ['MV'], MWK: ['MW'],
  MXN: ['MX'], MYR: ['MY'], MZN: ['MZ'], NAD: ['NA'], NGN: ['NG'], NIO: ['NI'],
  NOK: ['NO', 'SJ'], NPR: ['NP'], NZD: ['NZ', 'CK', 'NU', 'PN'], OMR: ['OM'], PAB: ['PA'],
  PEN: ['PE'], PGK: ['PG'], PHP: ['PH'], PKR: ['PK'], PLN: ['PL'], PYG: ['PY'], QAR: ['QA'],
  RON: ['RO'], RSD: ['RS'], RUB: ['RU'], RWF: ['RW'], SAR: ['SA'], SBD: ['SB'], SCR: ['SC'],
  SDG: ['SD'], SEK: ['SE'], SGD: ['SG'], SHP: ['SH'], SLE: ['SL'], SLL: ['SL'], SOS: ['SO'],
  SRD: ['SR'], SSP: ['SS'], STN: ['ST'], SYP: ['SY'], SZL: ['SZ'], THB: ['TH'], TJS: ['TJ'],
  TMT: ['TM'], TND: ['TN'], TOP: ['TO'], TRY: ['TR'], TTD: ['TT'], TVD: ['TV'], TWD: ['TW'],
  TZS: ['TZ'], UAH: ['UA'], UGX: ['UG'],
  USD: ['US', 'EC', 'SV', 'PA', 'TL', 'ZW', 'PR', 'FM', 'MH', 'PW'],
  UYU: ['UY'], UZS: ['UZ'], VES: ['VE'], VND: ['VN'], VUV: ['VU'], WST: ['WS'],
  XAF: ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'], XCD: ['AG', 'DM', 'GD', 'KN', 'LC', 'VC', 'AI', 'MS'],
  XDR: [], XOF: ['SN', 'CI', 'BJ', 'BF', 'ML', 'NE', 'TG', 'GW'], XPF: ['PF', 'NC', 'WF'],
  YER: ['YE'], ZAR: ['ZA', 'LS', 'NA', 'SZ'], ZMW: ['ZM'], ZWL: ['ZW'], ZWG: ['ZW'],
};

/** Shown at the top of the picker when the user has no favourites yet. */
export const POPULAR = ['USD', 'MZN', 'ZAR', 'EUR', 'GBP', 'CNY', 'BRL', 'AOA'];

/**
 * Turn an ISO 3166 region code into its emoji flag.
 * @param {string} region two-letter region code ("MZ")
 * @returns {string} emoji flag, or a neutral globe when unknown
 */
export function flagEmoji(region) {
  if (!region || !/^[A-Z]{2}$/.test(region)) return '🌐';
  return String.fromCodePoint(...[...region].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const nameCache = new Map();

/**
 * Localised display data for a currency.
 * @param {string} code ISO 4217 code
 * @param {string} locale UI locale ("pt-MZ" | "en")
 * @returns {{code: string, name: string, flag: string, countries: string[]}}
 */
export function currencyInfo(code, locale) {
  const key = `${locale}:${code}`;
  if (nameCache.has(key)) return nameCache.get(key);
  const regions = CURRENCY_REGIONS[code] || [];
  let name = code;
  let countries = [];
  try {
    name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code) || code;
    name = name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
    const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
    countries = regions.map((r) => {
      try { return regionNames.of(r); } catch { return r; }
    });
  } catch {
    /* very old browsers: fall back to the bare code */
  }
  const info = { code, name, flag: flagEmoji(regions[0]), countries };
  nameCache.set(key, info);
  return info;
}

/**
 * Guess the user's local currency from a BCP 47 locale ("en-ZA" → "ZAR").
 * @param {string} locale
 * @returns {string|null}
 */
export function currencyForLocale(locale) {
  const match = /[-_]([A-Za-z]{2})\b/.exec(locale || '');
  if (!match) return null;
  const region = match[1].toUpperCase();
  for (const [code, regions] of Object.entries(CURRENCY_REGIONS)) {
    if (regions[0] === region) return code;
  }
  for (const [code, regions] of Object.entries(CURRENCY_REGIONS)) {
    if (regions.includes(region)) return code;
  }
  return null;
}

/**
 * Case- and accent-insensitive search over code, name and countries.
 * @param {string[]} codes available codes
 * @param {string} query user text
 * @param {string} locale
 * @returns {string[]} matching codes, best matches first
 */
export function searchCurrencies(codes, query, locale) {
  const q = normalise(query);
  if (!q) return codes;
  const scored = [];
  for (const code of codes) {
    const info = currencyInfo(code, locale);
    const c = code.toLowerCase();
    let score = -1;
    if (c === q) score = 0;
    else if (c.startsWith(q)) score = 1;
    else if (normalise(info.name).startsWith(q)) score = 2;
    else if (normalise(info.name).includes(q)) score = 3;
    else if (info.countries.some((n) => normalise(n).includes(q))) score = 4;
    if (score >= 0) scored.push([score, code]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).map((s) => s[1]);
}

function normalise(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
