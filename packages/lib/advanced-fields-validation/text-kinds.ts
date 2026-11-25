import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DateTime } from 'luxon';

import type { TTextFieldMeta } from '../types/field-meta';

export type NormalisedTextValue = { ok: true; value: string } | { ok: false; error: string };

const MAX_PATTERN_LENGTH = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY = /^-?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/;
// A group that is itself repeated and holds a repeat: the shape of catastrophic backtracking, e.g. (a+)+
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/;

const DEFAULT_FORMATS = {
  date: 'yyyy-MM-dd',
  time: 'HH:mm',
  datetime: 'yyyy-MM-dd HH:mm',
} as const;

/** Whether a pattern is fit to run against a signer's input: short, compiles, and no nested repeats. */
export const isSafeRegex = (pattern: string): boolean => {
  if (pattern.length > MAX_PATTERN_LENGTH || NESTED_QUANTIFIER.test(pattern)) {
    return false;
  }

  try {
    new RegExp(`^(?:${pattern})$`);

    return true;
  } catch {
    return false;
  }
};

const parseDate = (value: string, format: string) => DateTime.fromFormat(value, format, { locale: 'en-US' });

const normalisePhone = (value: string, meta: TTextFieldMeta): NormalisedTextValue => {
  const withPlus = value.replace(/^00/, '+');
  const phone = parsePhoneNumberFromString(withPlus, meta.defaultCountry as never);

  if (!phone?.isValid()) {
    return { ok: false, error: 'Enter a valid phone number, including the country code' };
  }

  if (meta.allowedCountries?.length && (!phone.country || !meta.allowedCountries.includes(phone.country))) {
    return { ok: false, error: 'This phone number is not from an accepted country' };
  }

  return { ok: true, value: phone.number };
};

const normaliseDate = (
  value: string,
  meta: TTextFieldMeta,
  kind: 'date' | 'time' | 'datetime',
): NormalisedTextValue => {
  const format = meta.dateFormat || DEFAULT_FORMATS[kind];
  const parsed = parseDate(value, format);

  if (!parsed.isValid) {
    return { ok: false, error: `Enter a valid ${kind === 'time' ? 'time' : 'date'} as ${format}` };
  }

  const min = meta.minDate ? DateTime.fromISO(meta.minDate) : null;
  const max = meta.maxDate ? DateTime.fromISO(meta.maxDate) : null;

  if (kind !== 'time' && min?.isValid && parsed.startOf('day') < min.startOf('day')) {
    return { ok: false, error: `The date must be on or after ${meta.minDate}` };
  }

  if (kind !== 'time' && max?.isValid && parsed.startOf('day') > max.startOf('day')) {
    return { ok: false, error: `The date must be on or before ${meta.maxDate}` };
  }

  return { ok: true, value };
};

const applyKind = (value: string, meta: TTextFieldMeta): NormalisedTextValue => {
  switch (meta.inputKind) {
    case 'email':
      return EMAIL.test(value)
        ? { ok: true, value: value.toLowerCase() }
        : { ok: false, error: 'Enter a valid email address' };
    case 'phone':
      return normalisePhone(value, meta);
    case 'date':
    case 'time':
    case 'datetime':
      return normaliseDate(value, meta, meta.inputKind);
    case 'currency':
      return CURRENCY.test(value)
        ? { ok: true, value: value.replace(/,/g, '') }
        : { ok: false, error: 'Enter an amount like 1234.50' };
    default:
      return { ok: true, value };
  }
};

/**
 * What a TEXT field's value becomes, or why it is not acceptable: trimmed, checked for its input kind and
 * pattern, and normalised for storage (email lower-cased, phone E.164, currency without commas). An empty value
 * is always fine here; whether it is required is the caller's business.
 */
export const normaliseTextValue = (rawValue: string, meta: TTextFieldMeta): NormalisedTextValue => {
  const value = rawValue.trim();

  if (value === '') {
    return { ok: true, value: '' };
  }

  const result = applyKind(value, meta);

  if (!result.ok) {
    return result;
  }

  if (meta.pattern || meta.inputKind === 'pattern') {
    const pattern = meta.pattern ?? '';

    if (!pattern || !isSafeRegex(pattern) || !new RegExp(`^(?:${pattern})$`).test(value)) {
      return { ok: false, error: meta.patternMessage || 'The value does not match the required format' };
    }
  }

  return result;
};
