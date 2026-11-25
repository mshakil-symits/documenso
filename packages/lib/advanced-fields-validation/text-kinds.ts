import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DateTime } from 'luxon';

import type { TTextFieldMeta } from '../types/field-meta';
import { isSafeRegex } from '../utils/safe-regex';

export { isSafeRegex };

export type NormalisedTextValue = { ok: true; value: string } | { ok: false; error: string };

const MAX_PATTERNED_VALUE_LENGTH = 500;
// Zero-width and invisible filler characters: they make a value look empty, so they are not content
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u3164]/g;
// Linear check (a single @, no whitespace, a dot inside the domain), not a regex that can backtrack
const isEmail = (value: string): boolean => {
  const at = value.indexOf('@');

  if (at < 1 || at !== value.lastIndexOf('@') || /\s/.test(value)) {
    return false;
  }

  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');

  return dot > 0 && dot < domain.length - 1;
};
const CURRENCY = /^-?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/;

const DEFAULT_FORMATS = {
  date: 'yyyy-MM-dd',
  time: 'HH:mm',
  datetime: 'yyyy-MM-dd HH:mm',
} as const;

const parseDate = (value: string, format: string) => DateTime.fromFormat(value, format, { locale: 'en-US' });

const normalisePhone = (value: string, meta: TTextFieldMeta): NormalisedTextValue => {
  const withPlus = value.replace(/^00/, '+');
  const phone = parsePhoneNumberFromString(withPlus, (meta.defaultCountry?.toUpperCase() || undefined) as never);

  if (!phone?.isValid()) {
    return { ok: false, error: 'Enter a valid phone number, including the country code' };
  }

  if (
    meta.allowedCountries?.length &&
    (!phone.country || !meta.allowedCountries.map((code) => code.toUpperCase()).includes(phone.country))
  ) {
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
      return isEmail(value)
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
  const value = rawValue.replace(INVISIBLE, '').trim();

  if (value === '') {
    return { ok: true, value: '' };
  }

  // Every typed kind and pattern is checked against a bounded value; a plain text field is not limited here
  const isTyped = (meta.inputKind && meta.inputKind !== 'text') || meta.pattern;

  if (isTyped && value.length > MAX_PATTERNED_VALUE_LENGTH) {
    return { ok: false, error: 'The value is too long' };
  }

  const result = applyKind(value, meta);

  if (!result.ok) {
    return result;
  }

  if (meta.pattern || meta.inputKind === 'pattern') {
    const pattern = meta.pattern ?? '';

    if (
      !pattern ||
      value.length > MAX_PATTERNED_VALUE_LENGTH ||
      !isSafeRegex(pattern) ||
      !new RegExp(`^(?:${pattern})$`).test(value)
    ) {
      return { ok: false, error: meta.patternMessage || 'The value does not match the required format' };
    }
  }

  return result;
};

/**
 * The value to store for a signed TEXT field: normalised per its input kind (see normaliseTextValue), or the
 * value exactly as typed for a plain field, as before. Throws the validation message when it is not acceptable.
 */
export const textFieldValueToStore = (value: string, meta: TTextFieldMeta): string => {
  if ((!meta.inputKind || meta.inputKind === 'text') && !meta.pattern) {
    return value;
  }

  const result = normaliseTextValue(value, meta);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.value;
};

export const withoutInvisibleCharacters = (value: string): string => value.replace(INVISIBLE, '');
