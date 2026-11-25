import { describe, expect, it } from 'vitest';

import type { TTextFieldMeta } from '../types/field-meta';
import { isSafeRegex, normaliseTextValue } from './text-kinds';

const meta = (extra: Partial<TTextFieldMeta>): TTextFieldMeta => ({ type: 'text', ...extra });

const ok = (value: string, m: Partial<TTextFieldMeta>) => {
  const result = normaliseTextValue(value, meta(m));

  return result.ok ? result.value : `ERROR: ${result.error}`;
};

const fails = (value: string, m: Partial<TTextFieldMeta>) => !normaliseTextValue(value, meta(m)).ok;

describe('normaliseTextValue', () => {
  it('leaves a plain text value alone apart from trimming', () => {
    expect(ok('  hello  ', {})).toBe('hello');
    expect(ok('x', { inputKind: 'text' })).toBe('x');
  });

  it('accepts an empty value for every kind (required is checked elsewhere)', () => {
    for (const inputKind of ['text', 'email', 'phone', 'date', 'time', 'datetime', 'currency', 'pattern'] as const) {
      expect(ok('', { inputKind, pattern: '^a$' })).toBe('');
    }
  });

  describe('email', () => {
    it('trims and lower-cases', () => {
      expect(ok(' A@B.com ', { inputKind: 'email' })).toBe('a@b.com');
    });

    it.each(['nope', 'a@b', '@b.com', 'a b@c.com'])('rejects %s', (value) => {
      expect(fails(value, { inputKind: 'email' })).toBe(true);
    });
  });

  describe('phone', () => {
    it('normalises a pasted national number to E.164 with a default country', () => {
      expect(ok('(415) 555-2671', { inputKind: 'phone', defaultCountry: 'US' })).toBe('+14155552671');
    });

    it('accepts spaces, dashes, brackets and a leading 00', () => {
      expect(ok('+1 (415) 555-2671', { inputKind: 'phone' })).toBe('+14155552671');
      expect(ok('0044 20 7946 0958', { inputKind: 'phone' })).toBe('+442079460958');
    });

    it('rejects a number with no country and no default', () => {
      expect(fails('415 555 2671', { inputKind: 'phone' })).toBe(true);
    });

    it('rejects letters and short numbers', () => {
      expect(fails('abc', { inputKind: 'phone', defaultCountry: 'US' })).toBe(true);
      expect(fails('12345', { inputKind: 'phone', defaultCountry: 'US' })).toBe(true);
    });

    it('rejects a number from a country that is not allowed', () => {
      expect(fails('+44 20 7946 0958', { inputKind: 'phone', allowedCountries: ['US'] })).toBe(true);
      expect(ok('+1 415 555 2671', { inputKind: 'phone', allowedCountries: ['US'] })).toBe('+14155552671');
    });
  });

  describe('date, time and datetime', () => {
    it('defaults to yyyy-MM-dd', () => {
      expect(ok('2026-03-09', { inputKind: 'date' })).toBe('2026-03-09');
      expect(fails('09/03/2026', { inputKind: 'date' })).toBe(true);
    });

    it('uses the field dateFormat', () => {
      expect(ok('09/03/2026', { inputKind: 'date', dateFormat: 'dd/MM/yyyy' })).toBe('09/03/2026');
    });

    it('rejects a date that matches the format text but is not real', () => {
      expect(fails('02/30/2026', { inputKind: 'date', dateFormat: 'MM/dd/yyyy' })).toBe(true);
    });

    it('applies minDate and maxDate', () => {
      const bounds = { inputKind: 'date' as const, minDate: '2026-01-01', maxDate: '2026-12-31' };
      expect(ok('2026-06-01', bounds)).toBe('2026-06-01');
      expect(fails('2025-12-31', bounds)).toBe(true);
      expect(fails('2027-01-01', bounds)).toBe(true);
    });

    it('validates time and datetime with their defaults', () => {
      expect(ok('09:30', { inputKind: 'time' })).toBe('09:30');
      expect(fails('25:00', { inputKind: 'time' })).toBe(true);
      expect(ok('2026-03-09 09:30', { inputKind: 'datetime' })).toBe('2026-03-09 09:30');
      expect(fails('2026-03-09', { inputKind: 'datetime' })).toBe(true);
    });
  });

  describe('currency', () => {
    it('accepts amounts and strips thousands commas', () => {
      expect(ok('1,234.50', { inputKind: 'currency' })).toBe('1234.50');
      expect(ok('-12', { inputKind: 'currency' })).toBe('-12');
    });

    it.each(['12.345', 'abc', '1,23'])('rejects %s', (value) => {
      expect(fails(value, { inputKind: 'currency' })).toBe(true);
    });
  });

  describe('pattern', () => {
    it('matches the whole value only', () => {
      expect(ok('123-45-6789', { inputKind: 'pattern', pattern: '\\d{3}-\\d{2}-\\d{4}' })).toBe('123-45-6789');
      expect(fails('x123-45-6789', { inputKind: 'pattern', pattern: '\\d{3}-\\d{2}-\\d{4}' })).toBe(true);
    });

    it('uses patternMessage as the error', () => {
      expect(ok('abc', { pattern: '\\d+', patternMessage: 'Digits only' })).toBe('ERROR: Digits only');
    });

    it('applies a pattern on any kind', () => {
      expect(fails('a@b.com', { inputKind: 'email', pattern: '.*@corp\\.com' })).toBe(true);
    });
  });
});

describe('isSafeRegex', () => {
  it('accepts ordinary patterns', () => {
    expect(isSafeRegex('^\\d{3}-\\d{2}$')).toBe(true);
    expect(isSafeRegex('[A-Z]{2}\\d+')).toBe(true);
  });

  it('rejects a pattern that does not compile', () => {
    expect(isSafeRegex('(')).toBe(false);
  });

  it('rejects nested quantifiers', () => {
    expect(isSafeRegex('(a+)+$')).toBe(false);
    expect(isSafeRegex('(a*)*')).toBe(false);
  });

  it('rejects a pattern over 200 characters', () => {
    expect(isSafeRegex('a'.repeat(201))).toBe(false);
  });
});
