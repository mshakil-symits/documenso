import { describe, expect, it } from 'vitest';

import type { TTextFieldMeta } from '../types/field-meta';
import { isSafeRegex, normaliseTextValue, textFieldValueToStore } from './text-kinds';

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

  it('does not count zero-width characters as content in a typed field', () => {
    expect(ok('\u200b\u200b', { inputKind: 'email' })).toBe('');
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

    it('takes country codes in any case', () => {
      expect(ok('(415) 555-2671', { inputKind: 'phone', defaultCountry: 'us' as never })).toBe('+14155552671');
      expect(ok('+1 415 555 2671', { inputKind: 'phone', allowedCountries: ['us'] as never })).toBe('+14155552671');
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

    it('refuses to run a pattern against a very long value', () => {
      expect(fails('1'.repeat(501), { pattern: '\\d+' })).toBe(true);
    });

    it('applies a pattern on any kind', () => {
      expect(fails('a@b.com', { inputKind: 'email', pattern: '.*@corp\\.com' })).toBe(true);
    });
  });
});

describe('isSafeRegex catastrophic shapes', () => {
  it.each([
    '((a+))+',
    '(a{1,})+',
    '(\\d{1,3},?)+',
    '([A-Za-z]{1,20}\\s?)+',
    '(\\w?\\w?)+',
    'a*a*a*a*a*a*b',
    '.*.*.*.*=',
    '(a)\\1',
    '(?=a)a',
    '(?<=a)b',
  ])('rejects %s', (pattern) => {
    expect(isSafeRegex(pattern)).toBe(false);
  });

  it.each([
    '\\d{3}-\\d{2}-\\d{4}',
    '(\\d{3})?-\\d{4}',
    '[A-Za-z ]{1,50}',
    '(Mr|Mrs)\\.? [A-Z][a-z]+',
    '^\\+?\\d{7,15}$',
  ])('accepts %s', (pattern) => {
    expect(isSafeRegex(pattern)).toBe(true);
  });
});

describe('value length cap', () => {
  it('rejects an overlong email without running the email check on it', () => {
    const result = normaliseTextValue(`a@${'.'.repeat(50000)}@`, { inputKind: 'email' } as never);

    expect(result.ok).toBe(false);
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

  it('rejects alternation inside a repeated group', () => {
    expect(isSafeRegex('(a|a)*b')).toBe(false);
    expect(isSafeRegex('(x|xy)+z')).toBe(false);
  });

  it('rejects a counted repeat applied to a group', () => {
    expect(isSafeRegex('(\\d+){2,}x')).toBe(false);
    expect(isSafeRegex('(ab){3}')).toBe(false);
  });

  it('still accepts counted repeats on a single token', () => {
    expect(isSafeRegex('\\d{3}-[A-Z]{2}')).toBe(true);
  });

  it('still accepts alternation that is not repeated', () => {
    expect(isSafeRegex('(Mr|Mrs)\\.? [A-Z][a-z]+')).toBe(true);
  });

  it('rejects a pattern over 200 characters', () => {
    expect(isSafeRegex('a'.repeat(201))).toBe(false);
  });
});

describe('textFieldValueToStore', () => {
  it('returns the normalised value', () => {
    expect(textFieldValueToStore('+1 (415) 555-2671', meta({ inputKind: 'phone' }))).toBe('+14155552671');
    expect(textFieldValueToStore(' A@B.com ', meta({ inputKind: 'email' }))).toBe('a@b.com');
  });

  it('throws the validation message for a bad value', () => {
    expect(() => textFieldValueToStore('nope', meta({ inputKind: 'email' }))).toThrow('Enter a valid email address');
  });

  it('leaves a plain field untouched, spaces included', () => {
    expect(textFieldValueToStore('  keep  ', meta({}))).toBe('  keep  ');
  });
});
