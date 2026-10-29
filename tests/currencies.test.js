import { describe, it, expect } from 'vitest';
import { flagEmoji, currencyForLocale, searchCurrencies, currencyInfo } from '../js/currencies.js';

describe('currencies', () => {
  it('builds flag emoji', () => {
    expect(flagEmoji('MZ')).toBe('🇲🇿');
    expect(flagEmoji(undefined)).toBe('🌐');
  });

  it('maps locales to currencies', () => {
    expect(currencyForLocale('pt-MZ')).toBe('MZN');
    expect(currencyForLocale('en-ZA')).toBe('ZAR');
    expect(currencyForLocale('pt-PT')).toBe('EUR');
    expect(currencyForLocale('en-US')).toBe('USD');
    expect(currencyForLocale('en')).toBeNull();
  });

  it('searches by code, name and country, accent-insensitively', () => {
    const codes = ['USD', 'MZN', 'ZAR', 'EUR', 'AOA'];
    expect(searchCurrencies(codes, 'mzn', 'en')[0]).toBe('MZN');
    expect(searchCurrencies(codes, 'metical', 'pt-MZ')).toContain('MZN');
    expect(searchCurrencies(codes, 'mocambique', 'pt-MZ')).toContain('MZN');
    expect(searchCurrencies(codes, 'south africa', 'en')).toContain('ZAR');
    expect(searchCurrencies(codes, 'zzzz', 'en')).toEqual([]);
  });

  it('localises names', () => {
    expect(currencyInfo('USD', 'en').name).toMatch(/dollar/i);
    expect(currencyInfo('USD', 'pt-MZ').name).toMatch(/dólar/i);
  });
});
