import { describe, it, expect } from 'vitest';
import {
  parseAmount, convert, pairRate, fractionDigitsFor, roundMoney, formatNumber,
  seriesStats, sampleDates,
} from '../js/utils.js';

describe('parseAmount', () => {
  it.each([
    ['100', 100],
    ['1,500.50', 1500.5],
    ['1.500,50', 1500.5],
    ['1 500,50', 1500.5],
    ['1 500,50', 1500.5],
    ['1,000,000', 1000000],
    ['1.000.000', 1000000],
    ['0,5', 0.5],
    ['.75', 0.75],
    ['$ 20', 20],
    ['20 MZN', 20],
    ["1'250.5", 1250.5],
    ['+15', 15],
  ])('parses %j', (input, expected) => {
    expect(parseAmount(input, 'en')).toBeCloseTo(expected, 10);
  });

  it('uses the locale for an ambiguous single separator', () => {
    expect(parseAmount('1,500', 'en')).toBe(1500);
    expect(parseAmount('1,500', 'pt-MZ')).toBe(1.5);
    expect(parseAmount('1.500', 'pt-MZ')).toBe(1500);
    expect(parseAmount('1.500', 'en')).toBe(1.5);
  });

  it.each(['', '   ', 'abc', '-5', '1,2,3', '1.5.5', '1-2', null, undefined])(
    'rejects %j',
    (input) => {
      expect(parseAmount(input, 'en')).toBeNull();
    },
  );
});

describe('convert', () => {
  const rates = { USD: 1, MZN: 63.9, ZAR: 18.5, EUR: 0.92 };

  it('converts through the common base', () => {
    expect(convert(100, 'USD', 'MZN', rates)).toBeCloseTo(6390, 6);
    expect(convert(6390, 'MZN', 'USD', rates)).toBeCloseTo(100, 6);
    expect(convert(100, 'ZAR', 'MZN', rates)).toBeCloseTo((100 / 18.5) * 63.9, 8);
  });

  it('returns the amount for the same currency', () => {
    expect(convert(42, 'EUR', 'EUR', rates)).toBe(42);
  });

  it('returns null for missing or invalid rates', () => {
    expect(convert(1, 'USD', 'XYZ', rates)).toBeNull();
    expect(convert(1, 'USD', 'MZN', { USD: 1, MZN: 0 })).toBeNull();
    expect(convert(NaN, 'USD', 'MZN', rates)).toBeNull();
    expect(convert(1, 'USD', 'MZN', null)).toBeNull();
  });

  it('rate and inverse multiply to 1', () => {
    expect(pairRate('USD', 'MZN', rates) * pairRate('MZN', 'USD', rates)).toBeCloseTo(1, 12);
  });
});

describe('precision and rounding', () => {
  it('keeps 2 digits for normal values and more for tiny ones', () => {
    expect(fractionDigitsFor(63.9)).toBe(2);
    expect(fractionDigitsFor(1)).toBe(2);
    expect(fractionDigitsFor(0.5)).toBe(4);
    expect(fractionDigitsFor(0.01565)).toBe(5);
    expect(fractionDigitsFor(0.00000001)).toBe(8);
  });

  it('rounds half away from zero without float errors', () => {
    expect(roundMoney(1.005, 2)).toBe(1.01);
    expect(roundMoney(2.675, 2)).toBe(2.68);
    expect(roundMoney(-1.005, 2)).toBe(-1.01);
    expect(roundMoney(1e-9, 2)).toBe(0);
  });

  it('formats by locale', () => {
    expect(formatNumber(6390, 'en')).toBe('6,390.00');
    expect(formatNumber(0.015649, 'en')).toBe('0.01565');
    expect(formatNumber(16390.5, 'pt-MZ').replace(/\s/g, ' ')).toBe('16 390,50');
  });
});

describe('history helpers', () => {
  it('computes high, low and change', () => {
    const s = seriesStats([
      { date: '2026-01-01', rate: 60 },
      { date: '2026-01-02', rate: 66 },
      { date: '2026-01-03', rate: 63 },
    ]);
    expect(s).toEqual({ high: 66, low: 60, change: 3, changePct: 5 });
    expect(seriesStats([{ date: 'x', rate: 1 }])).toBeNull();
  });

  it('samples a bounded number of past dates, oldest first', () => {
    const today = new Date('2026-10-29T10:00:00Z');
    const week = sampleDates(7, today, 8);
    expect(week[0]).toBe('2026-10-22');
    expect(week.at(-1)).toBe('2026-10-28');
    const year = sampleDates(365, today, 16);
    expect(year.length).toBeLessThanOrEqual(17);
    expect([...year].sort()).toEqual(year);
    expect(year.at(-1)).toBe('2026-10-28');
  });
});
