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
// US and Canada share the +1 code, so one default parses a national number for both
const DEFAULT_PHONE_COUNTRY = 'US';
const CURRENCY = /^-?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/;

// A US ZIP or ZIP+4, or a Canadian postal code. Mirrors engyj-document's lib/zipCode.ts and App\Support\ZipCode.
const US_ZIP = /^\d{5}(-\d{4})?$/;
const CA_POSTAL = /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]) ?(\d[ABCEGHJ-NPRSTV-Z]\d)$/i;
const ZIP_ERROR = 'Enter a valid ZIP or postal code, e.g. 12345 or A1A 1A1.';
const CARD_INVALID = 'Enter a valid card number.';
const CARD_MISTYPED = 'Check the card number, it looks mistyped.';

const DEFAULT_FORMATS = {
  date: 'yyyy-MM-dd',
  time: 'HH:mm',
  datetime: 'yyyy-MM-dd HH:mm',
} as const;

const parseDate = (value: string, format: string) => DateTime.fromFormat(value, format, { locale: 'en-US' });

const normalisePhone = (value: string, meta: TTextFieldMeta): NormalisedTextValue => {
  const withPlus = value.replace(/^00/, '+');
  const phone = parsePhoneNumberFromString(
    withPlus,
    (meta.defaultCountry?.toUpperCase() || DEFAULT_PHONE_COUNTRY) as never,
  );

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

const normaliseZip = (value: string): NormalisedTextValue => {
  if (US_ZIP.test(value)) {
    return { ok: true, value };
  }

  const postal = CA_POSTAL.exec(value);

  return postal ? { ok: true, value: `${postal[1]} ${postal[2]}`.toUpperCase() } : { ok: false, error: ZIP_ERROR };
};

// The lengths a card brand's numbers come in, from its first digits; null for a brand we don't know.
// Mirrors engyj-document's lib/cardNumber.ts and App\Support\CardNumber.
const cardBrandLengths = (digits: string): number[] | null => {
  const four = Number(digits.slice(0, 4));

  if (/^3[47]/.test(digits)) {
    return [15];
  }

  if (digits.startsWith('4')) {
    return [13, 16, 19];
  }

  if (/^5[1-5]/.test(digits) || (four >= 2221 && four <= 2720)) {
    return [16];
  }

  if (/^(6011|65)/.test(digits)) {
    return [16, 17, 18, 19];
  }

  return null;
};

const passesLuhn = (digits: string): boolean => {
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);

    if (i % 2 === 1) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum % 10 === 0;
};

const normaliseCardNumber = (value: string): NormalisedTextValue => {
  const digits = value.replace(/[\s-]/g, '');

  // No card number starts with 0 (and an all-zero number would pass Luhn)
  if (!/^[1-9]\d{12,18}$/.test(digits)) {
    return { ok: false, error: CARD_INVALID };
  }

  const lengths = cardBrandLengths(digits);

  if (lengths && !lengths.includes(digits.length)) {
    return { ok: false, error: CARD_INVALID };
  }

  return passesLuhn(digits) ? { ok: true, value: digits } : { ok: false, error: CARD_MISTYPED };
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
    case 'zip':
      return normaliseZip(value);
    case 'credit_card':
      return normaliseCardNumber(value);
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
