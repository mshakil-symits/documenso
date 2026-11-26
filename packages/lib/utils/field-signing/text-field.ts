import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { VALID_DATE_FORMAT_VALUES } from '../../constants/date-formats';
import type { TTextFieldInputKind, TTextFieldMeta } from '../../types/field-meta';

export type TextInputType = 'textarea' | 'text' | 'email' | 'tel' | 'date' | 'time';

/** A card number's digits grouped as printed on the card: 4-6-5 for Amex, otherwise in fours. Other text is left as is. */
const groupCardNumber = (value: string): string => {
  if (!/^\d+$/.test(value)) {
    return value;
  }

  const groups = /^3[47]/.test(value) ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const parts: string[] = [];
  let at = 0;

  for (const size of groups) {
    if (at >= value.length) {
      break;
    }

    parts.push(value.slice(at, at + size));
    at += size;
  }

  if (at < value.length) {
    parts.push(value.slice(at));
  }

  return parts.join(' ');
};

/** What a stored TEXT value looks like to people: a phone number in international format, a card number grouped, anything else as is. */
export const formatTextForDisplay = (value: string, meta: TTextFieldMeta): string => {
  if (meta.inputKind === 'credit_card') {
    return groupCardNumber(value);
  }

  if (meta.inputKind !== 'phone') {
    return value;
  }

  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
};

/**
 * The input the signing dialog shows: the browser's own email, tel, date and time inputs where they give back
 * exactly what is stored (a date only in yyyy-MM-dd, a time only in HH:mm), a text box for the other kinds, and the
 * textarea of a plain or multiline field.
 */
export const textInputTypeFor = (meta: TTextFieldMeta): TextInputType => {
  if (meta.multiline || !meta.inputKind || meta.inputKind === 'text') {
    return 'textarea';
  }

  switch (meta.inputKind) {
    case 'email':
      return 'email';
    case 'phone':
      return 'tel';
    case 'date':
      return !meta.dateFormat || meta.dateFormat === 'yyyy-MM-dd' ? 'date' : 'text';
    case 'time':
      return !meta.dateFormat || meta.dateFormat === 'HH:mm' ? 'time' : 'text';
    default:
      return 'text';
  }
};

/** The messages of validateTextField, sorted for the dialog: required, character limit, and every other (format) one. */
export const splitTextFieldErrors = (errors: string[]) => ({
  required: errors.filter((error) => error.includes('required')),
  characterLimit: errors.filter((error) => error.includes('character limit')),
  format: errors.filter((error) => !error.includes('required') && !error.includes('character limit')),
});

const hasTimeToken = (format: string) => /h|H/.test(format);

/** The formats an author may pick for a date, time or datetime field, from Documenso's own list. */
export const dateFormatsFor = (kind: TTextFieldInputKind | undefined): string[] => {
  if (kind === 'time') {
    return ['HH:mm', 'hh:mm a'];
  }

  const all: string[] = [...VALID_DATE_FORMAT_VALUES];

  return all.filter((format) => (kind === 'datetime' ? hasTimeToken(format) : !hasTimeToken(format)));
};
